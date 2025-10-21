// services/merkle.js
import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';
import { prisma, createBatchDocument, updateBatchProgress, completeBatch, storeMerkleLeaf } from '../database/index.js';
import { generateQuizQuestion } from '../quiz/ai/gemini.js';
import { buildMerkleFromBatch, generateMerkleProof, commitBatchOffChain } from './tree-simple.js';

export async function generateBatch(db, config) {
  if (!prisma) {
    throw new Error("Database not initialized - cannot generate batch");
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

async function generateAndStoreQuestion(db, batchId, questionNumber, retryCount = 0) {
  const maxRetries = 5;
  
  if (retryCount > maxRetries) {
    console.error(`❌ Max retries (${maxRetries}) exceeded for question ${questionNumber}`);
    throw new Error('Too many retries - unable to generate valid question');
  }
  
  try {
    const question = await generateQuizQuestion();
    
    // Check if question generation completely failed
    if (!question) {
      console.error('❌ Question generation failed completely');
      throw new Error('Failed to generate question');
    }
    
    // Validate question has required fields (fallback should have provided these)
    if (!question.question || !question.options || !question.answer || !question.difficultyLevel || !question.category) {
      console.error('❌ Question missing required fields:', {
        hasQuestion: !!question.question,
        hasOptions: !!question.options,
        hasAnswer: !!question.answer,
        hasDifficultyLevel: !!question.difficultyLevel,
        hasCategory: !!question.category
      });
      throw new Error('Generated question is missing required fields');
    }
    
    // Check for Mars/Red Planet duplicates specifically
    const questionLower = question.question.toLowerCase();
    if (questionLower.includes('red planet') || 
        (questionLower.includes('mars') && questionLower.includes('planet')) ||
        questionLower.includes('known as the') && questionLower.includes('planet')) {
      console.log(`⚠️ Detected Mars/Red Planet question, regenerating... (retry ${retryCount + 1}/${maxRetries})`);
      return generateAndStoreQuestion(db, batchId, questionNumber, retryCount + 1); // Retry
    }
    
    const quizId = `q_${batchId}_${questionNumber}`;
    
    // Calculate leaves for all possible answers
    const answerLeaves = question.options.map(option => 
      ethers.keccak256(ethers.toUtf8Bytes(option))
    );

    // Store question with proper difficulty level
    await db.collection('questions').doc(quizId).create({
      quizId,
      question: question.question,
      options: question.options,
      answer: question.answer,
      category: question.category || 'general',
      difficulty: question.difficultyLevel, // Use AI difficulty level
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
    console.log(`✅ Question ${questionNumber} created and stored (Level: ${question.difficultyLevel}, Category: ${question.category})`);
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
    
    // 🔄 AUTO-SYNC: Update question ID 1's Merkle root to match the new batch
    // This fixes the architecture issue where manual updates were needed
    try {
      if (blockchain && blockchain.merkleContract) {
        const syncResult = await updateQuestionMerkleRoot(batchId, rootHex, blockchain.merkleContract, db);
        if (syncResult.success) {
          console.log(`✅ Auto-sync completed: Question ID 1 now has Merkle root from batch ${batchId}`);
        } else {
          console.warn(`⚠️ Auto-sync failed: ${syncResult.error}`);
        }
      } else {
        console.warn(`⚠️ Auto-sync skipped: blockchain.merkleContract not available`);
      }
    } catch (syncError) {
      console.warn(`⚠️ Auto-sync error (non-blocking):`, syncError.message);
    }
    
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

// Re-export functions from tree-simple.js
export { buildMerkleFromBatch, generateMerkleProof, commitBatchOffChain } from './tree-simple.js';
