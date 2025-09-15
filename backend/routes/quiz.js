// backend/routes/quiz.js - Fixed version without composite index dependency
import express from 'express';

const router = express.Router();

// Helper to get db from app.locals
const getDb = (req) => req.app.locals.db;

// Get user's answered quizzes - FIXED to not use composite index
router.post('/get-answered-quizzes', async (req, res) => {
  try {
    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    const db = getDb(req);
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`📊 Fetching answered quizzes for ${userAccount}`);

    // FIXED: Remove orderBy to avoid composite index requirement
    const answeredQuery = await db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .get();

    // Sort in JavaScript instead of Firestore
    const answeredQuizzes = answeredQuery.docs
      .map(doc => ({
        quizId: doc.data().quizId,
        answeredAt: doc.data().answeredAt?.toMillis() || Date.now(),
        correct: doc.data().correct || false,
        mode: doc.data().mode || 'solo',
        rewardAmount: doc.data().rewardAmount || "0",
        txHash: doc.data().txHash || null
      }))
      .sort((a, b) => b.answeredAt - a.answeredAt); // Sort descending in JS

    console.log(`✅ Found ${answeredQuizzes.length} answered quizzes for ${userAccount}`);

    res.json({
      success: true,
      answeredQuizzes: answeredQuizzes,
      total: answeredQuizzes.length
    });

  } catch (error) {
    console.error("Error fetching answered quizzes:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get available quizzes - FIXED to not use composite index
router.post('/get-available-quizzes', async (req, res) => {
  try {
    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    const db = getDb(req);
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`🔍 Finding available quizzes for ${userAccount}`);

    // Get all answered quizzes by this user - simple query
    const answeredQuery = await db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .get();

    const answeredQuizIds = new Set(
      answeredQuery.docs.map(doc => doc.data().quizId)
    );

    // FIXED: Remove orderBy to avoid index requirement
    const questionsQuery = await db.collection('questions')
      .where('isAnswered', '==', false)
      .limit(50)
      .get();

    const availableQuizzes = questionsQuery.docs
      .map(doc => ({
        ...doc.data(),
        quizId: doc.id
      }))
      .filter(quiz => !answeredQuizIds.has(quiz.quizId))
      .sort((a, b) => {
        // Sort by createdAt in JavaScript
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime; // Descending order
      });

    console.log(`✅ Found ${availableQuizzes.length} available quizzes`);

    res.json({
      success: true,
      quizzes: availableQuizzes,
      total: availableQuizzes.length
    });

  } catch (error) {
    console.error("Error fetching available quizzes:", error);
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

    const db = getDb(req);
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`📊 Fetching stats for ${userAccount}`);

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

    console.log(`✅ Stats fetched successfully for ${userAccount}:`, stats);

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

    const db = getDb(req);
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`📝 Recording answer for ${userAccount}: ${quizId}`);

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

    // Get admin reference
    const admin = await import('firebase-admin');

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

    console.log(`✅ Answer recorded successfully for ${userAccount}`);

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

export default router;