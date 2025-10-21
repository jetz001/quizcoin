// src/core/serviceManager.js - Organized service manager
import { initializeDatabase, disconnectDatabase } from '../services/database/index.js';
import { initializeBlockchain } from '../services/blockchain/index.js';

class ServiceManager {
  constructor() {
    this.services = new Map();
    this.isInitialized = false;
    this.shutdownHandlers = [];
  }

  registerService(name, initFn, cleanupFn = null) {
    this.services.set(name, {
      name,
      initFn,
      cleanupFn,
      instance: null,
      status: 'not_initialized'
    });
  }

  async initializeAll() {
    console.log('🚀 Initializing services (organized structure)...');
    
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
    console.log('✅ All services initialized');
    return this.getServiceInstances();
  }

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
      console.log(`✅ ${name} ready`);
      return service.instance;
    } catch (error) {
      service.status = 'failed';
      console.error(`❌ Failed to initialize ${name}:`, error);
      throw error;
    }
  }

  getServiceInstances() {
    const instances = {};
    for (const [name, service] of this.services) {
      instances[name] = service.instance;
    }
    return instances;
  }

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

  async shutdown() {
    console.log('🛑 Shutting down services...');
    
    const shutdownOrder = Array.from(this.services.keys()).reverse();
    
    for (const serviceName of shutdownOrder) {
      await this.shutdownService(serviceName);
    }

    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Shutdown handler error:', error);
      }
    }

    console.log('✅ All services shut down');
  }

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
}

// Create and configure service manager
const serviceManager = new ServiceManager();

// Register services
serviceManager.registerService('database', initializeDatabase, disconnectDatabase);
serviceManager.registerService('blockchain', initializeBlockchain, null);
serviceManager.registerService('quiz-generator', async () => ({ status: 'ready' }), null);
serviceManager.registerService('merkle-tree', async () => ({ status: 'ready' }), null);

export default serviceManager;
