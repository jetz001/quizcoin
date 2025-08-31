// frontend/src/utils/blockchain.js
// Blockchain utility functions for QuizCoin

import { ethers } from 'ethers';
import contractAddresses from '../config/addresses.json';

// Network configurations
export const NETWORKS = {
  BNB_TESTNET: {
    chainId: '0x61', // 97 in decimal
    chainName: 'BNB Smart Chain Testnet',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
  }
};

// Contract ABIs
const QUIZ_DIAMOND_ABI = [
  // Merkle functions
  {
    "inputs": [
      { "internalType": "bytes32", "name": "leaf", "type": "bytes32" },
      { "internalType": "bytes32[]", "name": "proof", "type": "bytes32[]" }
    ],
    "name": "verifyQuiz",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_questionId", "type": "uint256" },
      { "internalType": "bytes32", "name": "_answerLeaf", "type": "bytes32" },
      { "internalType": "bytes32[]", "name": "_merkleProof", "type": "bytes32[]" }
    ],
    "name": "submitAnswer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Question info
  {
    "inputs": [{ "internalType": "uint256", "name": "_questionId", "type": "uint256" }],
    "name": "getQuestion",
    "outputs": [
      { "internalType": "bytes32", "name": "correctAnswerHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "hintHash", "type": "bytes32" },
      { "internalType": "address", "name": "questionCreator", "type": "address" },
      { "internalType": "uint256", "name": "difficultyLevel", "type": "uint256" },
      { "internalType": "uint256", "name": "baseRewardAmount", "type": "uint256" },
      { "internalType": "bool", "name": "isClosed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const QUIZ_COIN_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Utility class for blockchain operations
export class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.quizDiamondContract = null;
    this.quizCoinContract = null;
  }

  // Initialize the service
  async initialize() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not detected');
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      // Initialize contracts
      this.quizDiamondContract = new ethers.Contract(
        contractAddresses.QuizGameDiamond,
        QUIZ_DIAMOND_ABI,
        this.provider
      );

      this.quizCoinContract = new ethers.Contract(
        contractAddresses.QuizCoin,
        QUIZ_COIN_ABI,
        this.provider
      );

      console.log('✅ Blockchain service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      return false;
    }
  }

  // Check if connected to correct network
  async checkNetwork() {
    try {
      const network = await this.provider.getNetwork();
      const chainId = '0x' + network.chainId.toString(16);
      
      if (chainId !== NETWORKS.BNB_TESTNET.chainId) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  }

  // Switch to BNB Testnet
  async switchToBNBTestnet() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORKS.BNB_TESTNET.chainId }],
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORKS.BNB_TESTNET],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add BNB Testnet:', addError);
          return false;
        }
      }
      console.error('Failed to switch network:', error);
      return false;
    }
  }

  // Get user's QZC balance
  async getQZCBalance(address) {
    try {
      const balance = await this.quizCoinContract.balanceOf(address);
      const decimals = await this.quizCoinContract.decimals();
      
      // Convert from wei to readable format
      const formattedBalance = ethers.formatUnits(balance, decimals);
      return parseFloat(formattedBalance).toFixed(2);
    } catch (error) {
      console.error('Error getting QZC balance:', error);
      return "0.00";
    }
  }

  // Generate Merkle proof via API
  async generateMerkleProof(quizId, answer) {
    try {
      const response = await fetch('/api/generate-merkle-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quizId, answer }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate proof');
      }

      return {
        leaf: data.leaf,
        proof: data.proof,
        root: data.root,
        isValid: data.isValid,
        batchId: data.batchId
      };
    } catch (error) {
      console.error('Error generating Merkle proof:', error);
      throw error;
    }
  }

  // Verify Merkle proof on-chain
  async verifyMerkleProof(leaf, proof) {
    try {
      const isValid = await this.quizDiamondContract.verifyQuiz(leaf, proof);
      return isValid;
    } catch (error) {
      console.error('Error verifying Merkle proof:', error);
      return false;
    }
  }

  // Submit answer with Merkle proof
  async submitAnswer(quizId, answer, onProgress) {
    try {
      if (!this.signer) {
        throw new Error('No signer available');
      }

      // Step 1: Generate Merkle proof
      onProgress && onProgress('🔍 กำลังสร้าง Merkle proof...');
      const proofData = await this.generateMerkleProof(quizId, answer);

      if (!proofData || !proofData.isValid) {
        throw new Error('Invalid Merkle proof generated');
      }

      // Step 2: Verify proof on-chain (optional verification)
      onProgress && onProgress('⚡ กำลังตรวจสอบด้วย Merkle Tree...');
      const isValidOnChain = await this.verifyMerkleProof(proofData.leaf, proofData.proof);
      
      if (!isValidOnChain) {
        console.warn('On-chain verification failed, proceeding anyway');
      }

      // Step 3: Extract question ID
      const questionId = this.extractQuestionId(quizId);

      // Step 4: Estimate gas
      onProgress && onProgress('⛽ กำลังคำนวณค่า gas...');
      const contractWithSigner = this.quizDiamondContract.connect(this.signer);
      
      let gasEstimate;
      try {
        gasEstimate = await contractWithSigner.submitAnswer.estimateGas(
          questionId,
          proofData.leaf,
          proofData.proof
        );
      } catch (estimateError) {
        console.warn('Gas estimation failed:', estimateError);
        gasEstimate = BigInt(500000); // Fallback gas limit
      }

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate * BigInt(120) / BigInt(100);

      // Step 5: Submit transaction
      onProgress && onProgress('📝 กำลังส่งธุรกรรมไปยัง Smart Contract...');
      
      const tx = await contractWithSigner.submitAnswer(
        questionId,
        proofData.leaf,
        proofData.proof,
        { gasLimit }
      );

      onProgress && onProgress(`⏳ รอการยืนยันธุรกรรม... ${tx.hash.slice(0, 10)}...`);

      // Step 6: Wait for confirmation
      const receipt = await tx.wait();

      // Step 7: Parse events for rewards
      const rewardInfo = this.parseRewardEvents(receipt);

      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt,
        rewardInfo: rewardInfo,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };

    } catch (error) {
      console.error('Error submitting answer:', error);
      
      // Handle specific error types
      if (error.code === 4001) {
        throw new Error('Transaction rejected by user');
      } else if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient BNB for gas fees');
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else {
        throw new Error(`Transaction failed: ${error.message}`);
      }
    }
  }

  // Extract question ID from quiz ID
  extractQuestionId(quizId) {
    // Extract numbers from quizId and convert to integer
    const match = quizId.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
    // Fallback: use timestamp-based ID
    return Math.floor(Date.now() / 1000) % 1000000;
  }

  // Parse reward events from transaction receipt
  parseRewardEvents(receipt) {
    let totalReward = "0";
    let rewardEvents = [];

    try {
      // Look for reward-related events in logs
      receipt.logs.forEach((log, index) => {
        try {
          // Check for common reward event signatures
          const rewardEventSignatures = [
            ethers.keccak256(ethers.toUtf8Bytes("RewardDistributed(uint256,address,uint256)")),
            ethers.keccak256(ethers.toUtf8Bytes("AnswerSubmitted(uint256,address,bytes32,bool)"))
          ];

          if (rewardEventSignatures.includes(log.topics[0])) {
            // This is likely a reward event
            rewardEvents.push({
              eventIndex: index,
              topics: log.topics,
              data: log.data
            });

            // Try to extract reward amount (this is simplified)
            if (log.data && log.data !== '0x') {
              try {
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);
                if (decoded && decoded[0]) {
                  totalReward = ethers.formatEther(decoded[0]);
                }
              } catch (decodeError) {
                console.warn('Could not decode reward amount:', decodeError);
              }
            }
          }
        } catch (eventError) {
          console.warn('Error parsing event:', eventError);
        }
      });
    } catch (error) {
      console.warn('Error parsing reward events:', error);
    }

    return {
      totalReward: totalReward,
      hasReward: rewardEvents.length > 0,
      events: rewardEvents
    };
  }

  // Get question info from blockchain
  async getQuestionInfo(questionId) {
    try {
      const questionInfo = await this.quizDiamondContract.getQuestion(questionId);
      
      return {
        correctAnswerHash: questionInfo[0],
        hintHash: questionInfo[1],
        questionCreator: questionInfo[2],
        difficultyLevel: questionInfo[3].toString(),
        baseRewardAmount: ethers.formatEther(questionInfo[4]),
        isClosed: questionInfo[5]
      };
    } catch (error) {
      console.error('Error getting question info:', error);
      return null;
    }
  }

  // Record answer on backend after successful blockchain transaction
  async recordAnswer(answerData) {
    try {
      const response = await fetch('/api/record-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(answerData),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to record answer');
      }

      return data;
    } catch (error) {
      console.error('Error recording answer:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(userAccount) {
    try {
      const response = await fetch('/api/get-user-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAccount }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get user stats');
      }

      return data.stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalAnswered: 0,
        totalCorrect: 0,
        totalEarned: "0",
        streak: 0,
        accuracy: 0
      };
    }
  }

  // Get available quizzes for user
  async getAvailableQuizzes(userAccount) {
    try {
      const response = await fetch('/api/get-available-quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAccount }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get available quizzes');
      }

      return data.quizzes || [];
    } catch (error) {
      console.error('Error getting available quizzes:', error);
      return [];
    }
  }

  // Format transaction hash for display
  formatTxHash(hash, length = 10) {
    if (!hash || hash.length < length) return hash;
    return `${hash.slice(0, length)}...`;
  }

  // Format address for display
  formatAddress(address, startLength = 6, endLength = 4) {
    if (!address || address.length < startLength + endLength) return address;
    return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
  }

  // Calculate APY or reward rate (mock calculation)
  calculateRewardRate(difficulty) {
    // Base reward calculation based on difficulty
    const baseReward = Math.floor(difficulty * 5 + 100);
    const bonus = difficulty >= 80 ? 50 : difficulty >= 50 ? 25 : 0;
    return baseReward + bonus;
  }

  // Check if user can answer a specific quiz
  async canAnswerQuiz(userAccount, quizId) {
    try {
      const response = await fetch('/api/get-answered-quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAccount }),
      });

      const data = await response.json();
      
      if (!data.success) {
        return true; // Allow by default if can't check
      }

      const hasAnswered = data.answeredQuizzes.some(
        quiz => quiz.quizId === quizId
      );

      return !hasAnswered;
    } catch (error) {
      console.error('Error checking if user can answer quiz:', error);
      return true; // Allow by default on error
    }
  }

  // Disconnect and cleanup
  disconnect() {
    this.provider = null;
    this.signer = null;
    this.quizDiamondContract = null;
    this.quizCoinContract = null;
    console.log('🔌 Blockchain service disconnected');
  }
}

// Export utility functions
export const blockchainService = new BlockchainService();

// Helper function to format numbers
export const formatNumber = (num, decimals = 2) => {
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// Helper function to format currency
export const formatCurrency = (amount, currency = 'QZC') => {
  return `${formatNumber(amount)} ${currency}`;
};

// Helper function to calculate time ago
export const timeAgo = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) {
    return `${minutes} นาทีที่แล้ว`;
  } else if (hours < 24) {
    return `${hours} ชั่วโมงที่แล้ว`;
  } else {
    return `${days} วันที่แล้ว`;
  }
};

// Error handler for blockchain operations
export const handleBlockchainError = (error, context = '') => {
  console.error(`Blockchain error ${context}:`, error);
  
  if (error.code === 4001) {
    return 'ผู้ใช้ปฏิเสธการทำธุรกรรม';
  } else if (error.message.includes('insufficient funds')) {
    return 'BNB ไม่เพียงพอสำหรับค่า gas';
  } else if (error.message.includes('network')) {
    return 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย';
  } else if (error.reason) {
    return `Smart Contract Error: ${error.reason}`;
  } else {
    return `เกิดข้อผิดพลาด: ${error.message}`;
  }
};

export default BlockchainService;