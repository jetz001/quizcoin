// backend/routes/merkle.js - Merkle Routes Only
import express from 'express';
import { generateProofForQuizAnswer, verifyMerkleProof } from '../services/merkle.js';
import { findQuizLeaf, getBatch } from '../services/firebase.js';

const router = express.Router();

// Generate Merkle proof for answer verification
router.post('/generate-merkle-proof', async (req, res) => {
  try {
    const { quizId, answer } = req.body;
    
    if (!quizId || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: "quizId and answer are required" 
      });
    }

    console.log(`🔍 Generating Merkle proof for quiz ${quizId}, answer: ${answer}`);

    // Find the quiz leaf data
    const leafData = await findQuizLeaf(quizId);
    if (!leafData) {
      return res.status(404).json({
        success: false,
        error: "Quiz not found in Merkle tree"
      });
    }

    // Generate proof for this answer
    const proofData = await generateProofForQuizAnswer(leafData.batchId, quizId, answer);

    console.log(`✅ Generated proof for ${quizId}: valid=${proofData.isValid}`);

    res.json({
      success: true,
      leaf: proofData.leaf,
      proof: proofData.proof,
      root: proofData.root,
      isValid: proofData.isValid,
      batchId: leafData.batchId,
      quizId: quizId
    });

  } catch (error) {
    console.error("Error generating Merkle proof:", error);
    
    if (error.message.includes("Incorrect answer")) {
      return res.status(400).json({ 
        success: false, 
        error: "Incorrect answer provided" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Verify Merkle proof
router.post('/verify-merkle-proof', async (req, res) => {
  try {
    const { leaf, proof, batchId } = req.body;

    if (!leaf || !proof || !batchId) {
      return res.status(400).json({
        success: false,
        error: "leaf, proof, and batchId are required"
      });
    }

    console.log(`🔍 Verifying Merkle proof for batch ${batchId}`);

    // Get the root for this batch
    const batchData = await getBatch(batchId);
    if (!batchData) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    const root = batchData.merkleRoot;
    if (!root) {
      return res.status(400).json({
        success: false,
        error: "Batch root not available"
      });
    }

    // Verify using Merkle library
    const isValid = verifyMerkleProof(proof, leaf, root);

    console.log(`✅ Proof verification result: ${isValid}`);

    res.json({
      success: true,
      isValid: isValid,
      root: root,
      batchId: batchId
    });

  } catch (error) {
    console.error("Error verifying Merkle proof:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get batch information
router.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;

    const batchData = await getBatch(parseInt(batchId));
    if (!batchData) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    // Return sanitized batch info (don't expose sensitive data)
    const sanitizedBatch = {
      batchId: batchData.batchId,
      status: batchData.status,
      totalQuestions: batchData.totalQuestions,
      totalCreated: batchData.totalCreated,
      progress: batchData.progress,
      merkleRoot: batchData.merkleRoot,
      totalLeaves: batchData.leaves ? batchData.leaves.length : 0,
      createdAt: batchData.createdAt,
      readyAt: batchData.readyAt,
      committedAt: batchData.committedAt
    };

    res.json({
      success: true,
      batch: sanitizedBatch
    });

  } catch (error) {
    console.error("Error getting batch:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get batch tree status
router.get('/batch/:batchId/tree-status', async (req, res) => {
  try {
    const { batchId } = req.params;

    const batchData = await getBatch(parseInt(batchId));
    if (!batchData) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    const treeStatus = {
      batchId: batchData.batchId,
      hasRoot: !!batchData.merkleRoot,
      root: batchData.merkleRoot,
      totalLeaves: batchData.leaves ? batchData.leaves.length : 0,
      status: batchData.status,
      isCommitted: batchData.status.includes('committed'),
      onChain: batchData.status === 'committed_onchain'
    };

    res.json({
      success: true,
      treeStatus
    });

  } catch (error) {
    console.error("Error getting tree status:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;