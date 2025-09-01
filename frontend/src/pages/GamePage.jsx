// src/pages/GamePage.jsx
import React, { useState, useEffect } from 'react';
import { useBlockchain } from '../hooks/useBlockchain';
import { useBackendAPI } from '../hooks/useBackendAPI';
import QuizList from '../components/QuizList';
import QuizDisplay from '../components/QuizDisplay';
import StatsHistory from '../components/StatsHistory';

const GamePage = ({ quizzes: initialQuizzes, onGoBack, userAccount, selectedMode }) => {
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rewardAmount, setRewardAmount] = useState("0");
  const [backendQuizzes, setBackendQuizzes] = useState([]);

  // Custom hooks
  const { 
    qzcBalance, 
    loadQzcBalance, 
    submitAnswerOnChain 
  } = useBlockchain(userAccount);
  
  const {
    answeredQuizzes,
    stats,
    loadAvailableQuizzes,
    recordAnswer,
    saveToLocalStorage,
    resetStreak
  } = useBackendAPI(userAccount);

  // Load quizzes from backend on mount
  useEffect(() => {
    const loadBackendQuizzes = async () => {
      setMessage("🔍 กำลังโหลดคำถามจาก backend...");
      
      const quizzes = await loadAvailableQuizzes();
      if (quizzes.length > 0) {
        setBackendQuizzes(quizzes);
        setMessage("✅ โหลดคำถามจาก backend สำเร็จ!");
        console.log("Backend quizzes loaded:", quizzes);
      } else {
        setMessage("⚠️ ไม่พบคำถามใน backend, ใช้คำถาม default");
        // Fallback to Firebase quizzes
        setBackendQuizzes(initialQuizzes || []);
      }

      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage("");
      }, 3000);
    };

    if (userAccount) {
      loadBackendQuizzes();
    }
  }, [userAccount]);

  // Use backend quizzes if available, otherwise use initial quizzes
  const activeQuizzes = backendQuizzes.length > 0 ? backendQuizzes : (initialQuizzes || []);

  const handleSelectQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setMessage("");
    // Calculate potential reward based on difficulty
    const difficulty = quiz.difficulty || Math.floor(Math.random() * 100) + 1;
    const baseReward = Math.floor(difficulty * 2 + 50);
    setRewardAmount(baseReward.toString());
  };

  const handleSubmitAnswer = async (selectedOption) => {
    if (!selectedQuiz || loading) return;
    
    setLoading(true);
    setMessage("🔄 กำลังตรวจสอบคำตอบ...");

    // Find correct answer from quiz data
    const quizData = activeQuizzes.find(q => q.quizId === selectedQuiz.quizId);
    
    if (!quizData) {
      setMessage("❌ ไม่พบข้อมูลคำถาม");
      setLoading(false);
      return;
    }

    // Check if answer is correct offline first
    const correctAnswer = quizData.options[quizData.answerIndex];
    
    if (correctAnswer === selectedOption) {
      try {
        // Submit to blockchain via MetaMask
        const result = await submitAnswerOnChain(
          selectedQuiz.quizId, 
          selectedOption, 
          availableQuizzes,
          setMessage
        );
        
        if (result.success) {
          const newAnsweredQuiz = { 
            quizId: selectedQuiz.quizId,
            answeredAt: Date.now(),
            mode: selectedMode,
            correct: true,
            selectedOption: selectedOption,
            correctOption: correctAnswer,
            txHash: result.txHash,
            earnedAmount: result.earnedAmount || 0
          };
          
          // Try to record in backend first
          const backendSuccess = await recordAnswer({
            quizId: selectedQuiz.quizId,
            answer: selectedOption,
            correct: true,
            mode: selectedMode,
            rewardAmount: result.earnedAmount,
            txHash: result.txHash
          });

          // Save to localStorage as backup (always do this)
          saveToLocalStorage(newAnsweredQuiz);
          
          if (!backendSuccess) {
            console.warn("Backend recording failed, but localStorage backup successful");
          }
          
          setSelectedQuiz(null);
          
          // Clear message after delay
          setTimeout(() => {
            setMessage("");
          }, 8000);
        }
      } catch (error) {
        setMessage(error.message);
        setTimeout(() => {
          setMessage("");
        }, 5000);
      }
    } else {
      setMessage("❌ คำตอบผิด! ลองใหม่อีกครั้ง");
      resetStreak();
      
      // Clear message after delay
      setTimeout(() => {
        setMessage("");
      }, 3000);
    }

    setLoading(false);
  };

  // Filter available quizzes (exclude already answered)
  const availableQuizzes = activeQuizzes.filter(quiz => 
    !answeredQuizzes.some(answered => answered.quizId === quiz.quizId)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      {/* Header */}
      <GameHeader 
        selectedMode={selectedMode}
        qzcBalance={qzcBalance}
        onRefreshBalance={loadQzcBalance}
        totalQuizzes={activeQuizzes.length}
        availableQuizzes={availableQuizzes.length}
      />

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar - Available Quizzes */}
          <div className="lg:col-span-1">
            <QuizList
              quizzes={availableQuizzes}
              selectedQuiz={selectedQuiz}
              onSelectQuiz={handleSelectQuiz}
              answeredQuizzes={answeredQuizzes}
            />
          </div>

          {/* Main Content - Quiz Display */}
          <div className="lg:col-span-2">
            <QuizDisplay
              selectedQuiz={selectedQuiz}
              rewardAmount={rewardAmount}
              loading={loading}
              message={message}
              onSubmitAnswer={handleSubmitAnswer}
            />
          </div>

          {/* Right Sidebar - Stats & History */}
          <StatsHistory
            stats={stats}
            answeredQuizzes={answeredQuizzes}
            qzcBalance={qzcBalance}
            onRefreshBalance={loadQzcBalance}
            onGoBack={onGoBack}
          />
        </div>
      </div>
    </div>
  );
};

const GameHeader = ({ selectedMode, qzcBalance, onRefreshBalance, totalQuizzes, availableQuizzes }) => (
  <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 p-4">
    <div className="max-w-7xl mx-auto flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          QuizCoin Game
        </h1>
        <p className="text-sm text-gray-300">
          {selectedMode === 'solo' ? '🎯 โหมด Solo' : '👥 โหมด Pool'} • 
          <span className="text-green-400"> QZC: {qzcBalance}</span> •
          <span className="text-blue-400"> คำถาม: {availableQuizzes}/{totalQuizzes}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-300">ยอดคงเหลือ QZC</p>
        <p className="text-xl font-bold text-green-400">{qzcBalance}</p>
        <button
          onClick={onRefreshBalance}
          className="text-xs text-blue-400 hover:text-blue-300 mt-1"
        >
          🔄 อัพเดท
        </button>
      </div>
    </div>
  </div>
);

export default GamePage;