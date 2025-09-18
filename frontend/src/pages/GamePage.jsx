// frontend/src/pages/GamePage.jsx
import React, { useState, useEffect, useCallback } from "react";
import useBlockchain from '../hooks/useBlockchain';

const GamePage = ({ userAccount, qzcBalance, setQzcBalance, selectedMode, onGoBack }) => {
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rewardAmount, setRewardAmount] = useState("100");
  
  // Local state for data management
  const [localQuizzes, setLocalQuizzes] = useState([]);
  const [localAnsweredQuizzes, setLocalAnsweredQuizzes] = useState([]);
  const [localUserStats, setLocalUserStats] = useState({
    totalAnswered: 0, 
    totalCorrect: 0, 
    totalEarned: "0", 
    streak: 0, 
    accuracy: 0
  });

  // Anti-duplicate loading flag
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Use blockchain hook
  const {
    submitAnswer,
    isLoading: blockchainLoading,
    error: blockchainError,
    clearError
  } = useBlockchain();

  // Debounced data loading function
  const loadDataManually = useCallback(async () => {
    if (!userAccount || isLoadingData) return;

    setIsLoadingData(true);
    console.log('📥 Loading data manually for', userAccount);

    try {
      // Load available quizzes - แก้ไข URL ให้ชี้ไปยัง backend
      const availableResponse = await fetch('http://localhost:8000/api/get-available-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount }),
      });
      
      if (availableResponse.ok) {
        const availableData = await availableResponse.json();
        if (availableData.success) {
          console.log('✅ Loaded quizzes:', availableData.quizzes.length);
          setLocalQuizzes(availableData.quizzes || []);
        }
      }

      // Load answered quizzes - แก้ไข URL ให้ชี้ไปยัง backend
      const answeredResponse = await fetch('http://localhost:8000/api/get-answered-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount }),
      });
      
      if (answeredResponse.ok) {
        const answeredData = await answeredResponse.json();
        if (answeredData.success) {
          console.log('✅ Loaded answered quizzes:', answeredData.answeredQuizzes.length);
          setLocalAnsweredQuizzes(answeredData.answeredQuizzes || []);
        }
      }

      // Load user stats - แก้ไข URL ให้ชี้ไปยัง backend
      const statsResponse = await fetch('http://localhost:8000/api/get-user-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount }),
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          console.log('✅ Loaded user stats:', statsData.stats);
          setLocalUserStats(statsData.stats || localUserStats);
        }
      }
    } catch (error) {
      console.error('❌ Error loading data manually:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [userAccount]); // ลบ isLoadingData จาก dependency

  // Load data when component mounts or user changes
  useEffect(() => {
    let isMounted = true;
    
    if (userAccount) {
      console.log('🔄 useEffect triggered for user:', userAccount);
      
      // Single load on mount, no timeout needed
      if (isMounted) {
        loadDataManually();
      }
    }

    return () => {
      isMounted = false;
    };
  }, [userAccount]); // ลบ loadDataManually จาก dependency

  // Manual refresh button handler
  const handleRefresh = useCallback(() => {
    if (!isLoadingData) {
      loadDataManually();
    }
  }, [loadDataManually]);
  useEffect(() => {
    if (blockchainError) {
      setMessage(`❌ ${blockchainError}`);
      const timer = setTimeout(() => {
        if (clearError) clearError();
        setMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [blockchainError, clearError]);

  const handleSubmitAnswer = async (selectedOption) => {
    if (!selectedQuiz || loading || blockchainLoading) return;
    
    setLoading(true);
    setMessage("🔄 กำลังตรวจสอบคำตอบ...");

    try {
      // Find the correct answer from quiz data
      const quizData = localQuizzes.find(q => q.quizId === selectedQuiz.quizId);
      
      if (!quizData) {
        setMessage("❌ ไม่พบข้อมูลคำถาม");
        setLoading(false);
        return;
      }

      // Check if answer is correct
      const correctAnswer = quizData.options[quizData.answerIndex];
      
      if (correctAnswer === selectedOption) {
        // Submit answer via blockchain service
        console.log('🚀 Submitting answer via blockchain service:', {
          quizId: selectedQuiz.quizId,
          answer: selectedOption
        });

        const result = await submitAnswer(
          selectedQuiz.quizId, 
          selectedOption,
          (progressMessage) => {
            setMessage(progressMessage);
          }
        );

        if (result && result.success) {
          const rewardAmount = result.reward || '100';
          setMessage(`🎉 คำตอบถูกต้อง! คุณได้รับ ${rewardAmount} QZC!`);
          
          // Update balance
          const currentBalance = parseFloat(qzcBalance || "0");
          const newBalance = currentBalance + parseFloat(rewardAmount);
          setQzcBalance(newBalance.toFixed(2));
          
          // Update local stats
          setLocalUserStats(prev => ({
            totalAnswered: prev.totalAnswered + 1,
            totalCorrect: prev.totalCorrect + 1,
            totalEarned: (parseFloat(prev.totalEarned) + parseFloat(rewardAmount)).toString(),
            streak: prev.streak + 1,
            accuracy: Math.round(((prev.totalCorrect + 1) / (prev.totalAnswered + 1)) * 100)
          }));

          // Add to answered quizzes
          const newAnsweredQuiz = {
            quizId: selectedQuiz.quizId,
            answeredAt: Date.now(),
            mode: selectedMode,
            correct: true,
            selectedOption: selectedOption,
            correctOption: correctAnswer,
            rewardAmount: rewardAmount,
            txHash: result.transactionHash
          };
          setLocalAnsweredQuizzes(prev => [...prev, newAnsweredQuiz]);
          
          // Reset selected quiz
          setSelectedQuiz(null);
          
          // Show transaction info if available
          if (result.transactionHash) {
            setTimeout(() => {
              setMessage(`✅ Transaction: ${result.transactionHash.substring(0, 10)}...`);
            }, 3000);
          }
          
          // Clear message after delay
          setTimeout(() => {
            setMessage("");
          }, 8000);
        }
      } else {
        setMessage(`❌ คำตอบผิด! คำตอบที่ถูกต้องคือ: ${correctAnswer}`);
        
        // Update stats for wrong answer
        setLocalUserStats(prev => ({
          totalAnswered: prev.totalAnswered + 1,
          totalCorrect: prev.totalCorrect,
          totalEarned: prev.totalEarned,
          streak: 0, // Reset streak on wrong answer
          accuracy: Math.round((prev.totalCorrect / (prev.totalAnswered + 1)) * 100)
        }));
        
        // Clear message after delay
        setTimeout(() => {
          setMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
      
      // Clear message after delay
      setTimeout(() => {
        setMessage("");
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setMessage("");
    if (clearError) clearError();
    
    // Calculate expected reward
    const difficulty = quiz.difficulty || Math.floor(Math.random() * 100) + 1;
    const baseReward = Math.floor(difficulty * 2 + 50);
    setRewardAmount(baseReward.toString());
  };

  // Filter available quizzes (exclude already answered)
  const availableQuizzes = localQuizzes.filter(quiz => 
    !localAnsweredQuizzes.some(answered => answered.quizId === quiz.quizId)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {onGoBack && (
              <button
                onClick={onGoBack}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-all duration-300"
              >
                ← กลับ
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                QuizCoin Game
              </h1>
              <p className="text-sm text-gray-300">
                {selectedMode === 'solo' ? '🎯 โหมด Solo' : '👥 โหมด Pool'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-300">ยอดคงเหลือ QZC</p>
            <p className="text-xl font-bold text-green-400">{qzcBalance || "0.00"}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar - Available Quizzes */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">คำถามรอตอบ</h2>
                <div className="bg-purple-600 text-white px-2 py-1 rounded-full text-sm">
                  {availableQuizzes.length}
                </div>
              </div>
              
              {isLoadingData && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
                  <p className="text-sm text-gray-400 mt-2">กำลังโหลด...</p>
                </div>
              )}
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {availableQuizzes.length > 0 ? (
                  availableQuizzes.map((quiz) => (
                    <div
                      key={quiz.quizId}
                      onClick={() => handleSelectQuiz(quiz)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border ${
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
                ) : !isLoadingData ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">⏳</div>
                    <p className="text-gray-400 text-sm">ไม่มีคำถามใหม่</p>
                    <p className="text-xs text-purple-400 mt-2">กรุณารอสักครู่</p>
                    <button
                      onClick={handleRefresh}
                      disabled={isLoadingData}
                      className="mt-3 px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 rounded text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingData ? 'กำลังโหลด...' : 'รีเฟรช'}
                    </button>
                  </div>
                ) : null}
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
                        {selectedQuiz.quizId.length > 20 ? 
                          `${selectedQuiz.quizId.substring(0, 17)}...` : 
                          selectedQuiz.quizId}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-blue-300 text-sm">Level {selectedQuiz.difficulty || Math.floor(Math.random() * 100) + 1}</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-2 leading-tight">{selectedQuiz.question}</h3>
                    <p className="text-green-400 text-sm">💰 รางวัล: {rewardAmount} QZC</p>
                    <p className="text-xs text-gray-400 mt-1">🦊 จะใช้ MetaMask ในการบันทึกคำตอบ</p>
                  </div>

                  {/* Options */}
                  <div className="space-y-4 max-w-lg mx-auto">
                    {selectedQuiz.options?.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleSubmitAnswer(option)}
                        disabled={loading || blockchainLoading}
                        className="w-full p-4 bg-white/10 hover:bg-purple-600/30 rounded-xl text-left transition-all duration-300 border border-white/20 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
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

                  {/* Message Display */}
                  {message && (
                    <div className={`mt-6 p-4 rounded-xl border transition-all duration-500 ${
                      message.includes('🎉') 
                        ? 'bg-green-600/20 border-green-600/30' 
                        : message.includes('❌') 
                        ? 'bg-red-600/20 border-red-600/30'
                        : 'bg-blue-600/20 border-blue-500/30'
                    }`}>
                      <p className={
                        message.includes('🎉') 
                          ? 'text-green-300' 
                          : message.includes('❌')
                          ? 'text-red-300'
                          : 'text-blue-300'
                      }>{message}</p>
                    </div>
                  )}

                  {/* Loading Indicator */}
                  {(loading || blockchainLoading) && (
                    <div className="mt-4 flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                      <span className="text-purple-300">กำลังประมวลผล...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-xl font-bold mb-2">เลือกคำถามที่ต้องการตอบ</h3>
                  <p className="text-gray-400">
                    คลิกที่คำถามในแถบด้านซ้ายเพื่อเริ่มต้น
                  </p>
                  {availableQuizzes.length === 0 && !isLoadingData && (
                    <p className="text-purple-400 text-sm mt-2">
                      ไม่มีคำถามใหม่ในขณะนี้
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Stats */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <h2 className="text-xl font-bold mb-4">สถิติของคุณ</h2>
              
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">คำถามที่ตอบแล้ว</div>
                  <div className="text-2xl font-bold text-blue-400">{localUserStats?.totalAnswered || 0}</div>
                </div>
                
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">QZC ที่ได้รับ</div>
                  <div className="text-2xl font-bold text-green-400">{parseFloat(localUserStats?.totalEarned || "0").toFixed(2)}</div>
                </div>
                
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">ชุดต่อเนื่อง</div>
                  <div className="text-2xl font-bold text-purple-400">{localUserStats?.streak || 0}</div>
                </div>

                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">ความแม่นยำ</div>
                  <div className="text-2xl font-bold text-yellow-400">{localUserStats?.accuracy || 0}%</div>
                </div>
              </div>

              {/* Debug info (only in development) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 text-xs text-gray-500">
                  <p>Available: {availableQuizzes.length}</p>
                  <p>Answered: {localAnsweredQuizzes.length}</p>
                  <p>Loading: {isLoadingData ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;