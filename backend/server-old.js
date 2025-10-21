// server.js - Main entry point (refactored)
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import routes
import adminRoutes from './routes/adminRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import merkleRoutes from './routes/merkleRoutes.js';
import dataRoutes from './routes/dataRoutes.js';

// Import services
import { initializeDatabase, disconnectDatabase } from './services/database.js';
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
    
    // Initialize Database
    const db = await initializeDatabase();
    
    // Initialize Blockchain
    const blockchain = await initializeBlockchain();
    
    // Make services available to routes
    app.locals.db = db;
    app.locals.blockchain = blockchain;
    
    // Routes
    app.use('/admin', adminRoutes);
    app.use('/api', apiRoutes);
    app.use('/merkle', merkleRoutes);
    app.use('/data', dataRoutes);
    
    
    // Health check
    app.get('/', (req, res) => {
      res.json({
        message: 'QuizCoin Backend (batch-merkle mode)',
        status: 'running',
        timestamp: new Date().toISOString(),
        services: {
          database: !!db,
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
    
    // Create HTTP server and Socket.IO
    const server = createServer(app);
    const io = new SocketIOServer(server, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        methods: ["GET", "POST"]
      }
    });

    // Make Socket.IO available to routes
    app.locals.io = io;

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server listening on ${PORT}`);
      console.log(`🌐 Admin dashboard: http://localhost:${PORT}/admin`);
      console.log(`🔌 Socket.IO ready for real-time updates`);
    });
    
    // Graceful shutdown with proper cleanup
    let isShuttingDown = false;
    
    const gracefulShutdown = (signal) => {
      if (isShuttingDown) {
        console.log('🛑 Shutdown already in progress...');
        return;
      }
      
      isShuttingDown = true;
      console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
      
      // Close Socket.IO connections
      io.close(() => {
        console.log('✅ Socket.IO closed');
        
        // Close database connection
        disconnectDatabase().then(() => {
          // Close HTTP server
          server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
          });
        });
      });
      
      // Force exit after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        console.log('⚠️ Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    
    // Set max listeners to prevent warning
    process.setMaxListeners(20);
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();