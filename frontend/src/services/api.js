// src/services/api.js - API service for organized backend
const API_BASE_URL = 'http://localhost:3001';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Quiz endpoints
  async getRandomQuiz() {
    return this.request('/api/quiz/random');
  }

  async getQuizzes(limit = 20, category = null, difficulty = null) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    
    const queryString = params.toString();
    const endpoint = `/api/quiz${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async submitAnswer(quizId, answer, userAccount) {
    return this.request('/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({
        quizId,
        answer,
        userAccount
      })
    });
  }

  async generateMerkleProof(quizId, answer) {
    return this.request('/merkle/generate-merkle-proof', {
      method: 'POST',
      body: JSON.stringify({
        quizId,
        answer
      })
    });
  }

  async verifyMerkleProof(leaf, proof, batchId) {
    return this.request('/merkle/verify-merkle-proof', {
      method: 'POST',
      body: JSON.stringify({
        leaf,
        proof,
        batchId
      })
    });
  }

  // Admin endpoints
  async getStats() {
    return this.request('/admin/stats');
  }

  async generateBatch(config = {}) {
    return this.request('/admin/batch/generate', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async getBatchStatus(batchId) {
    return this.request(`/admin/batch/${batchId}/status`);
  }

  // Data endpoints
  async getDatabaseStats() {
    return this.request('/data/stats');
  }

  // User management (if implemented)
  async getUserProfile(userAccount) {
    return this.request(`/api/user/${userAccount}`);
  }

  async updateUserProfile(userAccount, profileData) {
    return this.request(`/api/user/${userAccount}`, {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  // Leaderboard
  async getLeaderboard(limit = 10) {
    return this.request(`/api/leaderboard?limit=${limit}`);
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;

// Named exports for specific functions
export const {
  healthCheck,
  getRandomQuiz,
  getQuizzes,
  submitAnswer,
  generateMerkleProof,
  verifyMerkleProof,
  getStats,
  generateBatch,
  getBatchStatus,
  getDatabaseStats,
  getUserProfile,
  updateUserProfile,
  getLeaderboard
} = apiService;
