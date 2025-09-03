// backend/services/blockchain.js - Fixed for ES modules
import { ethers } from 'ethers';

// Merkle contract ABI
const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root, bytes32[] calldata leaves) external",
  "function verifyQuiz(bytes32 leaf, bytes32[] calldata proof) external view returns (bool)"
];

let provider, signer, merkleContract;

export async function initializeBlockchain() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const PROVIDER_URL = process.env.PROVIDER_URL;

  if (!PRIVATE_KEY || !CONTRACT_ADDRESS || !PROVIDER_URL) {
    console.warn("⚠️ Blockchain config incomplete - features will be disabled");
    return { provider: null, signer: null, merkleContract: null };
  }

  try {
    provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
    merkleContract = new ethers.Contract(CONTRACT_ADDRESS, MERKLE_ABI, signer);
    
    // Test connection
    await provider.getNetwork();
    
    return { provider, signer, merkleContract };
  } catch (error) {
    console.error("❌ Blockchain connection failed:", error.message);
    return { provider: null, signer: null, merkleContract: null };
  }
}

// Submit Merkle root to blockchain
export async function submitMerkleRoot(batchId, rootHex, leaves = [], gasLimit = 2_000_000) {
  if (!merkleContract) {
    throw new Error("Merkle contract not initialized");
  }

  try {
    console.log(`🚀 Submitting Merkle root for batch ${batchId}...`);
    const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, leaves, { gasLimit });
    console.log("📡 Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed:", tx.hash);
    
    return { txHash: tx.hash, receipt };
  } catch (error) {
    console.error("❌ Error submitting Merkle root:", error);
    throw error;
  }
}

// Submit Merkle root with leaves in chunks
export async function submitMerkleRootWithChunks(batchId, rootHex, leaves, chunkSize = 500, txDelay = 1) {
  if (!merkleContract) {
    throw new Error("Merkle contract not initialized");
  }

  const txHashes = [];
  
  for (let i = 0; i < leaves.length; i += chunkSize) {
    const chunk = leaves.slice(i, i + chunkSize);
    console.log(`🚀 Submitting chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} leaves)...`);
    
    try {
      const tx = await merkleContract.submitMerkleRoot(batchId, rootHex, chunk, { gasLimit: 6_000_000 });
      txHashes.push(tx.hash);
      console.log("📡 Tx sent:", tx.hash, " waiting confirmation...");
      
      await tx.wait();
      console.log("✅ Tx confirmed:", tx.hash);
      
      // Delay between transactions
      if (i + chunkSize < leaves.length) {
        await new Promise(r => setTimeout(r, txDelay * 1000));
      }
    } catch (error) {
      console.error(`❌ Error submitting chunk ${Math.floor(i / chunkSize) + 1}:`, error);
      throw error;
    }
  }

  return txHashes;
}

// Verify Merkle proof on-chain
export async function verifyMerkleProofOnChain(leaf, proof) {
  if (!merkleContract) {
    throw new Error("Merkle contract not initialized");
  }

  try {
    const isValid = await merkleContract.verifyQuiz(leaf, proof);
    return isValid;
  } catch (error) {
    console.error("❌ Error verifying Merkle proof on-chain:", error);
    return false;
  }
}

// Get current gas price
export async function getCurrentGasPrice() {
  if (!provider) {
    return null;
  }

  try {
    const gasPrice = await provider.getFeeData();
    return gasPrice;
  } catch (error) {
    console.error("❌ Error getting gas price:", error);
    return null;
  }
}

// Check if contract is accessible
export async function checkContractHealth() {
  if (!merkleContract) {
    return { accessible: false, error: "Contract not initialized" };
  }

  try {
    // Try to call a view function to test connectivity
    await merkleContract.provider.getNetwork();
    return { accessible: true, network: await merkleContract.provider.getNetwork() };
  } catch (error) {
    return { accessible: false, error: error.message };
  }
}

export const getProvider = () => provider;
export const getSigner = () => signer;
export const getMerkleContract = () => merkleContract;