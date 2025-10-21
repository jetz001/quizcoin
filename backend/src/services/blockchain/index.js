// services/blockchain.js
import { ethers } from 'ethers';

const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root) external",
  "function createQuestion(bytes32 _answerLeaf, bytes32 _hintHash, uint256 _difficultyLevel, uint8 _mode) external returns (uint256)",
  "function verifyQuiz(uint256 _questionId, bytes32 _answerLeaf, bytes32[] calldata _merkleProof) external view returns (bool)",
  "function getMerkleRoot(uint256 quizId) external view returns (bytes32)",
  "function getQuestion(uint256 _questionId) external view returns (bytes32 correctAnswerHash, bytes32 hintHash, address questionCreator, uint256 difficultyLevel, uint256 baseRewardAmount, bool isClosed, uint8 mode, uint256 blockCreationTime, uint256 firstCorrectAnswerTime, address firstSolverAddress, address[] poolCorrectSolvers)",
  "function submitAnswer(uint256 _questionId, bytes32 _answerLeaf, bytes32[] calldata _merkleProof) external",
  "function registerLeaf(uint256 _questionId, bytes32 _answerLeaf) external",
  "function isLeafSolved(bytes32 _answerLeaf) external view returns (bool)",
  "function getLeafSolver(bytes32 _answerLeaf) external view returns (address)",
  "function getLeafSolveTime(bytes32 _answerLeaf) external view returns (uint256)",
  "function getLeafQuestionId(bytes32 _answerLeaf) external view returns (uint256)",
  "function resetLeaf(bytes32 _answerLeaf) external",
  "event LeafSolved(uint256 indexed questionId, bytes32 indexed answerLeaf, address indexed solver, uint256 rewardAmount)",
  "event LeafRegistered(uint256 indexed questionId, bytes32 indexed answerLeaf)"
];

export class BlockchainService {
  constructor() {
    this.provider = null;
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

  async createQuestion(answerLeaf, hintHash, difficultyLevel, mode = 1) {
    if (!this.merkleContract) {
      throw new Error("Blockchain not initialized");
    }

    try {
      console.log(`🔨 Creating question on-chain: difficulty=${difficultyLevel}, mode=${mode}`);
      
      const tx = await this.merkleContract.createQuestion(
        answerLeaf,
        hintHash || ethers.ZeroHash,
        difficultyLevel,
        mode,
        { gasLimit: 500_000 }
      );
      
      console.log(`📡 Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Question created on-chain`);
      
      // Get the next question ID (the one that was just created)
      const nextQuestionId = await this.merkleContract.getNextQuestionId();
      const createdQuestionId = nextQuestionId - 1n; // The question we just created
      
      console.log(`📋 Created question ID: ${createdQuestionId}`);
      
      return {
        success: true,
        questionId: Number(createdQuestionId),
        txHash: tx.hash,
        receipt
      };
    } catch (error) {
      console.error("❌ Error creating question:", error);
      throw error;
    }
  }

  async createQuestionsInBatch(questions, batchSize = 10, delayMs = 1000) {
    if (!this.merkleContract) {
      throw new Error("Blockchain not initialized");
    }

    const results = [];
    const total = questions.length;
    
    console.log(`📦 Creating ${total} questions in batches of ${batchSize}...`);

    for (let i = 0; i < total; i += batchSize) {
      const batch = questions.slice(i, Math.min(i + batchSize, total));
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)} (${batch.length} questions)...`);

      for (const q of batch) {
        try {
          const result = await this.createQuestion(
            q.leaf,
            ethers.ZeroHash,
            q.difficulty || 50,
            0 // Solo mode
          );
          results.push({ quizId: q.quizId, success: true, txHash: result.txHash });
          console.log(`  ✅ ${q.quizId} created`);
        } catch (error) {
          console.error(`  ❌ ${q.quizId} failed:`, error.message);
          results.push({ quizId: q.quizId, success: false, error: error.message });
        }

        // Small delay between transactions
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      // Longer delay between batches
      if (i + batchSize < total && delayMs > 0) {
        console.log(`⏳ Waiting ${delayMs * 2}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * 2));
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`\n✅ Created ${successful}/${total} questions on-chain`);

    return results;
  }

  // 🚪 NEW: Leaf-Level Door System Methods
  
  async registerLeaf(questionId, answerLeaf) {
    if (!this.merkleContract) {
      throw new Error("Blockchain not initialized");
    }

    try {
      console.log(`🚪 Registering leaf for question ${questionId}...`);
      const tx = await this.merkleContract.registerLeaf(questionId, answerLeaf);
      const receipt = await tx.wait();
      
      console.log(`✅ Leaf registered: ${tx.hash}`);
      return { success: true, txHash: tx.hash };
    } catch (error) {
      console.error('❌ Error registering leaf:', error);
      return { success: false, error: error.message };
    }
  }

  async isLeafSolved(answerLeaf) {
    if (!this.merkleContract) {
      throw new Error("Blockchain not initialized");
    }

    try {
      const isSolved = await this.merkleContract.isLeafSolved(answerLeaf);
      return isSolved;
    } catch (error) {
      console.error('❌ Error checking leaf status:', error);
      return false;
    }
  }

  async getLeafInfo(answerLeaf) {
    if (!this.merkleContract) {
      throw new Error("Blockchain not initialized");
    }

    try {
      const [isSolved, solver, solveTime, questionId] = await Promise.all([
        this.merkleContract.isLeafSolved(answerLeaf),
        this.merkleContract.getLeafSolver(answerLeaf),
        this.merkleContract.getLeafSolveTime(answerLeaf),
        this.merkleContract.getLeafQuestionId(answerLeaf)
      ]);

      return {
        isSolved,
        solver,
        solveTime: solveTime.toString(),
        questionId: questionId.toString()
      };
    } catch (error) {
      console.error('❌ Error getting leaf info:', error);
      return null;
    }
  }

  async resetLeaf(answerLeaf) {
    if (!this.merkleContract) {
      throw new Error("Blockchain not initialized");
    }

    try {
      console.log(`🔄 Resetting leaf: ${answerLeaf}...`);
      const tx = await this.merkleContract.resetLeaf(answerLeaf);
      const receipt = await tx.wait();
      
      console.log(`✅ Leaf reset: ${tx.hash}`);
      return { success: true, txHash: tx.hash };
    } catch (error) {
      console.error('❌ Error resetting leaf:', error);
      return { success: false, error: error.message };
    }
  }
}

export async function initializeBlockchain() {
  const blockchainService = new BlockchainService();
  await blockchainService.initialize();
  return blockchainService;
}