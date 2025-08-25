// This is the main backend service for the QuizCoin project.
// It is responsible for generating new quiz questions using the Gemini API,
// storing them in a Firestore database, and handling API requests from the frontend.

import express from 'express';
import admin from 'firebase-admin';
import { createHmac } from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import cors from 'cors';
import { ethers } from 'ethers'; // Import ethers library

// Load environment variables from the .env file.
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Get the current directory name using ES Modules syntax
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- IMPORTANT: Middleware and Firebase/Gemini API Configuration ---
app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use(express.json());

// Load Firebase service account key from file.
let serviceAccount;
try {
  const serviceAccountPath = `${__dirname}/serviceAccountKey.json`;
  const serviceAccountData = readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountData);
} catch (e) {
  console.error("Error: Could not load Firebase serviceAccountKey.json.");
  console.error("Please ensure the file exists in the same directory as server.js.");
  console.error(e);
  process.exit(1);
}

// Get the Gemini API key from the environment variables for security.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is not defined in the .env file.");
  process.exit(1);
}
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- Blockchain Configuration ---
// Get blockchain configuration from environment variables for security
const PRIVATE_KEY = process.env.PLAYER1_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PROVIDER_URL = process.env.PROVIDER_URL;

// Smart Contract ABI (Application Binary Interface)
// แก้ไข ABI ให้เรียกฟังก์ชันสำหรับจ่ายรางวัล
const QUIZ_ABI = [
  "function distributeRewardForSoloMode(uint256 _quizId, address _participant) public"
];

let contract;
let signer;

if (PRIVATE_KEY && CONTRACT_ADDRESS && PROVIDER_URL) {
  try {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Create a new contract instance
    contract = new ethers.Contract(CONTRACT_ADDRESS, QUIZ_ABI, signer);
    
    // Check if the contract object is valid
    if (contract) {
        console.log("Successfully connected to blockchain.");
    } else {
        console.warn("Could not create contract instance. Blockchain interaction will be skipped.");
    }

  } catch (e) {
    console.error("Error connecting to blockchain:", e);
    console.warn("Blockchain interaction will be skipped.");
    contract = null;
  }
} else {
  console.warn("Warning: Blockchain configuration is missing. Smart contract interaction will be skipped.");
}


// --- Core Functionality: Question Generation and Storage ---

/**
 * Generates a quiz question using the Gemini API.
 * @returns {Object} An object containing the question, options, and correct answer.
 */
async function generateQuizQuestion() {
  const prompts = [
    {
      topic: 'science',
      text: `
      Generate a single quiz question suitable for a mobile game.
      The question should have four options, and only one correct answer.
      The topic must be about science.
      The output must be a JSON object with the following format:
      {
        "question": "The quiz question text",
        "options": [
          "Option A",
          "Option B",
          "Option C",
          "Option D"
        ],
        "answer": "The correct answer text (e.g., 'Option C')"
      }
      `
    },
    {
      topic: 'math',
      text: `
      Generate a single quiz question suitable for a mobile game.
      The question should have four options, and only one correct answer.
      The topic must be about mathematics.
      The output must be a JSON object with the following format:
      {
        "question": "The quiz question text",
        "options": [
          "Option A",
          "Option B",
          "Option C",
          "Option D"
        ],
        "answer": "The correct answer text (e.g., 'Option C')"
      }
      `
    }
  ];

  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

  const payload = {
    contents: [{ parts: [{ text: randomPrompt.text }] }]
  };

  try {
    const maxRetries = 5;
    let retryCount = 0;
    let response;

    while (retryCount < maxRetries) {
      try {
        response = await fetch(GEMINI_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          break;
        }
      } catch (error) {
        console.error(`Fetch attempt ${retryCount + 1} failed: ${error.message}`);
      }
      retryCount++;
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(res => setTimeout(res, delay));
    }

    if (!response || !response.ok) {
      throw new Error(`API call failed after ${maxRetries} retries.`);
    }

    const result = await response.json();
    const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error("Failed to get text from Gemini API response.");
    }
    
    const quizData = JSON.parse(generatedText.replace(/```json|```/g, '').trim());
    quizData.category = randomPrompt.topic;
    
    return quizData;

  } catch (error) {
    console.error("Error generating quiz question from Gemini:", error);
    return null;
  }
}

/**
 * Stores a quiz question in Firestore.
 * @param {Object} quizData The quiz data from the Gemini API.
 */
async function storeQuestion(quizData) {
    try {
        const quizId = `quiz${Date.now()}`;
        const answerIndex = quizData.options.indexOf(quizData.answer);
        if (answerIndex === -1) {
            console.error("Error: Correct answer not found in options array.");
            return;
        }

        const difficulty = Math.floor(Math.random() * 99) + 1;

        const questionData = {
            quizId,
            question: quizData.question,
            options: quizData.options,
            answerIndex: answerIndex,
            difficulty,
            mode: 'solo',
            category: quizData.category,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isAnswered: false,
        };

        await db.collection('questions').doc(quizId).set(questionData);
        console.log(`Successfully stored question ${quizId} in Firestore.`);
        console.log(`Quiz ID: ${quizId}`);
        console.log(`Correct Answer Index: ${answerIndex}`);

    } catch (error) {
        console.error("Error storing question:", error);
    }
}

// --- API Endpoints for Frontend Interaction ---

/**
 * API endpoint to get a list of quizzes already answered by a user.
 * It queries the 'user_answers' collection in Firestore.
 */
app.post('/api/get-answered-quizzes', async (req, res) => {
    try {
        const { userAccount } = req.body;
        if (!userAccount) {
            return res.status(400).json({ error: 'User account is required.' });
        }

        const userAnswersRef = db.collection('user_answers');
        const querySnapshot = await userAnswersRef.where('userId', '==', userAccount).get();
        
        const answeredQuizzes = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            answeredQuizzes.push({ quizId: data.quizId });
        });

        res.status(200).json({ answeredQuizzes });

    } catch (error) {
        console.error("Error fetching answered quizzes:", error);
        res.status(500).json({ error: 'Failed to fetch answered quizzes.' });
    }
});

/**
 * API endpoint to submit and verify a user's answer.
 */
app.post('/api/submit-answer', async (req, res) => {
    try {
        const { quizId, userAccount, selectedOption } = req.body;

        if (!quizId || !userAccount || selectedOption === undefined) {
            return res.status(400).json({ error: 'Missing quizId, userAccount, or selectedOption.' });
        }

        // 1. Get the original quiz data from Firestore
        const quizRef = db.collection('questions').doc(quizId);
        const doc = await quizRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Quiz not found.' });
        }

        const quizData = doc.data();
        const correctAnswer = quizData.options[quizData.answerIndex];
        const isCorrect = (selectedOption === correctAnswer);

        // 2. Save the user's answer to Firestore
        const userAnswersRef = db.collection('user_answers');
        await userAnswersRef.add({
            userId: userAccount,
            quizId: quizId,
            selectedOption: selectedOption,
            isCorrect: isCorrect,
            answeredAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. If the answer is correct, submit the transaction to the blockchain.
        if (isCorrect && contract) { // เพิ่มการตรวจสอบ isCorrect
            try {
                console.log("Submitting transaction to blockchain to distribute reward...");
                
                // แก้ไขการเรียกฟังก์ชันบน Smart Contract
                const tx = await contract.distributeRewardForSoloMode(quizId, userAccount);
                await tx.wait(); // Wait for the transaction to be mined
                
                console.log(`Transaction submitted! Tx Hash: ${tx.hash}`);
            } catch (blockchainError) {
                console.error("Error submitting to blockchain:", blockchainError);
                // Continue to respond even if blockchain transaction fails
            }
        }

        // 4. Respond to the frontend
        res.status(200).json({ isCorrect });

    } catch (error) {
        console.error("Error submitting answer:", error);
        res.status(500).json({ error: 'Failed to submit answer.' });
    }
});


// --- Scheduler and Server Startup ---

// Use setInterval to run the job every 3 minutes (180000 milliseconds).
// In a real production environment, you would use a more robust scheduler.
setInterval(createNewQuestionJob, 180000); 

app.get('/', (req, res) => {
  res.send('QuizCoin Backend Service is running.');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  createNewQuestionJob(); // Run the job immediately on startup.
});

async function createNewQuestionJob() {
  console.log('Running new question job...');
  const quizData = await generateQuizQuestion();
  if (quizData) {
    await storeQuestion(quizData);
  }
}
