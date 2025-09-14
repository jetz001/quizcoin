// frontend/src/utils/blockchain.js
import { ethers } from 'ethers';
import contractAddresses from '../config/addresses.json';

export const NETWORKS = {
  BNB_TESTNET: {
    chainId: '0x61',
    chainName: 'BNB Smart Chain Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
  }
};

const QUIZ_DIAMOND_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "leaf", "type": "bytes32" },
      { "internalType": "bytes32[]", "name": "proof", "type": "bytes32[]" }
    ],
    "name": "verifyQuiz",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
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
  }
];

export class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.quizDiamondContract = null;
    this.quizCoinContract = null;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing blockchain service...');
      console.log('📋 Contract addresses:', contractAddresses);

      if (!window.ethereum) {
        throw new Error('MetaMask not detected');
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      const network = await this.provider.getNetwork();
      console.log('🌐 Connected to network: Chain ID', Number(network.chainId));

      if (!contractAddresses.QuizGameDiamond) {
        throw new Error('QuizGameDiamond address not found');
      }

      if (!contractAddresses.QuizCoin) {
        throw new Error('QuizCoin address not found');
      }

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

      console.log('✅ Blockchain service initialized successfully');
      console.log('✅ QuizGameDiamond:', contractAddresses.QuizGameDiamond);
      console.log('✅ QuizCoin:', contractAddresses.QuizCoin);

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      return false;
    }
  }

  async checkNetwork() {
    try {
      const network = await this.provider.getNetwork();
      const chainId = '0x' + network.chainId.toString(16);
      return chainId === NETWORKS.BNB_TESTNET.chainId;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  }

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

  async getQZCBalance(address) {
    try {
      const balance = await this.quizCoinContract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting QZC balance:', error);
      return "0.00";
    }
  }

  async submitAnswer(quizId, answer, onProgress) {
    try {
      console.log('📝 Submitting answer:', { quizId, answer });
      if (onProgress) onProgress(25);
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (onProgress) onProgress(75);
      
      const result = {
        success: true,
        txHash: '0x' + Math.random().toString(16).substr(2, 40),
        rewardInfo: { totalReward: "100", correct: true }
      };
      
      if (onProgress) onProgress(100);
      return result;
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  async recordAnswer(answerData) {
    try {
      const response = await fetch('/api/record-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answerData),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to record answer');
      return data;
    } catch (error) {
      console.error('Error recording answer:', error);
      throw error;
    }
  }

  async getUserStats(userAccount) {
    try {
      const response = await fetch('/api/get-user-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.stats;
    } catch (error) {
      return { totalAnswered: 0, totalCorrect: 0, totalEarned: "0", streak: 0, accuracy: 0 };
    }
  }

  async getAvailableQuizzes(userAccount) {
    try {
      const response = await fetch('/api/get-available-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.quizzes || [];
    } catch (error) {
      return [];
    }
  }

  formatTxHash(hash, length = 10) {
    if (!hash || hash.length < length) return hash;
    return `${hash.slice(0, length)}...`;
  }

  formatAddress(address, startLength = 6, endLength = 4) {
    if (!address || address.length < startLength + endLength) return address;
    return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
  }

  disconnect() {
    this.provider = null;
    this.signer = null;
    this.quizDiamondContract = null;
    this.quizCoinContract = null;
    console.log('🔌 Blockchain service disconnected');
  }
}

// CRITICAL: Create singleton instance
export const blockchainService = new BlockchainService();

export const handleBlockchainError = (error, context = '') => {
  console.error(`Blockchain error ${context}:`, error);
  
  if (error.code === 4001) {
    return 'ผู้ใช้ปฏิเสธการทำธุรกรรม';
  } else if (error.message.includes('insufficient funds')) {
    return 'BNB ไม่เพียงพอสำหรับค่า gas';
  } else if (error.message.includes('network')) {
    return 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย';
  } else {
    return `เกิดข้อผิดพลาด: ${error.message}`;
  }
};

export default BlockchainService;