import React, { useState, useEffect } from 'react';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import firebaseApp from './config/firebase';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import './index.css';

// Get Firebase services from the imported app
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

function App() {
  const [userAccount, setUserAccount] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedMode, setSelectedMode] = useState(null); // 'solo' or 'pool'
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [qzcBalance, setQzcBalance] = useState('0');

  // Firebase Auth
  useEffect(() => {
    const signIn = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Firebase Auth error:", error);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Firebase Auth State Changed:", user.uid);
      } else {
        console.log("User signed out or is anonymous.");
      }
      setIsAuthReady(true);
    });

    signIn();
    return () => unsubscribe();
  }, []);

  // Fetch quizzes from backend API (includes blockchainQuestionId)
  useEffect(() => {
    if (!isAuthReady || !userAccount) return;
    
    const loadQuizzesFromBackend = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/get-available-quizzes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userAccount })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log("📊 Loaded quizzes from backend API:", data.quizzes.length);
            setQuizzes(data.quizzes);
          } else {
            console.error("Backend API error:", data.error);
            // Fallback to Firestore if backend fails
            loadQuizzesFromFirestore();
          }
        } else {
          console.error("Backend API not available, falling back to Firestore");
          loadQuizzesFromFirestore();
        }
      } catch (error) {
        console.error("Error fetching quizzes from backend:", error);
        // Fallback to Firestore if backend fails
        loadQuizzesFromFirestore();
      }
    };

    const loadQuizzesFromFirestore = () => {
      console.log("📊 Loading quizzes from Firestore (fallback)");
      const q = collection(db, "questions");
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const quizData = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          quizId: doc.id
          // Note: These won't have blockchainQuestionId
        }));
        console.log("📊 Loaded quizzes from Firestore:", quizData.length);
        setQuizzes(quizData);
      }, (error) => {
        console.error("Error fetching quizzes from Firestore:", error);
      });
      
      return unsubscribe;
    };

    // Load quizzes from backend API first
    loadQuizzesFromBackend();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(loadQuizzesFromBackend, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [isAuthReady, userAccount]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ 
          method: "eth_requestAccounts" 
        });
        setUserAccount(accounts[0]);
        console.log("✅ Wallet connected:", accounts[0]);
        
        // Check network
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log("Current chain ID:", chainId);
        
        // BNB Testnet chain ID is 0x61 (97 in decimal)
        if (chainId !== '0x61') {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x61' }],
            });
          } catch (switchError) {
            // Chain not added to wallet
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x61',
                    chainName: 'BNB Smart Chain Testnet',
                    nativeCurrency: {
                      name: 'BNB',
                      symbol: 'BNB',
                      decimals: 18,
                    },
                    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                    blockExplorerUrls: ['https://testnet.bscscan.com/'],
                  }],
                });
              } catch (addError) {
                console.error("Failed to add BNB Testnet:", addError);
              }
            }
          }
        }
        
      } catch (error) {
        console.error("User denied account access or other error:", error);
      }
    } else {
      alert("กรุณาติดตั้ง MetaMask เพื่อใช้งาน DApp นี้!");
    }
  };

  const disconnectWallet = () => {
    setUserAccount(null);
    setSelectedMode(null);
    setCurrentPage("home");
    console.log("👋 Wallet disconnected");
  };

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    setCurrentPage("game");
    console.log(`🎮 Game mode selected: ${mode}`);
  };

  const onGoBack = () => {
    setSelectedMode(null);
    setCurrentPage("home");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter">
      {currentPage === "home" ? (
        <HomePage
          connectWallet={connectWallet}
          userAccount={userAccount}
          disconnectWallet={disconnectWallet}
          onModeSelect={handleModeSelect}
        />
      ) : (
        <GamePage
          quizzes={quizzes}
          onGoBack={onGoBack}
          db={db}
          userAccount={userAccount}
          selectedMode={selectedMode}
          qzcBalance={qzcBalance}
          setQzcBalance={setQzcBalance}
        />
      )}
    </div>
  );
}

export default App;