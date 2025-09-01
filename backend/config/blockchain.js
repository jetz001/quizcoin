// backend/config/blockchain.js
import { ethers } from 'ethers';
import { CONFIG, MERKLE_ABI } from './constants.js';

let provider = null;
let signer = null;
let merkleContract = null;

export const initializeBlockchain = () => {
  if (!CONFIG.PRIVATE_KEY || !CONFIG.CONTRACT_ADDRESS || !CONFIG.PROVIDER_URL) {
    console.warn("⚠️ Blockchain config incomplete - on-chain submission will be skipped.");
    return null;
  }

  try {
    provider = new ethers.JsonRpcProvider(CONFIG.PROVIDER_URL);
    signer = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
    merkleContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, MERKLE_ABI, signer);
    
    console.log("✅ Connected to blockchain (Merkle contract ready).");
    return merkleContract;
  } catch (error) {
    console.error("❌ Blockchain connection failed:", error.message);
    console.error("⚠️ Server will continue but blockchain features will be disabled");
    return null;
  }
};

export const getBlockchainInstances = () => ({
  provider,
  signer,
  merkleContract
});

export { provider, signer, merkleContract };