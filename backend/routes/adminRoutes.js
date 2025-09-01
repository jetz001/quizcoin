// backend/routes/adminRoutes.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateBatch } from '../services/quizService.js';
import { commitBatchOnChain } from '../services/merkleService.js';
import { getDatabase } from '../config/database.js';
import { CONFIG } from '../config/constants.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate batch endpoint
router.post('/generate-batch', async (req, res) => {
  try {
    console.log(`Starting batch generation with default settings:`);
    console.log(`   - Total Questions: ${CONFIG.TOTAL_QUESTIONS}`);
    console.log(`   - Sub-batch Size: ${CONFIG.SUB_BATCH_SIZE}`);
    
    const result = await generateBatch();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error in /admin/generate-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commit batch endpoint
router.post('/commit-batch', async (req, res) => {
  try {
    const { batchId } = req.body;
    if (!batchId) {
      return res.status(400).json({ success: false, error: "batchId is required." });
    }
    
    console.log(`Starting batch commit with settings:`);
    console.log(`   - Submit Leaves: ${CONFIG.SUBMIT_LEAVES}`);
    console.log(`   - Chunk Size: ${CONFIG.SUBMIT_CHUNK_SIZE}`);
    
    const result = await commitBatchOnChain(batchId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error in /admin/commit-batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate and commit in one go
router.post('/generate-and-commit', async (req, res) => {
  try {
    console.log(`Starting full batch process with default settings:`);
    console.log(`   - Total Questions: ${CONFIG.TOTAL_QUESTIONS}`);
    console.log(`   - Sub-batch Size: ${CONFIG.SUB_BATCH_SIZE}`);
    console.log(`   - Submit Leaves: ${CONFIG.SUBMIT_LEAVES}`);
    console.log(`   - Chunk Size: ${CONFIG.SUBMIT_CHUNK_SIZE}`);
    
    const generationResult = await generateBatch();
    const commitResult = await commitBatchOnChain(generationResult.batchId);
    res.status(200).json({ success: true, ...commitResult, generationResult });
  } catch (error) {
    console.error("Error in /admin/generate-and-commit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get configuration
router.get('/config', (req, res) => {
  res.status(200).json({
    success: true,
    config: {
      TOTAL_QUESTIONS: CONFIG.TOTAL_QUESTIONS,
      SUB_BATCH_SIZE: CONFIG.SUB_BATCH_SIZE,
      SUBMIT_LEAVES: CONFIG.SUBMIT_LEAVES,
      SUBMIT_CHUNK_SIZE: CONFIG.SUBMIT_CHUNK_SIZE,
      SUB_BATCH_DELAY: CONFIG.SUB_BATCH_DELAY,
      TX_DELAY: CONFIG.TX_DELAY
    }
  });
});

// Get batches
router.get('/batches', async (req, res) => {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({ success: false, error: "Firebase not available" });
    }
    
    const querySnapshot = await db.collection('merkle_batches').orderBy('createdAt', 'desc').get();
    const batches = querySnapshot.docs.map(doc => doc.data());
    res.status(200).json({ batches });
  } catch (error) {
    console.error("Error in /admin/batches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;