// server.js (fixed version)
// SPDX-License-Identifier: MIT
import express from 'express';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import cors from 'cors';
import { ethers, keccak256, toUtf8Bytes } from 'ethers';
import { MerkleTree } from 'merkletreejs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Firebase init
let serviceAccount;
try {
  const serviceAccountPath = `${__dirname}/serviceAccountKey.json`;
  const serviceAccountData = readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountData);
} catch (e) {
  console.error("Error: Could not load Firebase serviceAccountKey.json.", e);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Gemini config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY missing in .env");
  process.exit(1);
}
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Blockchain config
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PROVIDER_URL = process.env.PROVIDER_URL;

const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root, bytes32[] calldata leaves) external"
];

let provider, signer, merkleContract;
if (PRIVATE_KEY && CONTRACT_ADDRESS && PROVIDER_URL) {
  provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  signer = new ethers.Wallet(PRIVATE_KEY, provider);
  merkleContract = new ethers.Contract(CONTRACT_ADDRESS, MERKLE_ABI, signer);
  console.log("✅ Connected to blockchain (Merkle contract ready).");
}

// ---------------- Gemini Helper ----------------
async function callGemini(promptText) {
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  const res = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const json = await res.json();
  const generatedText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return generatedText || null;
}

async function generateQuizQuestion() {
  const prompt = `
    Generate a single quiz question suitable for a mobile game.
    The question must have four options, one correct answer.
    Output JSON format:
    {
      "question": "...",
      "options": ["A","B","C","D"],
      "answer": "..."
    }`;
  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (e) {
    console.error("Gemini failed:", e.message);
    return null;
  }
}

async function storeQuestionToFirestore(quizId, quizData) {
  const answerIndex = quizData.options.indexOf(quizData.answer);
  if (answerIndex === -1) return false;
  const doc = {
    quizId,
    question: quizData.question,
    options: quizData.options,
    answerIndex,
    difficulty: Math.floor(Math.random() * 100),
    mode: 'solo',
    category: 'general',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isAnswered: false,
  };
  await db.collection('questions').doc(quizId).set(doc);
  return true;
}

// ---------------- Batch Generator ----------------
async function generateAndSubmitMerkle({
  totalQuestions = 18,
  genBatchSize = 9,
  submitChunkSize = 9,
  merkleQuizId = Math.floor(Date.now() / 1000)
} = {}) {
  console.log(`🚀 Start generating ${totalQuestions} questions (batchSize=${genBatchSize})`);

  const leaves = [];
  let created = 0;
  let indexCounter = 0;

  while (created < totalQuestions) {
    const active = Math.min(genBatchSize, totalQuestions - created);
    const batchResults = [];

    for (let i = 0; i < active; i++) {
      const quiz = await generateQuizQuestion();
      if (!quiz) continue;
      indexCounter++;
      const quizId = `q_${Date.now()}_${indexCounter}`;
      const ok = await storeQuestionToFirestore(quizId, quiz);
      if (!ok) continue;
      const leaf = keccak256(toUtf8Bytes(quizId));
      leaves.push({ leaf, quizId });
      created++;
      batchResults.push(quizId);
      console.log(`Created ${created}/${totalQuestions}: ${quizId}`);
    }

    console.log(`✅ Batch of ${batchResults.length} done. Waiting 1 minute...`);
    if (created < totalQuestions) await new Promise(r => setTimeout(r, 60_000));
  }

  console.log(`🎉 All ${created} questions generated.`);

  const leafBuffers = leaves.map(x => Buffer.from(x.leaf.slice(2), 'hex'));
  const keccakHashFn = (data) => Buffer.from(keccak256(data).slice(2), 'hex');
  const tree = new MerkleTree(leafBuffers, keccakHashFn, { sortPairs: true });
  const rootHex = '0x' + tree.getRoot().toString('hex');
  console.log(`🌳 Merkle Root: ${rootHex}`);

  if (!merkleContract) return { root: rootHex, totalLeaves: leaves.length, merkleQuizId };

  const leafHexes = leaves.map(x => x.leaf);
  for (let i = 0; i < leafHexes.length; i += submitChunkSize) {
    const chunk = leafHexes.slice(i, i + submitChunkSize);
    const tx = await merkleContract.submitMerkleRoot(merkleQuizId, rootHex, chunk, { gasLimit: 6_000_000 });
    console.log(`⛓️ TX ${tx.hash} submitted, waiting...`);
    await tx.wait();
    console.log(`✅ TX confirmed`);
    await new Promise(r => setTimeout(r, 1000));
  }

  return { root: rootHex, totalLeaves: leaves.length, merkleQuizId };
}

// ---------------- API ----------------
app.get('/', (req, res) => res.send('QuizCoin Backend Service (fixed)'));
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

// Auto-run
generateAndSubmitMerkle({ totalQuestions: 18, genBatchSize: 9, submitChunkSize: 9 })
  .then(r => console.log("Auto-run completed", r))
  .catch(e => console.error("Auto-run failed", e));
