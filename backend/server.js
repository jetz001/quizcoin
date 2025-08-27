// server.js (updated)
// SPDX-License-Identifier: MIT
import express from 'express';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import cors from 'cors';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Firebase init (serviceAccountKey.json must exist)
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
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

// Blockchain config
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS; // Diamond address exposing MerkleFacet.submitMerkleRoot
const PROVIDER_URL = process.env.PROVIDER_URL;

if (!PRIVATE_KEY || !CONTRACT_ADDRESS || !PROVIDER_URL) {
  console.warn("Blockchain config missing: CONTRACT_ADDRESS / PRIVATE_KEY / PROVIDER_URL");
}

const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root, bytes32[] calldata leaves) external"
];

let provider, signer, merkleContract;
if (PRIVATE_KEY && CONTRACT_ADDRESS && PROVIDER_URL) {
  provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  signer = new ethers.Wallet(PRIVATE_KEY, provider);
  merkleContract = new ethers.Contract(CONTRACT_ADDRESS, MERKLE_ABI, signer);
  console.log("Connected to blockchain (Merkle contract ready).");
}

// --- Helper: Gemini question generation --- //
async function callGemini(promptText, maxRetries = 5) {
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text().catch(()=>"");
        throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt}`);
      }
      const json = await res.json();
      const generatedText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) throw new Error("Empty generation result");
      return generatedText;
    } catch (err) {
      console.error(`Gemini attempt ${attempt} failed:`, err.message || err);
      const backoff = Math.min(30000, 2 ** attempt * 1000);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw new Error("Gemini: exceeded retries");
}

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
  const randomPrompt = prompts[Math.floor(Math.random()*prompts.length)];
  try {
    const raw = await callGemini(randomPrompt.text);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.category = randomPrompt.topic;
    return parsed;
  } catch (err) {
    console.error("generateQuizQuestion error:", err.message || err);
    return null;
  }
}

// storeQuestion returns the quizId used
async function storeQuestionToFirestore(quizId, quizData) {
  try {
    const answerIndex = quizData.options.indexOf(quizData.answer);
    if (answerIndex === -1) {
      console.warn("Correct answer not in options, skipping", quizId);
      return false;
    }
    const difficulty = Math.floor(Math.random() * 99) + 1;
    const doc = {
      quizId,
      question: quizData.question,
      options: quizData.options,
      answerIndex,
      difficulty,
      mode: 'solo',
      category: quizData.category,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isAnswered: false
    };
    await db.collection('questions').doc(quizId).set(doc);
    return true;
  } catch (err) {
    console.error("storeQuestionToFirestore error:", err);
    return false;
  }
}

// --- MAIN: generate many questions, build Merkle, submit root (chunked) --- //
/**
 * totalQuestions: how many questions to create (default 15000)
 * genBatchSize: how many generateQuizQuestion() calls concurrently per batch (to limit concurrency)
 * submitChunkSize: how many leaves to send per submitMerkleRoot tx (reduce to fit gas)
 */
async function generateAndSubmitMerkle({
  totalQuestions = 15000,
  genBatchSize = 50,
  submitChunkSize = 500,
  merkleQuizId = Math.floor(Date.now() / 1000) // numeric id for MerkleFacet
} = {}) {
  console.log(`Start generating ${totalQuestions} questions (batchSize=${genBatchSize})`);
  const leaves = []; // will store hex '0x...' leaves
  let created = 0;
  let indexCounter = 0;

  // create in loops: to avoid duplicate timestamps, we use a monotonic counter in id
  while (created < totalQuestions) {
    const active = Math.min(genBatchSize, totalQuestions - created);
    const promises = [];
    for (let i = 0; i < active; i++) {
      promises.push(generateQuizQuestion());
    }
    const results = await Promise.all(promises);
    for (const r of results) {
      indexCounter++;
      if (!r) continue;
      const quizId = `q_${Date.now()}_${indexCounter}`; // deterministic unique id
      const ok = await storeQuestionToFirestore(quizId, r);
      if (!ok) continue;
      // leaf = keccak256(abi.encodePacked(quizIdString)) -> use toUtf8Bytes(quizId)
      const leaf = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(quizId));
      leaves.push({ leaf, quizId }); // keep quizId for possible reference
      created++;
      if (created % 100 === 0) {
        console.log(`Created ${created}/${totalQuestions} questions`);
      }
      if (created >= totalQuestions) break;
    }
  }

  console.log(`Generation done. Successfully created ${created} questions.`);

  if (leaves.length === 0) {
    throw new Error("No leaves created, aborting Merkle creation");
  }

  // Create Merkle Tree (merkletreejs expects Buffers)
  const leafBuffers = leaves.map(x => Buffer.from(x.leaf.slice(2), 'hex'));
  const keccakHashFn = (data) => {
    // merkletreejs passes Buffer; ethers.keccak256 accepts BytesLike
    return Buffer.from(ethers.utils.keccak256(data).slice(2), 'hex');
  };

  const tree = new MerkleTree(leafBuffers, keccakHashFn, { sortPairs: true });
  const rootBuffer = tree.getRoot();
  const rootHex = '0x' + rootBuffer.toString('hex');

  console.log(`Merkle tree built. Root: ${rootHex}`);
  console.log(`Total leaves: ${leafBuffers.length}`);
  console.log(`Merkle Quiz ID (uint): ${merkleQuizId}`);
  console.log("About to submit root and leaves to MerkleFacet on-chain in chunks.");
  console.log(`Chunk size for submitMerkleRoot: ${submitChunkSize}`);

  if (!merkleContract) {
    console.warn("merkleContract not available. Skipping on-chain submission. Exiting.");
    return { root: rootHex, totalLeaves: leafBuffers.length, merkleQuizId };
  }

  // Prepare array of leaf hex strings
  const leafHexes = leaves.map(x => x.leaf);

  // Submit root + leaves in chunks (each tx will set mapping for that chunk)
  for (let i = 0; i < leafHexes.length; i += submitChunkSize) {
    const chunk = leafHexes.slice(i, i + submitChunkSize);
    console.log(`Submitting chunk ${Math.floor(i/submitChunkSize)+1} (${chunk.length} leaves) to chain...`);
    try {
      const tx = await merkleContract.submitMerkleRoot(
        merkleQuizId,
        rootHex,
        chunk,
        { gasLimit: 6_000_000 } // try to set a gas limit (adjust if needed)
      );
      console.log(` tx sent: ${tx.hash} - waiting for confirmation...`);
      const receipt = await tx.wait();
      console.log(` tx confirmed in block ${receipt.blockNumber}`);
      // small pause between txs to avoid spamming node
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error("Error submitting merkle chunk:", err);
      throw err;
    }
  }

  console.log("All chunks submitted. Merkle root and leaf->quizId mapping should be on-chain.");
  return { root: rootHex, totalLeaves: leafHexes.length, merkleQuizId };
}

// --- API endpoints (unchanged) --- //
app.post('/api/get-answered-quizzes', async (req, res) => {
  try {
    const { userAccount } = req.body;
    if (!userAccount) return res.status(400).json({ error: 'userAccount required' });
    const querySnapshot = await db.collection('user_answers').where('userId', '==', userAccount).get();
    const answered = [];
    querySnapshot.forEach(doc => answered.push(doc.data().quizId));
    res.json({ answeredQuizzes: answered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/api/submit-answer', async (req, res) => {
  try {
    const { quizId, userAccount, selectedOption } = req.body;
    if (!quizId || !userAccount || selectedOption === undefined) {
      return res.status(400).json({ error: 'Missing quizId, userAccount, or selectedOption.' });
    }
    const doc = await db.collection('questions').doc(quizId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Quiz not found.' });
    const quizData = doc.data();
    const correctAnswer = quizData.options[quizData.answerIndex];
    const isCorrect = (selectedOption === correctAnswer);

    await db.collection('user_answers').add({
      userId: userAccount,
      quizId,
      selectedOption,
      isCorrect,
      answeredAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // If correct, you might want to call on-chain distribution (not implemented here)
    res.json({ isCorrect });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed' });
  }
});

// --- One-off endpoint to trigger generation + submit (for manual run) ---
// Use this endpoint to run the whole flow once from HTTP (or you can call generateAndSubmitMerkle() directly on startup)
app.post('/admin/generate-and-submit', async (req, res) => {
  try {
    const { totalQuestions, genBatchSize, submitChunkSize, merkleQuizId } = req.body || {};
    const result = await generateAndSubmitMerkle({
      totalQuestions: totalQuestions || 15000,
      genBatchSize: genBatchSize || 50,
      submitChunkSize: submitChunkSize || 500,
      merkleQuizId: merkleQuizId || Math.floor(Date.now()/1000)
    });
    res.json({ ok: true, result });
  } catch (err) {
    console.error("Admin generation error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Startup: do NOT auto-run generation by default (it's expensive).
// If you want to run automatically once at startup, uncomment the line below.
 generateAndSubmitMerkle({ totalQuestions: 100, genBatchSize: 5, submitChunkSize: 20 })
   .then(r => console.log("Auto-run completed", r))
   .catch(e => console.error("Auto-run failed", e));

app.get('/', (req, res) => res.send('QuizCoin Backend Service (modified)'));
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
