// src/api/routes/health.js - Health check endpoints
import express from 'express';
import { prisma } from '../../services/database/index.js';

const router = express.Router();

// Main health check
router.get('/', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Get basic stats
    const [questionCount, userAnswerCount, batchCount] = await Promise.all([
      prisma.question.count(),
      prisma.userAnswer.count(),
      prisma.merkleBatch.count()
    ]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'operational',
        architecture: 'organized'
      },
      stats: {
        questions: questionCount,
        userAnswers: userAnswerCount,
        merkleBatches: batchCount
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: 'disconnected',
        api: 'operational',
        architecture: 'organized'
      }
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database with more detailed queries
    const [
      questionStats,
      categoryStats,
      recentAnswers,
      systemInfo
    ] = await Promise.all([
      prisma.question.aggregate({
        _count: { id: true },
        _avg: { difficulty: true },
        _max: { createdAt: true }
      }),
      prisma.question.groupBy({
        by: ['category'],
        _count: { category: true }
      }),
      prisma.userAnswer.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          isCorrect: true,
          rewardAmount: true
        }
      }),
      {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    ]);

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: {
          status: 'connected',
          type: 'SQLite',
          questions: questionStats._count.id,
          avgDifficulty: questionStats._avg.difficulty,
          lastQuestionAdded: questionStats._max.createdAt,
          categories: categoryStats.length
        },
        api: {
          status: 'operational',
          architecture: 'organized',
          endpoints: [
            '/health',
            '/api/quiz/*',
            '/admin/*',
            '/data/*',
            '/merkle/*'
          ]
        }
      },
      statistics: {
        questions: {
          total: questionStats._count.id,
          byCategory: categoryStats.map(cat => ({
            category: cat.category,
            count: cat._count.category
          })),
          averageDifficulty: Math.round(questionStats._avg.difficulty * 100) / 100
        },
        recentActivity: {
          recentAnswers: recentAnswers.length,
          correctAnswers: recentAnswers.filter(a => a.isCorrect).length,
          totalRewards: recentAnswers.reduce((sum, a) => sum + parseFloat(a.rewardAmount || 0), 0)
        }
      },
      system: systemInfo
    });

  } catch (error) {
    console.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: 'error',
        api: 'operational'
      }
    });
  }
});

export default router;
