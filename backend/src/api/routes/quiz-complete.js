// src/api/routes/quiz-complete.js - Complete quiz API endpoints
import express from 'express';
import { prisma } from '../../services/database/index.js';
import AuthService from '../../services/auth/index.js';

const router = express.Router();

// Get random quiz question
router.get('/random', async (req, res) => {
  try {
    const { category, difficulty } = req.query;
    
    // Build where clause
    const where = {
      status: 'active'
    };
    
    if (category) {
      where.category = category;
    }
    
    if (difficulty) {
      where.difficulty = parseInt(difficulty);
    }

    // Get total count
    const totalCount = await prisma.question.count({ where });
    
    if (totalCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'No questions found matching criteria'
      });
    }

    // Get random question
    const randomSkip = Math.floor(Math.random() * totalCount);
    const question = await prisma.question.findFirst({
      where,
      skip: randomSkip
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'No question found'
      });
    }

    // Parse options from JSON string
    let options;
    try {
      options = JSON.parse(question.options);
    } catch (error) {
      options = question.options.split(','); // Fallback for non-JSON format
    }

    res.json({
      success: true,
      quizId: question.quizId,
      question: question.question,
      options: options,
      category: question.category,
      difficulty: question.difficulty,
      mode: question.mode
    });

  } catch (error) {
    console.error('Error getting random quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all quizzes with pagination
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 20, 
      offset = 0, 
      category, 
      difficulty,
      search 
    } = req.query;

    // Build where clause
    const where = {
      status: 'active'
    };

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = parseInt(difficulty);
    }

    if (search) {
      where.question = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Get questions
    const questions = await prisma.question.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse options for each question
    const questionsWithParsedOptions = questions.map(q => {
      let options;
      try {
        options = JSON.parse(q.options);
      } catch (error) {
        options = q.options.split(',');
      }

      return {
        ...q,
        options
      };
    });

    // Get total count
    const totalCount = await prisma.question.count({ where });

    res.json({
      success: true,
      questions: questionsWithParsedOptions,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
      }
    });

  } catch (error) {
    console.error('Error getting quizzes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new quiz question
router.post('/create', async (req, res) => {
  try {
    const { 
      question, 
      options, 
      correctAnswer, 
      category = 'general', 
      difficulty = 1,
      mode = 'solo'
    } = req.body;

    // Validation
    if (!question || !options || !correctAnswer) {
      return res.status(400).json({
        success: false,
        error: 'Question, options, and correctAnswer are required'
      });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Options must be an array with at least 2 items'
      });
    }

    if (!options.includes(correctAnswer)) {
      return res.status(400).json({
        success: false,
        error: 'Correct answer must be one of the options'
      });
    }

    // Generate unique quiz ID
    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Find correct answer index
    const answerIndex = options.indexOf(correctAnswer);

    // Create question
    const newQuestion = await prisma.question.create({
      data: {
        quizId,
        question,
        options: JSON.stringify(options),
        answerIndex,
        correctAnswer,
        difficulty: parseInt(difficulty),
        category,
        mode,
        status: 'active'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      question: {
        ...newQuestion,
        options: JSON.parse(newQuestion.options)
      }
    });

  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Submit answer (with optional authentication)
router.post('/submit', AuthService.optionalAuth, async (req, res) => {
  try {
    const { quizId, answer, userAccount } = req.body;

    if (!quizId || !answer || !userAccount) {
      return res.status(400).json({
        success: false,
        error: 'quizId, answer, and userAccount are required'
      });
    }

    // Get the question
    const question = await prisma.question.findUnique({
      where: { quizId }
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    // Check if answer is correct
    const isCorrect = answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    
    // Calculate reward (simple logic for now)
    const baseReward = 10;
    const difficultyMultiplier = question.difficulty;
    const reward = isCorrect ? (baseReward * difficultyMultiplier).toString() : '0';

    // Record the answer
    await prisma.userAnswer.create({
      data: {
        quizId,
        userId: req.user?.userId || null, // Link to user if authenticated
        userAccount: userAccount.toLowerCase(),
        answer,
        isCorrect,
        mode: question.mode,
        rewardAmount: reward
      }
    });

    // Update user stats if authenticated
    if (req.user?.userId && isCorrect) {
      // Get current user to calculate new total rewards
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId }
      });
      
      const currentRewards = parseFloat(currentUser?.totalRewards || '0');
      const newTotalRewards = (currentRewards + parseFloat(reward)).toString();
      
      await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          totalScore: { increment: parseInt(reward) },
          questionsAnswered: { increment: 1 },
          correctAnswers: { increment: 1 },
          totalRewards: newTotalRewards
        }
      });
    } else if (req.user?.userId) {
      await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          questionsAnswered: { increment: 1 }
        }
      });
    }

    // Update question statistics
    await prisma.question.update({
      where: { quizId },
      data: {
        totalAnswers: {
          increment: 1
        },
        correctAnswers: {
          increment: isCorrect ? 1 : 0
        },
        ...(isCorrect && !question.firstSolverAddress ? {
          firstSolverAddress: userAccount.toLowerCase(),
          firstCorrectAnswerTime: new Date()
        } : {})
      }
    });

    res.json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      reward: reward,
      message: isCorrect ? 'Correct answer!' : 'Incorrect answer',
      explanation: isCorrect ? 
        `Great job! You earned ${reward} QZC tokens.` : 
        `The correct answer was: ${question.correctAnswer}`
    });

  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get quiz categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.question.groupBy({
      by: ['category'],
      _count: {
        category: true
      },
      where: {
        status: 'active'
      }
    });

    res.json({
      success: true,
      categories: categories.map(cat => ({
        name: cat.category,
        count: cat._count.category
      }))
    });

  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
