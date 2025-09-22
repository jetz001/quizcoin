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
    { "internalType": "uint256", "name": "quizId", "type": "uint256" },
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
      console.log(`🔍 Generating Merkle proof for quiz: ${quizId}, answer: ${answer}`);
      
      const response = await fetch('/api/generate-merkle-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quizId, answer }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate proof');
      }

      console.log('✅ Merkle proof generated:', {
        leaf: data.leaf,
        proofLength: data.proof ? data.proof.length : 0,
        root: data.root,
        isValid: data.isValid,
        batchId: data.batchId
      });

      return {
        leaf: data.leaf,
        proof: data.proof || [],
        root: data.root,
        isValid: data.isValid,
        batchId: data.batchId
      };
    } catch (error) {
      console.error('❌ Error generating Merkle proof:', error);
      throw error;
    }
  }

  // Verify Merkle proof on-chain
  async verifyMerkleProof(quizId, leaf, proof) {
  try {
    if (!this.quizDiamondContract) {
      throw new Error('Quiz contract not initialized');
    }

    console.log('🔍 Verifying proof on-chain:', { quizId, leaf, proofLength: proof.length });
    
    const isValid = await this.quizDiamondContract.verifyQuiz(quizId, leaf, proof);
    
    console.log('✅ On-chain verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying Merkle proof on-chain:', error);
    return false;
  }
}

  // Submit answer with real Merkle proof
  async submitAnswer(quizId, answer, onProgress) {
    try {
      if (!this.signer) {
        throw new Error('No signer available');
      }

      // Step 1: Generate Merkle proof from backend
      if (onProgress) onProgress('🔍 กำลังสร้าง Merkle proof จาก backend...');
      const proofData = await this.generateMerkleProof(quizId, answer);

      if (!proofData || !proofData.isValid) {
        throw new Error('Invalid Merkle proof generated');
      }

      console.log('📋 Proof data:', {
        quizId,
        leaf: proofData.leaf,
        proofLength: proofData.proof.length,
        root: proofData.root,
        batchId: proofData.batchId
      });

      // Step 2: Verify proof on-chain (optional check)
      if (onProgress) onProgress('⚡ กำลังตรวจสอบด้วย Merkle Tree...');
      try {
        const isValidOnChain = await this.verifyMerkleProof(proofData.batchId, proofData.leaf, proofData.proof);

        console.log('🔍 On-chain verification:', isValidOnChain);
        
        if (!isValidOnChain) {
          console.warn('⚠️ On-chain verification failed, but continuing...');
        }
      } catch (verifyError) {
        console.warn('⚠️ On-chain verification error:', verifyError.message);
      }

      // Step 3: Extract questionId from quizId
      const questionIdMatch = quizId.match(/q_(\d+)_(\d+)/);
      const questionId = questionIdMatch ? questionIdMatch[1] : Date.now().toString();

      if (onProgress) onProgress('📝 กำลังส่งคำตอบไปยัง blockchain...');

      // Step 4: Submit answer to blockchain
      const contractWithSigner = this.quizDiamondContract.connect(this.signer);
      
      // Estimate gas first
      let gasEstimate;
      try {
        gasEstimate = await contractWithSigner.submitAnswer.estimateGas(
          questionId,
          proofData.leaf,
          proofData.proof
        );
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (gasError) {
        console.warn('⚠️ Gas estimation failed:', gasError.message);
        gasEstimate = 300000; // Fallback gas limit
      }

      // Submit transaction
      const tx = await contractWithSigner.submitAnswer(
        questionId,
        proofData.leaf,
        proofData.proof,
        {
          gasLimit: Math.floor(Number(gasEstimate) * 1.2) // Add 20% buffer
        }
      );

      console.log('📤 Transaction sent:', tx.hash);

      if (onProgress) onProgress('⏳ รอการยืนยันจาก blockchain...');
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      console.log('✅ Transaction confirmed:', {
        hash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      });

      // Step 5: Parse events to get reward info
      let rewardAmount = '100'; // Default fallback
      try {
        const events = receipt.logs || [];
        for (const event of events) {
          if (event.topics && event.topics.length > 0) {
            console.log('📊 Event detected:', event);
            // TODO: Parse specific reward events based on your contract
          }
        }
      } catch (eventError) {
        console.warn('⚠️ Error parsing events:', eventError.message);
      }

      if (onProgress) onProgress('🎉 คำตอบถูกบันทึกเรียบร้อย!');

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        rewardInfo: {
          totalReward: rewardAmount,
          currency: 'QZC'
        },
        proofData: {
          leaf: proofData.leaf,
          proof: proofData.proof,
          root: proofData.root,
          batchId: proofData.batchId
        }
      };

    } catch (error) {
      console.error('❌ Error submitting answer:', error);
      
      // Handle specific error types
      if (error.code === 4001) {
        throw new Error('ผู้ใช้ปฏิเสธการทำธุรกรรม');
      } else if (error.message.includes('insufficient funds')) {
        throw new Error('BNB ไม่เพียงพอสำหรับค่า gas');
      } else if (error.message.includes('Quiz already answered')) {
        throw new Error('คำถามนี้ตอบไปแล้ว');
      } else if (error.message.includes('Invalid Merkle proof')) {
        throw new Error('Merkle proof ไม่ถูกต้อง');
      } else {
        throw new Error(`เกิดข้อผิดพลาด: ${error.message}`);
      }
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
      console.error('Error getting user stats:', error);
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
      console.error('Error getting available quizzes:', error);
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