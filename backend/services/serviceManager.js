// services/serviceManager.js - Centralized service management
import { initializeDatabase, disconnectDatabase } from './database.js';
import { initializeBlockchain } from './blockchain.js';

class ServiceManager {
  constructor() {
    this.services = new Map();
    this.isInitialized = false;
    this.shutdownHandlers = [];
  }

  // Register a service with initialization and cleanup
  registerService(name, initFn, cleanupFn = null) {
    this.services.set(name, {
      name,
      initFn,
      cleanupFn,
      instance: null,
      status: 'not_initialized'
    });
  }

  // Initialize all services in dependency order
  async initializeAll() {
    console.log('🚀 Initializing all services...');
    
    const initOrder = [
      'database',
      'blockchain',
      'quiz-generator',
      'merkle-tree'
    ];

    for (const serviceName of initOrder) {
      await this.initializeService(serviceName);
    }

    this.isInitialized = true;
    console.log('✅ All services initialized successfully');
    return this.getServiceInstances();
  }

  // Initialize individual service
  async initializeService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }

    try {
      console.log(`🔄 Initializing ${name}...`);
      service.status = 'initializing';
      service.instance = await service.initFn();
      service.status = 'running';
      console.log(`✅ ${name} initialized`);
      return service.instance;
    } catch (error) {
      service.status = 'failed';
      console.error(`❌ Failed to initialize ${name}:`, error);
      throw error;
    }
  }

  // Get all service instances
  getServiceInstances() {
    const instances = {};
    for (const [name, service] of this.services) {
      instances[name] = service.instance;
    }
    return instances;
  }

  // Get service status
  getServiceStatus() {
    const status = {};
    for (const [name, service] of this.services) {
      status[name] = service.status;
    }
    return status;
  }

  // Graceful shutdown of all services
  async shutdown() {
    console.log('🛑 Shutting down services...');
    
    // Shutdown in reverse order
    const shutdownOrder = Array.from(this.services.keys()).reverse();
    
    for (const serviceName of shutdownOrder) {
      await this.shutdownService(serviceName);
    }

    // Run additional shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Shutdown handler error:', error);
      }
    }

    console.log('✅ All services shut down');
  }

  // Shutdown individual service
  async shutdownService(name) {
    const service = this.services.get(name);
    if (!service || !service.cleanupFn) return;

    try {
      console.log(`🔄 Shutting down ${name}...`);
      await service.cleanupFn(service.instance);
      service.status = 'stopped';
      console.log(`✅ ${name} shut down`);
    } catch (error) {
      console.error(`❌ Error shutting down ${name}:`, error);
    }
  }

  // Add custom shutdown handler
  addShutdownHandler(handler) {
    this.shutdownHandlers.push(handler);
  }

  // Health check for all services
  async healthCheck() {
    const health = {};
    
    for (const [name, service] of this.services) {
      health[name] = {
        status: service.status,
        healthy: service.status === 'running' && service.instance !== null
      };
    }

    return {
      overall: Object.values(health).every(s => s.healthy),
      services: health,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const serviceManager = new ServiceManager();

// Register core services
serviceManager.registerService(
  'database',
  initializeDatabase,
  disconnectDatabase
);

serviceManager.registerService(
  'blockchain',
  initializeBlockchain,
  null // No cleanup needed for blockchain
);

serviceManager.registerService(
  'quiz-generator',
  async () => {
    // Initialize quiz generation service
    console.log('Quiz generator ready');
    return { status: 'ready' };
  },
  null
);

serviceManager.registerService(
  'merkle-tree',
  async () => {
    // Initialize merkle tree service
    console.log('Merkle tree service ready');
    return { status: 'ready' };
  },
  null
);

export default serviceManager;
