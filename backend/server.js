// backend/server.js - Fixed for ES modules (type: "module")
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import modules (ES module syntax)
import { initializeFirebase } from './services/firebase.js';
import { initializeBlockchain } from './services/blockchain.js';
import merkleRoutes from './routes/merkle.js';
import quizRoutes from './routes/quiz.js';
import adminRoutes from './routes/admin.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize services
async function initializeServices() {
  try {
    // Initialize Firebase
    const db = await initializeFirebase();
    console.log("✅ Firebase initialized");
    
    // Initialize Blockchain
    const { provider, signer, merkleContract } = await initializeBlockchain();
    if (merkleContract) {
      console.log("✅ Blockchain initialized");
    }
    
    // Make services available globally
    app.locals.db = db;
    app.locals.merkleContract = merkleContract;
    app.locals.provider = provider;
    app.locals.signer = signer;
    
  } catch (error) {
    console.error("❌ Service initialization failed:", error);
    console.warn("⚠️ Server will continue with limited functionality");
  }
}

// Routes
app.use('/api', merkleRoutes);
app.use('/api', quizRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    services: {
      firebase: !!app.locals.db,
      blockchain: !!app.locals.merkleContract,
      gemini: !!process.env.GEMINI_API_KEY
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
async function startServer() {
  await initializeServices();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server listening on ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 Admin dashboard: http://localhost:${PORT}/admin`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});