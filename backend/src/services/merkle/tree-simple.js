// backend/services/merkle/tree-simple.js - Simplified Merkle service for organized structure
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { prisma, getLeavesForBatch, getBatch, findQuizLeaf } from '../database/index.js';

export const buildMerkleFromBatch = async (batchId) => {
  if (!prisma) {
    throw new Error("Database not initialized - cannot build Merkle tree");
  }
  
  console.log(`🌳 Building Merkle tree for batch ${batchId}...`);
  
  const leaves = await getLeavesForBatch(batchId);
  if (leaves.length === 0) {
    throw new Error(`No leaves found for batch ${batchId}`);
  }
  
  const leafHashes = leaves.map(leaf => leaf.leaf);
  const tree = new MerkleTree(leafHashes, ethers.keccak256, { sortPairs: true });
  const rootHex = tree.getHexRoot();
  
  console.log(`✅ Built Merkle tree: ${leafHashes.length} leaves, root: ${rootHex}`);
  
  return { rootHex, leaves: leafHashes, tree };
};

export const generateMerkleProof = async (quizId, answer) => {
  try {
    if (!prisma) {
      throw new Error("Database not available");
    }

    console.log(`🔍 Generating Merkle proof for quiz ${quizId}, answer: ${answer}`);

    // Find the quiz leaf
    const leafData = await findQuizLeaf(quizId);
    if (!leafData) {
      throw new Error(`Quiz ${quizId} not found in Merkle tree`);
    }

    const batchId = leafData.batchId;
    console.log(`📁 Found quiz in batch ${batchId}`);

    // Build the Merkle tree for this batch
    const { rootHex, leaves, tree } = await buildMerkleFromBatch(batchId);
    
    // Generate proof for the stored leaf
    const storedLeaf = leafData.leaf;
    const proof = tree.getHexProof(storedLeaf);
    
    // Verify the proof is correct
    const isValid = tree.verify(proof, storedLeaf, rootHex);

    console.log(`✅ Generated proof for ${quizId}: valid=${isValid}`);

    return {
      leaf: storedLeaf,
      proof: proof,
      root: rootHex,
      isValid: isValid,
      batchId: batchId,
      quizId: quizId
    };

  } catch (error) {
    console.error("❌ Error generating Merkle proof:", error);
    throw error;
  }
};

export const verifyMerkleProof = (leaf, proof, root) => {
  try {
    const isValid = MerkleTree.verify(proof, leaf, root, ethers.keccak256, { sortPairs: true });
    return isValid;
  } catch (error) {
    console.error("❌ Error verifying Merkle proof:", error);
    return false;
  }
};

// Simple batch commit (without blockchain for now)
export const commitBatchOffChain = async (batchId) => {
  try {
    console.log(`📝 Committing batch ${batchId} off-chain...`);
    
    const batch = await getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const { rootHex, leaves } = await buildMerkleFromBatch(batchId);
    
    // Update batch with Merkle root
    await prisma.merkleBatch.update({
      where: { batchId: parseInt(batchId) },
      data: {
        merkleRoot: rootHex,
        status: 'committed_offchain',
        leaves: JSON.stringify(leaves),
        readyAt: new Date()
      }
    });

    console.log(`✅ Batch ${batchId} committed off-chain with root: ${rootHex}`);
    
    return {
      success: true,
      root: rootHex,
      totalLeaves: leaves.length,
      onChain: false
    };

  } catch (error) {
    console.error(`❌ Error committing batch ${batchId}:`, error);
    throw error;
  }
};

export default {
  buildMerkleFromBatch,
  generateMerkleProof,
  verifyMerkleProof,
  commitBatchOffChain
};
