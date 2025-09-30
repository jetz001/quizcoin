// services/merkle.js
import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';
import { admin } from './firebase.js';
import { callGemini } from './geminiService.js';

export async function generateBatch(db, config) {
  if (!db) {
    throw new Error("Firebase not initialized - cannot generate batch");
  }

  const { TOTAL_QUESTIONS, SUB_BATCH_SIZE, SUB_BATCH_DELAY } = config;
  const bid = Math.floor(Date.now() / 1000);
  let created = 0;

  console.log(`🎯 Starting batch ${bid} generation...`);

  // Create batch document
  try {
    await db.collection('merkle_batches').doc(String(bid)).create({
      batchId: bid,
      status: 'generating',
      totalQuestions: TOTAL_QUESTIONS,
      totalCreated: 0,
      progress: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("❌ Failed to create batch document:", error);
    throw error;
  }

  // Generate questions in sub-batches
  const numSubBatches = Math.ceil(TOTAL_QUESTIONS / SUB_BATCH_SIZE);
  
  for (let subBatch = 0; subBatch < numSubBatches; subBatch++) {
    const startIndex = subBatch * SUB_BATCH_SIZE;
    const endIndex = Math.min(startIndex + SUB_BATCH_SIZE, TOTAL_QUESTIONS);
    const questionsInThisBatch = endIndex - startIndex;

    console.log(`📦 Sub-batch ${subBatch + 1}/${numSubBatches}: Generating ${questionsInThisBatch} questions...`);

    // Generate questions for this sub-batch
    const subBatchPromises = [];
    for (let i = 0; i < questionsInThisBatch; i++) {
      subBatchPromises.push(generateAndStoreQuestion(db, bid, startIndex + i + 1));
    }

    try {
      await Promise.all(subBatchPromises);
      created += questionsInThisBatch;

      // Update progress
      const progress = Math.round((created / TOTAL_QUESTIONS) * 100);
      await db.collection('merkle_batches').doc(String(bid)).update({
        totalCreated: created,
        progress: progress
      });

      console.log(`✅ Sub-batch ${subBatch + 1} completed. Total: ${created}/${TOTAL_QUESTIONS}`);
    } catch (error) {
      console.error(`❌ Error in sub-batch ${subBatch + 1}:`, error);
      throw error;
    }

    // Delay between sub-batches (except for the last one)
    if (subBatch < numSubBatches - 1) {
      console.log(`⏸️ Waiting ${SUB_BATCH_DELAY}s before next sub-batch...`);
      for (let sec = SUB_BATCH_DELAY; sec > 0; sec -= 10) {
        console.log(`     ... still waiting (${sec}s left)`);
        await new Promise(r => setTimeout(r, 10_000));
      }
    } else {
      console.log(`🎉 Batch ${bid} generation complete.`);
    }
  }

  // Update batch status to ready
  try {
    await db.collection('merkle_batches').doc(String(bid)).update({
      status: 'ready',
      readyAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("❌ Failed to update batch status:", error);
  }

  return { batchId: bid, totalCreated: created };
}

async function generateAndStoreQuestion(db, batchId, questionNumber) {
  try {
    const question = await generateQuizQuestion();
    const quizId = `q_${batchId}_${questionNumber}`;
    
    // Calculate leaves for all possible answers
    const answerLeaves = question.options.map(option => 
      ethers.keccak256(ethers.toUtf8Bytes(option))
    );

    // Store question
    await db.collection('questions').doc(quizId).create({
      ...question,
      quizId,
      batchId,
      questionNumber,
      isAnswered: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Store merkle leaves
    const batch = db.batch();
    answerLeaves.forEach((leaf, index) => {
      const leafDoc = db.collection('merkle_leaves').doc();
      batch.create(leafDoc, {
        quizId,
        batchId,
        leaf,
        option: question.options[index],
        isCorrect: question.options[index] === question.answer,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log(`✅ Question ${questionNumber} created and stored`);
  } catch (error) {
    console.error(`❌ Error generating question ${questionNumber}:`, error);
    throw error;
  }
}

export async function commitBatchOnChain(db, blockchain, batchId, config) {
  console.log(`🔗 Preparing to commit batch ${batchId} on-chain...`);

  if (!db) {
    throw new Error("Firebase not initialized - cannot commit batch");
  }

  // Get batch info
  const bdoc = await db.collection('merkle_batches').doc(String(batchId)).get();
  if (!bdoc.exists) throw new Error("Batch not found: " + batchId);
  
  const batchInfo = bdoc.data();
  if (batchInfo.status !== 'ready') {
    console.warn("⚠️ Batch status not 'ready' — current:", batchInfo.status);
  }

  // Build Merkle tree
  const { rootHex, leaves } = await buildMerkleFromBatch(db, batchId);
  console.log(`🌳 Merkle root built: ${rootHex}, total leaves=${leaves.length}`);

  // Update batch with root
  await db.collection('merkle_batches').doc(String(batchId)).update({ 
    root: rootHex, 
    committedAt: null 
  });

  // Submit to blockchain
  if (!blockchain.isConnected()) {
    console.warn("⚠️ No blockchain connection -> skipping on-chain commit. Root saved to Firestore only.");
    await db.collection('merkle_batches').doc(String(batchId)).update({
      status: 'committed_offchain',
      rootSavedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { root: rootHex, totalLeaves: leaves.length, onChain: false };
  }

  try {
    const result = await blockchain.submitMerkleRoot(batchId, rootHex, leaves);
    
    await db.collection('merkle_batches').doc(String(batchId)).update({
      status: 'committed_onchain',
      committedAt: admin.firestore.FieldValue.serverTimestamp(),
      txs: result.txHashes
    });

    console.log(`🎉 Batch ${batchId} committed successfully on-chain.`);
    return { 
      root: rootHex, 
      totalLeaves: leaves.length, 
      onChain: true, 
      txs: result.txHashes 
    };
  } catch (error) {
    console.error("❌ Error committing to blockchain:", error);
    throw error;
  }
}

export async function buildMerkleFromBatch(db, batchId) {
  if (!db) {
    throw new Error("Firebase not initialized - cannot build Merkle tree");
  }

  const query = await db.collection('merkle_leaves').where('batchId', '==', batchId).get();
  const leaves = query.docs.map(doc => doc.data().leaf);
  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  const rootHex = tree.getHexRoot();
  return { rootHex, leaves };
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
  } catch (error) {
    console.error("❌ Gemini question generation failed:", error);
    throw error;
  }
}