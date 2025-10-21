// src/core/app.js - Express application setup
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import API routes
import apiRoutes from '../api/routes/index.js';
import healthRoutes from '../api/routes/health.js';
import quizRoutes from '../api/routes/quiz-complete.js';
import authRoutes from '../api/routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../public')));

  // Health check
  app.get('/', async (req, res) => {
    const serviceManager = req.app.locals.serviceManager;
    const health = await serviceManager.healthCheck();
    
    res.json({
      message: 'QuizCoin Backend (Service Managed)',
      status: 'running',
      timestamp: new Date().toISOString(),
      services: health.services,
      healthy: health.overall
    });
  });

  // Service status endpoint
  app.get('/status', async (req, res) => {
    const serviceManager = req.app.locals.serviceManager;
    const health = await serviceManager.healthCheck();
    res.json(health);
  });

  // API routes
  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/quiz', quizRoutes);
  app.use('/', apiRoutes);

  // Global error handling
  app.use((error, req, res, next) => {
    console.error('🚨 Express Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ 
      success: false, 
      error: 'Not found',
      message: `Route ${req.method} ${req.path} not found` 
    });
  });

  return app;
}
