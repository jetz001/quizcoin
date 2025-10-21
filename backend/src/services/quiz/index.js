// backend/services/quiz.js - Fixed environment variable handling
import dotenv from 'dotenv';
import { 
  storeQuestionToFirestore, 
  storeMerkleLeaf, 
  createBatchDocument, 
  updateBatchProgress 
} from '../database/firebase.js';
import { createAnswerLeaf, finalizeBatch } from './merkle.js';

// Ensure environment variables are loaded
dotenv.config();

// Configuration
const DEFAULT_CONFIG = {
  TOTAL_QUESTIONS: 18,
  SUB_BATCH_SIZE: 9,
  SUB_BATCH_DELAY: 60
};

const TOTAL_QUESTIONS = parseInt(process.env.TOTAL_QUESTIONS || DEFAULT_CONFIG.TOTAL_QUESTIONS.toString(), 10);
const SUB_BATCH_SIZE = parseInt(process.env.SUB_BATCH_SIZE || DEFAULT_CONFIG.SUB_BATCH_SIZE.toString(), 10);
const SUB_BATCH_DELAY = parseInt(process.env.SUB_BATCH_DELAY || DEFAULT_CONFIG.SUB_BATCH_DELAY.toString(), 10);

// Gemini API setup with better error handling
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log(`🔑 Gemini API Key status: ${GEMINI_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
if (GEMINI_API_KEY) {
  console.log(`🔑 Key preview: ${GEMINI_API_KEY.substring(0, 20)}...`);
}

const GEMINI_API_URL = GEMINI_API_KEY ? 
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}` : 
  null;

// Call Gemini API (using global fetch in Node.js 18+)
async function callGemini(prompt) {
  if (!GEMINI_API_KEY || !GEMINI_API_URL) {
    throw new Error("Gemini API key not configured. Please check GEMINI_API_KEY in .env file");
  }

  console.log(`📡 Calling Gemini API...`);
  
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.7, 
        maxOutputTokens: 1000 
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Gemini API Error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Track recent questions to avoid duplicates
const recentQuestions = new Set();
const MAX_RECENT_QUESTIONS = 50;

// Function to randomly select difficulty level
function getRandomDifficultyLevel() {
  const level = Math.floor(Math.random() * 99) + 1; // Random number 1-99
  
  // Determine description based on level
  let description;
  if (level <= 30) {
    description = 'Basic/Easy questions (simple facts, common knowledge)';
  } else if (level <= 60) {
    description = 'Medium questions (requires some thinking or specialized knowledge)';
  } else {
    description = 'Hard questions (complex concepts, advanced knowledge)';
  }
  
  return { level, description };
}

// Generate a single quiz question using AI
export async function generateQuizQuestion() {
  // Get random difficulty level for this question
  const targetDifficulty = getRandomDifficultyLevel();
  
  // Add random seed to force fresh responses
  const randomSeed = Math.floor(Math.random() * 10000);
  
  const prompt = `RANDOM_SEED_${randomSeed}: You are a quiz generator. Generate ONLY math or science questions.

ABSOLUTELY FORBIDDEN (WILL BE REJECTED):
- Any mention of planets, Mars, solar system, astronomy, space
- Any mention of Paris, landmarks, geography, countries, capitals  
- Any mention of history, literature, arts, sports, movies, actors

ONLY GENERATE FROM THESE TOPICS:
- Mathematics: What is 2+2? What is the square root of 16?
- Chemistry: What is the symbol for gold? What is H2O?
- Biology: What organelle produces energy? What is DNA?
- Physics: What is Newton's first law? What is the speed of light?

CRITICAL: Your response MUST include ALL these fields or it will be rejected:
- question (string)
- options (array of 4 strings)  
- answer (string - must match one option exactly)
- category (string - must be "math" or "science")
- difficultyLevel (number - must be ${targetDifficulty.level})

EXAMPLE VALID RESPONSE:
{
  "question": "What is the chemical symbol for gold?",
  "options": ["Au", "Ag", "Fe", "Cu"],
  "answer": "Au", 
  "category": "science",
  "difficultyLevel": ${targetDifficulty.level}
}

Generate a Level ${targetDifficulty.level} math or science question now. SEED: ${randomSeed}`;

  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      console.log(`⚡ Requesting new quiz question from Gemini... (Target Level: ${targetDifficulty.level})`);
      const raw = await callGemini(prompt);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      // Check for duplicates (semantic similarity)
      const questionText = parsed.question?.toLowerCase() || '';
      const questionKey = questionText.substring(0, 50);
      
      // Validate required fields first
      if (!parsed.question || !parsed.options || !parsed.answer || !parsed.difficultyLevel || !parsed.category) {
        console.log(`❌ AI response missing required fields:`, {
          hasQuestion: !!parsed.question,
          hasOptions: !!parsed.options,
          hasAnswer: !!parsed.answer,
          hasDifficultyLevel: !!parsed.difficultyLevel,
          hasCategory: !!parsed.category
        });
        attempts++;
        
        // If we've exhausted attempts, use fallback
        if (attempts >= maxAttempts) {
          console.error("❌ Failed to generate valid question after maximum attempts, using fallback");
          return generateFallbackQuestion(targetDifficulty.level);
        }
        
        continue;
      }

      // Check for banned keywords/topics (immediate rejection)
      const bannedKeywords = [
        'red planet', 'mars', 'planet', 'solar system', 'astronomy',
        'paris', 'france', 'eiffel', 'landmark', 'capital',
        'history', 'literature', 'arts', 'sports', 'geography'
      ];
      
      const hasBannedContent = bannedKeywords.some(keyword => 
        questionText.includes(keyword)
      );
      
      if (hasBannedContent) {
        console.log(`🚫 Question contains banned content: "${parsed.question}"`);
        attempts++;
        
        // If we've exhausted attempts, use fallback
        if (attempts >= maxAttempts) {
          console.error("❌ Failed to generate valid question after maximum attempts, using fallback");
          return generateFallbackQuestion(targetDifficulty.level);
        }
        
        continue;
      }
      
      // Check for duplicates against recent questions
      const isDuplicate = Array.from(recentQuestions).some(recentKey => {
        // Check for similar sentence structure
        const hasSimilarStructure = (
          questionText.includes('which of these') && recentKey.includes('which of these')
        ) || (
          questionText.includes('located in') && recentKey.includes('located in')
        );
        
        return hasSimilarStructure || questionKey === recentKey;
      });
      
      if (isDuplicate) {
        console.log(`⚠️ Similar/duplicate question detected, retrying... (attempt ${attempts + 1})`);
        attempts++;
        
        // If we've exhausted attempts, use fallback
        if (attempts >= maxAttempts) {
          console.error("❌ Failed to generate valid question after maximum attempts, using fallback");
          return generateFallbackQuestion(targetDifficulty.level);
        }
        
        continue;
      }
      
      // Add to recent questions
      recentQuestions.add(questionKey);
      if (recentQuestions.size > MAX_RECENT_QUESTIONS) {
        const firstKey = recentQuestions.values().next().value;
        recentQuestions.delete(firstKey);
      }
      
      // Ensure difficultyLevel is set correctly
      parsed.difficultyLevel = targetDifficulty.level;
      
      console.log(`✅ Quiz question generated successfully (Level: ${parsed.difficultyLevel}, Category: ${parsed.category})`);
      return parsed;
    } catch (e) {
      console.error("❌ generateQuizQuestion error:", e.message || e);
      attempts++;
      if (attempts >= maxAttempts) {
        console.error("❌ Failed to generate quiz question after maximum attempts, using fallback");
        return generateFallbackQuestion(targetDifficulty.level);
      }
    }
  }
  
  // If we exit the loop without success, use fallback
  console.error("❌ Exhausted all attempts, using fallback");
  return generateFallbackQuestion(targetDifficulty.level);
}

// Fallback question generator when Gemini fails
function generateFallbackQuestion(difficultyLevel) {
  const mathQuestions = [
    {
      question: "What is 7 × 8?",
      options: ["54", "56", "58", "60"],
      answer: "56",
      category: "math",
      difficultyLevel: difficultyLevel
    },
    {
      question: "What is the square root of 64?",
      options: ["6", "7", "8", "9"],
      answer: "8",
      category: "math", 
      difficultyLevel: difficultyLevel
    },
    {
      question: "What is 15% of 200?",
      options: ["25", "30", "35", "40"],
      answer: "30",
      category: "math",
      difficultyLevel: difficultyLevel
    },
    {
      question: "What is 12 + 18?",
      options: ["28", "30", "32", "34"],
      answer: "30",
      category: "math",
      difficultyLevel: difficultyLevel
    },
    {
      question: "What is 9 × 6?",
      options: ["52", "54", "56", "58"],
      answer: "54",
      category: "math",
      difficultyLevel: difficultyLevel
    }
  ];

  const scienceQuestions = [
    {
      question: "What is the chemical symbol for gold?",
      options: ["Au", "Ag", "Fe", "Cu"],
      answer: "Au",
      category: "science",
      difficultyLevel: difficultyLevel
    },
    {
      question: "What gas do plants absorb during photosynthesis?",
      options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
      answer: "Carbon dioxide",
      category: "science",
      difficultyLevel: difficultyLevel
    },
    {
      question: "What is the powerhouse of the cell?",
      options: ["Nucleus", "Mitochondria", "Ribosome", "Cytoplasm"],
      answer: "Mitochondria",
      category: "science",
      difficultyLevel: difficultyLevel
    },
    {
      question: "What is the chemical symbol for water?",
      options: ["H2O", "CO2", "NaCl", "O2"],
      answer: "H2O",
      category: "science",
      difficultyLevel: difficultyLevel
    },
    {
      question: "What is the hardest natural substance?",
      options: ["Gold", "Iron", "Diamond", "Quartz"],
      answer: "Diamond",
      category: "science",
      difficultyLevel: difficultyLevel
    }
  ];

  const allQuestions = [...mathQuestions, ...scienceQuestions];
  
  // Add timestamp to make each question unique
  const randomIndex = Math.floor(Math.random() * allQuestions.length);
  const selectedQuestion = { ...allQuestions[randomIndex] };
  
  console.log(`✅ Generated fallback question (Level: ${difficultyLevel}, Category: ${selectedQuestion.category})`);
  return selectedQuestion;
}

// Generate unique batch ID
export function makeBatchId() {
  return Math.floor(Date.now() / 1000);
}

// Generate a complete batch of questions
export async function generateQuestionBatch(totalQuestions = TOTAL_QUESTIONS, subBatchSize = SUB_BATCH_SIZE, batchId = null) {
  const bid = batchId || makeBatchId();
  console.log(`🔧 Generating batch ${bid} (${totalQuestions} questions, subBatchSize=${subBatchSize})`);
  
  // Check if Gemini API is configured
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is required. Please configure GEMINI_API_KEY in .env file");
  }
  
  // Initialize batch in database
  await createBatchDocument(bid, totalQuestions);

  let created = 0;
  let indexCounter = 0;
  const allLeaves = [];
  const allQuizIds = [];

  while (created < totalQuestions) {
    const active = Math.min(subBatchSize, totalQuestions - created);
    const createdThisRound = [];
    console.log(`🚀 Starting sub-batch: need ${active} questions...`);
    
    for (let i = 0; i < active; i++) {
      try {
        let quizData;
        
        quizData = await generateQuizQuestion();
        
        if (!quizData) {
          console.warn(`⚠️ Failed to generate question ${i + 1}/${active}, skipping...`);
          continue;
        }
        
        indexCounter++;
        const quizId = `q_${bid}_${indexCounter}`;
        
        // Store question in Firestore
        const stored = await storeQuestionToFirestore(quizId, quizData, bid);
        if (!stored) {
          console.warn(`⚠️ Failed to store question ${quizId}, skipping...`);
          continue;
        }
        
        // Create Merkle leaf from correct answer
        const answerLeaf = createAnswerLeaf(quizData.answer);
        
        // Store leaf data
        const leafStored = await storeMerkleLeaf(bid, answerLeaf, quizId, quizData.answer);
        if (!leafStored) {
          console.warn(`⚠️ Failed to store leaf for ${quizId}, skipping...`);
          continue;
        }
        
        allLeaves.push(answerLeaf);
        allQuizIds.push(quizId);
        created++;
        createdThisRound.push(quizId);
        
        console.log(`   ✅ Created ${created}/${totalQuestions} : ${quizId}`);

        // Update progress every 5 questions
        if (created % 5 === 0) {
          await updateBatchProgress(bid, (created / totalQuestions) * 100);
        }

      } catch (error) {
        console.error(`❌ Error creating question ${i + 1}:`, error.message);
        continue;
      }
    }
    
    // Delay between sub-batches if not complete
    if (created < totalQuestions) {
      console.log(`⏳ Sub-batch done (${createdThisRound.length}). Waiting ${SUB_BATCH_DELAY}s before next sub-batch...`);
      for (let sec = SUB_BATCH_DELAY; sec > 0; sec -= 10) {
        console.log(`     ... still waiting (${sec}s left)`);
        await new Promise(r => setTimeout(r, 10_000));
      }
    } else {
      console.log(`🎉 Batch ${bid} generation complete.`);
    }
  }

  // Finalize batch with Merkle tree
  const result = await finalizeBatch(bid, allLeaves, allQuizIds);
  
  return { 
    batchId: bid, 
    totalCreated: created, 
    merkleRoot: result.merkleRoot,
    totalLeaves: allLeaves.length
  };
}

// Generate single question for testing
export async function generateSingleQuestion() {
  try {
    let quizData;
    
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key is required. Please configure GEMINI_API_KEY in .env file");
    }
    
    quizData = await generateQuizQuestion();
    
    if (!quizData) {
      throw new Error("Failed to generate question");
    }

    const quizId = `test_q_${Date.now()}`;
    const answerLeaf = createAnswerLeaf(quizData.answer);

    return {
      quizId,
      quizData,
      answerLeaf,
      success: true
    };
  } catch (error) {
    console.error("❌ Error generating single question:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Validate quiz question format
export function validateQuizQuestion(quizData) {
  if (!quizData) return false;
  
  const requiredFields = ['question', 'options', 'answer', 'difficultyLevel'];
  for (const field of requiredFields) {
    if (!quizData[field]) {
      console.warn(`⚠️ Missing required field: ${field}`);
      return false;
    }
  }
  
  if (!Array.isArray(quizData.options) || quizData.options.length !== 4) {
    console.warn(`⚠️ Options must be an array of 4 items`);
    return false;
  }
  
  if (!quizData.options.includes(quizData.answer)) {
    console.warn(`⚠️ Correct answer not found in options`);
    return false;
  }
  
  // Validate difficulty level matches contract requirements
  if (typeof quizData.difficultyLevel !== 'number' || 
      quizData.difficultyLevel < 1 || 
      quizData.difficultyLevel > 100) {
    console.warn(`⚠️ Difficulty level must be a number between 1-100`);
    return false;
  }
  
  return true;
}

// Get batch generation status
export async function getBatchGenerationStatus() {
  return {
    config: {
      totalQuestions: TOTAL_QUESTIONS,
      subBatchSize: SUB_BATCH_SIZE,
      subBatchDelay: SUB_BATCH_DELAY
    },
    services: {
      gemini: !!GEMINI_API_KEY
    }
  };
}