import express from 'express';
import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// เพื่อใช้ __dirname ใน ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route สำหรับ serve admin dashboard HTML
router.get('/', (req, res) => {
  const adminPath = path.join(__dirname, '..', 'public', 'admin.html');
  console.log(`🔍 Serving admin.html from: ${adminPath}`);
  
  res.sendFile(adminPath, (err) => {
    if (err) {
      console.error(`❌ Error serving admin.html:`, err);
      res.status(404).send('Admin dashboard not found');
    } else {
      console.log(`✅ Admin dashboard served successfully`);
    }
  });
});

// Generate batch endpoint
router.post('/generate-batch', async (req, res) => {
  try {
    const { db } = req.app.locals;
    
    console.log(`🔧 Starting batch generation...`);
    
    const result = await generateBatch(db);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("❌ Error in /admin/generate-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commit batch endpoint
router.post('/commit-batch', async (req, res) => {
  try {
    const { batchId } = req.body;
    const { db, merkleContract } = req.app.locals;

    if (!batchId) {
      return res.status(400).json({ success: false, error: "batchId is required" });
    }

    console.log(`🔗 Starting batch commit with batchId: ${batchId}`);

    const result = await commitBatchOnChain(batchId, db, merkleContract);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("❌ Error in /admin/commit-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create questions on blockchain endpoint
router.post('/create-questions-onchain', async (req, res) => {
  try {
    const { batchId } = req.body;
    const { db, blockchain } = req.app.locals;

    if (!batchId) {
      return res.status(400).json({ success: false, error: "batchId is required" });
    }

    if (!blockchain || !blockchain.isConnected()) {
      return res.status(503).json({ success: false, error: "Blockchain not connected" });
    }

    console.log(`🔨 Creating questions on-chain for batch ${batchId}...`);

    // Get all leaves for this batch
    const leavesQuery = await db.collection('merkle_leaves')
      .where('batchId', '==', batchId)
      .get();

    if (leavesQuery.empty) {
      return res.status(404).json({ success: false, error: "No leaves found for this batch" });
    }

    const questions = leavesQuery.docs.map(doc => ({
      ...doc.data(),
      docId: doc.id
    }));

    console.log(`📋 Found ${questions.length} questions to create on-chain`);

    // Create questions on blockchain
    const results = await blockchain.createQuestionsInBatch(questions, 5, 2000);

    // Update Firestore with blockchain questionIds
    const batch = db.batch();
    let successCount = 0;

    results.forEach((result, index) => {
      if (result.success) {
        const docRef = db.collection('merkle_leaves').doc(questions[index].docId);
        batch.update(docRef, {
          blockchainQuestionId: index + 1, // questionId starts from 1 and increments
          createdOnChain: true,
          txHash: result.txHash
        });
        successCount++;
      }
    });

    await batch.commit();

    // Update batch status
    await db.collection('merkle_batches').doc(String(batchId)).update({
      questionsCreatedOnChain: true,
      onChainQuestionCount: successCount,
      createdOnChainAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      batchId,
      totalQuestions: questions.length,
      successfullyCreated: successCount,
      results
    });

  } catch (error) {
    console.error("❌ Error creating questions on-chain:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get config endpoint
router.get('/config', (req, res) => {
  res.status(200).json({
    success: true,
    config: {
      TOTAL_QUESTIONS: process.env.TOTAL_QUESTIONS || 18,
      SUB_BATCH_SIZE: process.env.SUB_BATCH_SIZE || 9,
      SUBMIT_LEAVES: process.env.SUBMIT_LEAVES || false,
      SUBMIT_CHUNK_SIZE: process.env.SUBMIT_CHUNK_SIZE || 500,
      SUB_BATCH_DELAY: process.env.SUB_BATCH_DELAY || 60,
      TX_DELAY: process.env.TX_DELAY || 1
    }
  });
});

// Load batches endpoint
router.get('/batches', async (req, res) => {
  try {
    const { db } = req.app.locals;
    
    if (!db) {
      return res.status(503).json({ success: false, error: "Firebase not available" });
    }
    
    console.log("📊 Loading batches from Firestore...");
    
    const querySnapshot = await db.collection('merkle_batches')
      .orderBy('createdAt', 'desc')
      .get();
    
    const batches = querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    
    console.log(`✅ Found ${batches.length} batches`);
    
    res.status(200).json({ 
      success: true,
      batches: batches 
    });
  } catch (error) {
    console.error("❌ Error in /admin/batches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Helper Functions ====================

async function generateBatch(db) {
  if (!db) {
    throw new Error("Firebase not initialized");
  }

  const batchId = Date.now();
  const TOTAL_QUESTIONS = parseInt(process.env.TOTAL_QUESTIONS || "18");
  
  console.log(`🎯 Generating batch ${batchId} with ${TOTAL_QUESTIONS} questions`);
  
  // Create sample questions with realistic content
  const questions = [];
  const questionTemplates = [
    "What is the capital of France?",
    "What is 2 + 2?", 
    "Who painted the Mona Lisa?",
    "What is the largest planet in our solar system?",
    "What year did World War II end?",
    "What is the chemical symbol for gold?",
    "Who wrote Romeo and Juliet?",
    "What is the speed of light?",
    "What is the largest ocean on Earth?",
    "What is the smallest country in the world?",
    "What is the currency of Japan?",
    "Who invented the telephone?",
    "What is the highest mountain in the world?",
    "What is the longest river in the world?",
    "What is the largest mammal?",
    "What is the capital of Australia?",
    "What is the smallest planet in our solar system?",
    "Who discovered gravity?"
  ];

  const answerTemplates = [
    "Paris", "4", "Leonardo da Vinci", "Jupiter", "1945", "Au", 
    "William Shakespeare", "299,792,458 m/s", "Pacific Ocean", 
    "Vatican City", "Yen", "Alexander Graham Bell", "Mount Everest",
    "Nile River", "Blue Whale", "Canberra", "Mercury", "Isaac Newton"
  ];
  
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
    const questionIndex = (i - 1) % questionTemplates.length;
    const quizId = `q_${batchId}_${i}`;
    const answer = answerTemplates[questionIndex];
    
    questions.push({
      quizId,
      question: questionTemplates[questionIndex],
      answer: answer,
      leaf: ethers.keccak256(ethers.toUtf8Bytes(answer))
    });
  }
  
  // Save batch metadata to Firebase
  const batchData = {
    batchId,
    totalQuestions: TOTAL_QUESTIONS,
    status: 'generating',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await db.collection('merkle_batches').doc(String(batchId)).set(batchData);
  console.log(`📝 Saved batch metadata for ${batchId}`);
  
  // Save leaves to Firebase
  console.log(`💾 Saving ${questions.length} leaves to Firestore...`);
  const batch = db.batch();
  
  questions.forEach((q) => {
    const leafRef = db.collection('merkle_leaves').doc();
    batch.set(leafRef, {
      batchId,
      quizId: q.quizId,
      leaf: q.leaf,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  
  await batch.commit();
  
  // Update batch status to ready
  await db.collection('merkle_batches').doc(String(batchId)).update({
    status: 'ready',
    readyAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`✅ Batch ${batchId} generation complete`);
  
  return { batchId, totalCreated: TOTAL_QUESTIONS };
}

async function commitBatchOnChain(batchId, db, merkleContract) {
  console.log(`🔗 Committing batch ${batchId} to blockchain...`);
  
  if (!db) {
    throw new Error("Firebase not initialized");
  }
  
  // Check if batch exists
  const batchDoc = await db.collection('merkle_batches').doc(String(batchId)).get();
  if (!batchDoc.exists) {
    throw new Error(`Batch ${batchId} not found`);
  }
  
  const batchInfo = batchDoc.data();
  if (batchInfo.status !== 'ready') {
    console.warn(`⚠️ Batch status is '${batchInfo.status}', not 'ready'`);
  }
  
  // Get leaves for this batch
  console.log(`🔍 Getting leaves for batch ${batchId}...`);
  const query = await db.collection('merkle_leaves')
    .where('batchId', '==', batchId)
    .get();
  
  if (query.empty) {
    throw new Error(`No leaves found for batch ${batchId}`);
  }
  
  const leaves = query.docs.map(doc => {
    const data = doc.data();
    console.log(`   📄 Found leaf: ${data.quizId}`);
    return data.leaf;
  });
  
  console.log(`✅ Found ${leaves.length} leaves for batch ${batchId}`);
  
  // Build Merkle tree
  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  const rootHex = tree.getHexRoot();
  
  console.log(`🌳 Built Merkle tree for batch ${batchId}: ${rootHex} (${leaves.length} leaves)`);
  
  // Update batch with root
  await db.collection('merkle_batches').doc(String(batchId)).update({ 
    root: rootHex, 
    committedAt: null 
  });
  
  if (!merkleContract) {
    console.warn("⚠️ No merkleContract -> skipping on-chain commit. Root saved to Firestore only.");
    await db.collection('merkle_batches').doc(String(batchId)).update({ 
      status: 'committed_offchain', 
      rootSavedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    return { root: rootHex, totalLeaves: leaves.length, onChain: false };
  }
  
  // Submit to blockchain
  try {
    console.log(`🚀 Submitting Merkle root for batch ${batchId}...`);
    const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, [], { gasLimit: 2_000_000 });
    console.log("📡 Transaction sent:", tx.hash);
    
    await tx.wait();
    console.log("✅ Transaction confirmed:", tx.hash);
    
    // Update batch status
    await db.collection('merkle_batches').doc(String(batchId)).update({
      status: 'committed_onchain',
      root: rootHex,
      committedAt: admin.firestore.FieldValue.serverTimestamp(),
      txs: [tx.hash]
    });
    
    console.log(`🎉 Batch ${batchId} committed successfully on-chain.`);
    
    return { 
      root: rootHex, 
      totalLeaves: leaves.length, 
      onChain: true, 
      txs: [tx.hash] 
    };
  } catch (error) {
    console.error("❌ Error submitting Merkle root:", error);
    throw error;
  }
}

export default router;