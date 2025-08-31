import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

// Import contract addresses
import contractAddresses from '../config/addresses.json';

// ABI for the QuizGameDiamond contract with Merkle functionality
const combinedQuizDiamondABI = [
  // Merkle verification function
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
  // Submit answer with Merkle proof
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
  // Get quiz info
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

const GamePage = ({ quizzes, onGoBack, userAccount, selectedMode }) => {
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [answeredQuizzes, setAnsweredQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [quizDiamondContract, setQuizDiamondContract] = useState(null);
  const [qzcBalance, setQzcBalance] = useState("0");
  const [rewardAmount, setRewardAmount] = useState("0");
  const [stats, setStats] = useState({
    totalAnswered: 0,
    totalEarned: "0",
    streak: 0
  });

  // Initialize contract
  useEffect(() => {
    const setupContract = async () => {
      if (!window.ethereum) {
        setMessage("⚠️ ไม่พบ MetaMask กรุณาติดตั้งหรือเปิดใช้งาน");
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contractInstance = new ethers.Contract(
          contractAddresses.QuizGameDiamond, 
          combinedQuizDiamondABI, 
          provider
        );
        setQuizDiamondContract(contractInstance);
        console.log("✅ Contract initialized");
        
        // Load mock QZC balance
        await loadQzcBalance();
      } catch (error) {
        console.error("Contract setup error:", error);
        setMessage("⚠️ เกิดข้อผิดพลาดในการตั้งค่าสัญญา");
      }
    };
    setupContract();
  }, [userAccount]);

  // Load QZC balance (mock)
  const loadQzcBalance = async () => {
    try {
      // For demo purposes, we'll simulate balance
      const mockBalance = (Math.random() * 5000 + 1000).toFixed(2);
      setQzcBalance(mockBalance);
    } catch (error) {
      console.error("Error loading QZC balance:", error);
    }
  };

  // Load answered quizzes from localStorage for demo
  useEffect(() => {
    const loadUserData = () => {
      if (!userAccount) return;
      
      try {
        // For demo, use localStorage
        const storageKey = `answered_${userAccount.toLowerCase()}`;
        const storedAnswered = localStorage.getItem(storageKey);
        
        if (storedAnswered) {
          const parsed = JSON.parse(storedAnswered);
          setAnsweredQuizzes(parsed);
          
          // Update stats
          setStats({
            totalAnswered: parsed.length,
            totalEarned: (parsed.length * 150).toString(), // Mock calculation
            streak: Math.min(parsed.length, 5) // Mock streak
          });
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [userAccount]);

  // Generate Merkle proof (simplified for demo)
  const generateMerkleProof = async (quizId, answer) => {
    try {
      // For demo purposes, create a simple hash-based proof
      // In production, this should call your backend API
      const answerLeaf = ethers.keccak256(ethers.toUtf8Bytes(answer));
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock proof - in reality this comes from your Merkle tree backend
      return {
        leaf: answerLeaf,
        proof: [], // Empty proof for demo
        isValid: true // Always true for demo
      };
      
    } catch (error) {
      console.error("Error generating Merkle proof:", error);
      return null;
    }
  };

  const submitAnswerOnChain = async (quizId, selectedOption) => {
    try {
      setMessage("🔍 กำลังเตรียมข้อมูล...");
      
      // For demo purposes, we'll simulate the blockchain transaction
      // without actually calling the smart contract
      
      // Step 1: Generate Merkle proof
      const proofData = await generateMerkleProof(quizId, selectedOption);
      if (!proofData) {
        setMessage("❌ ไม่สามารถสร้าง Merkle proof ได้");
        return false;
      }

      setMessage("⚡ กำลังตรวจสอบคำตอบ...");
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMessage("📝 กำลังประมวลผลรางวัล...");
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock successful transaction
      const mockTxHash = "0x" + Math.random().toString(16).substring(2, 66);
      const mockReward = Math.floor(Math.random() * 200 + 100).toString();
      
      setMessage(`🎉 คำตอบถูกต้อง! คุณได้รับ ${mockReward} QZC!`);
      
      // Update balance
      const currentBalance = parseFloat(qzcBalance);
      const newBalance = currentBalance + parseFloat(mockReward);
      setQzcBalance(newBalance.toFixed(2));
      
      // Update stats
      setStats(prev => ({
        totalAnswered: prev.totalAnswered + 1,
        totalEarned: (parseFloat(prev.totalEarned) + parseFloat(mockReward)).toString(),
        streak: prev.streak + 1
      }));

      return true;

    } catch (error) {
      console.error("Simulated transaction error:", error);
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
      return false;
    }
  };

  const handleSubmitAnswer = async (selectedOption) => {
    if (!selectedQuiz || loading) return;
    
    setLoading(true);
    setMessage("🔄 กำลังตรวจสอบคำตอบ...");

    // Find correct answer from quiz data
    const quizData = quizzes.find(q => q.quizId === selectedQuiz.quizId);
    
    if (!quizData) {
      setMessage("❌ ไม่พบข้อมูลคำถาม");
      setLoading(false);
      return;
    }

    // Check if answer is correct offline first
    const correctAnswer = quizData.options[quizData.answerIndex];
    if (correctAnswer === selectedOption) {
      // Submit to blockchain (simulated)
      const success = await submitAnswerOnChain(selectedQuiz.quizId, selectedOption);
      
      if (success) {
        // Add to answered quizzes
        const newAnsweredQuiz = { 
          quizId: selectedQuiz.quizId,
          answeredAt: Date.now(),
          mode: selectedMode,
          correct: true,
          selectedOption: selectedOption,
          correctOption: correctAnswer
        };
        
        const updatedAnswered = [...answeredQuizzes, newAnsweredQuiz];
        setAnsweredQuizzes(updatedAnswered);
        
        // Save to localStorage for demo
        try {
          const storageKey = `answered_${userAccount.toLowerCase()}`;
          localStorage.setItem(storageKey, JSON.stringify(updatedAnswered));
        } catch (storageError) {
          console.warn("Could not save to localStorage:", storageError);
        }
        
        setSelectedQuiz(null);
        
        // Clear message after delay
        setTimeout(() => {
          setMessage("");
        }, 5000);
      }
    } else {
      setMessage("❌ คำตอบผิด! ลองใหม่อีกครั้ง");
      // Reset streak on wrong answer
      setStats(prev => ({
        ...prev,
        streak: 0
      }));
      
      // Clear message after delay
      setTimeout(() => {
        setMessage("");
      }, 3000);
    }

    setLoading(false);
  };

  const handleSelectQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setMessage("");
    // Calculate potential reward based on difficulty
    const difficulty = quiz.difficulty || Math.floor(Math.random() * 100) + 1;
    const baseReward = Math.floor(difficulty * 2 + 50); // Simplified calculation
    setRewardAmount(baseReward.toString());
  };

  // Filter available quizzes (exclude already answered)
  const availableQuizzes = quizzes.filter(quiz => 
    !answeredQuizzes.some(answered => answered.quizId === quiz.quizId)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              QuizCoin Game
            </h1>
            <p className="text-sm text-gray-300">
              {selectedMode === 'solo' ? '🎯 โหมด Solo' : '👥 โหมด Pool'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-300">ยอดคงเหลือ QZC</p>
            <p className="text-xl font-bold text-green-400">{qzcBalance}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar - Available Quizzes */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">คำถามรอตอบ</h2>
                <div className="bg-purple-600 text-white px-2 py-1 rounded-full text-sm">
                  {availableQuizzes.length}
                </div>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {availableQuizzes.length > 0 ? (
                  availableQuizzes.map((quiz) => (
                    <div
                      key={quiz.quizId}
                      onClick={() => handleSelectQuiz(quiz)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border card-hover ${
                        selectedQuiz?.quizId === quiz.quizId 
                          ? "bg-purple-600/30 border-purple-400" 
                          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-sm text-purple-300">
                          {quiz.quizId.length > 15 ? `${quiz.quizId.substring(0, 12)}...` : quiz.quizId}
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded">
                            LV.{quiz.difficulty || Math.floor(Math.random() * 100) + 1}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 line-clamp-2">
                        {quiz.question?.substring(0, 80)}
                        {quiz.question?.length > 80 ? "..." : ""}
                      </p>
                      <div className="mt-2 text-xs text-green-400">
                        💰 ~{Math.floor((quiz.difficulty || 50) * 2 + 50)} QZC
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2 animate-bounce">⏳</div>
                    <p className="text-gray-400 text-sm">ไม่มีคำถามใหม่</p>
                    <p className="text-xs text-purple-400 mt-2">กรุณารอสักครู่</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content - Quiz Display */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 min-h-96">
              {selectedQuiz ? (
                <div className="text-center">
                  <div className="mb-6">
                    <div className="inline-flex items-center space-x-2 bg-purple-600/20 px-4 py-2 rounded-full mb-4">
                      <span className="text-purple-300 font-mono text-sm">
                        {selectedQuiz.quizId.length > 20 ? `${selectedQuiz.quizId.substring(0, 17)}...` : selectedQuiz.quizId}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-blue-300 text-sm">Level {selectedQuiz.difficulty || Math.floor(Math.random() * 100) + 1}</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-2 leading-tight">{selectedQuiz.question}</h3>
                    <p className="text-green-400 text-sm animate-pulse">💰 รางวัล: {rewardAmount} QZC</p>
                  </div>

                  <div className="space-y-4 max-w-lg mx-auto">
                    {selectedQuiz.options?.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleSubmitAnswer(option)}
                        disabled={loading}
                        className="w-full p-4 bg-white/10 hover:bg-purple-600/30 rounded-xl text-left transition-all duration-300 border border-white/20 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] interactive"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-600/50 rounded-full flex items-center justify-center text-sm font-bold">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="flex-1 text-left">{option}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {message && (
                    <div className={`mt-6 p-4 rounded-xl border transition-all duration-500 ${
                      message.includes('🎉') 
                        ? 'bg-green-600/20 border-green-600/30 animate-bounce-in' 
                        : message.includes('❌') 
                        ? 'bg-red-600/20 border-red-600/30 animate-shake'
                        : 'bg-white/10 border-white/20'
                    }`}>
                      <p className="text-sm text-center">{message}</p>
                      {loading && (
                        <div className="mt-3 w-full bg-white/20 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full animate-progress"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 animate-float">🎯</div>
                  <h3 className="text-2xl font-bold text-purple-400 mb-2">
                    เลือกคำถามเพื่อเริ่มเล่น
                  </h3>
                  <p className="text-gray-400 mb-6">
                    คลิกเลือกคำถามจากด้านซ้ายเพื่อเริ่มทำแบบทดสอบ
                  </p>
                  <div className="text-sm text-purple-300 animate-pulse">
                    💡 ตอบถูกได้ QZC ทันที!
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Stats & History */}
          <div className="lg:col-span-1">
            {/* Stats Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">สถิติของคุณ</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">ตอบแล้ว:</span>
                  <span className="font-bold text-blue-400 animate-count-up">{stats.totalAnswered}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">QZC รวม:</span>
                  <span className="font-bold text-green-400 animate-count-up">{stats.totalEarned}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Streak:</span>
                  <span className="font-bold text-orange-400">
                    {stats.streak} {stats.streak > 0 && <span className="animate-pulse">🔥</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* History Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <h2 className="text-xl font-bold mb-4">ประวัติการตอบ</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                {answeredQuizzes.length > 0 ? (
                  answeredQuizzes.slice(-10).reverse().map((quiz, index) => (
                    <div key={index} className="p-3 bg-green-600/20 rounded-lg border border-green-600/30 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm text-green-300">
                          {quiz.quizId.length > 12 ? `${quiz.quizId.substring(0, 9)}...` : quiz.quizId}
                        </span>
                        <span className="text-xs text-green-400">✅</span>
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        {quiz.mode === 'solo' ? '🎯 Solo' : '👥 Pool'} • 
                        {new Date(quiz.answeredAt).toLocaleTimeString('th-TH', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm text-center py-4">
                    ยังไม่มีประวัติการตอบ
                  </p>
                )}
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={onGoBack}
              className="w-full mt-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 btn-glow"
            >
              🏠 กลับหน้าแรก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;