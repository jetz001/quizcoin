// backend/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configurations
import { CONFIG, displayConfig } from './config/constants.js';
import { initializeFirebase } from './config/database.js';
import { initializeBlockchain } from './config/blockchain.js';

// Import middleware
import { setupGlobalErrorHandlers, errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import adminRoutes from './routes/adminRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import merkleRoutes from './routes/merkleRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup global error handlers
setupGlobalErrorHandlers();

const app = express();

// Middleware
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize services
console.log("Initializing QuizCoin Backend...");
displayConfig();

const db = initializeFirebase();
const merkleContract = initializeBlockchain();

// Routes
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/api', merkleRoutes);

// Admin dashboard route
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'public', 'admin.html');
  res.sendFile(adminPath, (err) => {
    if (err) {
      console.error('Error sending admin.html:', err);
      res.status(500).send('Error loading admin page');
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'QuizCoin Backend (Refactored)',
    status: 'running',
    timestamp: new Date().toISOString(),
    config: {
      TOTAL_QUESTIONS: CONFIG.TOTAL_QUESTIONS,
      SUB_BATCH_SIZE: CONFIG.SUB_BATCH_SIZE,
      SUBMIT_LEAVES: CONFIG.SUBMIT_LEAVES,
      SUBMIT_CHUNK_SIZE: CONFIG.SUBMIT_CHUNK_SIZE,
      SUB_BATCH_DELAY: CONFIG.SUB_BATCH_DELAY,
      TX_DELAY: CONFIG.TX_DELAY
    },
    services: {
      firebase: !!db,
      gemini: !!CONFIG.GEMINI_API_KEY,
      blockchain: !!merkleContract
    },
    endpoints: [
      'POST /admin/generate-batch - Create new batch',
      'POST /admin/commit-batch - Commit batch to blockchain',
      'POST /admin/generate-and-commit - Generate and commit in one go',
      'GET /admin/config - View current configuration',
      'GET /admin/batches - View all batches',
      'POST /api/get-available-quizzes - Get available quizzes',
      'POST /api/get-answered-quizzes - Get user answered quizzes',
      'POST /api/get-user-stats - Get user statistics',
      'POST /api/record-answer - Record user answer',
      'POST /api/generate-merkle-proof - Generate Merkle proof',
      'POST /api/verify-merkle-proof - Verify Merkle proof',
      'GET /admin - Admin dashboard'
    ]
  });
});

// Error handling
app.use(errorHandler);
app.use(notFoundHandler);

// Start server
const server = app.listen(CONFIG.PORT, () => {
  console.log(`Server listening on port ${CONFIG.PORT}`);
  console.log(`Ready to generate batches with ${CONFIG.TOTAL_QUESTIONS} questions each`);
  console.log(`Admin dashboard: http://localhost:${CONFIG.PORT}/admin`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});