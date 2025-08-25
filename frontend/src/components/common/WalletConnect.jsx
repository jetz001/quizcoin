import React, { useState, useEffect } from 'react';
import { FaWallet } from 'react-icons/fa';
import { ethers } from 'ethers';

// This component handles wallet connection logic.
const WalletConnect = () => {
  // Use state to store the user's wallet address.
  const [walletAddress, setWalletAddress] = useState(null);
  
  // This function connects to the user's wallet (e.g., MetaMask).
  const connectWallet = async () => {
    // Check if Ethereum is available in the browser (e.g., MetaMask is installed).
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request access to the user's accounts.
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        // Set the first account address to the state.
        setWalletAddress(accounts[0]);
        console.log("Connected to wallet:", accounts[0]);
      } catch (error) {
        // Handle potential errors like the user declining the connection.
        console.error("User denied account access or another error occurred:", error);
      }
    } else {
      // Alert the user if no Ethereum provider is found.
      alert('กรุณาติดตั้ง MetaMask!');
    }
  };

  // Use useEffect to check for wallet connection on component load.
  useEffect(() => {
    // Check if a wallet is already connected.
    const checkWalletConnection = async () => {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      }
    };
    checkWalletConnection();

    // Listen for account changes and update the state.
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setWalletAddress(accounts.length > 0 ? accounts[0] : null);
      });
    }
  }, []);

  return (
    <div>
      {/*
        Conditional rendering to show the wallet address or a connect button.
      */}
      {walletAddress ? (
        <span className="bg-gray-700 text-orange-400 py-2 px-4 rounded-full text-sm font-semibold">
          {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
        </span>
      ) : (
        <button
          onClick={connectWallet}
          className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 transition-colors text-white font-bold py-2 px-4 rounded-full shadow"
        >
          <FaWallet />
          <span>เชื่อมต่อ Wallet</span>
        </button>
      )}
    </div>
  );
};

export default WalletConnect;
