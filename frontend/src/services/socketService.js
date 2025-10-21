// frontend/src/services/socketService.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(url = 'http://localhost:3001') {
    if (this.socket) {
      return this.socket;
    }

    console.log('🔌 Connecting to Socket.IO server...');
    
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', this.socket.id);
      this.isConnected = true;
      
      // Test connection by requesting server info
      setTimeout(() => {
        console.log('🔍 Testing Socket.IO connection...');
        console.log('🔍 Connected:', this.socket.connected);
        console.log('🔍 Socket ID:', this.socket.id);
      }, 1000);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
      this.isConnected = false;
    });

    // Listen for fresh question creation events
    this.socket.on('freshQuestionCreated', (data) => {
      console.log('📡 Received freshQuestionCreated event:', data);
      console.log('🔄 Socket connection status:', this.socket.connected);
      console.log('🔄 Socket ID:', this.socket.id);
      this.emit('freshQuestionCreated', data);
    });

    // Listen for quiz completion events
    this.socket.on('quizCompleted', (data) => {
      console.log('📡 Received quizCompleted event:', data);
      this.emit('quizCompleted', data);
    });

    // Listen for real-time question ID updates
    this.socket.on('questionIdUpdated', (data) => {
      console.log('📡 Received questionIdUpdated event:', data);
      console.log('🔄 Processing question ID update from', data.oldQuestionId, 'to', data.newQuestionId);
      this.emit('questionIdUpdated', data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting Socket.IO...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Event emitter pattern for internal use
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in socket event listener for ${event}:`, error);
        }
      });
    }
  }

  // Convenience methods for specific events
  onFreshQuestionCreated(callback) {
    this.on('freshQuestionCreated', callback);
  }

  onQuizCompleted(callback) {
    this.on('quizCompleted', callback);
  }

  onQuestionIdUpdated(callback) {
    this.on('questionIdUpdated', callback);
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null
    };
  }
}

// Create singleton instance
export const socketService = new SocketService();
export default SocketService;
