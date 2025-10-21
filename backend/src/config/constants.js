// backend/config/constants.js
import dotenv from 'dotenv';

dotenv.config();

// Default configuration
export const DEFAULT_CONFIG = {
  TOTAL_QUESTIONS: 18,
  SUB_BATCH_SIZE: 9,
  SUBMIT_LEAVES: false,
  SUBMIT_CHUNK_SIZE: 500,
  SUB_BATCH_DELAY: 60,
  TX_DELAY: 1
};

// Environment configuration
export const CONFIG = {
  PORT: process.env.PORT || 3000,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
  PROVIDER_URL: process.env.PROVIDER_URL,
  TOTAL_QUESTIONS: parseInt(process.env.TOTAL_QUESTIONS || DEFAULT_CONFIG.TOTAL_QUESTIONS.toString(), 10),
  SUB_BATCH_SIZE: parseInt(process.env.SUB_BATCH_SIZE || DEFAULT_CONFIG.SUB_BATCH_SIZE.toString(), 10),
  SUBMIT_LEAVES: (process.env.SUBMIT_LEAVES || DEFAULT_CONFIG.SUBMIT_LEAVES.toString()).toLowerCase() === "true",
  SUBMIT_CHUNK_SIZE: parseInt(process.env.SUBMIT_CHUNK_SIZE || DEFAULT_CONFIG.SUBMIT_CHUNK_SIZE.toString(), 10),
  SUB_BATCH_DELAY: parseInt(process.env.SUB_BATCH_DELAY || DEFAULT_CONFIG.SUB_BATCH_DELAY.toString(), 10),
  TX_DELAY: parseInt(process.env.TX_DELAY || DEFAULT_CONFIG.TX_DELAY.toString(), 10)
};

// API URLs
export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

// ABIs
export const MERKLE_ABI = [
  "function submitMerkleRoot(uint256 quizId, bytes32 root) external"
];

// Console configuration display
export const displayConfig = () => {
  console.log("📋 Configuration:");
  console.log(`   - Total Questions per Batch: ${CONFIG.TOTAL_QUESTIONS}`);
  console.log(`   - Sub-batch Size: ${CONFIG.SUB_BATCH_SIZE}`);
  console.log(`   - Submit Leaves: ${CONFIG.SUBMIT_LEAVES}`);
  console.log(`   - Submit Chunk Size: ${CONFIG.SUBMIT_CHUNK_SIZE}`);
  console.log(`   - Sub-batch Delay: ${CONFIG.SUB_BATCH_DELAY}s`);
  console.log(`   - Transaction Delay: ${CONFIG.TX_DELAY}s`);
  console.log("=====================================");
};