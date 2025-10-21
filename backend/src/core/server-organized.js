// src/core/server-organized.js - Main server with organized structure
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import serviceManager from './serviceManager.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    console.log('🚀 Starting QuizCoin Backend (Organized Structure)...');
    
    // Initialize all services
    const services = await serviceManager.initializeAll();
    
    // Create Express app
    const app = createApp();
    
    // Make services available to routes
    app.locals.db = services.database;
    app.locals.blockchain = services.blockchain;
    app.locals.quizGenerator = services['quiz-generator'];
    app.locals.merkleTree = services['merkle-tree'];
    app.locals.serviceManager = serviceManager;
    
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
      console.log(`🌐 Dashboard: http://localhost:${PORT}/dashboard.html`);
      console.log(`📊 Health: http://localhost:${PORT}/status`);
      console.log(`🔌 Socket.IO ready for real-time updates`);
      console.log(`📁 Structure: Organized & Service-Managed`);
    });
    
    // Graceful shutdown
    setupGracefulShutdown(server, io);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await serviceManager.shutdown();
    process.exit(1);
  }
}

function setupGracefulShutdown(server, io) {
  let isShuttingDown = false;
  
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) {
      console.log('🛑 Shutdown already in progress...');
      return;
    }
    
    isShuttingDown = true;
    console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
    
    // Close Socket.IO connections
    io.close(() => {
      console.log('✅ Socket.IO closed');
      
      // Shutdown all services
      serviceManager.shutdown().then(() => {
        // Close HTTP server
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      });
    });
    
    // Force exit after 15 seconds
    setTimeout(() => {
      console.log('⚠️ Forcing shutdown after timeout');
      process.exit(1);
    }, 15000);
  };
  
  // Set max listeners to prevent warning
  process.setMaxListeners(20);
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
}

startServer();
