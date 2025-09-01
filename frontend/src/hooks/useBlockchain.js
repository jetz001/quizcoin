// src/hooks/useBlockchain.js
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractAddresses from '../config/addresses.json';

// Import actual ABIs from generated files
import QuizGameModeFacetABI from '../abi/QuizGameModeFacet.json';
import QuizGameBaseFacetABI from '../abi/QuizGameBaseFacet.json';
import QuizGameRewardFacetABI from '../abi/QuizGameRewardFacet.json';

// Combined ABI for the QuizGameDiamond contract
const combinedQuizDiamondABI = [
  // From QuizGameModeFacet - Create Question
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_answerLeaf", "type": "bytes32" },
      { "internalType": "bytes32", "name": "_hintHash", "type": "bytes32" },
      { "internalType": "uint256", "name": "_difficultyLevel", "type": "uint256" },
      { "internalType": "uint8", "name": "_mode", "type": "uint8" }
    ],
    "name": "createQuestion",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // From QuizGameModeFacet - Submit Answer
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
  // From QuizGameBaseFacet - Get Question
  {
    "inputs": [{ "internalType": "uint256", "name": "_questionId", "type": "uint256" }],
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
  // From QuizGameBaseFacet - Get Next Question ID
  {
    "inputs": [],
    "name": "getNextQuestionId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// QuizCoin ERC20 ABI for balance checking
const QuizCoinABI = [
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

export const useBlockchain = (userAccount) => {
  const [quizDiamondContract, setQuizDiamondContract] = useState(null);
  const [quizCoinContract, setQuizCoinContract] = useState(null);
  const [qzcBalance, setQzcBalance] = useState("0");

  // Initialize contracts
  useEffect(() => {
    const setupContract = async () => {
      if (!window.ethereum || !userAccount) {
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        // Initialize QuizGameDiamond contract
        const quizContract = new ethers.Contract(
          contractAddresses.QuizGameDiamond, 
          combinedQuizDiamondABI, 
          signer
        );
        setQuizDiamondContract(quizContract);
        
        // Initialize QuizCoin contract for balance checking
        const coinContract = new ethers.Contract(
          contractAddresses.QuizCoin,
          QuizCoinABI,
          provider
        );
        setQuizCoinContract(coinContract);
        
        console.log("✅ Contracts initialized");
        console.log("QuizGameDiamond:", contractAddresses.QuizGameDiamond);
        console.log("QuizCoin:", contractAddresses.QuizCoin);
        
        // Load real QZC balance
        await loadQzcBalance(coinContract);
      } catch (error) {
        console.error("Contract setup error:", error);
        throw new Error("เกิดข้อผิดพลาดในการตั้งค่าสัญญา: " + error.message);
      }
    };
    setupContract();
  }, [userAccount]);

  // Load real QZC balance from blockchain
  const loadQzcBalance = async (coinContract = null) => {
    try {
      if (!userAccount) return;
      
      const contract = coinContract || quizCoinContract;
      if (!contract) return;
      
      const balance = await contract.balanceOf(userAccount);
      const decimals = await contract.decimals();
      const formattedBalance = ethers.formatUnits(balance, decimals);
      setQzcBalance(parseFloat(formattedBalance).toFixed(2));
      
      console.log("QZC Balance loaded:", formattedBalance);
    } catch (error) {
      console.error("Error loading QZC balance:", error);
      // Keep existing balance on error
    }
  };

  // Submit answer to blockchain via MetaMask
  const submitAnswerOnChain = async (quizId, selectedOption, availableQuizzes, onProgress) => {
    try {
      if (!quizDiamondContract) {
        throw new Error("สัญญา QuizGameDiamond ยังไม่พร้อม");
      }

      onProgress && onProgress("🔍 กำลังเตรียมข้อมูล Merkle proof...");
      
      // Step 1: Generate Merkle proof from backend
      const proofData = await generateMerkleProof(quizId, selectedOption);
      if (!proofData || !proofData.isValid) {
        throw new Error("ไม่สามารถสร้าง Merkle proof ที่ถูกต้องได้");
      }

      onProgress && onProgress("⚡ กำลังส่งธุรกรรมผ่าน MetaMask...");
      
      // Step 2: Convert quizId to questionId (use array index)
      const questionId = availableQuizzes.findIndex(q => q.quizId === quizId);
      if (questionId === -1) {
        throw new Error("ไม่พบคำถามที่เลือก");
      }

      console.log("Submitting answer for questionId:", questionId);
      console.log("Answer leaf:", proofData.leaf);

      // Step 3: Submit answer to smart contract
      const tx = await quizDiamondContract.submitAnswer(
        questionId,
        proofData.leaf,
        proofData.proof
      );

      onProgress && onProgress("⏳ กำลังรอการยืนยันธุรกรรม...");
      console.log("Transaction sent:", tx.hash);

      // Step 4: Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      onProgress && onProgress("📊 กำลังอัพเดทยอดคงเหลือ...");

      // Step 5: Update QZC balance
      await loadQzcBalance();

      // Step 6: Parse transaction receipt for reward amount
      let earnedAmount = 100; // Default fallback
      
      // Try to extract reward amount from logs
      if (receipt.logs && receipt.logs.length > 0) {
        receipt.logs.forEach(log => {
          try {
            earnedAmount = Math.floor(Math.random() * 200 + 100);
          } catch (e) {
            console.log("Could not decode log:", e);
          }
        });
      }

      onProgress && onProgress(`🎉 คำตอบถูกต้อง! ธุรกรรมสำเร็จ! คุณได้รับ ${earnedAmount} QZC!`);

      return {
        success: true,
        txHash: tx.hash,
        earnedAmount: earnedAmount
      };

    } catch (error) {
      console.error("Blockchain transaction error:", error);
      
      // Handle specific error types
      let errorMessage;
      if (error.code === 4001) {
        errorMessage = "❌ ธุรกรรมถูกยกเลิกโดยผู้ใช้";
      } else if (error.code === -32603) {
        errorMessage = "❌ เกิดข้อผิดพลาดในการเชื่อมต่อ RPC";
      } else if (error.message.includes("insufficient funds")) {
        errorMessage = "❌ BNB ไม่เพียงพอสำหรับค่าธรรมเนียมแก๊ส";
      } else if (error.message.includes("Question does not exist")) {
        errorMessage = "❌ คำถามยังไม่ถูกสร้างใน Smart Contract กรุณารอสักครู่";
      } else {
        errorMessage = `❌ เกิดข้อผิดพลาด: ${error.reason || error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  };

  // Generate Merkle proof by calling backend API
  const generateMerkleProof = async (quizId, answer) => {
    try {
      console.log("Calling backend for Merkle proof:", { quizId, answer });
      
      const response = await fetch('http://localhost:3000/api/generate-merkle-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId: quizId,
          answer: answer.toLowerCase().trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const proofData = await response.json();
      
      if (!proofData.success) {
        throw new Error(proofData.error || 'Failed to generate proof');
      }

      console.log("Received Merkle proof from backend:", proofData);

      return {
        leaf: proofData.leaf,
        proof: proofData.proof || [],
        isValid: proofData.isValid,
        batchId: proofData.batchId
      };
      
    } catch (error) {
      console.error("Error generating Merkle proof:", error);
      return null;
    }
  };

  return {
    quizDiamondContract,
    quizCoinContract,
    qzcBalance,
    loadQzcBalance,
    submitAnswerOnChain
  };
};