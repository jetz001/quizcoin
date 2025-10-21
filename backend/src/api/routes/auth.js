// src/api/routes/auth.js - Authentication API endpoints
import express from 'express';
import AuthService from '../../services/auth/index.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, displayName, walletAddress } = req.body;

    const result = await AuthService.register({
      email,
      username,
      password,
      displayName,
      walletAddress
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Register endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const result = await AuthService.login({
      identifier,
      password
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }

  } catch (error) {
    console.error('Login endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/profile', AuthService.authenticateToken, async (req, res) => {
  try {
    const result = await AuthService.getProfile(req.user.userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    console.error('Profile endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', AuthService.authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    const result = await AuthService.updateProfile(req.user.userId, updates);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Update profile endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Verify token (useful for frontend to check if token is still valid)
router.get('/verify', AuthService.authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      userId: req.user.userId,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role
    },
    message: 'Token is valid'
  });
});

// Logout (client-side only, but useful for logging)
router.post('/logout', AuthService.authenticateToken, (req, res) => {
  // In a JWT setup, logout is handled client-side by removing the token
  // But we can log the logout event
  console.log(`User ${req.user.username} logged out`);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get user statistics
router.get('/stats', AuthService.authenticateToken, async (req, res) => {
  try {
    const stats = await AuthService.calculateUserStats(req.user.userId);
    
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Stats endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const { prisma } = await import('../../services/database/index.js');
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    res.json({
      success: true,
      available: !existingUser,
      message: existingUser ? 'Username is taken' : 'Username is available'
    });

  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Check email availability
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const { prisma } = await import('../../services/database/index.js');
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    res.json({
      success: true,
      available: !existingUser,
      message: existingUser ? 'Email is already registered' : 'Email is available'
    });

  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
