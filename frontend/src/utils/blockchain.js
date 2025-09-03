// frontend/src/utils/blockchain.js - Enhanced version
import { ethers } from 'ethers';

// Contract addresses and ABIs
import contractAddresses from '../config/addresses.json';
import QuizDiamondABI from '../abi/QuizGameDiamond.json';
import MerkleFacetABI from '../abi/MerkleFacet.json';
import QuizCoinABI from '../abi/QuizCoin.json';

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.quizDiamondContract = null;
    this.merkleContract = null;
    this.quizCoinContract = null;
    this.isConnected = false;
    this.userAddress = null;
  }

  // Initialize blockchain connection
  async initialize() {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install MetaMask to use this application');
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.');
      }

      this.signer = await this.provider.getSigner();
      this.userAddress = await this.signer.getAddress();

      // Initialize contracts
      await this.initializeContracts();

      this.isConnected = true;
      console.log('✅ Blockchain service initialized:', this.userAddress);

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          this.disconnect();
        } else {
          window.location.reload(); // Reload to reinitialize
        }
      });

      // Listen for network changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload(); // Reload to reinitialize
      });

      return true;
    } catch (error) {
      console.error('❌ Blockchain initialization failed:', error);
      throw error;
    }
  }

  // Initialize smart contracts
  async initializeContracts() {
    try {
      const network = await this.provider.getNetwork();
      const chainId = network.chainId.toString();

      if (!contractAddresses[chainId]) {
        throw new Error(`Unsupported network. Chain ID: ${chainId}`);
      }

      const addresses = contractAddresses[chainId];

      // Initialize Quiz Diamond contract (main contract)
      if (addresses.QuizGameDiamond) {
        this.quizDiamondContract = new ethers.Contract(
          addresses.QuizGameDiamond,
          QuizDiamondABI.abi,
          this.signer
        );
      }

      // Initialize Merkle contract (same as Diamond for Merkle functions)
      if (addresses.QuizGameDiamond) {
        this.merkleContract = new ethers.Contract(
          addresses.QuizGameDiamond,
          MerkleFacetABI.abi,
          this.signer
        );
      }

      // Initialize QuizCoin contract
      if (addresses.QuizCoin) {
        this.quizCoinContract = new ethers.Contract(
          addresses.QuizCoin,
          QuizCoinABI.abi,
          this.signer
        );
      }

      console.log('✅ Contracts initialized for chain:', chainId);
    } catch (error) {
      console.error('❌ Contract initialization failed:', error);
      throw error;
    }
  }

  // Disconnect wallet
  disconnect() {
    this.provider = null;
    this.signer = null;
    this.quizDiamondContract = null;
    this.merkleContract = null;
    this.quizCoinContract = null;
    this.isConnected = false;
    this.userAddress = null;
    console.log('🔌 Blockchain service disconnected');
  }

  // Get user's wallet address
  getAddress() {
    return this.userAddress;
  }

  // Check if wallet is connected
  isWalletConnected() {
    return this.isConnected && this.userAddress;
  }

  // Get QuizCoin balance
  async getQZCBalance() {
    try {
      if (!this.quizCoinContract || !this.userAddress) {
        return "0.00";
      }

      const balance = await this.quizCoinContract.balanceOf(this.userAddress);
      const decimals = await this.quizCoinContract.decimals();
      
      const formattedBalance = ethers.formatUnits(balance, decimals);
      return parseFloat(formattedBalance).toFixed(2);
    } catch (error) {
      console.error('❌ Error getting QZC balance:', error);
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

  // Verify Merkle proof on-chain
  async verifyMerkleProof(leaf, proof) {
    try {
      if (!this.merkleContract) {
        throw new Error('Merkle contract not initialized');
      }

      console.log('⚡ Verifying Merkle proof on-chain...');
      const isValid = await this.merkleContract.verifyQuiz(leaf, proof);
      return isValid;
    } catch (error) {
      console.error('❌ Error verifying Merkle proof on-chain:', error);
      return false;
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

      // Step 2: Verify proof on-chain (optional check)
      onProgress && onProgress('⚡ กำลังตรวจสอบด้วย Merkle Tree...');
      const isValidOnChain = await this.verifyMerkleProof(proofData.leaf, proofData.proof);
      
      if (!isValidOnChain) {
        console.warn('⚠️ On-chain verification failed, but proceeding...');
      }

      // Step 3: Extract question ID from quizId
      const questionId = this.extractQuestionId(quizId);

      // Step 4: Submit answer to blockchain
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

      // Step 5: Record answer in backend
      onProgress && onProgress('💾 กำลังบันทึกข้อมูล...');
      await this.recordAnswerSubmission(quizId, answer, proofData, tx.hash);

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

  // Extract question ID from quiz ID (implement based on your ID format)
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

  // Record answer submission in backend
  async recordAnswerSubmission(quizId, answer, proofData, txHash) {
    try {
      const response = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          answer,
          userAccount: this.userAddress,
          merkleProof: proofData.proof,
          txHash
        })
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to record answer in backend');
        return false;
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('❌ Error recording answer submission:', error);
      return false;
    }
  }

  // Get user's answered quizzes
  async getUserAnsweredQuizzes() {
    try {
      if (!this.userAddress) {
        throw new Error('No wallet connected');
      }

      const response = await fetch('/api/get-answered-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount: this.userAddress })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch answered quizzes');
      }

      return data.answeredQuizzes || [];
    } catch (error) {
      console.error('❌ Error getting answered quizzes:', error);
      return [];
    }
  }

  // Get network information
  async getNetworkInfo() {
    try {
      if (!this.provider) {
        return null;
      }

      const network = await this.provider.getNetwork();
      return {
        chainId: network.chainId.toString(),
        name: network.name,
        ensAddress: network.ensAddress
      };
    } catch (error) {
      console.error('❌ Error getting network info:', error);
      return null;
    }
  }

  // Check if user can submit answer (not already answered today)
  async canSubmitAnswer(quizId) {
    try {
      const answeredQuizzes = await this.getUserAnsweredQuizzes();
      const today = new Date().toDateString();
      
      // Check if already answered this quiz today
      const alreadyAnswered = answeredQuizzes.some(quiz => 
        quiz.quizId === quizId && 
        new Date(quiz.answeredAt).toDateString() === today
      );

      return !alreadyAnswered;
    } catch (error) {
      console.error('❌ Error checking answer eligibility:', error);
      return true; // Allow attempt if check fails
    }
  }

  // Format error messages for user display
  formatError(error) {
    if (error.code === 4001) {
      return 'การทำธุรกรรมถูกยกเลิกโดยผู้ใช้';
    } else if (error.code === -32603) {
      return 'เกิดข้อผิดพลาดภายในของ RPC';
    } else if (error.message.includes('insufficient funds')) {
      return 'เงินในกระเป๋าไม่เพียงพอสำหรับค่าแก๊ส';
    } else if (error.message.includes('Wrong answer')) {
      return 'คำตอบไม่ถูกต้อง';
    } else if (error.message.includes('already answered')) {
      return 'คุณได้ตอบคำถามนี้ไปแล้ววันนี้';
    }
    
    return error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  }
}

// Create and export singleton instance
const blockchainService = new BlockchainService();
export default blockchainService;