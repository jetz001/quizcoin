// backend/services/quiz.js - Fixed for ES modules
import { 
  storeQuestionToFirestore, 
  storeMerkleLeaf, 
  createBatchDocument, 
  updateBatchProgress 
} from './firebase.js';
import { createAnswerLeaf, finalizeBatch } from './merkle.js';

// Configuration
const DEFAULT_CONFIG = {
  TOTAL_QUESTIONS: 18,
  SUB_BATCH_SIZE: 9,
  SUB_BATCH_DELAY: 60
};

const TOTAL_QUESTIONS = parseInt(process.env.TOTAL_QUESTIONS || DEFAULT_CONFIG.TOTAL_QUESTIONS.toString(), 10);
const SUB_BATCH_SIZE = parseInt(process.env.SUB_BATCH_SIZE || DEFAULT_CONFIG.SUB_BATCH_SIZE.toString(), 10);
const SUB_BATCH_DELAY = parseInt(process.env.SUB_BATCH_DELAY || DEFAULT_CONFIG.SUB_BATCH_DELAY.toString(), 10);

// Gemini API setup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

// Call Gemini API (using global fetch in Node.js 18+)
async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

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
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Generate a single quiz question using AI
export async function generateQuizQuestion() {
  const prompt = `Generate a quiz question about general knowledge, science, history, or technology.
The question must have four options, and only one correct answer.
Output JSON:
{
  "question": "text",
  "options": ["A","B","C","D"],
  "answer": "the correct option text",
  "category": "general|science|history|technology"
}`;

  try {
    console.log("⚡ Requesting new quiz question from Gemini...");
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log("✅ Quiz question generated.");
    return parsed;
  } catch (e) {
    console.error("generateQuizQuestion error:", e.message || e);
    return null;
  }
}

// Generate unique batch ID
export function makeBatchId() {
  return Math.floor(Date.now() / 1000);
}

// Generate a complete batch of questions
export async function generateQuestionBatch(totalQuestions = TOTAL_QUESTIONS, subBatchSize = SUB_BATCH_SIZE, batchId = null) {
  const bid = batchId || makeBatchId();
  console.log(`🔧 Generating batch ${bid} (${totalQuestions} questions, subBatchSize=${subBatchSize})`);
  
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
        const quizData = await generateQuizQuestion();
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
    const quizData = await generateQuizQuestion();
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
  
  const requiredFields = ['question', 'options', 'answer'];
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