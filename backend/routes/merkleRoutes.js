// backend/routes/merkleRoutes.js
import express from 'express';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { generateMerkleProof } from '../services/merkleService.js';
import { getDatabase } from '../config/database.js';

const router = express.Router();

// Generate Merkle proof for a specific answer
router.post('/generate-merkle-proof', async (req, res) => {
  try {
    const { quizId, answer } = req.body;
    
    if (!quizId || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: "quizId and answer are required" 
      });
    }

    console.log(`Generating Merkle proof for quiz ${quizId}, answer: ${answer}`);

    const proofData = await generateMerkleProof(quizId, answer);

    res.json({
      success: true,
      ...proofData
    });

  } catch (error) {
    console.error("Error generating Merkle proof:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Verify a Merkle proof
router.post('/verify-merkle-proof', async (req, res) => {
  try {
    const { leaf, proof, batchId } = req.body;

    if (!leaf || !proof || !batchId) {
      return res.status(400).json({
        success: false,
        error: "leaf, proof, and batchId are required"
      });
    }

    const db = getDatabase();
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    // Get the root for this batch
    const batchDoc = await db.collection('merkle_batches').doc(String(batchId)).get();
    
    if (!batchDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    const root = batchDoc.data().root;
    
    if (!root) {
      return res.status(400).json({
        success: false,
        error: "Batch root not available"
      });
    }

    // Verify using MerkleTree library
    const isValid = MerkleTree.verify(proof, leaf, root, ethers.keccak256, { sortPairs: true });

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

export default router;