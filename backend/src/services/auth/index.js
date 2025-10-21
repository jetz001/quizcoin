// src/services/auth/index.js - Authentication service
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  // Register new user
  static async register(userData) {
    try {
      const { email, username, password, displayName, walletAddress } = userData;

      // Validation
      if (!email || !username || !password) {
        throw new Error('Email, username, and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            { username: username.toLowerCase() },
            ...(walletAddress ? [{ walletAddress: walletAddress.toLowerCase() }] : [])
          ]
        }
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          throw new Error('Email already registered');
        }
        if (existingUser.username === username.toLowerCase()) {
          throw new Error('Username already taken');
        }
        if (walletAddress && existingUser.walletAddress === walletAddress.toLowerCase()) {
          throw new Error('Wallet address already registered');
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          passwordHash,
          displayName: displayName || username,
          walletAddress: walletAddress ? walletAddress.toLowerCase() : null,
          lastLoginAt: new Date()
        }
      });

      // Generate JWT token
      const token = this.generateToken(user);

      // Return user without password
      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token,
        message: 'User registered successfully'
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Login user
  static async login(credentials) {
    try {
      const { identifier, password } = credentials; // identifier can be email or username

      if (!identifier || !password) {
        throw new Error('Email/username and password are required');
      }

      // Find user by email or username
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier.toLowerCase() },
            { username: identifier.toLowerCase() }
          ],
          isActive: true
        }
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Generate JWT token
      const token = this.generateToken(user);

      // Return user without password
      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token,
        message: 'Login successful'
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate JWT token
  static generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Get user profile
  static async getProfile(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          achievements: {
            orderBy: { unlockedAt: 'desc' },
            take: 10
          },
          gameHistory: {
            orderBy: { startedAt: 'desc' },
            take: 10,
            where: { status: 'completed' }
          },
          _count: {
            select: {
              userAnswers: true,
              achievements: true,
              gameHistory: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Calculate additional stats
      const stats = await this.calculateUserStats(userId);

      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: {
          ...userWithoutPassword,
          stats
        }
      };

    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate user statistics
  static async calculateUserStats(userId) {
    const [
      totalAnswers,
      correctAnswers,
      recentAnswers,
      categoryStats
    ] = await Promise.all([
      prisma.userAnswer.count({
        where: { userId }
      }),
      prisma.userAnswer.count({
        where: { userId, isCorrect: true }
      }),
      prisma.userAnswer.findMany({
        where: { userId },
        orderBy: { answeredAt: 'desc' },
        take: 10,
        include: {
          question: {
            select: { category: true, difficulty: true }
          }
        }
      }),
      prisma.userAnswer.groupBy({
        by: ['isCorrect'],
        where: { userId },
        _count: true
      })
    ]);

    const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;

    return {
      totalAnswers,
      correctAnswers,
      accuracy: Math.round(accuracy * 100) / 100,
      recentActivity: recentAnswers.length,
      categoryBreakdown: categoryStats
    };
  }

  // Update user profile
  static async updateProfile(userId, updates) {
    try {
      const allowedUpdates = ['displayName', 'avatar', 'preferredCategories', 'difficulty', 'soundEnabled'];
      const filteredUpdates = {};

      // Filter allowed updates
      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid updates provided');
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...filteredUpdates,
          updatedAt: new Date()
        }
      });

      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        message: 'Profile updated successfully'
      };

    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Middleware to authenticate requests
  static authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    try {
      const decoded = AuthService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  }

  // Optional authentication (doesn't fail if no token)
  static optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = AuthService.verifyToken(token);
        req.user = decoded;
      } catch (error) {
        // Token is invalid, but we don't fail the request
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  }
}

export default AuthService;
