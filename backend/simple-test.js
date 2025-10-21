// Simple test for leaf system
const { ethers } = require('ethers');

async function simpleTest() {
  console.log('🧪 Simple Leaf System Test...');
  
  try {
    // Connect to local hardhat network
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('✅ Connected to blockchain');
    console.log('📍 Signer:', signer.address);
    
    // Contract ABI for leaf functions
    const abi = [
      "function isLeafSolved(bytes32 _answerLeaf) external view returns (bool)",
      "function createQuestion(bytes32 _answerLeaf, bytes32 _hintHash, uint256 _difficultyLevel, uint8 _mode) external returns (uint256)"
    ];
    
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const contract = new ethers.Contract(contractAddress, abi, signer);
    
    console.log('✅ Contract connected:', contractAddress);
    
    // Test leaf checking
    const testLeaf = ethers.keccak256(ethers.toUtf8Bytes('test-leaf-123'));
    console.log('🧪 Testing leaf:', testLeaf);
    
    const isSolved = await contract.isLeafSolved(testLeaf);
    console.log('🚪 Leaf solved status:', isSolved);
    
    if (!isSolved) {
      console.log('✅ SUCCESS: Leaf shows as available (not solved)');
    } else {
      console.log('⚠️ INFO: Leaf shows as solved');
    }
    
    console.log('\n🎉 Leaf system is working!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

simpleTest();
