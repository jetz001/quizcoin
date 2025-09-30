// services/blockchain.js
import { ethers } from 'ethers';

const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root) external"
];

export class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.merkleContract = null;
    this.config = {
      privateKey: process.env.PRIVATE_KEY,
      contractAddress: process.env.CONTRACT_ADDRESS,
      providerUrl: process.env.PROVIDER_URL,
      submitLeaves: process.env.SUBMIT_LEAVES === 'true',
      submitChunkSize: parseInt(process.env.SUBMIT_CHUNK_SIZE || '500'),
      txDelay: parseInt(process.env.TX_DELAY || '1')
    };
  }

  async initialize() {
    const { privateKey, contractAddress, providerUrl } = this.config;
    
    if (!privateKey || !contractAddress || !providerUrl) {
      console.warn("⚠️ Blockchain config incomplete - on-chain submission disabled");
      return { merkleContract: null };
    }

    try {
      this.provider = new ethers.JsonRpcProvider(providerUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.merkleContract = new ethers.Contract(contractAddress, MERKLE_ABI, this.signer);
      
      console.log("✅ Connected to blockchain");
      console.log(`   - Contract: ${contractAddress}`);
      console.log(`   - Signer: ${this.signer.address}`);
      
      return { merkleContract: this.merkleContract };
    } catch (error) {
      console.error("❌ Blockchain connection failed:", error.message);
      return { merkleContract: null };
    }
  }

  async submitMerkleRoot(batchId, rootHex, leaves = []) {
    if (!this.merkleContract) {
      throw new Error("Blockchain not initialized");
    }

    const { submitLeaves, submitChunkSize, txDelay } = this.config;
    const txHashes = [];

    try {
      if (!submitLeaves || leaves.length === 0) {
        // Submit root only
        console.log("🚀 Submitting root-only transaction...");
        const tx = await this.merkleContract.submitMerkleRoot(
          batchId, 
          rootHex, 
          { gasLimit: 2_000_000 }
        );
        console.log("📡 Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Transaction confirmed:", tx.hash);
        txHashes.push(tx.hash);
      } else {
        // Leaves submission no longer supported by facet; ignore leaves
      }

      return {
        success: true,
        txHashes,
        onChain: true
      };

    } catch (error) {
      console.error("❌ Error submitting Merkle root:", error);
      throw error;
    }
  }

  getSignerAddress() {
    return this.signer?.address || null;
  }

  isConnected() {
    return !!this.merkleContract;
  }
}

export async function initializeBlockchain() {
  const blockchainService = new BlockchainService();
  await blockchainService.initialize();
  return blockchainService;
}