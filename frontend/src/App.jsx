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
  const [isAuthReady, setIsAuthReady] = useState(false);

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

  // Fetch quizzes from Firestore
  useEffect(() => {
      if (!isAuthReady) return;
      const q = collection(db, "questions");
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const quizData = querySnapshot.docs.map(doc => ({
              ...doc.data(),
              quizId: doc.id
          }));
          setQuizzes(quizData);
      }, (error) => {
          console.error("Error fetching quizzes:", error);
      });
      return () => unsubscribe();
  }, [isAuthReady]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setUserAccount(accounts[0]);
        setCurrentPage("game");
      } catch (error) {
        console.error("User denied account access or other error:", error);
      }
    } else {
      console.error("Please install MetaMask to use this DApp!");
    }
  };

  const disconnectWallet = () => {
    setUserAccount(null);
    setCurrentPage("home");
  };

  const onGoBack = () => {
    setUserAccount(null);
    setCurrentPage("home");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter">
      {currentPage === "home" ? (
        <HomePage
          connectWallet={connectWallet}
          userAccount={userAccount}
          disconnectWallet={disconnectWallet}
        />
      ) : (
        <GamePage
          quizzes={quizzes}
          onGoBack={onGoBack}
          db={db}
          userAccount={userAccount}
        />
      )}
    </div>
  );
}

export default App;
