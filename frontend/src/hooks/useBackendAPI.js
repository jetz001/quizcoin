// src/hooks/useBackendAPI.js
import { useState, useEffect } from 'react';

const BACKEND_URL = 'http://localhost:3001';

export const useBackendAPI = (userAccount) => {
  const [answeredQuizzes, setAnsweredQuizzes] = useState([]);
  const [stats, setStats] = useState({
    totalAnswered: 0,
    totalEarned: "0",
    streak: 0
  });
  const [loading, setLoading] = useState(false);

  // Load user data from backend
  useEffect(() => {
    const loadBackendData = async () => {
      if (!userAccount) return;

      try {
        setLoading(true);
        
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
    answeredQuizzes,
    stats,
    loading,
    loadAvailableQuizzes,
    recordAnswer,
    saveToLocalStorage,
    resetStreak,
    // Export the function directly for GamePage to use
    setAnsweredQuizzes,
    setStats
  };
};