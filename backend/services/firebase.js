// backend/services/firebase.js - Fixed for ES modules
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

export async function initializeFirebase() {
  try {
    // Read service account key
    const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    
    db = admin.firestore();
    console.log(`✅ Firebase connected to project: ${serviceAccount.project_id}`);
    return db;
  } catch (e) {
    console.error("❌ Firebase connection failed:", e);
    throw new Error("Firebase initialization failed");
  }
}

// Store question in Firestore with enhanced metadata
export async function storeQuestionToFirestore(quizId, quizData, batchId) {
  if (!db) {
    console.warn("⚠️ Firebase not initialized");
    return false;
  }
  
  try {
    const answerIndex = quizData.options.indexOf(quizData.answer);
    if (answerIndex === -1) {
      console.warn("⚠️ Correct answer not in options, skipping", quizId);
      return false;
    }

    const doc = {
      quizId,
      batchId,
      question: quizData.question,
      options: quizData.options,
      answerIndex,
      correctAnswer: quizData.answer,
      difficulty: Math.floor(Math.random() * 100) + 1,
      mode: 'solo',
      category: quizData.category || 'general',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isAnswered: false,
      totalAnswers: 0,
      correctAnswers: 0,
      status: 'active'
    };

    await db.collection('questions').doc(quizId).set(doc);
    console.log(`📥 Stored question ${quizId} to Firestore`);
    return true;
  } catch (err) {
    console.error("storeQuestionToFirestore error:", err);
    return false;
  }
}

// Store Merkle leaf data
export async function storeMerkleLeaf(batchId, leaf, quizId, correctAnswer) {
  if (!db) {
    console.warn("⚠️ Firebase not initialized");
    return false;
  }

  try {
    await db.collection('merkle_leaves').add({
      batchId,
      leaf,
      quizId,
      correctAnswer,
      answerHash: leaf,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to store leaf for ${quizId}:`, error);
    return false;
  }
}

// Create batch document
export async function createBatchDocument(batchId, totalQuestions) {
  if (!db) return false;

  try {
    await db.collection('merkle_batches').doc(String(batchId)).set({
      batchId,
      totalQuestions,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'generating',
      progress: 0
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to create batch document:", error);
    return false;
  }
}

// Update batch progress
export async function updateBatchProgress(batchId, progress) {
  if (!db) return false;

  try {
    await db.collection('merkle_batches').doc(String(batchId)).update({ 
      progress: Math.floor(progress)
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to update batch progress:", error);
    return false;
  }
}

// Complete batch
export async function completeBatch(batchId, created, merkleRoot, allLeaves, allQuizIds) {
  if (!db) return false;

  try {
    await db.collection('merkle_batches').doc(String(batchId)).update({ 
      status: 'ready',
      progress: 100,
      totalCreated: created,
      merkleRoot: merkleRoot,
      leaves: allLeaves,
      quizIds: allQuizIds,
      readyAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to complete batch:", error);
    return false;
  }
}

// Get batch by ID
export async function getBatch(batchId) {
  if (!db) return null;

  try {
    const doc = await db.collection('merkle_batches').doc(String(batchId)).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error("❌ Failed to get batch:", error);
    return null;
  }
}

// Get leaves for batch
export async function getLeavesForBatch(batchId) {
  if (!db) return [];

  try {
    const query = await db.collection('merkle_leaves')
      .where('batchId', '==', batchId)
      .orderBy('createdAt')
      .get();
    
    return query.docs.map(doc => doc.data());
  } catch (error) {
    console.error("❌ Failed to get leaves:", error);
    return [];
  }
}

// Find quiz leaf
export async function findQuizLeaf(quizId) {
  if (!db) return null;

  try {
    const query = await db.collection('merkle_leaves')
      .where('quizId', '==', quizId)
      .limit(1)
      .get();

    if (query.empty) return null;
    return query.docs[0].data();
  } catch (error) {
    console.error("❌ Failed to find quiz leaf:", error);
    return null;
  }
}

// Record answer submission
export async function recordAnswerSubmission(quizId, userAccount, answer, isCorrect, merkleProof, txHash, mode, rewardAmount) {
  if (!db) return false;

  try {
    const answerRecord = {
      quizId,
      userAccount: userAccount.toLowerCase(),
      answer,
      isCorrect,
      answeredAt: admin.firestore.FieldValue.serverTimestamp(),
      merkleProof: merkleProof || null,
      txHash: txHash || null,
      mode: mode || 'solo',
      rewardAmount: rewardAmount || "0"
    };

    await db.collection('user_answers').add(answerRecord);
    return true;
  } catch (error) {
    console.error("❌ Failed to record answer:", error);
    return false;
  }
}

// Update question statistics
export async function updateQuestionStats(quizId, isCorrect, userAccount) {
  if (!db) return false;

  try {
    const questionRef = db.collection('questions').doc(quizId);
    const questionDoc = await questionRef.get();
    
    if (!questionDoc.exists) return false;

    const updateData = {
      totalAnswers: admin.firestore.FieldValue.increment(1)
    };

    if (isCorrect) {
      updateData.correctAnswers = admin.firestore.FieldValue.increment(1);
      
      const questionData = questionDoc.data();
      if (!questionData.firstSolverAddress) {
        updateData.firstSolverAddress = userAccount.toLowerCase();
        updateData.firstCorrectAnswerTime = admin.firestore.FieldValue.serverTimestamp();
      }
    }

    await questionRef.update(updateData);
    return true;
  } catch (error) {
    console.error("❌ Failed to update question stats:", error);
    return false;
  }
}

// Get question by ID
export async function getQuestion(quizId) {
  if (!db) return null;

  try {
    const doc = await db.collection('questions').doc(quizId).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error("❌ Failed to get question:", error);
    return null;
  }
}

// Get quizzes with filters
export async function getQuizzes(limit = 20, category = null, difficulty = null) {
  if (!db) return [];

  try {
    let query = db.collection('questions')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (category) {
      query = query.where('category', '==', category);
    }

    if (difficulty) {
      const difficultyNum = parseInt(difficulty);
      if (difficultyNum >= 1 && difficultyNum <= 100) {
        query = query.where('difficulty', '==', difficultyNum);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("❌ Failed to get quizzes:", error);
    return [];
  }
}

export { admin };