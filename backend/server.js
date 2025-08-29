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

// Configs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY missing in .env");
  process.exit(1);
}
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PROVIDER_URL = process.env.PROVIDER_URL;
const SUBMIT_LEAVES = (process.env.SUBMIT_LEAVES || "false").toLowerCase() === "true";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "9", 10);

const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root, bytes32[] calldata leaves) external"
];

let provider, signer, merkleContract;
if (PRIVATE_KEY && CONTRACT_ADDRESS && PROVIDER_URL) {
  provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  signer = new ethers.Wallet(PRIVATE_KEY, provider);
  merkleContract = new ethers.Contract(CONTRACT_ADDRESS, MERKLE_ABI, signer);
  console.log("✅ Connected to blockchain (Merkle contract ready).");
} else {
  console.warn("⚠️ Blockchain config incomplete - on-chain submission will be skipped.");
}

// ---------------- Gemini helper with retry/backoff ----------------
async function callGemini(promptText, maxRetries = 5) {
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`🔹 Gemini call attempt ${attempt} ...`);
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
      console.log("✅ Gemini responded successfully.");
      return generatedText;
    } catch (err) {
      console.error(`❌ Gemini attempt ${attempt} failed:`, err.message || err);
      const backoff = Math.min(30000, 2 ** attempt * 1000);
      console.log(`⏳ Waiting ${backoff / 1000}s before retry...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw new Error("Gemini: exceeded retries");
}

async function generateQuizQuestion() {
  const prompt = `
Generate a single quiz question suitable for a mobile game.
The question must have four options, and only one correct answer.
Output JSON:
{
  "question": "text",
  "options": ["A","B","C","D"],
  "answer": "the correct option text"
}
`;
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

// store question in Firestore
async function storeQuestionToFirestore(quizId, quizData) {
  try {
    const answerIndex = quizData.options.indexOf(quizData.answer);
    if (answerIndex === -1) {
      console.warn("⚠️ Correct answer not in options, skipping", quizId);
      return false;
    }
    const doc = {
      quizId,
      question: quizData.question,
      options: quizData.options,
      answerIndex,
      difficulty: Math.floor(Math.random() * 100),
      mode: 'solo',
      category: quizData.category || 'general',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isAnswered: false
    };
    await db.collection('questions').doc(quizId).set(doc);
    console.log(`📥 Stored question ${quizId} to Firestore.`);
    return true;
  } catch (err) {
    console.error("storeQuestionToFirestore error:", err);
    return false;
  }
}

// ---------------- Batch generation ----------------
function makeBatchId() {
  return Math.floor(Date.now() / 1000);
}

async function generateBatch(totalQuestions = 18, subBatchSize = BATCH_SIZE, batchId = null) {
  const bid = batchId || makeBatchId();
  console.log(`🔧 Generating batch ${bid} (${totalQuestions} questions, subBatchSize=${subBatchSize})`);
  await db.collection('merkle_batches').doc(String(bid)).set({
    batchId: bid,
    totalQuestions,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'open'
  });

  let created = 0;
  let indexCounter = 0;

  while (created < totalQuestions) {
    const active = Math.min(subBatchSize, totalQuestions - created);
    const createdThisRound = [];
    console.log(`🚀 Starting sub-batch: need ${active} questions...`);
    for (let i = 0; i < active; i++) {
      const q = await generateQuizQuestion();
      if (!q) continue;
      indexCounter++;
      const quizId = `q_${Date.now()}_${indexCounter}`;
      const ok = await storeQuestionToFirestore(quizId, q);
      if (!ok) continue;
      const leaf = ethers.keccak256(ethers.toUtf8Bytes(quizId));
      await db.collection('merkle_leaves').add({
        batchId: bid,
        leaf,
        quizId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      created++;
      createdThisRound.push(quizId);
      console.log(`   ✅ Created ${created}/${totalQuestions} : ${quizId}`);
    }
    if (created < totalQuestions) {
      console.log(`⏳ Sub-batch done (${createdThisRound.length}). Waiting 60s before next sub-batch...`);
      for (let sec = 60; sec > 0; sec -= 10) {
        console.log(`     ... still waiting (${sec}s left)`);
        await new Promise(r => setTimeout(r, 10_000));
      }
    } else {
      console.log(`🎉 Batch ${bid} generation complete.`);
    }
  }

  await db.collection('merkle_batches').doc(String(bid)).update({ status: 'ready', readyAt: admin.firestore.FieldValue.serverTimestamp() });
  return { batchId: bid, totalCreated: created };
}

// ---------------- Merkle Tree logic ----------------
async function buildMerkleFromBatch(batchId) {
  const query = await db.collection('merkle_leaves').where('batchId', '==', batchId).get();
  const leaves = query.docs.map(doc => doc.data().leaf);
  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  const rootHex = tree.getHexRoot();
  return { rootHex, leaves };
}

// ---------------- Commit batch ----------------
async function commitBatchOnChain(batchId, submitChunkSize = 500) {
  console.log(`🔗 Preparing to commit batch ${batchId} on-chain...`);
  const bdoc = await db.collection('merkle_batches').doc(String(batchId)).get();
  if (!bdoc.exists) throw new Error("Batch not found: " + batchId);
  const batchInfo = bdoc.data();
  if (batchInfo.status !== 'ready') {
    console.warn("⚠️ Batch status not 'ready' — current:", batchInfo.status);
  }

  const { rootHex, leaves } = await buildMerkleFromBatch(batchId);
  console.log(`🌳 Merkle root built: ${rootHex}, total leaves=${leaves.length}`);

  await db.collection('merkle_batches').doc(String(batchId)).update({ root: rootHex, committedAt: null });

  if (!merkleContract) {
    console.warn("⚠️ No merkleContract -> skipping on-chain commit. Root saved to Firestore only.");
    await db.collection('merkle_batches').doc(String(batchId)).update({ status: 'committed_offchain', rootSavedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { root: rootHex, totalLeaves: leaves.length, onChain: false };
  }

  if (!SUBMIT_LEAVES) {
    try {
      console.log("🚀 Submitting root-only tx...");
      const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, [], { gasLimit: 2_000_000 });
      console.log("📡 Root-only tx sent:", tx.hash);
      await tx.wait();
      console.log("✅ Root-only tx confirmed:", tx.hash);
      await db.collection('merkle_batches').doc(String(batchId)).update({ status: 'committed_onchain_root_only', committedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { root: rootHex, totalLeaves: leaves.length, onChain: true, txs: [tx.hash] };
    } catch (err) {
      console.error("❌ Error submitting root-only:", err);
      throw err;
    }
  }

  const leafHexes = leaves;
  const txHashes = [];
  for (let i = 0; i < leafHexes.length; i += submitChunkSize) {
    const chunk = leafHexes.slice(i, i + submitChunkSize);
    console.log(`🚀 Submitting chunk ${Math.floor(i / submitChunkSize) + 1} (${chunk.length})...`);
    const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, chunk, { gasLimit: 6_000_000 });
    txHashes.push(tx.hash);
    console.log("📡 Tx sent:", tx.hash, " waiting confirmation...");
    await tx.wait();
    console.log("✅ Tx confirmed:", tx.hash);
    await new Promise(r => setTimeout(r, 1000));
  }

  await db.collection('merkle_batches').doc(String(batchId)).update({ status: 'committed_onchain', committedAt: admin.firestore.FieldValue.serverTimestamp(), txs: txHashes });
  console.log(`🎉 Batch ${batchId} committed successfully on-chain.`);
  return { root: rootHex, totalLeaves: leafHexes.length, onChain: true, txs: txHashes };
}

// ---------------- HTTP endpoints ----------------
app.post('/admin/generate-batch', async (req, res) => {
  try {
    const { totalQuestions, subBatchSize } = req.body;
    const result = await generateBatch(totalQuestions, subBatchSize);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error in /admin/generate-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/commit-batch', async (req, res) => {
  try {
    const { batchId } = req.body;
    if (!batchId) {
      return res.status(400).json({ success: false, error: "batchId is required." });
    }
    const result = await commitBatchOnChain(batchId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error in /admin/commit-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/generate-and-commit', async (req, res) => {
  try {
    const { totalQuestions, subBatchSize } = req.body;
    const generationResult = await generateBatch(totalQuestions, subBatchSize);
    const commitResult = await commitBatchOnChain(generationResult.batchId);
    res.status(200).json({ success: true, ...commitResult, generationResult });
  } catch (error) {
    console.error("Error in /admin/generate-and-commit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/batches', async (req, res) => {
  try {
    const querySnapshot = await db.collection('merkle_batches').orderBy('createdAt', 'desc').get();
    const batches = querySnapshot.docs.map(doc => doc.data());
    res.status(200).json({ batches });
  } catch (error) {
    console.error("Error in /admin/batches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => res.send('QuizCoin Backend (batch-merkle mode)'));

app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));