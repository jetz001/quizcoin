// backend/services/merkle.js
const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');
const { getLeavesForBatch, completeBatch } = require('./firebase');
const { submitMerkleRoot, submitMerkleRootWithChunks } = require('./blockchain');

// Configuration
const DEFAULT_CONFIG = {
  SUBMIT_LEAVES: false,
  SUBMIT_CHUNK_SIZE: 500,
  TX_DELAY: 1
};

const SUBMIT_LEAVES = (process.env.SUBMIT_LEAVES || DEFAULT_CONFIG.SUBMIT_LEAVES.toString()).toLowerCase() === "true";
const SUBMIT_CHUNK_SIZE = parseInt(process.env.SUBMIT_CHUNK_SIZE || DEFAULT_CONFIG.SUBMIT_CHUNK_SIZE.toString(), 10);
const TX_DELAY = parseInt(process.env.TX_DELAY || DEFAULT_CONFIG.TX_DELAY.toString(), 10);

// Create answer leaf hash
function createAnswerLeaf(answer) {
  return ethers.keccak256(ethers.toUtf8Bytes(answer));
}

// Build Merkle tree from batch leaves
async function buildMerkleTreeFromBatch(batchId) {
  const leafData = await getLeavesForBatch(batchId);
  
  if (leafData.length === 0) {
    throw new Error(`No leaves found for batch ${batchId}`);
  }

  const leaves = leafData.map(data => data.leaf);
  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  const rootHex = tree.getHexRoot();
  
  console.log(`🌳 Built Merkle tree for batch ${batchId}: ${rootHex} (${leaves.length} leaves)`);
  
  return { tree, rootHex, leaves, leafData };
}

// Generate Merkle proof for a specific leaf
function generateMerkleProof(tree, leaf) {
  try {
    const proof = tree.getHexProof(leaf);
    const root = tree.getHexRoot();
    const isValid = tree.verify(proof, leaf, root);
    
    return {
      proof,
      root,
      isValid,
      leaf
    };
  } catch (error) {
    console.error("❌ Error generating Merkle proof:", error);
    return null;
  }
}

// Verify Merkle proof offline
function verifyMerkleProof(proof, leaf, root) {
  try {
    return MerkleTree.verify(proof, leaf, root, ethers.keccak256, { sortPairs: true });
  } catch (error) {
    console.error("❌ Error verifying Merkle proof:", error);
    return false;
  }
}

// Generate proof for quiz answer
async function generateProofForQuizAnswer(batchId, quizId, answer) {
  try {
    // Build tree from batch
    const { tree, rootHex, leafData } = await buildMerkleTreeFromBatch(batchId);
    
    // Find the leaf for this quiz
    const quizLeafData = leafData.find(data => data.quizId === quizId);
    if (!quizLeafData) {
      throw new Error(`Quiz ${quizId} not found in batch ${batchId}`);
    }
    
    // Verify the answer is correct
    if (quizLeafData.correctAnswer !== answer) {
      throw new Error("Incorrect answer provided");
    }
    
    // Generate proof
    const answerLeaf = createAnswerLeaf(answer);
    const proofData = generateMerkleProof(tree, answerLeaf);
    
    if (!proofData || !proofData.isValid) {
      throw new Error("Failed to generate valid proof");
    }
    
    return {
      ...proofData,
      batchId,
      quizId,
      correctAnswer: answer
    };
  } catch (error) {
    console.error("❌ Error generating proof for quiz answer:", error);
    throw error;
  }
}

// Commit batch to blockchain
async function commitBatchToBlockchain(batchId, merkleContract) {
  try {
    console.log(`🔗 Committing batch ${batchId} to blockchain...`);
    
    const { rootHex, leaves } = await buildMerkleTreeFromBatch(batchId);
    const txHashes = [];
    
    if (!SUBMIT_LEAVES) {
      // Submit only root
      const result = await submitMerkleRoot(batchId, rootHex, [], 2_000_000);
      txHashes.push(result.txHash);
    } else {
      // Submit root with leaves in chunks
      const hashes = await submitMerkleRootWithChunks(batchId, rootHex, leaves, SUBMIT_CHUNK_SIZE, TX_DELAY);
      txHashes.push(...hashes);
    }
    
    console.log(`🎉 Batch ${batchId} committed to blockchain successfully`);
    
    return {
      root: rootHex,
      totalLeaves: leaves.length,
      onChain: true,
      txs: txHashes
    };
  } catch (error) {
    console.error("❌ Error committing batch to blockchain:", error);
    throw error;
  }
}

// Save batch off-chain only
async function saveBatchOffchain(batchId) {
  try {
    console.log(`💾 Saving batch ${batchId} off-chain only...`);
    
    const { rootHex, leaves } = await buildMerkleTreeFromBatch(batchId);
    
    // Update batch status in database
    await completeBatch(batchId, leaves.length, rootHex, leaves, []);
    
    console.log(`✅ Batch ${batchId} saved off-chain`);
    
    return {
      root: rootHex,
      totalLeaves: leaves.length,
      onChain: false
    };
  } catch (error) {
    console.error("❌ Error saving batch off-chain:", error);
    throw error;
  }
}

// Build tree and update batch with complete information
async function finalizeBatch(batchId, allLeaves, allQuizIds) {
  try {
    if (allLeaves.length === 0) {
      throw new Error("No leaves to build tree from");
    }

    // Build Merkle tree
    const tree = new MerkleTree(allLeaves, ethers.keccak256, { sortPairs: true });
    const merkleRoot = tree.getHexRoot();
    
    console.log(`🌳 Finalized batch ${batchId} with Merkle root: ${merkleRoot}`);
    
    // Update batch in database
    await completeBatch(batchId, allLeaves.length, merkleRoot, allLeaves, allQuizIds);
    
    return {
      batchId,
      merkleRoot,
      totalLeaves: allLeaves.length,
      tree
    };
  } catch (error) {
    console.error("❌ Error finalizing batch:", error);
    throw error;
  }
}

// Validate tree structure
function validateMerkleTree(tree, leaves) {
  try {
    const root = tree.getHexRoot();
    
    // Test that we can generate and verify proofs for all leaves
    for (const leaf of leaves) {
      const proof = tree.getHexProof(leaf);
      const isValid = tree.verify(proof, leaf, root);
      
      if (!isValid) {
        console.error(`❌ Invalid proof for leaf: ${leaf}`);
        return false;
      }
    }
    
    console.log(`✅ Merkle tree validation passed for ${leaves.length} leaves`);
    return true;
  } catch (error) {
    console.error("❌ Error validating Merkle tree:", error);
    return false;
  }
}

module.exports = {
  createAnswerLeaf,
  buildMerkleTreeFromBatch,
  generateMerkleProof,
  verifyMerkleProof,
  generateProofForQuizAnswer,
  commitBatchToBlockchain,
  saveBatchOffchain,
  finalizeBatch,
  validateMerkleTree
};