// frontend/src/utils/blockchain.js
import { ethers } from 'ethers';
import contractAddresses from '../config/addresses.json';

export const NETWORKS = {
  BNB_TESTNET: {
    chainId: '0x61',
    chainName: 'BNB Smart Chain Testnet',
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
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_questionId", "type": "uint256" }
    ],
    "name": "getQuestion",
    "outputs": [
      { "internalType": "bytes32", "name": "correctAnswerHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "hintHash", "type": "bytes32" },
      { "internalType": "address", "name": "questionCreator", "type": "address" },
      { "internalType": "uint256", "name": "difficultyLevel", "type": "uint256" },
      { "internalType": "uint256", "name": "baseRewardAmount", "type": "uint256" },
      { "internalType": "bool", "name": "isClosed", "type": "bool" },
      { "internalType": "uint8", "name": "mode", "type": "uint8" },
      { "internalType": "uint256", "name": "blockCreationTime", "type": "uint256" },
      { "internalType": "uint256", "name": "firstCorrectAnswerTime", "type": "uint256" },
      { "internalType": "address", "name": "firstSolverAddress", "type": "address" },
      { "internalType": "address[]", "name": "poolCorrectSolvers", "type": "address[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_answerLeaf", "type": "bytes32" }
    ],
    "name": "isLeafSolved",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_answerLeaf", "type": "bytes32" }
    ],
    "name": "getLeafSolver",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_answerLeaf", "type": "bytes32" }
    ],
    "name": "getLeafSolveTime",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_answerLeaf", "type": "bytes32" }
    ],
    "name": "getLeafQuestionId",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
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
      if (!this.quizCoinContract) {
        console.warn('QuizCoin contract not initialized');
        return "0.00";
      }
      
      const balance = await this.quizCoinContract.balanceOf(address);
      const decimals = await this.quizCoinContract.decimals();
      const formattedBalance = ethers.formatUnits(balance, decimals);
      return parseFloat(formattedBalance).toFixed(2);
    } catch (error) {
      console.warn('QZC balance not available (contract may not be deployed):', error.message);
      return "0.00";
    }
  }

  // Generate Merkle proof via backend API
  async generateMerkleProof(quizId, answer) {
    try {
      console.log(`🔍 Generating Merkle proof for quiz: ${quizId}, answer: ${answer}`);
      
      const response = await fetch('http://localhost:3001/api/generate-merkle-proof', {
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
  async verifyMerkleProof(blockchainQuestionId, leaf, proof) {
  try {
    if (!this.quizDiamondContract) {
      throw new Error('Quiz contract not initialized');
    }

    // Use the actual blockchain question ID
    const questionId = blockchainQuestionId;
    
    console.log('🔍 Verifying proof on-chain:', { questionId, leaf, proofLength: proof.length });
    
    const isValid = await this.quizDiamondContract.verifyQuiz(questionId, leaf, proof);
    
    console.log('✅ On-chain verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying Merkle proof on-chain:', error);
    return false;
  }
}

  // Submit answer with real Merkle proof (with retry logic)
  async submitAnswer(quizId, answer, blockchainQuestionId, onProgress, quizData = null) {
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        const result = await this._submitAnswerInternal(quizId, answer, blockchainQuestionId, onProgress, quizData);
        
        // If result indicates we should retry, increment counter and try again
        if (result && result.shouldRetry && retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Retrying submission (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          if (onProgress) onProgress(`🔄 กำลังลองใหม่ครั้งที่ ${retryCount + 1}...`);
          continue;
        }
        
        return result;
      } catch (error) {
        if (retryCount < maxRetries && error.message.includes('คำถามใหม่ถูกสร้างแล้ว')) {
          retryCount++;
          console.log(`🔄 Retrying after fresh question creation (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          if (onProgress) onProgress(`🔄 กำลังลองใหม่ครั้งที่ ${retryCount + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw error;
      }
    }
  }

  // Internal submit answer method
  async _submitAnswerInternal(quizId, answer, blockchainQuestionId, onProgress, quizData = null) {
    try {
      if (!this.signer) {
        throw new Error('No signer available');
      }

      // Validate blockchainQuestionId
      if (!blockchainQuestionId) {
        throw new Error('คำถามนี้ยังไม่ได้สร้างบน blockchain กรุณาเลือกคำถามอื่น');
      }

      // Additional validation
      if (typeof blockchainQuestionId !== 'number' || blockchainQuestionId <= 0) {
        throw new Error('รหัสคำถามบน blockchain ไม่ถูกต้อง');
      }

      // Step 1: Generate Merkle proof from backend
      if (onProgress) onProgress('🔍 กำลังสร้าง Merkle proof จาก backend...');
      const proofData = await this.generateMerkleProof(quizId, answer);

      if (!proofData || !proofData.isValid) {
        throw new Error('Invalid Merkle proof generated');
      }

      console.log('📋 Proof data:', {
        quizId,
        blockchainQuestionId,
        leaf: proofData.leaf,
        proofLength: proofData.proof.length,
        root: proofData.root,
        batchId: proofData.batchId
      });

      // Step 2: Verify proof on-chain (optional check)
      if (onProgress) onProgress('⚡ กำลังตรวจสอบด้วย Merkle Tree...');
      try {
        const isValidOnChain = await this.verifyMerkleProof(blockchainQuestionId, proofData.leaf, proofData.proof);

        console.log('🔍 On-chain verification:', isValidOnChain);
        
        if (!isValidOnChain) {
          console.warn('⚠️ On-chain verification failed, but continuing...');
        }
      } catch (verifyError) {
        console.warn('⚠️ On-chain verification error:', verifyError.message);
      }

      // Step 3: Use the blockchain question ID from the quiz data
      const questionId = blockchainQuestionId;

      if (onProgress) onProgress('📝 กำลังส่งคำตอบไปยัง blockchain...');

      // Step 4: Submit answer to blockchain
      const contractWithSigner = this.quizDiamondContract.connect(this.signer);
      
      // Note: Removed question status check - using off-chain quiz completion tracking instead

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
        
        // Handle specific case of already solved quiz
        if (gasError.message.includes('already solved')) {
          console.log('⚠️ Quiz already solved on blockchain');
          if (onProgress) onProgress('⚠️ คำถามนี้ถูกทำไปแล้ว');
          
          // Sync the completion status with Firebase
          try {
            const userAccount = await this.signer.getAddress();
            await this.syncQuizCompletion(userAccount, quizId, 'blockchain_already_solved');
          } catch (syncError) {
            console.warn('⚠️ Failed to sync quiz completion:', syncError);
          }
          
          // Return a special object to indicate this quiz should be marked as completed
          return {
            success: false,
            alreadySolved: true,
            message: 'คำถามนี้ถูกทำไปแล้วบน blockchain',
            quizId: quizId
          };
        }
        
        // If gas estimation fails due to closed question, try to create fresh question
        if (gasError.message.includes('Question is closed') || gasError.message.includes('already closed')) {
          console.log('🔄 Question is closed, attempting to create fresh question...');
          if (onProgress) onProgress('🔄 คำถามถูกปิด กำลังสร้างคำถามใหม่...');
          
          try {
            // Extract batch ID from proof data
            const batchId = proofData.batchId;
            if (batchId) {
              await this.createFreshQuestion(batchId);
              
              // Wait for real-time update and then retry automatically
              console.log('✅ Fresh question creation initiated, waiting for real-time update...');
              if (onProgress) onProgress('✅ คำถามใหม่ถูกสร้างแล้ว กำลังอัพเดท...');
              
              // Give the real-time system time to update
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Instead of throwing error, return a special flag to retry
              return { shouldRetry: true, message: 'Fresh question created, retrying...' };
            } else {
              throw new Error('ไม่สามารถสร้างคำถามใหม่ได้ กรุณารีเฟรชหน้า');
            }
          } catch (freshError) {
            console.error('❌ Failed to create fresh question:', freshError);
            throw new Error('คำถามใหม่ถูกสร้างแล้ว ระบบจะอัพเดทอัตโนมัติในไม่ช้า');
          }
        }
        
        // Use fallback gas limit for other estimation failures
        gasEstimate = 350000; // Increased fallback gas limit
        console.log('⛽ Using fallback gas estimate:', gasEstimate);
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
        },
        quizData: quizData || {
          question: "Question not available",
          options: [],
          category: "general",
          difficulty: 50
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
      } else if (error.message.includes('Question does not exist')) {
        throw new Error('คำถามนี้ไม่มีอยู่บน blockchain กรุณาเลือกคำถามอื่น');
      } else if (error.message.includes('execution reverted')) {
        throw new Error('การทำธุรกรรมถูกยกเลิก อาจเป็นเพราะคำถามไม่มีอยู่หรือข้อมูลไม่ถูกต้อง');
      } else {
        throw new Error(`เกิดข้อผิดพลาด: ${error.message}`);
      }
    }
  }

  // Complete quiz in backend
  async completeQuiz(completionData) {
    try {
      const response = await fetch('http://localhost:3001/api/complete-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(completionData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Quiz completed in backend:', result);
      return result;
    } catch (error) {
      console.error('❌ Error completing quiz in backend:', error);
      throw error;
    }
  }

  // Create fresh question when current one is closed
  async createFreshQuestion(batchId) {
    try {
      console.log(`🔄 Creating fresh question for batch ${batchId}...`);
      
      const response = await fetch(`http://localhost:3001/admin/create-fresh-question/${batchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Fresh question created:', result);
      return result;
    } catch (error) {
      console.error('❌ Error creating fresh question:', error);
      throw error;
    }
  }

  async getUserStats(userAccount) {
    try {
      const response = await fetch('http://localhost:3001/api/get-user-stats', {
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
      const response = await fetch('http://localhost:3001/api/get-available-quizzes', {
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

  // 🚪 NEW: Leaf-Level Door System Methods
  
  async isLeafSolved(answerLeaf) {
    if (!this.quizDiamondContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const isSolved = await this.quizDiamondContract.isLeafSolved(answerLeaf);
      console.log(`🚪 Leaf ${answerLeaf} solved status:`, isSolved);
      return isSolved;
    } catch (error) {
      console.error('❌ Error checking leaf status:', error);
      return false;
    }
  }

  async getLeafInfo(answerLeaf) {
    if (!this.quizDiamondContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const [isSolved, solver, solveTime, questionId] = await Promise.all([
        this.quizDiamondContract.isLeafSolved(answerLeaf),
        this.quizDiamondContract.getLeafSolver(answerLeaf),
        this.quizDiamondContract.getLeafSolveTime(answerLeaf),
        this.quizDiamondContract.getLeafQuestionId(answerLeaf)
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

  async checkQuizAvailability(quizId, answerLeaf) {
    try {
      const isSolved = await this.isLeafSolved(answerLeaf);
      console.log(`🎯 Quiz ${quizId} availability:`, !isSolved);
      return !isSolved; // Available if not solved
    } catch (error) {
      console.error('❌ Error checking quiz availability:', error);
      return true; // Default to available on error
    }
  }

  async checkQuizCompleted(userAccount, quizId) {
    try {
      console.log(`🔍 Checking if quiz ${quizId} completed by ${userAccount}`);
      
      // First check database for completion status
      const response = await fetch('http://localhost:3001/api/check-quiz-completed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAccount: userAccount.toLowerCase(),
          quizId
        })
      });

      if (!response.ok) {
        console.error(`❌ API request failed with status ${response.status}`);
        return { isCompleted: false, completedData: null };
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Quiz completion check result:`, data.isCompleted);
        return {
          isCompleted: data.isCompleted,
          completedData: data.completedData
        };
      } else {
        console.error('❌ Failed to check quiz completion:', data.error);
        return { isCompleted: false, completedData: null };
      }
    } catch (error) {
      console.error('❌ Error checking quiz completion:', error);
      return { isCompleted: false, completedData: null };
    }
  }

  async checkQuizCompletedByLeaf(quizId, correctAnswer) {
    try {
      console.log(`🔍 Checking if quiz ${quizId} completed by leaf (answer: ${correctAnswer})`);
      
      // Generate the answer leaf hash
      const answerLeaf = ethers.keccak256(ethers.toUtf8Bytes(correctAnswer.toLowerCase().trim()));
      console.log(`🍃 Answer leaf hash: ${answerLeaf}`);
      
      // Check if this specific leaf is solved on blockchain
      const isSolved = await this.isLeafSolved(answerLeaf);
      console.log(`🚪 Leaf solved status: ${isSolved}`);
      
      if (isSolved) {
        // Get additional info about who solved it and when
        const leafInfo = await this.getLeafInfo(answerLeaf);
        console.log(`📋 Leaf info:`, leafInfo);
        
        return {
          isCompleted: true,
          completedData: {
            solver: leafInfo.solver,
            solveTime: leafInfo.solveTime,
            questionId: leafInfo.questionId,
            answerLeaf: answerLeaf,
            method: 'leaf_check'
          }
        };
      }
      
      return { isCompleted: false, completedData: null };
      
    } catch (error) {
      console.error('❌ Error checking quiz completion by leaf:', error);
      return { isCompleted: false, completedData: null };
    }
  }

  async syncQuizCompletion(userAccount, quizId, reason) {
    try {
      console.log(`🔄 Syncing quiz completion: ${quizId} for ${userAccount}`);
      
      const response = await fetch('http://localhost:3001/api/sync-quiz-completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAccount: userAccount.toLowerCase(),
          quizId,
          reason
        })
      });

      if (!response.ok) {
        console.error(`❌ Sync API request failed with status ${response.status}`);
        return false;
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Quiz completion synced:`, data.synced ? 'newly synced' : 'already existed');
        return true;
      } else {
        console.error('❌ Failed to sync quiz completion:', data.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error syncing quiz completion:', error);
      return false;
    }
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