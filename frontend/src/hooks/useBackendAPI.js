// src/hooks/useBackendAPI.js
import { useState, useEffect } from 'react';
import { socketService } from '../services/socketService.js';

const BACKEND_URL = 'http://localhost:3001';

export const useBackendAPI = (userAccount) => {
  const [quizzes, setQuizzes] = useState([]);
  const [answeredQuizzes, setAnsweredQuizzes] = useState([]);
  const [stats, setStats] = useState({
    totalAnswered: 0,
    totalEarned: "0",
    streak: 0
  });
  const [loading, setLoading] = useState(false);

  // Load available quizzes from backend
  const loadAvailableQuizzes = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/get-available-quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAccount })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log("✅ Loaded quizzes from backend:", data.quizzes.length);
          return data.quizzes;
        }
      } else {
        console.error("Backend API not available, status:", response.status);
      }
    } catch (error) {
      console.error("Error loading available quizzes:", error);
    }
    return [];
  };

  // Load user data from backend
  useEffect(() => {
    if (!userAccount) return;

    // Connect to Socket.IO for real-time updates
    socketService.connect();
    
    // Set up event listeners for real-time updates
    const handleFreshQuestion = (data) => {
      console.log('🔄 Fresh question created, updating question ID in real-time...', data);
      
      // Update question ID immediately without full reload
      setQuizzes(prevQuizzes => {
        console.log('📋 Fresh question: Updating', prevQuizzes.length, 'quizzes to question ID', data.newQuestionId);
        const updatedQuizzes = prevQuizzes.map(quiz => ({
          ...quiz,
          blockchainQuestionId: data.newQuestionId
        }));
        console.log('✅ Fresh question: All quizzes updated to question ID', data.newQuestionId);
        console.log('📋 First quiz after fresh question update:', updatedQuizzes[0]?.quizId, 'blockchainId:', updatedQuizzes[0]?.blockchainQuestionId);
        return updatedQuizzes;
      });
      
      console.log(`🎯 Updated all quizzes to use question ID ${data.newQuestionId} (no server reload needed)`);
    };

    const handleQuizCompleted = (data) => {
      if (data.userAccount === userAccount.toLowerCase()) {
        console.log('🎯 Quiz completed, reloading data...', data);
        setTimeout(() => {
          loadBackendData();
        }, 500); // Quick reload for current user
      }
    };

    const handleQuestionIdUpdate = (data) => {
      console.log('🔄 Question ID updated, applying to all quizzes...', data);
      
      // Update question ID for all quizzes immediately
      setQuizzes(prevQuizzes => {
        console.log('📋 Updating', prevQuizzes.length, 'quizzes with new question ID', data.newQuestionId);
        if (prevQuizzes.length === 0) {
          console.log('⚠️ No quizzes to update, skipping question ID update');
          return prevQuizzes;
        }
        
        const updatedQuizzes = prevQuizzes.map(quiz => ({
          ...quiz,
          blockchainQuestionId: data.newQuestionId
        }));
        console.log('✅ Updated quizzes:', updatedQuizzes.length, 'items with question ID', data.newQuestionId);
        console.log('📋 First quiz after update:', updatedQuizzes[0]?.quizId, 'blockchainId:', updatedQuizzes[0]?.blockchainQuestionId);
        return updatedQuizzes;
      });
      
      console.log(`🎯 All quizzes now use question ID ${data.newQuestionId} (real-time update)`);
    };

    socketService.onFreshQuestionCreated(handleFreshQuestion);
    socketService.onQuizCompleted(handleQuizCompleted);
    socketService.onQuestionIdUpdated(handleQuestionIdUpdate);

    const loadBackendData = async () => {
      try {
        setLoading(true);
        
        // Load available quizzes from backend
        const availableQuizzes = await loadAvailableQuizzes();
        console.log('🎯 useBackendAPI useEffect: Setting quizzes to', availableQuizzes.length, 'items');
        setQuizzes(availableQuizzes);
        
        // Load user's answered quizzes from backend
        const answeredResponse = await fetch(`${BACKEND_URL}/api/get-answered-quizzes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userAccount })
        });

        if (answeredResponse.ok) {
          const answeredData = await answeredResponse.json();
          if (answeredData.success) {
            setAnsweredQuizzes(answeredData.answeredQuizzes);
            console.log("Loaded answered quizzes:", answeredData.answeredQuizzes.length);
          }
        }

        // Load user stats from backend
        const statsResponse = await fetch(`${BACKEND_URL}/api/get-user-stats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userAccount })
        });

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.success) {
            setStats(statsData.stats);
            console.log("Loaded user stats:", statsData.stats);
          }
        }

      } catch (error) {
        console.error("Error loading backend data:", error);
        
        // Fallback to localStorage if backend fails
        loadUserDataFromLocalStorage();
      } finally {
        setLoading(false);
      }
    };

    loadBackendData();

    // Cleanup function
    return () => {
      // Remove event listeners when component unmounts or userAccount changes
      socketService.off('freshQuestionCreated', handleFreshQuestion);
      socketService.off('quizCompleted', handleQuizCompleted);
      socketService.off('questionIdUpdated', handleQuestionIdUpdate);
    };
  }, [userAccount]);

  // Fallback to localStorage
  const loadUserDataFromLocalStorage = () => {
    if (!userAccount) return;
    
    try {
      const storageKey = `answered_${userAccount.toLowerCase()}`;
      const storedAnswered = localStorage.getItem(storageKey);
      
      if (storedAnswered) {
        const parsed = JSON.parse(storedAnswered);
        setAnsweredQuizzes(parsed);
        
        // Update stats
        const totalEarned = parsed.reduce((sum, quiz) => sum + (quiz.earnedAmount || 0), 0);
        setStats({
          totalAnswered: parsed.length,
          totalEarned: totalEarned.toString(),
          streak: Math.min(parsed.length, 10)
        });
      }
    } catch (error) {
      console.error("Error loading local storage data:", error);
    }
  };

  // Record answer in backend
  const recordAnswer = async (quizData) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/record-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAccount: userAccount,
          quizId: quizData.quizId,
          answer: quizData.answer,
          correct: quizData.correct,
          mode: quizData.mode,
          rewardAmount: quizData.rewardAmount?.toString() || "0",
          txHash: quizData.txHash
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.success;
      }
    } catch (error) {
      console.error("Failed to record answer in backend:", error);
    }
    return false;
  };

  // Save to localStorage as backup
  const saveToLocalStorage = (newAnsweredQuiz) => {
    try {
      const updatedAnswered = [...answeredQuizzes, newAnsweredQuiz];
      setAnsweredQuizzes(updatedAnswered);
      
      const storageKey = `answered_${userAccount.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedAnswered));
      
      // Update stats
      const totalEarned = updatedAnswered.reduce((sum, quiz) => sum + (quiz.earnedAmount || 0), 0);
      setStats(prev => ({
        totalAnswered: prev.totalAnswered + 1,
        totalEarned: totalEarned.toString(),
        streak: prev.streak + 1
      }));
      
      return true;
    } catch (error) {
      console.error("Could not save to localStorage:", error);
      return false;
    }
  };

  // Reset streak on wrong answer
  const resetStreak = () => {
    setStats(prev => ({
      ...prev,
      streak: 0
    }));
  };

  return {
    quizzes,
    answeredQuizzes,
    userStats: stats, // Rename stats to userStats for GamePage compatibility
    loading,
    loadAvailableQuizzes,
    recordAnswer,
    saveToLocalStorage,
    resetStreak,
    // Export the function directly for GamePage to use
    setAnsweredQuizzes,
    setStats,
    // Add loadBackendData function for manual reload
    loadBackendData: async () => {
      if (!userAccount) return;
      try {
        setLoading(true);
        
        // Load available quizzes from backend
        const availableQuizzes = await loadAvailableQuizzes();
        console.log('🎯 useBackendAPI manual reload: Setting quizzes to', availableQuizzes.length, 'items');
        setQuizzes(availableQuizzes);
        
        // Load user's answered quizzes from backend
        const answeredResponse = await fetch(`${BACKEND_URL}/api/get-answered-quizzes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userAccount })
        });

        if (answeredResponse.ok) {
          const answeredData = await answeredResponse.json();
          if (answeredData.success) {
            setAnsweredQuizzes(answeredData.answeredQuizzes);
            console.log("Reloaded answered quizzes:", answeredData.answeredQuizzes.length);
          }
        }

        // Load user stats from backend
        const statsResponse = await fetch(`${BACKEND_URL}/api/get-user-stats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userAccount })
        });

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.success) {
            setStats(statsData.stats);
            console.log("Reloaded user stats:", statsData.stats);
          }
        }
      } catch (error) {
        console.error("Error reloading data:", error);
      } finally {
        setLoading(false);
      }
    }
  };
};