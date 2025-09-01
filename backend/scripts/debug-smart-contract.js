// scripts/debug-smart-contract.js - สคริปต์ debug smart contract

const { ethers } = require('hardhat');

async function debugSmartContract() {
  console.log('🔍 Starting Smart Contract Debug...\n');

  try {
    // Get deployed contract addresses
    const quizGameDiamondAddress = "0x7707CE42a3EFE0E5bdAE20996e2D0a1d45e40FE4";
    const quizCoinAddress = "0x573A71E80b19EC21d5C925140514Ac41659B323a";

    // Get signers
    const [deployer, user1] = await ethers.getSigners();
    console.log('👤 Deployer address:', deployer.address);
    console.log('👤 User1 address:', user1.address);

    // Connect to contracts
    const quizGameDiamond = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamondAddress);
    const quizCoin = await ethers.getContractAt("QuizCoin", quizCoinAddress);

    console.log('\n📊 Contract Status:');
    console.log('QuizGameDiamond:', quizGameDiamondAddress);
    console.log('QuizCoin:', quizCoinAddress);

    // 1. Check total questions
    try {
      const nextQuestionId = await quizGameDiamond.nextQuestionId();
      console.log('\n📈 Next Question ID:', nextQuestionId.toString());
      
      if (nextQuestionId > 0) {
        console.log('✅ Questions exist in smart contract');
        
        // Check existing questions
        for (let i = 1; i < nextQuestionId; i++) {
          try {
            const question = await quizGameDiamond.getQuestion(i);
            console.log(`\n📋 Question ${i}:`, {
              correctAnswerHash: question[0],
              hintHash: question[1],
              creator: question[2],
              difficultyLevel: question[3].toString(),
              baseRewardAmount: ethers.formatEther(question[4]),
              isClosed: question[5]
            });
          } catch (error) {
            console.log(`❌ Question ${i} error:`, error.message);
          }
        }
      } else {
        console.log('⚠️ No questions found in smart contract!');
        console.log('💡 Need to create questions first');
      }
    } catch (error) {
      console.error('❌ Error checking questions:', error.message);
    }

    // 2. Check QuizCoin balances
    try {
      const deployerBalance = await quizCoin.balanceOf(deployer.address);
      const user1Balance = await quizCoin.balanceOf(user1.address);
      
      console.log('\n💰 QZC Balances:');
      console.log('Deployer:', ethers.formatEther(deployerBalance), 'QZC');
      console.log('User1:', ethers.formatEther(user1Balance), 'QZC');
    } catch (error) {
      console.error('❌ Error checking balances:', error.message);
    }

    // 3. Create sample questions if none exist
    try {
      const nextQuestionId = await quizGameDiamond.nextQuestionId();
      
      if (nextQuestionId == 0) {
        console.log('\n🎯 Creating sample questions...');
        
        // Create sample questions
        const sampleQuestions = [
          {
            answer: "4",
            hint: "Simple math",
            difficulty: 10
          },
          {
            answer: "Bangkok",
            hint: "Capital city",
            difficulty: 20
          },
          {
            answer: "Blue",
            hint: "Sky color",
            difficulty: 15
          }
        ];

        for (let i = 0; i < sampleQuestions.length; i++) {
          const q = sampleQuestions[i];
          
          // Create answer hash
          const answerLeaf = ethers.keccak256(ethers.toUtf8Bytes(`${i + 1}:${q.answer}`));
          const hintHash = ethers.keccak256(ethers.toUtf8Bytes(q.hint));
          
          console.log(`Creating question ${i + 1}:`, {
            answer: q.answer,
            answerLeaf,
            difficulty: q.difficulty
          });
          
          try {
            const tx = await quizGameDiamond.createQuestion(
              answerLeaf,
              hintHash,
              q.difficulty,
              0 // Solo mode
            );
            
            await tx.wait();
            console.log(`✅ Question ${i + 1} created successfully`);
          } catch (error) {
            console.error(`❌ Failed to create question ${i + 1}:`, error.message);
          }
        }
        
        console.log('✅ Sample questions created');
      }
    } catch (error) {
      console.error('❌ Error creating sample questions:', error.message);
    }

    // 4. Test Merkle proof verification
    try {
      console.log('\n🌿 Testing Merkle proof verification...');
      
      const testAnswer = "4";
      const testQuestionId = 1;
      const testLeaf = ethers.keccak256(ethers.toUtf8Bytes(`${testQuestionId}:${testAnswer}`));
      const testProof = [testLeaf]; // Simple proof
      
      console.log('Test data:', {
        questionId: testQuestionId,
        answer: testAnswer,
        leaf: testLeaf,
        proof: testProof
      });
      
      // Note: This might fail if verifyQuiz function expects specific Merkle tree structure
      try {
        const isValid = await quizGameDiamond.verifyQuiz(testLeaf, testProof);
        console.log('✅ Merkle verification result:', isValid);
      } catch (error) {
        console.log('⚠️ Merkle verification not implemented or failed:', error.message);
      }
      
    } catch (error) {
      console.error('❌ Error testing Merkle proof:', error.message);
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

// Helper function to create question with proper format
async function createTestQuestion(contract, questionId, answer, hint, difficulty) {
  const answerLeaf = ethers.keccak256(ethers.toUtf8Bytes(`${questionId}:${answer}`));
  const hintHash = ethers.keccak256(ethers.toUtf8Bytes(hint));
  
  return await contract.createQuestion(
    answerLeaf,
    hintHash,
    difficulty,
    0 // Solo mode
  );
}

// Run debug if called directly
if (require.main === module) {
  debugSmartContract()
    .then(() => {
      console.log('\n✅ Debug completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugSmartContract, createTestQuestion };