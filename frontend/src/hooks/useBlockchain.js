// frontend/src/hooks/useBlockchain.js
// React hook for managing blockchain interactions

import { useState, useEffect, useCallback } from 'react';
import { blockchainService, handleBlockchainError } from '../utils/blockchain';

export const useBlockchain = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [userAccount, setUserAccount] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [qzcBalance, setQzcBalance] = useState("0.00");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize blockchain connection
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await blockchainService.initialize();
      if (success) {
        const networkOk = await blockchainService.checkNetwork();
        setIsCorrectNetwork(networkOk);
        setIsConnected(true);

        // Get connected accounts
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' 
        });
        
        if (accounts.length > 0) {
          setUserAccount(accounts[0]);
          await updateBalance(accounts[0]);
        }
      }
    } catch (error) {
      console.error('Failed to initialize blockchain:', error);
      setError(handleBlockchainError(error, 'during initialization'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts available');
      }

      setUserAccount(accounts[0]);

      // Initialize blockchain service
      await blockchainService.initialize();

      // Check network
      const networkOk = await blockchainService.checkNetwork();
      if (!networkOk) {
        const switched = await blockchainService.switchToBNBTestnet();
        setIsCorrectNetwork(switched);
        
        if (!switched) {
          throw new Error('Please switch to BNB Smart Chain Testnet');
        }
      } else {
        setIsCorrectNetwork(true);
      }

      setIsConnected(true);
      await updateBalance(accounts[0]);

      return accounts[0];
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setError(handleBlockchainError(error, 'during wallet connection'));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setUserAccount(null);
    setIsConnected(false);
    setIsCorrectNetwork(false);
    setQzcBalance("0.00");
    setError(null);
    blockchainService.disconnect();
  }, []);

  // Update QZC balance
  const updateBalance = useCallback(async (account) => {
    try {
      if (!account || !blockchainService.quizCoinContract) return;
      
      const balance = await blockchainService.getQZCBalance(account);
      setQzcBalance(balance);
    } catch (error) {
      console.error('Failed to update balance:', error);
      // Don't set error state for balance updates to avoid blocking UI
    }
  }, []);

  // Submit answer with full flow
  const submitAnswer = useCallback(async (quizId, answer, onProgress) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!userAccount) {
        throw new Error('Wallet not connected');
      }

      if (!isCorrectNetwork) {
        throw new Error('Please switch to BNB Smart Chain Testnet');
      }

      // Submit answer via blockchain service
      const result = await blockchainService.submitAnswer(
        quizId, 
        answer, 
        onProgress
      );

      // Record answer in backend if blockchain transaction successful
      if (result.success) {
        try {
          await blockchainService.recordAnswer({
            userAccount,
            quizId,
            answer,
            correct: true,
            mode: 'solo', // This should come from props
            rewardAmount: result.rewardInfo.totalReward,
            txHash: result.txHash
          });
        } catch (recordError) {
          console.warn('Failed to record answer in backend:', recordError);
          // Don't throw here as blockchain transaction was successful
        }

        // Update balance after successful transaction
        await updateBalance(userAccount);
      }

      return result;
    } catch (error) {
      console.error('Failed to submit answer:', error);
      const errorMessage = handleBlockchainError(error, 'during answer submission');
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [userAccount, isCorrectNetwork, updateBalance]);

  // Get user statistics
  const getUserStats = useCallback(async () => {
    try {
      if (!userAccount) return null;
      
      return await blockchainService.getUserStats(userAccount);
    } catch (error) {
      console.error('Failed to get user stats:', error);
      return null;
    }
  }, [userAccount]);

  // Get available quizzes
  const getAvailableQuizzes = useCallback(async () => {
    try {
      if (!userAccount) return [];
      
      return await blockchainService.getAvailableQuizzes(userAccount);
    } catch (error) {
      console.error('Failed to get available quizzes:', error);
      return [];
    }
  }, [userAccount]);

  // Switch network
  const switchNetwork = useCallback(async () => {
    try {
      setIsLoading(true);
      const success = await blockchainService.switchToBNBTestnet();
      setIsCorrectNetwork(success);
      
      if (success) {
        setError(null);
      } else {
        throw new Error('Failed to switch network');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to switch network:', error);
      setError(handleBlockchainError(error, 'during network switch'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen to account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== userAccount) {
        setUserAccount(accounts[0]);
        updateBalance(accounts[0]);
      }
    };

    const handleChainChanged = (chainId) => {
      const isCorrect = chainId === '0x61'; // BNB Testnet
      setIsCorrectNetwork(isCorrect);
      
      if (isCorrect && userAccount) {
        updateBalance(userAccount);
      }
    };

    const handleDisconnect = () => {
      disconnectWallet();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    };
  }, [userAccount, updateBalance, disconnectWallet]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    // State
    isConnected,
    userAccount,
    isCorrectNetwork,
    qzcBalance,
    isLoading,
    error,
    
    // Actions
    connectWallet,
    disconnectWallet,
    submitAnswer,
    switchNetwork,
    updateBalance: () => updateBalance(userAccount),
    getUserStats,
    getAvailableQuizzes,
    
    // Utilities
    formatAddress: (addr) => blockchainService.formatAddress(addr),
    formatTxHash: (hash) => blockchainService.formatTxHash(hash),
    clearError: () => setError(null)
  };
};

// Hook for quiz-specific operations
export const useQuiz = (userAccount) => {
  const [answeredQuizzes, setAnsweredQuizzes] = useState([]);
  const [userStats, setUserStats] = useState({
    totalAnswered: 0,
    totalCorrect: 0,
    totalEarned: "0",
    streak: 0,
    accuracy: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load answered quizzes
  const loadAnsweredQuizzes = useCallback(async () => {
    if (!userAccount) return;

    try {
      setIsLoading(true);
      
      const response = await fetch('/api/get-answered-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccount }),
      });

      const data = await response.json();
      if (data.success) {
        setAnsweredQuizzes(data.answeredQuizzes || []);
      }
    } catch (error) {
      console.error('Failed to load answered quizzes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userAccount]);

  // Load user stats
  const loadUserStats = useCallback(async () => {
    if (!userAccount) return;

    try {
      const stats = await blockchainService.getUserStats(userAccount);
      if (stats) {
        setUserStats(stats);
      }
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  }, [userAccount]);

  // Check if user can answer a quiz
  const canAnswerQuiz = useCallback((quizId) => {
    return !answeredQuizzes.some(quiz => quiz.quizId === quizId);
  }, [answeredQuizzes]);

  // Add answered quiz
  const addAnsweredQuiz = useCallback((quizData) => {
    setAnsweredQuizzes(prev => [...prev, quizData]);
    
    // Update stats
    setUserStats(prev => ({
      ...prev,
      totalAnswered: prev.totalAnswered + 1,
      totalCorrect: quizData.correct ? prev.totalCorrect + 1 : prev.totalCorrect,
      totalEarned: (parseFloat(prev.totalEarned) + parseFloat(quizData.rewardAmount || "0")).toString(),
      streak: quizData.correct ? prev.streak + 1 : 0,
      accuracy: Math.round(((quizData.correct ? prev.totalCorrect + 1 : prev.totalCorrect) / (prev.totalAnswered + 1)) * 100)
    }));
  }, []);

  // Initialize data on mount or account change
  useEffect(() => {
    if (userAccount) {
      loadAnsweredQuizzes();
      loadUserStats();
    } else {
      setAnsweredQuizzes([]);
      setUserStats({
        totalAnswered: 0,
        totalCorrect: 0,
        totalEarned: "0",
        streak: 0,
        accuracy: 0
      });
    }
  }, [userAccount, loadAnsweredQuizzes, loadUserStats]);

  return {
    answeredQuizzes,
    userStats,
    isLoading,
    canAnswerQuiz,
    addAnsweredQuiz,
    loadAnsweredQuizzes,
    loadUserStats
  };
};

export default useBlockchain;