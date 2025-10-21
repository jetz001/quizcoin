// backend/routes/apiRoutes.js
import express from 'express';
import { admin } from '../../services/database/firebase.js';
import { generateMerkleProof } from '../../services/merkle/tree.js';

const router = express.Router();

// Simple in-memory cache to reduce Firebase queries
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Circuit breaker for quota exhaustion
let isQuotaExhausted = false;
let quotaExhaustedUntil = 0;
const QUOTA_COOLDOWN = 300000; // 5 minutes

// Reset circuit breaker periodically
setInterval(() => {
  if (isQuotaExhausted && Date.now() > quotaExhaustedUntil) {
    isQuotaExhausted = false;
    quotaExhaustedUntil = 0;
    console.log('✅ Circuit breaker reset: Firebase quota should be restored');
  }
}, 60000); // Check every minute

// Debug endpoint to test Firebase connection
router.get('/debug-firebase', (req, res) => {
  const db = req.app.locals.db;
  res.json({
    success: true,
    hasDb: !!db,
    dbType: typeof db,
    firebaseConnected: !!db
  });
});

// Get available quizzes (not yet answered by user)
router.post('/get-available-quizzes', async (req, res) => {
  try {
    // Check circuit breaker
    if (isQuotaExhausted && Date.now() < quotaExhaustedUntil) {
      return res.status(503).json({
        success: false,
        error: "Firebase quota exhausted. Please try again later.",
        retryAfter: Math.ceil((quotaExhaustedUntil - Date.now()) / 1000)
      });
    }

    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`Finding available quizzes for ${userAccount}`);

    // Check cache first
    const cacheKey = `available_quizzes_${userAccount.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Returning cached quizzes for ${userAccount}`);
      return res.json(cached.data);
    }

    // Get all answered quizzes by this user from both collections
    const answeredQuery = await db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .get();

    const completedQuery = await db.collection('completed_quizzes')
      .where('userAccount', '==', userAccount.toLowerCase())
      .get();

    const answeredQuizIds = new Set([
      ...answeredQuery.docs.map(doc => doc.data().quizId),
      ...completedQuery.docs.map(doc => doc.data().quizId)
    ]);

    // Get all available questions from merkle_leaves that have been created on-chain
    const leavesQuery = await db.collection('merkle_leaves')
      .where('createdOnChain', '==', true)
      .limit(20) // Reduced from 50 to 20 to save quota
      .get();

    // Get corresponding question details from questions collection
    const quizIds = leavesQuery.docs.map(doc => doc.data().quizId);
    const questionsMap = new Map();
    
    if (quizIds.length > 0) {
      // Process quizIds in batches of 10 due to Firestore 'in' query limit
      const batchSize = 10;
      for (let i = 0; i < quizIds.length; i += batchSize) {
        const batch = quizIds.slice(i, i + batchSize);
        const questionsQuery = await db.collection('questions')
          .where('quizId', 'in', batch)
          .get();
        
        questionsQuery.docs.forEach(doc => {
          questionsMap.set(doc.data().quizId, doc.data());
        });
      }
    }

    // Group leaves by quizId to find correct answers
    const leavesByQuiz = {};
    leavesQuery.docs.forEach(doc => {
      const leafData = doc.data();
      if (!leavesByQuiz[leafData.quizId]) {
        leavesByQuiz[leafData.quizId] = [];
      }
      leavesByQuiz[leafData.quizId].push(leafData);
    });

    const availableQuizzes = Object.keys(leavesByQuiz)
      .map(quizId => {
        const leaves = leavesByQuiz[quizId];
        const firstLeaf = leaves[0];
        const questionData = questionsMap.get(quizId) || {};
        
        // Find the correct answer from merkle leaves
        const correctLeaf = leaves.find(leaf => leaf.isCorrect === true);
        const correctAnswer = correctLeaf ? correctLeaf.option : questionData.answer || 'Answer not found';
        
        return {
          quizId: quizId,
          blockchainQuestionId: firstLeaf.blockchainQuestionId,
          batchId: firstLeaf.batchId,
          question: questionData.question || 'Question not found',
          options: questionData.options || [],
          answer: correctAnswer,
          difficulty: questionData.difficulty || 50,
          category: questionData.category || 'general',
          createdAt: firstLeaf.createdAt
        };
      })
      .filter(quiz => !answeredQuizIds.has(quiz.quizId) && quiz.blockchainQuestionId)
      .sort((a, b) => {
        // Sort by createdAt in descending order (newest first)
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    console.log(`Found ${availableQuizzes.length} available quizzes from merkle_leaves`);

    // If no blockchain quizzes found, fallback to regular questions collection
    if (availableQuizzes.length === 0) {
      console.log('No blockchain quizzes found, falling back to questions collection...');
      
      try {
        const questionsQuery = await db.collection('questions').limit(20).get();
        const fallbackQuizzes = questionsQuery.docs
          .map(doc => ({
            quizId: doc.id,
            blockchainQuestionId: null, // No blockchain ID yet
            batchId: null,
            question: doc.data().question || 'Question not found',
            options: doc.data().options || [],
            answer: doc.data().answer || 'Answer not found',
            difficulty: doc.data().difficulty || 50,
            category: doc.data().category || 'general',
            createdAt: doc.data().createdAt || null
          }))
          .filter(quiz => !answeredQuizIds.has(quiz.quizId));
        
        console.log(`Found ${fallbackQuizzes.length} fallback quizzes from questions collection`);
        
        res.json({
          success: true,
          quizzes: fallbackQuizzes,
          total: fallbackQuizzes.length,
          source: 'questions_fallback'
        });
        return;
      } catch (fallbackError) {
        console.error('Error loading fallback quizzes:', fallbackError);
      }
    }

    const responseData = {
      success: true,
      quizzes: availableQuizzes,
      total: availableQuizzes.length,
      source: 'merkle_leaves'
    };

    // Cache the response
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    res.json(responseData);

  } catch (error) {
    console.error("Error fetching available quizzes:", error);
    
    // Check if it's a quota exhaustion error
    if (error.code === 8 || error.message.includes('Quota exceeded') || error.message.includes('RESOURCE_EXHAUSTED')) {
      isQuotaExhausted = true;
      quotaExhaustedUntil = Date.now() + QUOTA_COOLDOWN;
      console.log(`🚫 Circuit breaker activated: Firebase quota exhausted until ${new Date(quotaExhaustedUntil).toLocaleTimeString()}`);
      
      return res.status(503).json({
        success: false,
        error: "Firebase quota exhausted. Service temporarily unavailable.",
        retryAfter: Math.ceil(QUOTA_COOLDOWN / 1000)
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get user's answered quizzes
router.post('/get-answered-quizzes', async (req, res) => {
  try {
    // Check circuit breaker
    if (isQuotaExhausted && Date.now() < quotaExhaustedUntil) {
      return res.status(503).json({
        success: false,
        error: "Firebase quota exhausted. Please try again later.",
        retryAfter: Math.ceil((quotaExhaustedUntil - Date.now()) / 1000)
      });
    }

    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`Fetching answered quizzes for ${userAccount}`);

    // Get user's answered quizzes from Firestore (simplified query)
    const answeredQuery = await db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .get();

    const answeredQuizzes = answeredQuery.docs
      .map(doc => ({
        quizId: doc.data().quizId,
        answeredAt: doc.data().answeredAt?.toMillis() || Date.now(),
        correct: doc.data().correct || false,
        mode: doc.data().mode || 'solo',
        rewardAmount: doc.data().rewardAmount || "0",
        txHash: doc.data().txHash || null
      }))
      .sort((a, b) => b.answeredAt - a.answeredAt); // Sort by answeredAt descending

    console.log(`Found ${answeredQuizzes.length} answered quizzes for ${userAccount}`);

    res.json({
      success: true,
      answeredQuizzes: answeredQuizzes,
      total: answeredQuizzes.length
    });

  } catch (error) {
    console.error("Error fetching answered quizzes:", error);
    
    // Check if it's a quota exhaustion error
    if (error.code === 8 || error.message.includes('Quota exceeded') || error.message.includes('RESOURCE_EXHAUSTED')) {
      isQuotaExhausted = true;
      quotaExhaustedUntil = Date.now() + QUOTA_COOLDOWN;
      console.log(`🚫 Circuit breaker activated: Firebase quota exhausted until ${new Date(quotaExhaustedUntil).toLocaleTimeString()}`);
      
      return res.status(503).json({
        success: false,
        error: "Firebase quota exhausted. Service temporarily unavailable.",
        retryAfter: Math.ceil(QUOTA_COOLDOWN / 1000)
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get user statistics
router.post('/get-user-stats', async (req, res) => {
  try {
    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`Fetching stats for ${userAccount}`);

    const userStatsDoc = await db.collection('user_stats')
      .doc(userAccount.toLowerCase())
      .get();

    let stats = {
      totalAnswered: 0,
      totalCorrect: 0,
      totalEarned: "0",
      streak: 0,
      accuracy: 0
    };

    if (userStatsDoc.exists) {
      const data = userStatsDoc.data();
      stats = {
        totalAnswered: data.totalAnswered || 0,
        totalCorrect: data.totalCorrect || 0,
        totalEarned: data.totalEarned || "0",
        streak: data.streak || 0,
        accuracy: data.totalAnswered > 0 ? 
          Math.round((data.totalCorrect / data.totalAnswered) * 100) : 0,
        firstAnsweredAt: data.firstAnsweredAt?.toMillis(),
        lastAnsweredAt: data.lastAnsweredAt?.toMillis()
      };
    }

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Record user answer (called after successful blockchain transaction)
router.post('/record-answer', async (req, res) => {
  try {
    const { 
      userAccount, 
      quizId, 
      answer, 
      correct, 
      mode, 
      rewardAmount, 
      txHash 
    } = req.body;

    if (!userAccount || !quizId) {
      return res.status(400).json({
        success: false,
        error: "userAccount and quizId are required"
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`Recording answer for ${userAccount}: ${quizId}`);

    // Check if already answered
    const existingQuery = await db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .where('quizId', '==', quizId)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      return res.status(409).json({
        success: false,
        error: "Quiz already answered by this user"
      });
    }

    // Record the answer
    const answerDoc = {
      userAccount: userAccount.toLowerCase(),
      quizId: quizId,
      answer: answer,
      correct: correct || false,
      mode: mode || 'solo',
      rewardAmount: rewardAmount || "0",
      txHash: txHash || null,
      answeredAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('user_answers').add(answerDoc);

    // Update user stats
    const userStatsRef = db.collection('user_stats').doc(userAccount.toLowerCase());
    const userStats = await userStatsRef.get();

    if (userStats.exists) {
      const currentStats = userStats.data();
      await userStatsRef.update({
        totalAnswered: (currentStats.totalAnswered || 0) + 1,
        totalCorrect: (currentStats.totalCorrect || 0) + (correct ? 1 : 0),
        totalEarned: (parseFloat(currentStats.totalEarned || "0") + parseFloat(rewardAmount || "0")).toString(),
        lastAnsweredAt: admin.firestore.FieldValue.serverTimestamp(),
        streak: correct ? (currentStats.streak || 0) + 1 : 0
      });
    } else {
      await userStatsRef.set({
        userAccount: userAccount.toLowerCase(),
        totalAnswered: 1,
        totalCorrect: correct ? 1 : 0,
        totalEarned: rewardAmount || "0",
        firstAnsweredAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAnsweredAt: admin.firestore.FieldValue.serverTimestamp(),
        streak: correct ? 1 : 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`Answer recorded successfully for ${userAccount}`);

    res.json({
      success: true,
      message: "Answer recorded successfully"
    });

  } catch (error) {
    console.error("Error recording answer:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Complete a quiz - move to completed_quizzes collection
router.post('/complete-quiz', async (req, res) => {
  try {
    const { userAccount, quizId, answer, correct, rewardAmount, txHash, quizData } = req.body;

    if (!userAccount || !quizId) {
      return res.status(400).json({
        success: false,
        error: "userAccount and quizId are required"
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`📝 Completing quiz ${quizId} for ${userAccount}`);

    // Create completed quiz document
    const completedQuizDoc = {
      userAccount: userAccount.toLowerCase(),
      quizId,
      answer,
      correct: correct || false,
      rewardAmount: rewardAmount || "0",
      txHash: txHash || null,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // Store full quiz data for history
      quizData: quizData || {
        question: "Question not available",
        options: [],
        category: "general",
        difficulty: 50
      }
    };

    // Add to completed_quizzes collection
    await db.collection('completed_quizzes').add(completedQuizDoc);

    // Also add to user_answers for backward compatibility
    const answerDoc = {
      userAccount: userAccount.toLowerCase(),
      quizId,
      answer,
      correct: correct || false,
      rewardAmount: rewardAmount || "0",
      txHash: txHash || null,
      answeredAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('user_answers').add(answerDoc);

    // Update user stats
    const userStatsRef = db.collection('user_stats').doc(userAccount.toLowerCase());
    const userStats = await userStatsRef.get();

    if (userStats.exists) {
      const currentStats = userStats.data();
      await userStatsRef.update({
        totalAnswered: (currentStats.totalAnswered || 0) + 1,
        totalCorrect: (currentStats.totalCorrect || 0) + (correct ? 1 : 0),
        totalEarned: (parseFloat(currentStats.totalEarned || "0") + parseFloat(rewardAmount || "0")).toString(),
        lastAnsweredAt: admin.firestore.FieldValue.serverTimestamp(),
        streak: correct ? (currentStats.streak || 0) + 1 : 0,
        accuracy: Math.round(((currentStats.totalCorrect || 0) + (correct ? 1 : 0)) / ((currentStats.totalAnswered || 0) + 1) * 100)
      });
    } else {
      await userStatsRef.set({
        userAccount: userAccount.toLowerCase(),
        totalAnswered: 1,
        totalCorrect: correct ? 1 : 0,
        totalEarned: rewardAmount || "0",
        firstAnsweredAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAnsweredAt: admin.firestore.FieldValue.serverTimestamp(),
        streak: correct ? 1 : 0,
        accuracy: correct ? 100 : 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`✅ Quiz ${quizId} completed successfully for ${userAccount}`);

    // Emit Socket.IO event for real-time frontend updates
    const io = req.app.locals.io;
    if (io) {
      io.emit('quizCompleted', {
        userAccount: userAccount.toLowerCase(),
        quizId,
        correct,
        rewardAmount,
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Emitted quizCompleted event for user ${userAccount}, quiz ${quizId}`);
    }

    res.json({
      success: true,
      message: "Quiz completed successfully",
      quizId,
      correct,
      rewardAmount
    });

  } catch (error) {
    console.error("Error completing quiz:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get user's completed quizzes
router.post('/get-completed-quizzes', async (req, res) => {
  try {
    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`Fetching completed quizzes for ${userAccount}`);

    const completedQuery = await db.collection('completed_quizzes')
      .where('userAccount', '==', userAccount.toLowerCase())
      .limit(100)
      .get();

    const completedQuizzes = completedQuery.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate?.() || null
      }))
      .sort((a, b) => {
        // Sort by completedAt descending (newest first)
        const aTime = a.completedAt ? a.completedAt.getTime() : 0;
        const bTime = b.completedAt ? b.completedAt.getTime() : 0;
        return bTime - aTime;
      });

    console.log(`Found ${completedQuizzes.length} completed quizzes for ${userAccount}`);

    res.json({
      success: true,
      completedQuizzes,
      total: completedQuizzes.length
    });

  } catch (error) {
    console.error("Error fetching completed quizzes:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate Merkle proof for a specific answer
router.post('/generate-merkle-proof', async (req, res) => {
  try {
    const { quizId, answer } = req.body;
    
    if (!quizId || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: "quizId and answer are required" 
      });
    }

    console.log(`🔍 Generating Merkle proof for quiz ${quizId}, answer: ${answer}`);

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    const proofData = await generateMerkleProof(quizId, answer, db);

    console.log(`✅ Merkle proof generated for ${quizId}:`, {
      leaf: proofData.leaf,
      proofLength: proofData.proof?.length,
      isValid: proofData.isValid,
      batchId: proofData.batchId
    });

    res.json({
      success: true,
      ...proofData
    });

  } catch (error) {
    console.error("❌ Error generating Merkle proof:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Check if a specific quiz has been completed by a user
router.post('/check-quiz-completed', async (req, res) => {
  try {
    console.log('📥 Received check-quiz-completed request');
    console.log('Request body:', req.body);
    
    const { userAccount, quizId } = req.body;
    
    if (!userAccount || !quizId) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false, 
        error: "userAccount and quizId are required" 
      });
    }

    const db = req.app.locals.db;
    console.log('🔍 Database available:', !!db);
    
    if (!db) {
      console.log('❌ Firebase not available');
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`🔍 Checking if quiz ${quizId} completed by ${userAccount}`);

    // Check in completed_quizzes collection
    console.log('🔍 Executing Firestore query...');
    const completedQuery = await db.collection('completed_quizzes')
      .where('userAccount', '==', userAccount.toLowerCase())
      .where('quizId', '==', quizId)
      .limit(1)
      .get();

    console.log('📊 Query results:', {
      empty: completedQuery.empty,
      size: completedQuery.size
    });

    const isCompleted = !completedQuery.empty;
    let completedData = null;

    if (isCompleted) {
      completedData = completedQuery.docs[0].data();
      console.log(`✅ Quiz ${quizId} already completed by ${userAccount}`);
      console.log('📋 Completed data:', completedData);
    } else {
      console.log(`❌ Quiz ${quizId} not completed by ${userAccount}`);
    }

    res.json({
      success: true,
      isCompleted,
      completedData: isCompleted ? {
        answer: completedData.answer,
        correct: completedData.correct,
        rewardAmount: completedData.rewardAmount,
        txHash: completedData.txHash,
        completedAt: completedData.completedAt?.toDate?.() || null
      } : null
    });

  } catch (error) {
    console.error("❌ Error checking quiz completion:", error);
    console.error("Error details:", error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Sync quiz completion status when blockchain and Firebase are out of sync
router.post('/sync-quiz-completion', async (req, res) => {
  try {
    const { userAccount, quizId, reason } = req.body;
    
    if (!userAccount || !quizId) {
      return res.status(400).json({ 
        success: false, 
        error: "userAccount and quizId are required" 
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`🔄 Syncing quiz completion for ${quizId} by ${userAccount} - Reason: ${reason}`);

    // Check if already exists
    const existingQuery = await db.collection('completed_quizzes')
      .where('userAccount', '==', userAccount.toLowerCase())
      .where('quizId', '==', quizId)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      console.log(`✅ Quiz ${quizId} already marked as completed in Firebase`);
      return res.json({
        success: true,
        message: "Quiz already marked as completed",
        alreadyExists: true
      });
    }

    // Get quiz data for the completion record
    const questionDoc = await db.collection('questions').doc(quizId).get();
    let quizData = { question: "Question not available", options: [], category: "general", difficulty: 50 };
    
    if (questionDoc.exists) {
      const qData = questionDoc.data();
      quizData = {
        question: qData.question || "Question not available",
        options: qData.options || [],
        category: qData.category || "general",
        difficulty: qData.difficulty || 50
      };
    }

    // Create completed quiz document
    const completedQuizDoc = {
      userAccount: userAccount.toLowerCase(),
      quizId,
      answer: "Unknown (synced from blockchain)",
      correct: true, // Assume correct since it was solved on blockchain
      rewardAmount: "100", // Default reward
      txHash: null, // Unknown transaction hash
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      syncReason: reason || "blockchain_state_sync",
      quizData
    };

    await db.collection('completed_quizzes').add(completedQuizDoc);
    console.log(`✅ Synced quiz ${quizId} completion for ${userAccount}`);

    res.json({
      success: true,
      message: "Quiz completion synced successfully",
      quizId,
      synced: true
    });

  } catch (error) {
    console.error("❌ Error syncing quiz completion:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error"
    });
  }
});

export default router;