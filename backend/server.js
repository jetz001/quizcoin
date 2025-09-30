// server.js - Main entry point (refactored)
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import routes
import adminRoutes from './routes/adminRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import merkleRoutes from './routes/merkleRoutes.js';

// Import services
import { initializeFirebase } from './services/firebase.js';
import { initializeBlockchain } from './services/blockchain.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize services
const startServer = async () => {
  try {
    console.log('🚀 Starting QuizCoin Backend...');
    
    // Initialize Firebase
    const db = await initializeFirebase();
    
    // Initialize Blockchain
    const blockchain = await initializeBlockchain();
    
    // Make services available to routes
    app.locals.db = db;
    app.locals.blockchain = blockchain;
    
    // Routes
    app.use('/admin', adminRoutes);
    app.use('/api', apiRoutes);
    app.use('/api', merkleRoutes);
    
    // Health check
    app.get('/', (req, res) => {
      res.json({
        message: 'QuizCoin Backend (batch-merkle mode)',
        status: 'running',
        timestamp: new Date().toISOString(),
        services: {
          firebase: !!db,
          blockchain: !!blockchain.merkleContract
        }
      });
    });
    
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
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server listening on ${PORT}`);
      console.log(`🌐 Admin dashboard: http://localhost:${PORT}/admin`);
    });
    
    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('🛑 Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();