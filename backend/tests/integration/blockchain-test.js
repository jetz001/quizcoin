import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function testBlockchainQuestions() {
  try {
    console.log('🔍 Testing blockchain questions...');
    
    // Connect to BSC Testnet
    const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Contract ABI for the question-related functions
    const contractABI = [
      "function getQuestionCount() external view returns (uint256)",
      "function questions(uint256) external view returns (bytes32)"
    ];
    
    const contractAddress = '0x6a70A7FFab5Af92c7886a9D84626714E2F12db3D'; // From the logs
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    
    // Get total question count
    const questionCount = await contract.getQuestionCount();
    console.log(`📊 Total questions on blockchain: ${questionCount.toString()}`);
    
    // Test a few question IDs to see which ones exist
    const testIds = [1, 2, 5, 10, 15, 20, 25, 29, 30];
    
    for (const id of testIds) {
      try {
        const questionHash = await contract.questions(id);
        const exists = questionHash !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        console.log(`Question ID ${id}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'} (hash: ${questionHash})`);
      } catch (error) {
        console.log(`Question ID ${id}: ❌ ERROR - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing blockchain:', error);
  }
}

testBlockchainQuestions();
