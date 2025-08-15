// This is the main backend service for the QuizCoin project.
// It is responsible for generating new quiz questions using the Gemini API
// and storing them in a Firestore database.

import express from 'express';
import admin from 'firebase-admin';
import { createHmac } from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Get the current directory name using ES Modules syntax
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- IMPORTANT: Firebase and Gemini API Configuration ---
// Make sure to replace this with your actual Firebase service account key.
// You can download this JSON file from your Firebase project settings.
let serviceAccount;
try {
  const serviceAccountPath = `${__dirname}/serviceAccountKey.json`;
  const serviceAccountData = readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountData);
} catch (e) {
  console.error("Error: Could not load Firebase serviceAccountKey.json.");
  console.error("Please ensure the file exists in the same directory as server.js.");
  console.error(e);
  process.exit(1); // Exit the process with an error code
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

// --- Core Functionality: Question Generation and Storage ---

/**
 * Generates a quiz question using the Gemini API.
 * @returns {Object} An object containing the question, options, and correct answer.
 */
async function generateQuizQuestion() {
  const prompt = `
  Generate a single quiz question suitable for a mobile game.
  The question should have four options, and only one correct answer.
  The topic can be general knowledge, science, or history.
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
  `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error("Failed to get text from Gemini API response.");
    }
    
    // Parse the JSON string from the model response.
    const quizData = JSON.parse(generatedText.replace(/```json|```/g, '').trim());
    return quizData;

  } catch (error) {
    console.error("Error generating quiz question from Gemini:", error);
    return null;
  }
}

/**
 * Stores a quiz question in Firestore.
 * It hashes the correct answer for on-chain verification later.
 * @param {Object} quizData The quiz data from the Gemini API.
 */
async function storeQuestionInFirestore(quizData) {
  try {
    // Get the HMAC secret key from the .env file.
    const hmacSecretKey = process.env.HMAC_SECRET_KEY || 'super-secret-key';
    
    // Generate a unique ID for the quiz.
    const quizId = `quiz${Date.now()}`;
    const salt = createHmac('sha256', hmacSecretKey).update(quizId).digest('hex');

    // Hash the correct answer for on-chain verification.
    const correctAnswerHash = createHmac('sha256', salt).update(quizData.answer).digest('hex');

    const questionData = {
      quizId,
      question: quizData.question,
      options: quizData.options,
      correctAnswerHash: correctAnswerHash,
      difficulty: 1, // Placeholder for future logic
      mode: 'solo', // Placeholder for future logic
      category: 'general', // Placeholder for future logic
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isAnswered: false
    };

    // Store the question in the 'questions' collection.
    await db.collection('questions').doc(quizId).set(questionData);
    console.log(`Successfully stored question ${quizId} in Firestore.`);

  } catch (error) {
    console.error("Error storing question in Firestore:", error);
  }
}

/**
 * Main function to generate and store a new question.
 */
async function createNewQuestionJob() {
  console.log('Running new question job...');
  const quizData = await generateQuizQuestion();
  if (quizData) {
    await storeQuestionInFirestore(quizData);
  }
}

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
