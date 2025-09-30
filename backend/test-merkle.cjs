// Test Merkle proof verification
const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');

async function testMerkleProof() {
  try {
    // Connect to BSC testnet
    const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545/');
    const contractAddress = '0x6a70A7FFab5Af92c7886a9D84626714E2F12db3D';
    
    // Contract ABI
    const abi = [
      'function getMerkleRoot(uint256 quizId) external view returns (bytes32)',
      'function verifyQuiz(uint256 quizId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool)'
    ];
    
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    // Test data from the logs
    const batchId = 1759159233;
    const quizId = 'q_1759159233_10';
    const userAnswer = 'Chameleon';
    // The correct answer should be what's stored in the database
    const correctAnswer = 'Chameleon'; // Let's test with the same for now
    
    console.log('🔍 Testing Merkle proof for:', { batchId, quizId, userAnswer, correctAnswer });
    
    // Get the root from smart contract
    const root = await contract.getMerkleRoot(batchId);
    console.log('📋 Smart contract root:', root);
    
    // Create the leaf the same way as in the backend (just the correct answer)
    const leaf = ethers.keccak256(ethers.toUtf8Bytes(correctAnswer));
    console.log('🍃 Generated leaf (correct answer):', leaf);
    
    // For now, let's just test if the contract can be called
    console.log('🧪 Testing contract call...');
    
    // Create a dummy proof for testing (this will fail but we can see the error)
    const dummyProof = [ethers.ZeroHash, ethers.ZeroHash];
    
    try {
      const result = await contract.verifyQuiz(batchId, leaf, dummyProof);
      console.log('✅ Contract call succeeded:', result);
    } catch (error) {
      console.log('❌ Contract call failed:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testMerkleProof();
