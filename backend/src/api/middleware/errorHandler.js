// backend/middleware/errorHandler.js

// Global error handlers
export const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    console.error('Stack:', err.stack);
    // Don't exit immediately, log the error and continue
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, log the error and continue
  });
};

// Express error handling middleware
export const errorHandler = (error, req, res, next) => {
  console.error('Express Error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: error.message 
  });
};

// 404 handler
export const notFoundHandler = (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found` 
  });
};