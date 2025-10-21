// แทนที่ไฟล์ frontend/src/pages/GamePage.jsx ทั้งหมด

import React, { useState, useEffect } from "react";
import useBlockchain from '../hooks/useBlockchain';
import { socketService } from '../services/socketService';

// เดาว่าใน useBackendAPI.js อาจจะ export แบบ named export 
// หรือ default export ลองทั้งสองวิธี
import { useBackendAPI } from '../hooks/useBackendAPI';
// หรือถ้า export default ให้ใช้
// import useBackendAPI from '../hooks/useBackendAPI';

const GamePage = ({ quizzes: propsQuizzes = [], userAccount, qzcBalance, setQzcBalance, selectedMode }) => {
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rewardAmount, setRewardAmount] = useState("100");
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  
  // เพิ่ม state สำหรับข้อมูลเอง เผื่อ useBackendAPI ไม่ทำงาน
  const [localQuizzes, setLocalQuizzes] = useState([]);
  const [localAnsweredQuizzes, setLocalAnsweredQuizzes] = useState([]);
  const [completedQuizIds, setCompletedQuizIds] = useState(new Set());
  const [localUserStats, setLocalUserStats] = useState({
    totalAnswered: 0, totalCorrect: 0, totalEarned: "0", streak: 0, accuracy: 0
  });
  const [selectedHistoryQuiz, setSelectedHistoryQuiz] = useState(null);

  // Debug: Log completedQuizIds whenever it changes
  useEffect(() => {
    console.log('🎯 completedQuizIds updated:', {
      count: completedQuizIds.size,
      quizIds: Array.from(completedQuizIds),
      asSet: completedQuizIds
    });
    
    // Expose to window for DevTools access
    window.completedQuizIds = completedQuizIds;
    window.completedQuizIdsArray = Array.from(completedQuizIds);
  }, [completedQuizIds]);

  // ใช้ backend API hook หรือ fallback
  let backendData;
  try {
    backendData = useBackendAPI ? useBackendAPI(userAccount) : null;
  } catch (error) {
    console.error('useBackendAPI error:', error);
    backendData = null;
  }

  const {
    quizzes: hookQuizzes = [],
    answeredQuizzes: hookAnsweredQuizzes = [], 
    userStats: hookUserStats = localUserStats,
    loadBackendData = null
  } = backendData || {};

  // ใช้ blockchain hook
  const {
    submitAnswer,
    isLoading: blockchainLoading,
    error: blockchainError,
    clearError
  } = useBlockchain(loadBackendData);

  // ใช้ข้อมูลจาก backend API ก่อน (เพราะมี blockchainQuestionId) แล้วค่อย fallback ไปที่ props หรือ local state
  // แต่ให้ใช้ backend API เป็นหลักเสมอถ้ามีข้อมูล
  // Props quizzes now also come from backend API (via App.jsx) so they should have blockchainQuestionId
  const quizzes = hookQuizzes.length > 0 ? hookQuizzes : (propsQuizzes.length > 0 ? propsQuizzes : localQuizzes);
  const answeredQuizzes = hookAnsweredQuizzes.length > 0 ? hookAnsweredQuizzes : localAnsweredQuizzes;
  const userStats = hookUserStats && hookUserStats.totalAnswered >= 0 ? hookUserStats : localUserStats;

  // Debug logging
  useEffect(() => {
    console.log('🔍 GamePage Quiz Sources:');
    console.log('  - Hook quizzes:', hookQuizzes.length, hookQuizzes[0] ? `(first: ${hookQuizzes[0].quizId}, blockchainId: ${hookQuizzes[0].blockchainQuestionId})` : '');
    console.log('  - Props quizzes:', propsQuizzes.length, propsQuizzes[0] ? `(first: ${propsQuizzes[0].quizId}, blockchainId: ${propsQuizzes[0].blockchainQuestionId})` : '');
    console.log('  - Local quizzes:', localQuizzes.length);
    console.log('  - Final quizzes:', quizzes.length, quizzes[0] ? `(first: ${quizzes[0].quizId}, blockchainId: ${quizzes[0].blockchainQuestionId})` : '');
  }, [hookQuizzes, propsQuizzes, localQuizzes, quizzes]);

  // Manual loading function
  const loadDataManually = async () => {
    if (!userAccount) return;

    console.log('📥 Loading data manually for', userAccount);

    try {
      // โหลดคำถามที่มี
      const availableResponse = await fetch('http://localhost:3001/api/get-available-quizzes', {
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

      // โหลดคำถามที่ตอบแล้ว
      const answeredResponse = await fetch('http://localhost:3001/api/get-answered-quizzes', {
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

      // โหลดควิซที่เสร็จแล้ว
      const completedResponse = await fetch('http://localhost:3001/api/get-completed-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount }),
      });
      
      if (completedResponse.ok) {
        const completedData = await completedResponse.json();
        if (completedData.success) {
          console.log('✅ Loaded completed quizzes:', completedData.completedQuizzes.length);
          const completedIds = new Set(completedData.completedQuizzes.map(quiz => quiz.quizId));
          setCompletedQuizIds(completedIds);
        }
      }

      // โหลดสถิติผู้ใช้
      const statsResponse = await fetch('http://localhost:3001/api/get-user-stats', {
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
    }
  };

  // โหลดข้อมูลเมื่อเริ่มต้น
  useEffect(() => {
    if (userAccount) {
      if (loadBackendData) {
        console.log('📥 Loading via useBackendAPI hook');
        loadBackendData();
      } else {
        console.log('📥 Loading manually (hook not available)');
        loadDataManually();
      }
    }
  }, [userAccount]);

  // รีโหลดข้อมูล manual หากไม่มีคำถาม
  useEffect(() => {
    if (userAccount && quizzes.length === 0 && !loading) {
      console.log('📥 No quizzes found, retrying manual load...');
      setTimeout(() => {
        loadDataManually();
      }, 1000);
    }
  }, [userAccount, quizzes.length, loading]);

  // Real-time question ID updates via Socket.IO
  useEffect(() => {
    if (!userAccount) return;

    // Connect to Socket.IO
    socketService.connect();

    // Handle real-time question ID updates
    const handleQuestionIdUpdate = (data) => {
      console.log('🔄 Question ID updated in real-time:', data);
      setCurrentQuestionId(data.newQuestionId);
      
      // Update all quizzes with new question ID
      if (hookQuizzes && hookQuizzes.length > 0) {
        const updatedQuizzes = hookQuizzes.map(quiz => ({
          ...quiz,
          blockchainQuestionId: data.newQuestionId
        }));
        // Note: We can't directly update hookQuizzes here as it comes from useBackendAPI
        // But we can trigger a notification or update currentQuestionId
      }
      
      // Show user-friendly message
      setMessage(`🔄 Question updated to ID ${data.newQuestionId} - Continue playing!`);
      setTimeout(() => setMessage(""), 3000);
    };

    // Set up event listener
    socketService.onQuestionIdUpdated(handleQuestionIdUpdate);

    // Cleanup
    return () => {
      socketService.off('questionIdUpdated', handleQuestionIdUpdate);
    };
  }, [userAccount, hookQuizzes]);

  // แสดง error จาก blockchain
  useEffect(() => {
    if (blockchainError) {
      setMessage(`❌ ${blockchainError}`);
      const timer = setTimeout(() => {
        clearError();
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
      // ค้นหาคำตอบที่ถูกต้องจากข้อมูลควิซ
      const quizData = quizzes.find(q => q.quizId === selectedQuiz.quizId);
      
      if (!quizData) {
        setMessage("❌ ไม่พบข้อมูลคำถาม");
        setLoading(false);
        return;
      }

      // ตรวจสอบคำตอบที่ถูกต้อง
      const correctAnswer = quizData.answer;
      
      if (correctAnswer === selectedOption) {
        // ตรวจสอบว่าควิซนี้เคยทำแล้วหรือไม่
        // 1. ตรวจสอบจาก local state ก่อน
        if (completedQuizIds.has(selectedQuiz.quizId)) {
          setMessage(`⚠️ คุณเคยทำควิซนี้แล้ว! (จาก local cache)`);
          setLoading(false);
          return;
        }

        // 2. ตรวจสอบจาก blockchain โดยใช้ leaf-level checking
        setMessage("🔍 กำลังตรวจสอบสถานะควิซบน blockchain...");
        
        try {
          const { blockchainService } = await import('../utils/blockchain.js');
          
          // Use leaf-level checking instead of database checking
          const leafCompletionCheck = await blockchainService.checkQuizCompletedByLeaf(selectedQuiz.quizId, correctAnswer);
          
          if (leafCompletionCheck.isCompleted) {
            // อัปเดต local state ด้วย
            setCompletedQuizIds(prev => new Set([...prev, selectedQuiz.quizId]));
            setMessage(`⚠️ คำถามนี้ถูกทำไปแล้วบน blockchain! (Solver: ${leafCompletionCheck.completedData?.solver?.slice(0, 6)}...)`);
            setLoading(false);
            return;
          }
          
          // Also check database for additional verification
          const dbCompletionCheck = await blockchainService.checkQuizCompleted(userAccount, selectedQuiz.quizId);
          if (dbCompletionCheck.isCompleted) {
            // อัปเดต local state ด้วย
            setCompletedQuizIds(prev => new Set([...prev, selectedQuiz.quizId]));
            setMessage(`⚠️ คุณเคยทำควิซนี้แล้ว! ได้รับรางวัล ${dbCompletionCheck.completedData?.rewardAmount || '100'} QZC`);
            setLoading(false);
            return;
          }
        } catch (checkError) {
          console.warn('⚠️ Could not check quiz completion status, proceeding with submission:', checkError);
          // Continue with submission even if check fails
        }

        // Check if this quiz has blockchain support
        if (!selectedQuiz.blockchainQuestionId) {
          // Test mode - just show correct/incorrect without blockchain interaction
          setMessage(`🎯 โหมดทดสอบ: คำตอบ${correctAnswer === selectedOption ? 'ถูกต้อง' : 'ผิด'}! (ไม่มีรางวัล QZC)`);
          
          if (correctAnswer !== selectedOption) {
            setTimeout(() => {
              setMessage(`❌ คำตอบที่ถูกต้องคือ: ${correctAnswer}`);
            }, 2000);
          }
          
          setTimeout(() => {
            setMessage("");
            setSelectedQuiz(null);
          }, 4000);
          
          setLoading(false);
          return;
        }

        console.log('🚀 Submitting answer via blockchain service:', {
          quizId: selectedQuiz.quizId,
          answer: selectedOption,
          blockchainQuestionId: selectedQuiz.blockchainQuestionId
        });

        const result = await submitAnswer(
          selectedQuiz.quizId, 
          selectedOption,
          selectedQuiz.blockchainQuestionId,
          (progressMessage) => {
            // อัปเดตสถานะตามความคืบหน้า
            setMessage(progressMessage);
          },
          {
            question: selectedQuiz.question,
            options: selectedQuiz.options,
            category: selectedQuiz.category,
            difficulty: selectedQuiz.difficulty
          }
        );

        // Handle the case where quiz is already solved on blockchain
        if (result && result.alreadySolved) {
          console.log('🔄 Quiz already solved on blockchain, updating local state');
          setCompletedQuizIds(prev => new Set([...prev, selectedQuiz.quizId]));
          setMessage(`⚠️ คำถามนี้ถูกทำไปแล้วบน blockchain และได้ซิงค์แล้ว`);
          setSelectedQuiz(null);
          
          // Reload data to refresh the UI
          setTimeout(() => {
            if (loadBackendData) {
              loadBackendData();
            } else {
              loadDataManually();
            }
          }, 1000);
          
          setLoading(false);
          return;
        }

        if (result && result.success) {
          const rewardAmount = result.rewardInfo?.totalReward || '100';
          setMessage(`🎉 คำตอบถูกต้อง! คุณได้รับ ${rewardAmount} QZC!`);
          
          // อัปเดตยอดเงิน
          const currentBalance = parseFloat(qzcBalance);
          const newBalance = currentBalance + parseFloat(rewardAmount);
          setQzcBalance(newBalance.toFixed(2));
          
          // เพิ่มควิซนี้เข้าไปในรายการที่เสร็จแล้ว
          setCompletedQuizIds(prev => new Set([...prev, selectedQuiz.quizId]));
          
          // รีเซ็ตการเลือกควิซ
          setSelectedQuiz(null);
          
          // รีโหลดข้อมูลจาก backend
          setTimeout(() => {
            if (loadBackendData) {
              loadBackendData();
            } else {
              loadDataManually();
            }
          }, 1000);
          
          // แสดง transaction hash
          if (result.txHash) {
            setTimeout(() => {
              setMessage(`✅ Transaction: ${result.txHash.substring(0, 10)}...`);
            }, 3000);
          }
          
          // ล้างข้อความหลังจาก 8 วินาที
          setTimeout(() => {
            setMessage("");
          }, 8000);
        }
      } else {
        setMessage(`❌ คำตอบผิด! คำตอบที่ถูกต้องคือ: ${correctAnswer}`);
        
        // ล้างข้อความหลังจาก 3 วินาที
        setTimeout(() => {
          setMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      
      // Handle specific case of already solved quiz
      if (error.message.includes('ถูกทำไปแล้ว') || error.message.includes('already solved')) {
        // Mark this quiz as completed in local state
        setCompletedQuizIds(prev => new Set([...prev, selectedQuiz.quizId]));
        setMessage(`⚠️ คำถามนี้ถูกทำไปแล้ว กรุณาเลือกคำถามอื่น`);
        setSelectedQuiz(null); // Clear selection
      } else {
        setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
      }
      
      // ล้างข้อความหลังจาก 5 วินาที
      setTimeout(() => {
        setMessage("");
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  // คำนวณรางวัลตามสูตรจาก Smart Contract
  const calculateReward = (difficultyLevel) => {
    // ค่าคงที่จาก Smart Contract
    const REWARD_FOR_LEVEL_1_99 = 5000; // 5000 QZC
    const REWARD_FOR_LEVEL_100 = 10000; // 10000 QZC
    const HALVING_PERIOD_SECONDS = 4 * 365 * 24 * 60 * 60; // 4 years
    const MIN_REWARD_AFTER_HALVING = 100; // 100 QZC
    const GAME_START_TIMESTAMP = 1697270400; // ประมาณ Oct 2023 (ปรับตามจริง)
    
    if (difficultyLevel === 100) {
      return REWARD_FOR_LEVEL_100;
    }
    
    if (difficultyLevel < 1 || difficultyLevel > 99) {
      return 100; // ค่าเริ่มต้น
    }
    
    // คำนวณ base reward
    const currentBaseReward = Math.floor((REWARD_FOR_LEVEL_1_99 * difficultyLevel) / 99);
    
    // คำนวณ halving cycles
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeElapsed = currentTimestamp - GAME_START_TIMESTAMP;
    const halvingCycles = Math.floor(timeElapsed / HALVING_PERIOD_SECONDS);
    
    // ใช้ halving
    let finalReward = currentBaseReward;
    for (let i = 0; i < halvingCycles; i++) {
      finalReward = Math.floor(finalReward / 2);
      if (finalReward < MIN_REWARD_AFTER_HALVING) {
        finalReward = MIN_REWARD_AFTER_HALVING;
        break;
      }
    }
    
    return finalReward;
  };

  const handleSelectQuiz = (quiz) => {
    console.log('🎯 Selected quiz:', quiz.quizId, 'blockchainQuestionId:', quiz.blockchainQuestionId);
    
    if (!quiz.blockchainQuestionId) {
      setMessage("⚠️ คำถามนี้ยังไม่ได้สร้างบน blockchain - การตอบจะไม่ได้รับรางวัล QZC");
      // Still allow selection for testing, but with warning
    } else {
      setMessage("");
    }
    
    setSelectedQuiz(quiz);
    setSelectedHistoryQuiz(null); // Clear history selection
    if (clearError) clearError();
    
    // คำนวณรางวัลที่คาดหวังตามสูตรจาก Smart Contract
    const difficulty = quiz.difficulty || Math.floor(Math.random() * 100) + 1;
    const calculatedReward = calculateReward(difficulty);
    setRewardAmount(calculatedReward.toString());
  };

  const handleSelectHistoryQuiz = async (answeredQuiz) => {
    console.log('📜 Selected history quiz:', answeredQuiz.quizId);
    
    try {
      // Find the original quiz data to get the question and options
      const originalQuiz = quizzes.find(q => q.quizId === answeredQuiz.quizId) || 
                          propsQuizzes.find(q => q.quizId === answeredQuiz.quizId);
      
      if (originalQuiz) {
        setSelectedHistoryQuiz({
          ...originalQuiz,
          answeredData: answeredQuiz,
          userAnswer: answeredQuiz.userAnswer,
          correctAnswer: answeredQuiz.correctAnswer || originalQuiz.answer,
          rewardReceived: answeredQuiz.rewardAmount || '100',
          answeredAt: answeredQuiz.answeredAt,
          wasCorrect: answeredQuiz.correct
        });
        setSelectedQuiz(null); // Clear regular quiz selection
        setMessage("");
      } else {
        setMessage("⚠️ ไม่พบข้อมูลคำถามนี้");
      }
    } catch (error) {
      console.error('Error selecting history quiz:', error);
      setMessage("❌ เกิดข้อผิดพลาดในการโหลดข้อมูลประวัติ");
    }
  };

  // กรองควิซที่ยังไม่ได้ตอบและลบข้อมูลซ้ำ
  const uniqueQuizzes = quizzes.reduce((acc, quiz) => {
    if (!acc.find(existing => existing.quizId === quiz.quizId)) {
      acc.push(quiz);
    }
    return acc;
  }, []);
  
  const availableQuizzes = uniqueQuizzes.filter(quiz => 
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
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">คำถามรอตอบ</h2>
                <div className="bg-purple-600 text-white px-2 py-1 rounded-full text-sm">
                  {availableQuizzes.length}
                </div>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {availableQuizzes.length > 0 ? (
                  availableQuizzes.map((quiz, index) => {
                    const isCompleted = completedQuizIds.has(quiz.quizId);
                    const hasBlockchainId = !!quiz.blockchainQuestionId;
                    return (
                      <div
                        key={`${quiz.quizId}-${quiz.blockchainQuestionId || 'no-blockchain'}-${index}`}
                        onClick={() => !isCompleted && handleSelectQuiz(quiz)}
                        className={`p-4 rounded-xl transition-all duration-300 border ${
                          isCompleted 
                            ? "bg-green-600/20 border-green-400/50 cursor-not-allowed opacity-75" 
                            : selectedQuiz?.quizId === quiz.quizId 
                              ? "bg-purple-600/30 border-purple-400 cursor-pointer" 
                              : !hasBlockchainId
                                ? "bg-yellow-600/20 border-yellow-400/50 hover:bg-yellow-600/30 cursor-pointer"
                                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-mono text-sm text-purple-300">
                            {quiz.quizId.length > 15 ? `${quiz.quizId.substring(0, 12)}...` : quiz.quizId}
                          </span>
                          <div className="flex items-center space-x-1">
                            {isCompleted && (
                              <span className="text-xs bg-green-600/30 text-green-300 px-2 py-1 rounded">
                                ✅ เสร็จแล้ว
                              </span>
                            )}
                            {!hasBlockchainId && !isCompleted && (
                              <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded">
                                ⚠️ ทดสอบ
                              </span>
                            )}
                            <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded">
                              LV.{quiz.difficulty || Math.floor(Math.random() * 100) + 1}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-2">
                          {quiz.question?.substring(0, 80)}
                          {quiz.question?.length > 80 ? "..." : ""}
                        </p>
                        <div className="mt-2 text-xs">
                          {hasBlockchainId ? (
                            <span className="text-green-400">
                              💰 ~{calculateReward(quiz.difficulty || 50).toLocaleString()} QZC
                              {isCompleted && <span className="ml-2 text-green-300">(ได้รับแล้ว)</span>}
                            </span>
                          ) : (
                            <span className="text-yellow-400">
                              ⚠️ โหมดทดสอบ (ไม่มีรางวัล)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">⏳</div>
                    <p className="text-gray-400 text-sm">ไม่มีคำถามใหม่</p>
                    <p className="text-xs text-purple-400 mt-2">กรุณารอสักครู่</p>
                    <div className="mt-4 text-xs text-gray-500 bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
                      <p className="text-yellow-400 font-semibold mb-1">🔍 Debug Info:</p>
                      <p>Hook quizzes: {hookQuizzes.length}</p>
                      <p>Props quizzes: {propsQuizzes.length}</p>
                      <p>Local quizzes: {localQuizzes.length}</p>
                      <p>Final quizzes: {quizzes.length}</p>
                      {quizzes.length > 0 && (
                        <p className="mt-2 text-orange-300">
                          ⚠️ {quizzes.filter(q => !q.blockchainQuestionId).length} quizzes missing blockchainQuestionId
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content - Quiz Display */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 min-h-96">
              {selectedHistoryQuiz ? (
                /* History Quiz Display */
                <div className="text-center">
                  <div className="inline-flex items-center space-x-2 bg-blue-600/20 px-4 py-2 rounded-full mb-4">
                    <span className="text-blue-300 font-mono text-sm">
                      {selectedHistoryQuiz.quizId.length > 20 ? 
                        `${selectedHistoryQuiz.quizId.substring(0, 17)}...` : 
                        selectedHistoryQuiz.quizId}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-blue-300 text-sm">Level {selectedHistoryQuiz.difficulty || 50}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-purple-300 text-sm">📜 ประวัติ</span>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-4 leading-tight">{selectedHistoryQuiz.question}</h3>
                  
                  {/* Show all options with indicators */}
                  <div className="space-y-3 max-w-lg mx-auto mb-6">
                    {selectedHistoryQuiz.options?.map((option, index) => {
                      const isUserAnswer = option === selectedHistoryQuiz.userAnswer;
                      const isCorrectAnswer = option === selectedHistoryQuiz.correctAnswer;
                      
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border-2 ${
                            isCorrectAnswer 
                              ? 'bg-green-600/20 border-green-400 text-green-300' 
                              : isUserAnswer 
                                ? 'bg-red-600/20 border-red-400 text-red-300'
                                : 'bg-white/5 border-white/20 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{option}</span>
                            <div className="flex items-center space-x-2">
                              {isCorrectAnswer && <span className="text-green-400">✅ ถูกต้อง</span>}
                              {isUserAnswer && !isCorrectAnswer && <span className="text-red-400">❌ คำตอบของคุณ</span>}
                              {isUserAnswer && isCorrectAnswer && <span className="text-green-400">✅ คำตอบของคุณ</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Result Summary */}
                  <div className="bg-white/5 rounded-xl p-6 max-w-md mx-auto">
                    <div className="flex items-center justify-center space-x-4 mb-4">
                      {selectedHistoryQuiz.wasCorrect ? (
                        <div className="text-green-400 text-center">
                          <div className="text-4xl mb-2">🎉</div>
                          <div className="font-bold">ตอบถูก!</div>
                        </div>
                      ) : (
                        <div className="text-red-400 text-center">
                          <div className="text-4xl mb-2">😞</div>
                          <div className="font-bold">ตอบผิด</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-green-400">
                        💰 รางวัลที่ได้รับ: <span className="font-bold">{parseInt(selectedHistoryQuiz.rewardReceived).toLocaleString()} QZC</span>
                      </p>
                      <p className="text-gray-400 text-sm">
                        📅 ตอบเมื่อ: {new Date(selectedHistoryQuiz.answeredAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedHistoryQuiz(null)}
                    className="mt-6 px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              ) : selectedQuiz ? (
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
                    <p className="text-green-400 text-sm">💰 รางวัล: {parseInt(rewardAmount).toLocaleString()} QZC</p>
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
                  {availableQuizzes.length === 0 && (
                    <p className="text-purple-400 text-sm mt-2">
                      ไม่มีคำถามใหม่ในขณะนี้
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Stats & History */}
          <div className="lg:col-span-1 space-y-6">
            {/* Statistics */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <h2 className="text-xl font-bold mb-4">สถิติของคุณ</h2>
              
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">คำถามที่ตอบแล้ว</div>
                  <div className="text-2xl font-bold text-blue-400">{userStats?.totalAnswered || 0}</div>
                </div>
                
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">QZC ที่ได้รับ</div>
                  <div className="text-2xl font-bold text-green-400">{parseFloat(userStats?.totalEarned || "0").toFixed(2)}</div>
                </div>
                
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">ชุดต่อเนื่อง</div>
                  <div className="text-2xl font-bold text-purple-400">{userStats?.streak || 0}</div>
                </div>

                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-gray-300">ความแม่นยำ</div>
                  <div className="text-2xl font-bold text-yellow-400">{userStats?.accuracy || 0}%</div>
                </div>
              </div>
            </div>


            {/* History */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">ประวัติการตอบ</h2>
                <div className="bg-green-600 text-white px-2 py-1 rounded-full text-sm">
                  {answeredQuizzes.length}
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {answeredQuizzes.length > 0 ? (
                  answeredQuizzes.slice(0, 10).map((answered, index) => (
                    <button
                      key={`${answered.quizId}-${index}`}
                      onClick={() => handleSelectHistoryQuiz(answered)}
                      className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-xs text-gray-300">
                          {answered.quizId?.length > 12 ? `${answered.quizId.substring(0, 9)}...` : answered.quizId}
                        </span>
                        <div className="flex items-center space-x-2">
                          {answered.correct ? (
                            <span className="text-green-400 text-sm">✅</span>
                          ) : (
                            <span className="text-red-400 text-sm">❌</span>
                          )}
                          <span className="text-xs text-green-400">
                            +{answered.rewardAmount || '0'} QZC
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(answered.answeredAt).toLocaleDateString('th-TH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📝</div>
                    <p className="text-gray-400 text-sm">ยังไม่มีประวัติการตอบ</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
