// backend/services/quizService.js
import { ethers } from 'ethers';
import { getDatabase, admin } from '../config/database.js';
import { generateQuizQuestion } from './geminiService.js';
import { CONFIG } from '../config/constants.js';

export const storeQuestionToFirestore = async (quizId, quizData) => {
  const db = getDatabase();
  if (!db) {
    console.warn("⚠️ Firebase not initialized, skipping Firestore storage");
    return true;
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
    const answerDoc = {
    quizId: quizId,
    correctAnswer: quizData.answer,
    answerHash: ethers.keccak256(ethers.toUtf8Bytes(quizData.answer)),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('quiz_answers').doc(quizId).set(answerDoc);
    console.log(`📥 Stored question ${quizId} to Firestore.`);
    return true;
  } catch (err) {
    console.error("storeQuestionToFirestore error:", err);
    return false;
  }
};

export const makeBatchId = () => {
  return Math.floor(Date.now() / 1000);
};

export const generateBatch = async (totalQuestions = CONFIG.TOTAL_QUESTIONS, subBatchSize = CONFIG.SUB_BATCH_SIZE, batchId = null) => {
  const db = getDatabase();
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
        
        const correctAnswer = q.answer;
        const leaf = ethers.keccak256(ethers.toUtf8Bytes(correctAnswer));
        
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
      console.log(`⏳ Sub-batch done (${createdThisRound.length}). Waiting ${CONFIG.SUB_BATCH_DELAY}s before next sub-batch...`);
      for (let sec = CONFIG.SUB_BATCH_DELAY; sec > 0; sec -= 10) {
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
};