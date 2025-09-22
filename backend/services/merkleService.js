// backend/services/merkleService.js
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { getDatabase, admin } from '../config/database.js';
import { merkleContract } from '../config/blockchain.js';
import { CONFIG } from '../config/constants.js';

export const buildMerkleFromBatch = async (batchId) => {
  const db = getDatabase();
  if (!db) {
    throw new Error("Firebase not initialized - cannot build Merkle tree");
  }
  
  const query = await db.collection('merkle_leaves').where('batchId', '==', batchId).get();
  const leaves = query.docs.map(doc => doc.data().leaf);
  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  const rootHex = tree.getHexRoot();
  return { rootHex, leaves };
};

export const commitBatchOnChain = async (batchId, submitChunkSize = CONFIG.SUBMIT_CHUNK_SIZE) => {
  console.log(`Preparing to commit batch ${batchId} on-chain...`);
  
  const db = getDatabase();
  if (!db) {
    throw new Error("Firebase not initialized - cannot commit batch");
  }
  
  const bdoc = await db.collection('merkle_batches').doc(String(batchId)).get();
  if (!bdoc.exists) throw new Error("Batch not found: " + batchId);
  
  const batchInfo = bdoc.data();
  if (batchInfo.status !== 'ready') {
    console.warn("Batch status not 'ready' — current:", batchInfo.status);
  }

  const { rootHex, leaves } = await buildMerkleFromBatch(batchId);
  console.log(`Merkle root built: ${rootHex}, total leaves=${leaves.length}`);

  await db.collection('merkle_batches').doc(String(batchId)).update({ root: rootHex, committedAt: null });

  if (!merkleContract) {
    console.warn("No merkleContract -> skipping on-chain commit. Root saved to Firestore only.");
    await db.collection('merkle_batches').doc(String(batchId)).update({ 
      status: 'committed_offchain', 
      rootSavedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    return { root: rootHex, totalLeaves: leaves.length, onChain: false };
  }

  if (!CONFIG.SUBMIT_LEAVES) {
    try {
      console.log("Submitting root-only tx...");
      const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, [], { gasLimit: 2_000_000 });
      console.log("Root-only tx sent:", tx.hash);
      await tx.wait();
      console.log("Root-only tx confirmed:", tx.hash);
      
      await db.collection('merkle_batches').doc(String(batchId)).update({ 
        status: 'committed_onchain_root_only', 
        committedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      return { root: rootHex, totalLeaves: leaves.length, onChain: true, txs: [tx.hash] };
    } catch (err) {
      console.error("Error submitting root-only:", err);
      throw err;
    }
  }

  const leafHexes = leaves;
  const txHashes = [];
  for (let i = 0; i < leafHexes.length; i += submitChunkSize) {
    const chunk = leafHexes.slice(i, i + submitChunkSize);
    console.log(`Submitting chunk ${Math.floor(i / submitChunkSize) + 1} (${chunk.length})...`);
    
    try {
      const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, chunk, { gasLimit: 6_000_000 });
      txHashes.push(tx.hash);
      console.log("Tx sent:", tx.hash, " waiting confirmation...");
      await tx.wait();
      console.log("Tx confirmed:", tx.hash);
      await new Promise(r => setTimeout(r, CONFIG.TX_DELAY * 1000));
    } catch (error) {
      console.error(`Error submitting chunk ${Math.floor(i / submitChunkSize) + 1}:`, error);
      throw error;
    }
  }

  await db.collection('merkle_batches').doc(String(batchId)).update({ 
    status: 'committed_onchain', 
    committedAt: admin.firestore.FieldValue.serverTimestamp(), 
    txs: txHashes 
  });
  console.log(`Batch ${batchId} committed successfully on-chain.`);
  return { root: rootHex, totalLeaves: leafHexes.length, onChain: true, txs: txHashes };
};

// Generate Merkle proof for a specific answer
export const generateMerkleProof = async (quizId, answer) => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error("Firebase not available");
    }

    console.log(`Generating Merkle proof for quiz ${quizId}, answer: ${answer}`);

    // Find which batch this quiz belongs to
    const leavesQuery = await db.collection('merkle_leaves')
      .where('quizId', '==', quizId)
      .limit(1)
      .get();

    if (leavesQuery.empty) {
      throw new Error("Quiz not found in Merkle tree");
    }

    const leafDoc = leavesQuery.docs[0];
    const batchId = leafDoc.data().batchId;
    const storedLeaf = leafDoc.data().leaf; // Use the stored leaf hash

    // Get all leaves for this batch to rebuild the tree
    const batchLeavesQuery = await db.collection('merkle_leaves')
      .where('batchId', '==', batchId)
      .get();

    const leaves = batchLeavesQuery.docs.map(doc => doc.data().leaf);
    
    // Rebuild Merkle tree
    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    
    // Generate proof for the stored leaf (NOT answer leaf)
    const proof = tree.getHexProof(storedLeaf);
    const root = tree.getHexRoot();

    // Verify the proof is correct
    const isValid = tree.verify(proof, storedLeaf, root);

    console.log(`Generated proof for ${quizId}: valid=${isValid}`);

    // For smart contract, we need to create answer leaf hash
    const answerLeaf = ethers.keccak256(ethers.toUtf8Bytes(answer.toLowerCase().trim()));

    return {
      leaf: storedLeaf,
      proof: proof,
      root: root,
      isValid: isValid,
      batchId: batchId,
      storedLeaf: storedLeaf // For debugging
    };

  } catch (error) {
    console.error("Error generating Merkle proof:", error);
    throw error;
  }
};