// src/api/routes/index.js - Route aggregator
import express from 'express';

// Import route modules from organized structure
import adminRoutes from './admin.js';
import apiRoutes from './quiz.js';
import merkleRoutes from './merkle.js';
import dataRoutes from './data.js';

const router = express.Router();

// Mount routes
router.use('/admin', adminRoutes);
router.use('/api', apiRoutes);
router.use('/merkle', merkleRoutes);
router.use('/data', dataRoutes);

export default router;
