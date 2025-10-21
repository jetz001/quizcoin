// src/services/authService.js - Frontend authentication service
const API_BASE_URL = 'http://localhost:3001';

class AuthService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.tokenKey = 'quizcoin_token';
    this.userKey = 'quizcoin_user';
  }

  // Get stored token
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  // Get stored user
  getUser() {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  // Store token and user
  setAuth(token, user) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  // Clear auth data
  clearAuth() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  }

  // Make authenticated request
  async authenticatedRequest(endpoint, options = {}) {
    const token = this.getToken();
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      const data = await response.json();

      // If token is invalid, clear auth
      if (response.status === 401 || response.status === 403) {
        this.clearAuth();
        throw new Error('Authentication expired');
      }

      return { ...data, status: response.status };
    } catch (error) {
      console.error(`Auth request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Register new user
  async register(userData) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (data.success) {
        this.setAuth(data.token, data.user);
      }

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Login user
  async login(credentials) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success) {
        this.setAuth(data.token, data.user);
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Logout user
  async logout() {
    try {
      if (this.isAuthenticated()) {
        await this.authenticatedRequest('/api/auth/logout', {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  // Get user profile
  async getProfile() {
    return this.authenticatedRequest('/api/auth/profile');
  }

  // Update user profile
  async updateProfile(updates) {
    return this.authenticatedRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Verify token
  async verifyToken() {
    try {
      const result = await this.authenticatedRequest('/api/auth/verify');
      return result.success;
    } catch (error) {
      return false;
    }
  }

  // Check username availability
  async checkUsername(username) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/check-username/${username}`);
      return await response.json();
    } catch (error) {
      console.error('Username check error:', error);
      throw error;
    }
  }

  // Check email availability
  async checkEmail(email) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/check-email/${email}`);
      return await response.json();
    } catch (error) {
      console.error('Email check error:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats() {
    return this.authenticatedRequest('/api/auth/stats');
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;
