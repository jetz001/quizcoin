// frontend/src/utils/blockchain.js - Fix network configuration
import { ethers } from 'ethers';

// Network configurations - แก้ไข chain ID
export const NETWORKS = {
  BNB_TESTNET: {
    chainId: '0x61', // 97 in hex = BSC Testnet ✅
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

// Contract addresses - ใช้จาก .env
export const contractAddresses = {
  "97": { // BSC Testnet chain ID ในรูปแบบ decimal
    QuizGameDiamond: "0x7707CE42a3EFE0E5bdAE20996e2D0a1d45e40FE4", // จาก .env
    QuizCoin: "0x7707CE42a3EFE0E5bdAE20996e2D0a1d45e40FE4", // หรือ address แยกถ้ามี
    MerkleFacet: "0x7707CE42a3EFE0E5bdAE20996e2D0a1d45e40FE4"
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

      // Get network info
      const network = await this.provider.getNetwork();
      const chainId = network.chainId.toString();
      
      console.log(`🌐 Connected to network: Chain ID ${chainId}`);

      // Initialize contracts based on chain ID
      await this.initializeContracts();

      console.log('✅ Blockchain service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      return false;
    }
  }

  // Initialize contracts for current network
  async initializeContracts() {
    try {
      const network = await this.provider.getNetwork();
      const chainId = network.chainId.toString();

      console.log(`🔧 Initializing contracts for chain ID: ${chainId}`);

      // ใช้ contractAddresses โดยตรง
      if (!contractAddresses.QuizGameDiamond) {
        console.error('❌ Available contracts:', contractAddresses);
        throw new Error(`No QuizGameDiamond address found. Available: ${Object.keys(contractAddresses).join(', ')}`);
      }

      // Initialize Quiz Diamond contract (main contract)
      this.quizDiamondContract = new ethers.Contract(
        contractAddresses.QuizGameDiamond,
        QUIZ_DIAMOND_ABI,
        this.signer
      );
      console.log(`✅ Quiz Diamond contract: ${contractAddresses.QuizGameDiamond}`);

      // Initialize QuizCoin contract
      if (contractAddresses.QuizCoin) {
        this.quizCoinContract = new ethers.Contract(
          contractAddresses.QuizCoin,
          QUIZ_COIN_ABI,
          this.signer
        );
        console.log(`✅ Quiz Coin contract: ${contractAddresses.QuizCoin}`);
      }

      console.log('✅ Contracts initialized successfully');
    } catch (error) {
      console.error('❌ Contract initialization failed:', error);
      throw error;
    }
  }

  // Check if connected to correct network
  async checkNetwork() {
    try {
      const network = await this.provider.getNetwork();
      const chainId = network.chainId.toString();
      
      // รองรับ BSC Testnet (Chain ID: 97)
      return chainId === '97';
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
        params: [{ chainId: NETWORKS.BNB_TESTNET.chainId }], // 0x61
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
      if (!this.quizCoinContract) {
        return "0.00";
      }

      const balance = await this.quizCoinContract.balanceOf(address);
      const decimals = await this.quizCoinContract.decimals();
      
      const formattedBalance = ethers.formatUnits(balance, decimals);
      return parseFloat(formattedBalance).toFixed(2);
    } catch (error) {
      console.error('Error getting QZC balance:', error);
      return "0.00";
    }
  }

  // Generate Merkle proof via backend API
  async generateMerkleProof(quizId, answer) {
    try {
      console.log(`🔍 Generating Merkle proof for quiz ${quizId}...`);

      const response = await fetch('/api/generate-merkle-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, answer }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate proof');
      }

      console.log('✅ Merkle proof generated successfully');
      return {
        leaf: data.leaf,
        proof: data.proof,
        root: data.root,
        isValid: data.isValid,
        batchId: data.batchId,
        quizId: data.quizId
      };
    } catch (error) {
      console.error('❌ Error generating Merkle proof:', error);
      throw error;
    }
  }

  // Submit answer with Merkle proof
  async submitAnswer(quizId, answer, onProgress) {
    try {
      if (!this.signer) {
        throw new Error('No signer available. Please connect your wallet.');
      }

      if (!this.quizDiamondContract) {
        throw new Error('Quiz contract not initialized');
      }

      // Step 1: Generate Merkle proof via backend
      onProgress && onProgress('🔍 กำลังสร้าง Merkle proof...');
      const proofData = await this.generateMerkleProof(quizId, answer);

      if (!proofData || !proofData.isValid) {
        throw new Error('Invalid Merkle proof generated');
      }

      // Step 2: Extract question ID from quizId
      const questionId = this.extractQuestionId(quizId);

      // Step 3: Submit answer to blockchain
      onProgress && onProgress('📝 กำลังส่งคำตอบขึ้น blockchain...');
      
      const tx = await this.quizDiamondContract.submitAnswer(
        questionId,
        proofData.leaf,
        proofData.proof,
        {
          gasLimit: 500000 // Set reasonable gas limit
        }
      );

      console.log('📡 Transaction sent:', tx.hash);
      onProgress && onProgress('⏳ กำลังรอการยืนยันธุรกรรม...');

      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', tx.hash);

      onProgress && onProgress('🎉 สำเร็จ! กำลังประมวลผลรางวัล...');

      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt,
        proofData: proofData
      };

    } catch (error) {
      console.error('❌ Error submitting answer:', error);
      throw error;
    }
  }

  // Extract question ID from quiz ID
  extractQuestionId(quizId) {
    // If quizId format is like "q_1234567890_1", extract the last number
    const parts = quizId.split('_');
    if (parts.length >= 3) {
      return parseInt(parts[parts.length - 1]);
    }
    
    // Fallback: use hash of quizId
    return Math.abs(this.hashString(quizId)) % 1000000;
  }

  // Simple hash function for string
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Format address for display
  formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Format transaction hash for display
  formatTxHash(hash) {
    if (!hash) return '';
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
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

// Export singleton instance as default
export default blockchainService;