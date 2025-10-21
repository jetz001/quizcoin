// routes/dataRoutes.js - Simple data viewing endpoints
import express from 'express';

const router = express.Router();

// Get database statistics
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const [questions, answers, batches, leaves] = await Promise.all([
      db.question.count(),
      db.userAnswer.count(),
      db.merkleBatch.count(),
      db.merkleLeaf.count()
    ]);
    
    res.json({
      success: true,
      stats: {
        questions,
        userAnswers: answers,
        merkleBatches: batches,
        merkleLeaves: leaves,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent questions
router.get('/questions', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const limit = parseInt(req.query.limit) || 10;
    
    const questions = await db.question.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        quizId: true,
        question: true,
        category: true,
        difficulty: true,
        totalAnswers: true,
        correctAnswers: true,
        createdAt: true,
        status: true
      }
    });
    
    res.json({
      success: true,
      questions,
      count: questions.length
    });
  } catch (error) {
    console.error('Questions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent answers
router.get('/answers', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const limit = parseInt(req.query.limit) || 10;
    
    const answers = await db.userAnswer.findMany({
      take: limit,
      orderBy: { answeredAt: 'desc' },
      select: {
        quizId: true,
        userAccount: true,
        answer: true,
        isCorrect: true,
        answeredAt: true,
        rewardAmount: true,
        mode: true
      }
    });
    
    res.json({
      success: true,
      answers,
      count: answers.length
    });
  } catch (error) {
    console.error('Answers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get batches
router.get('/batches', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const batches = await db.merkleBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    res.json({
      success: true,
      batches,
      count: batches.length
    });
  } catch (error) {
    console.error('Batches error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search questions
router.get('/search', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { q, category, difficulty } = req.query;
    
    const where = {};
    
    if (q) {
      where.question = {
        contains: q,
        mode: 'insensitive'
      };
    }
    
    if (category) {
      where.category = category;
    }
    
    if (difficulty) {
      where.difficulty = parseInt(difficulty);
    }
    
    const questions = await db.question.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      success: true,
      questions,
      count: questions.length,
      query: { q, category, difficulty }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
