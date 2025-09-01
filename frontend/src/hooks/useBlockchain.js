// frontend/src/hooks/useBlockchain.js - เพิ่ม validation และ debug

import { useState, useCallback, useEffect } from 'react';
import { blockchainService, handleBlockchainError } from '../utils/blockchain';

const useBlockchain = () => {
  const [userAccount, setUserAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [qzcBalance, setQzcBalance] = useState("0.00");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debug: ตรวจสอบคำถามที่มีอยู่
  const debugAvailableQuestions = useCallback(async () => {
    try {
      console.log('🔍 Debugging available questions...');
      
      // 1. เช็คใน database
      const dbResponse = await fetch('/api/debug/questions');
      const dbData = await dbResponse.json();
      
      console.log('📚 Database questions:', dbData);
      
      // 2. เช็คใน smart contract
      if (blockchainService.quizDiamondContract) {
        const availableQuestions = await blockchainService.findAvailableQuestions();
        console.log('⛓️ Smart contract questions:', availableQuestions);
        
        return {
          database: dbData,
          smartContract: availableQuestions
        };
      }
      
      return { database: dbData, smartContract: [] };
    } catch (error) {
      console.error('Debug error:', error);
      return null;
    }
  }, []);

  // Update QZC balance
  const updateBalance = useCallback(async (account) => {
    try {
      if (!account || !blockchainService.quizCoinContract) return;
      
      const balance = await blockchainService.getQZCBalance(account);
      setQzcBalance(balance);
      console.log('💰 Updated QZC balance:', balance);
    } catch (error) {
      console.error('Failed to update balance:', error);
      // Don't set error state for balance updates to avoid blocking UI
    }
  }, []);

  // Submit answer with enhanced validation
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

      // 🔍 Debug: ตรวจสอบ quiz data ก่อนส่ง
      console.log('🎯 Submitting answer:', { quizId, answer });
      
      // ตรวจสอบว่า quiz มี questionId หรือไม่
      if (quizId && typeof quizId === 'object' && quizId.questionId) {
        console.log('✅ Quiz has questionId:', quizId.questionId);
      } else {
        console.warn('⚠️ Quiz missing questionId, will generate one');
      }

      // Enhanced progress tracking
      const enhancedOnProgress = (message) => {
        console.log('📊 Progress:', message);
        if (onProgress) onProgress(message);
      };

      // Submit answer via blockchain service
      const result = await blockchainService.submitAnswer(
        quizId, 
        answer, 
        enhancedOnProgress
      );

      // Record answer in backend if blockchain transaction successful
      if (result.success) {
        try {
          await blockchainService.recordAnswer({
            userAccount,
            quizId: typeof quizId === 'object' ? quizId.quizId : quizId,
            questionId: result.questionId,
            answer,
            correct: true,
            mode: 'solo',
            rewardAmount: result.rewardInfo.totalReward,
            txHash: result.txHash
          });
          console.log('✅ Answer recorded in backend');
        } catch (recordError) {
          console.warn('⚠️ Failed to record answer in backend:', recordError);
          // Don't throw here as blockchain transaction was successful
        }

        // Update balance after successful transaction
        await updateBalance(userAccount);
        
        console.log('🎉 Transaction completed successfully!', result);
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to submit answer:', error);
      
      // Enhanced error handling
      let errorMessage = handleBlockchainError(error, 'during answer submission');
      
      // Add specific guidance for common errors
      if (error.message.includes('Question does not exist')) {
        errorMessage += '\n\n💡 Tips:\n- ตรวจสอบว่ามีคำถามใน Smart Contract\n- ลองรีเฟรชหน้าและเลือกคำถามใหม่\n- ติดต่อผู้พัฒนาถ้าปัญหายังคงมีอยู่';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [userAccount, isCorrectNetwork, updateBalance]);

  // Enhanced connect wallet with debug
  const connectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const accounts = await blockchainService.connectWallet();
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      setUserAccount(accounts[0]);
      console.log('👛 Wallet connected:', accounts[0]);

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

      // 🔍 Debug: ตรวจสอบคำถามที่มีอยู่หลังจากเชื่อมต่อ
      setTimeout(async () => {
        const debugInfo = await debugAvailableQuestions();
        console.log('🔍 Debug info after wallet connection:', debugInfo);
      }, 2000);

      return accounts[0];
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setError(handleBlockchainError(error, 'during wallet connection'));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [debugAvailableQuestions, updateBalance]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setUserAccount(null);
    setIsConnected(false);
    setIsCorrectNetwork(false);
    setQzcBalance("0.00");
    setError(null);
    blockchainService.disconnect();
    console.log('👛 Wallet disconnected');
  }, []);

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

  // Get available quizzes with enhanced validation
  const getAvailableQuizzes = useCallback(async () => {
    try {
      if (!userAccount) return [];
      
      console.log('📚 Fetching available quizzes...');
      const quizzes = await blockchainService.getAvailableQuizzes(userAccount);
      
      // Validate and enhance quiz data
      const enhancedQuizzes = quizzes.map(quiz => {
        // Ensure quiz has required fields
        const enhanced = {
          ...quiz,
          questionId: quiz.questionId || blockchainService.extractQuestionId(quiz.quizId || quiz.id),
          id: quiz.quizId || quiz.id
        };
        
        console.log('📋 Enhanced quiz:', {
          dbId: enhanced.id,
          questionId: enhanced.questionId,
          difficultyLevel: enhanced.difficultyLevel
        });
        
        return enhanced;
      });
      
      console.log(`✅ Fetched ${enhancedQuizzes.length} available quizzes`);
      return enhancedQuizzes;
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
        console.log('🌐 Switched to BNB Smart Chain Testnet');
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

  // Auto-connect on page load
  useEffect(() => {
    const autoConnect = async () => {
      try {
        if (window.ethereum && window.ethereum.selectedAddress) {
          console.log('🔄 Auto-connecting wallet...');
          await connectWallet();
        }
      } catch (error) {
        console.log('Auto-connect failed:', error);
      }
    };

    autoConnect();
  }, [connectWallet]);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (accounts[0] !== userAccount) {
          setUserAccount(accounts[0]);
          updateBalance(accounts[0]);
          console.log('👛 Account changed to:', accounts[0]);
        }
      };

      const handleChainChanged = (chainId) => {
        console.log('🌐 Chain changed to:', chainId);
        setIsCorrectNetwork(chainId === '0x61'); // BNB Testnet
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [userAccount, disconnectWallet, updateBalance]);

  return {
    // State
    userAccount,
    isConnected,
    isCorrectNetwork,
    qzcBalance,
    isLoading,
    error,
    
    // Actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    submitAnswer,
    updateBalance,
    getUserStats,
    getAvailableQuizzes,
    debugAvailableQuestions,
    
    // Utilities
    formatAddress: (addr) => blockchainService.formatAddress(addr),
    formatTxHash: (hash) => blockchainService.formatTxHash(hash),
    clearError: () => setError(null)
  };
};

// ✅ CRITICAL: Export the hook as named export
export { useBlockchain };

// Also export as default for flexibility
export default useBlockchain;