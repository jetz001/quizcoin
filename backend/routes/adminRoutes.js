// routes/adminRoutes.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateBatch, commitBatchOnChain } from '../services/merkle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuration
const DEFAULT_CONFIG = {
  TOTAL_QUESTIONS: 18,
  SUB_BATCH_SIZE: 9,
  SUBMIT_LEAVES: false,
  SUBMIT_CHUNK_SIZE: 500,
  SUB_BATCH_DELAY: 60,
  TX_DELAY: 1
};

const config = {
  TOTAL_QUESTIONS: parseInt(process.env.TOTAL_QUESTIONS || DEFAULT_CONFIG.TOTAL_QUESTIONS.toString()),
  SUB_BATCH_SIZE: parseInt(process.env.SUB_BATCH_SIZE || DEFAULT_CONFIG.SUB_BATCH_SIZE.toString()),
  SUBMIT_LEAVES: (process.env.SUBMIT_LEAVES || DEFAULT_CONFIG.SUBMIT_LEAVES.toString()).toLowerCase() === "true",
  SUBMIT_CHUNK_SIZE: parseInt(process.env.SUBMIT_CHUNK_SIZE || DEFAULT_CONFIG.SUBMIT_CHUNK_SIZE.toString()),
  SUB_BATCH_DELAY: parseInt(process.env.SUB_BATCH_DELAY || DEFAULT_CONFIG.SUB_BATCH_DELAY.toString()),
  TX_DELAY: parseInt(process.env.TX_DELAY || DEFAULT_CONFIG.TX_DELAY.toString())
};

// Generate new batch
router.post('/generate-batch', async (req, res) => {
  try {
    const overrides = req.body || {};
    const effectiveConfig = {
      ...config,
      TOTAL_QUESTIONS: parseInt(overrides.totalQuestions ?? config.TOTAL_QUESTIONS),
      SUB_BATCH_SIZE: parseInt(overrides.subBatchSize ?? config.SUB_BATCH_SIZE)
    };

    console.log(`🔧 Starting batch generation with settings:`);
    console.log(`   - Total Questions: ${effectiveConfig.TOTAL_QUESTIONS}`);
    console.log(`   - Sub-batch Size: ${effectiveConfig.SUB_BATCH_SIZE}`);
    
    const result = await generateBatch(req.app.locals.db, effectiveConfig);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("❌ Error in /admin/generate-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// (Removed duplicate /generate-and-commit handler with incorrect success checks)

// Commit existing batch to blockchain
router.post('/commit-batch', async (req, res) => {
  try {
    const { batchId } = req.body;
    if (!batchId) {
      return res.status(400).json({ success: false, error: "batchId is required." });
    }
    const overrides = req.body || {};
    const effectiveConfig = {
      ...config,
      TOTAL_QUESTIONS: parseInt(overrides.totalQuestions ?? config.TOTAL_QUESTIONS),
      SUB_BATCH_SIZE: parseInt(overrides.subBatchSize ?? config.SUB_BATCH_SIZE)
    };

    console.log(`🔗 Starting batch commit with settings:`);
    console.log(`   - Submit Leaves: ${effectiveConfig.SUBMIT_LEAVES}`);
    console.log(`   - Chunk Size: ${effectiveConfig.SUBMIT_CHUNK_SIZE}`);
    
    const result = await commitBatchOnChain(
      req.app.locals.db, 
      req.app.locals.blockchain, 
      batchId, 
      effectiveConfig
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("❌ Error in /admin/commit-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate and commit in one step
router.post('/generate-and-commit', async (req, res) => {
  try {
    const overrides = req.body || {};
    const effectiveConfig = {
      ...config,
      TOTAL_QUESTIONS: parseInt(overrides.totalQuestions ?? config.TOTAL_QUESTIONS),
      SUB_BATCH_SIZE: parseInt(overrides.subBatchSize ?? config.SUB_BATCH_SIZE)
    };

    console.log(`🚀 Starting full batch process with settings:`);
    console.log(`   - Total Questions: ${effectiveConfig.TOTAL_QUESTIONS}`);
    console.log(`   - Sub-batch Size: ${effectiveConfig.SUB_BATCH_SIZE}`);
    console.log(`   - Submit Leaves: ${effectiveConfig.SUBMIT_LEAVES}`);
    console.log(`   - Chunk Size: ${effectiveConfig.SUBMIT_CHUNK_SIZE}`);
    
    const generationResult = await generateBatch(req.app.locals.db, effectiveConfig);
    const commitResult = await commitBatchOnChain(
      req.app.locals.db, 
      req.app.locals.blockchain, 
      generationResult.batchId, 
      effectiveConfig
    );
    res.status(200).json({ success: true, ...commitResult, generationResult });
  } catch (error) {
    console.error("❌ Error in /admin/generate-and-commit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get configuration
router.get('/config', (req, res) => {
  res.status(200).json({
    success: true,
    config
  });
});

// Get all batches
router.get('/batches', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ success: false, error: "Firebase not available" });
    }
    
    const querySnapshot = await db.collection('merkle_batches').orderBy('createdAt', 'desc').get();
    const batches = querySnapshot.docs.map(doc => doc.data());
    res.status(200).json({ batches });
  } catch (error) {
    console.error("❌ Error in /admin/batches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Grant admin role to address
router.post('/grant-admin-role', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ success: false, error: "Address is required" });
    }
    
    const { grantAdminRole } = await import('../scripts/grant-admin-role.js');
    await grantAdminRole(address);
    
    res.status(200).json({ 
      success: true, 
      message: `Admin role granted to ${address}` 
    });
  } catch (error) {
    console.error("❌ Error in /admin/grant-admin-role:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin dashboard HTML
router.get('/', (req, res) => {
  const adminPath = path.join(__dirname, '..', 'public', 'admin.html');
  console.log(`🔍 Checking admin.html at path: ${adminPath}`);

  try {
    res.sendFile(adminPath, (err) => {
      if (err) {
        console.error(`❌ Error sending admin.html:`, err);
        res.status(500).send("Error loading admin page");
      } else {
        console.log(`✅ admin.html served successfully`);
      }
    });
  } catch (error) {
    console.error("❌ Error serving admin page:", error);
    res.status(500).send("Error loading admin page");
  }
});

export default router;