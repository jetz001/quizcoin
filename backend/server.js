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
import path from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit immediately, log the error and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, log the error and continue
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware with error handling
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Firebase init with better error handling
let serviceAccount;
let db;
try {
  const serviceAccountPath = `${__dirname}/serviceAccountKey.json`;
  const serviceAccountData = readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountData);
  
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log("✅ Firebase initialized successfully");
} catch (e) {
  console.error("❌ Error: Could not load Firebase serviceAccountKey.json.", e);
  console.error("⚠️ Server will continue but Firebase features will be disabled");
  // Don't exit, continue without Firebase
}

// Configs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Error: GEMINI_API_KEY missing in .env");
  console.error("⚠️ Server will continue but AI features will be disabled");
  // Don't exit, continue without Gemini
}
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PROVIDER_URL = process.env.PROVIDER_URL;

// ===================== DEFAULT CONFIGURATION =====================
const DEFAULT_CONFIG = {
  TOTAL_QUESTIONS: 18,
  SUB_BATCH_SIZE: 9,
  SUBMIT_LEAVES: false,
  SUBMIT_CHUNK_SIZE: 500,
  SUB_BATCH_DELAY: 60,
  TX_DELAY: 1
};

const TOTAL_QUESTIONS = parseInt(process.env.TOTAL_QUESTIONS || DEFAULT_CONFIG.TOTAL_QUESTIONS.toString(), 10);
const SUB_BATCH_SIZE = parseInt(process.env.SUB_BATCH_SIZE || DEFAULT_CONFIG.SUB_BATCH_SIZE.toString(), 10);
const SUBMIT_LEAVES = (process.env.SUBMIT_LEAVES || DEFAULT_CONFIG.SUBMIT_LEAVES.toString()).toLowerCase() === "true";
const SUBMIT_CHUNK_SIZE = parseInt(process.env.SUBMIT_CHUNK_SIZE || DEFAULT_CONFIG.SUBMIT_CHUNK_SIZE.toString(), 10);
const SUB_BATCH_DELAY = parseInt(process.env.SUB_BATCH_DELAY || DEFAULT_CONFIG.SUB_BATCH_DELAY.toString(), 10);
const TX_DELAY = parseInt(process.env.TX_DELAY || DEFAULT_CONFIG.TX_DELAY.toString(), 10);

console.log("📋 Configuration:");
console.log(`   - Total Questions per Batch: ${TOTAL_QUESTIONS}`);
console.log(`   - Sub-batch Size: ${SUB_BATCH_SIZE}`);
console.log(`   - Submit Leaves: ${SUBMIT_LEAVES}`);
console.log(`   - Submit Chunk Size: ${SUBMIT_CHUNK_SIZE}`);
console.log(`   - Sub-batch Delay: ${SUB_BATCH_DELAY}s`);
console.log(`   - Transaction Delay: ${TX_DELAY}s`);
console.log("=====================================");

const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root, bytes32[] calldata leaves) external"
];

let provider, signer, merkleContract;
if (PRIVATE_KEY && CONTRACT_ADDRESS && PROVIDER_URL) {
  try {
    provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
    merkleContract = new ethers.Contract(CONTRACT_ADDRESS, MERKLE_ABI, signer);
    console.log("✅ Connected to blockchain (Merkle contract ready).");
  } catch (error) {
    console.error("❌ Blockchain connection failed:", error.message);
    console.error("⚠️ Server will continue but blockchain features will be disabled");
  }
} else {
  console.warn("⚠️ Blockchain config incomplete - on-chain submission will be skipped.");
}

// ---------------- Gemini helper with retry/backoff ----------------
async function callGemini(promptText, maxRetries = 5) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }
  
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
      if (attempt >= maxRetries) throw err;
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
  if (!db) {
    console.warn("⚠️ Firebase not initialized, skipping Firestore storage");
    return true; // Return true to continue with other operations
  }
  
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

async function generateBatch(totalQuestions = TOTAL_QUESTIONS, subBatchSize = SUB_BATCH_SIZE, batchId = null) {
  const bid = batchId || makeBatchId();
  console.log(`🔧 Generating batch ${bid} (${totalQuestions} questions, subBatchSize=${subBatchSize})`);
  
  if (db) {
    try {
      await db.collection('merkle_batches').doc(String(bid)).set({
        batchId: bid,
        totalQuestions,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'open'
      });
    } catch (error) {
      console.error("❌ Failed to create batch document:", error);
      throw new Error("Failed to initialize batch in database");
    }
  }

  let created = 0;
  let indexCounter = 0;

  while (created < totalQuestions) {
    const active = Math.min(subBatchSize, totalQuestions - created);
    const createdThisRound = [];
    console.log(`🚀 Starting sub-batch: need ${active} questions...`);
    
    for (let i = 0; i < active; i++) {
      try {
        const q = await generateQuizQuestion();
        if (!q) {
          console.warn(`⚠️ Failed to generate question ${i + 1}/${active}, skipping...`);
          continue;
        }
        
        indexCounter++;
        const quizId = `q_${Date.now()}_${indexCounter}`;
        const ok = await storeQuestionToFirestore(quizId, q);
        if (!ok) {
          console.warn(`⚠️ Failed to store question ${quizId}, skipping...`);
          continue;
        }
        
        const leaf = ethers.keccak256(ethers.toUtf8Bytes(quizId));
        
        if (db) {
          try {
            await db.collection('merkle_leaves').add({
              batchId: bid,
              leaf,
              quizId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            console.error(`❌ Failed to store leaf for ${quizId}:`, error);
            continue;
          }
        }
        
        created++;
        createdThisRound.push(quizId);
        console.log(`   ✅ Created ${created}/${totalQuestions} : ${quizId}`);
      } catch (error) {
        console.error(`❌ Error creating question ${i + 1}:`, error.message);
        continue;
      }
    }
    
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

  if (db) {
    try {
      await db.collection('merkle_batches').doc(String(bid)).update({ 
        status: 'ready', 
        readyAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    } catch (error) {
      console.error("❌ Failed to update batch status:", error);
    }
  }
  
  return { batchId: bid, totalCreated: created };
}

// ---------------- Merkle Tree logic ----------------
async function buildMerkleFromBatch(batchId) {
  if (!db) {
    throw new Error("Firebase not initialized - cannot build Merkle tree");
  }
  
  const query = await db.collection('merkle_leaves').where('batchId', '==', batchId).get();
  const leaves = query.docs.map(doc => doc.data().leaf);
  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  const rootHex = tree.getHexRoot();
  return { rootHex, leaves };
}

// ---------------- Commit batch ----------------
async function commitBatchOnChain(batchId, submitChunkSize = SUBMIT_CHUNK_SIZE) {
  console.log(`🔗 Preparing to commit batch ${batchId} on-chain...`);
  
  if (!db) {
    throw new Error("Firebase not initialized - cannot commit batch");
  }
  
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
    await db.collection('merkle_batches').doc(String(batchId)).update({ 
      status: 'committed_offchain', 
      rootSavedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    return { root: rootHex, totalLeaves: leaves.length, onChain: false };
  }

  if (!SUBMIT_LEAVES) {
    try {
      console.log("🚀 Submitting root-only tx...");
      const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, [], { gasLimit: 2_000_000 });
      console.log("📡 Root-only tx sent:", tx.hash);
      await tx.wait();
      console.log("✅ Root-only tx confirmed:", tx.hash);
      await db.collection('merkle_batches').doc(String(batchId)).update({ 
        status: 'committed_onchain_root_only', 
        committedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
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
    
    try {
      const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, chunk, { gasLimit: 6_000_000 });
      txHashes.push(tx.hash);
      console.log("📡 Tx sent:", tx.hash, " waiting confirmation...");
      await tx.wait();
      console.log("✅ Tx confirmed:", tx.hash);
      await new Promise(r => setTimeout(r, TX_DELAY * 1000));
    } catch (error) {
      console.error(`❌ Error submitting chunk ${Math.floor(i / submitChunkSize) + 1}:`, error);
      throw error;
    }
  }

  await db.collection('merkle_batches').doc(String(batchId)).update({ 
    status: 'committed_onchain', 
    committedAt: admin.firestore.FieldValue.serverTimestamp(), 
    txs: txHashes 
  });
  console.log(`🎉 Batch ${batchId} committed successfully on-chain.`);
  return { root: rootHex, totalLeaves: leafHexes.length, onChain: true, txs: txHashes };
}

// ---------------- HTTP endpoints with error handling ----------------

app.post('/admin/generate-batch', async (req, res) => {
  try {
    console.log(`🔧 Starting batch generation with default settings:`);
    console.log(`   - Total Questions: ${TOTAL_QUESTIONS}`);
    console.log(`   - Sub-batch Size: ${SUB_BATCH_SIZE}`);
    
    const result = await generateBatch();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("❌ Error in /admin/generate-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/commit-batch', async (req, res) => {
  try {
    const { batchId } = req.body;
    if (!batchId) {
      return res.status(400).json({ success: false, error: "batchId is required." });
    }
    
    console.log(`🔗 Starting batch commit with settings:`);
    console.log(`   - Submit Leaves: ${SUBMIT_LEAVES}`);
    console.log(`   - Chunk Size: ${SUBMIT_CHUNK_SIZE}`);
    
    const result = await commitBatchOnChain(batchId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("❌ Error in /admin/commit-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/generate-and-commit', async (req, res) => {
  try {
    console.log(`🚀 Starting full batch process with default settings:`);
    console.log(`   - Total Questions: ${TOTAL_QUESTIONS}`);
    console.log(`   - Sub-batch Size: ${SUB_BATCH_SIZE}`);
    console.log(`   - Submit Leaves: ${SUBMIT_LEAVES}`);
    console.log(`   - Chunk Size: ${SUBMIT_CHUNK_SIZE}`);
    
    const generationResult = await generateBatch();
    const commitResult = await commitBatchOnChain(generationResult.batchId);
    res.status(200).json({ success: true, ...commitResult, generationResult });
  } catch (error) {
    console.error("❌ Error in /admin/generate-and-commit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/config', (req, res) => {
  res.status(200).json({
    success: true,
    config: {
      TOTAL_QUESTIONS,
      SUB_BATCH_SIZE,
      SUBMIT_LEAVES,
      SUBMIT_CHUNK_SIZE,
      SUB_BATCH_DELAY,
      TX_DELAY
    }
  });
});

app.get('/admin/batches', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, error: "Firebase not available" });
    }
    
    const querySnapshot = await db.collection('merkle_batches').orderBy('createdAt', 'desc').get();
    const batches = querySnapshot.docs.map(doc => doc.data());
    res.status(200).json({ batches });
  } catch (error) {
    console.error("❌ Error in /admin/batches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin dashboard route
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'admin.html');
  console.log(`🔍 Checking admin.html at path: ${adminPath}`);

  try {
    res.sendFile(adminPath, (err) => {
      if (err) {
        console.error(`❌ Error sending admin.html:`, err);
      } else {
        console.log(`✅ admin.html served successfully`);
      }
    });
  } catch (error) {
    console.error("❌ Error serving admin page:", error);
    res.status(500).send("Error loading admin page");
  }
});


app.get('/', (req, res) => {
  res.json({
    message: 'QuizCoin Backend (batch-merkle mode)',
    status: 'running',
    timestamp: new Date().toISOString(),
    config: {
      TOTAL_QUESTIONS,
      SUB_BATCH_SIZE,
      SUBMIT_LEAVES,
      SUBMIT_CHUNK_SIZE,
      SUB_BATCH_DELAY,
      TX_DELAY
    },
    services: {
      firebase: !!db,
      gemini: !!GEMINI_API_KEY,
      blockchain: !!merkleContract
    },
    endpoints: [
      'POST /admin/generate-batch - สร้าง batch ใหม่',
      'POST /admin/commit-batch - commit batch ขึ้น blockchain',
      'POST /admin/generate-and-commit - สร้างและ commit ในคำสั่งเดียว',
      'GET /admin/config - ดูการตั้งค่าปัจจุบัน',
      'GET /admin/batches - ดู batch ทั้งหมด',
      'GET /admin - หน้า admin dashboard'
    ]
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Express Error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found` 
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
  console.log(`📋 Ready to generate batches with ${TOTAL_QUESTIONS} questions each`);
  console.log(`🌐 Admin dashboard: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});