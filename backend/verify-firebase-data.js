// Firebase Data Verification Script
import { initializeFirebase } from './services/firebase.js';

async function verifyFirebaseData() {
  console.log('🔍 Starting Firebase data verification...\n');
  
  try {
    const db = await initializeFirebase();
    
    // 1. Check Questions Collection
    console.log('📋 Checking Questions Collection:');
    console.log('================================');
    
    const questionsSnapshot = await db.collection('questions').get();
    console.log(`Total questions: ${questionsSnapshot.size}`);
    
    if (!questionsSnapshot.empty) {
      const sampleQuestion = questionsSnapshot.docs[0].data();
      console.log('\nSample question structure:');
      console.log('- quizId:', sampleQuestion.quizId);
      console.log('- question:', sampleQuestion.question?.substring(0, 50) + '...');
      console.log('- options count:', sampleQuestion.options?.length);
      console.log('- answer:', sampleQuestion.correctAnswer);
      console.log('- category:', sampleQuestion.category);
      console.log('- difficulty:', sampleQuestion.difficulty);
      console.log('- batchId:', sampleQuestion.batchId);
      console.log('- isAnswered:', sampleQuestion.isAnswered);
      console.log('- createdAt:', sampleQuestion.createdAt?.toDate?.());
    }
    
    // 2. Check Completed Quizzes Collection
    console.log('\n\n🏆 Checking Completed Quizzes Collection:');
    console.log('=========================================');
    
    const completedSnapshot = await db.collection('completed_quizzes').get();
    console.log(`Total completed quizzes: ${completedSnapshot.size}`);
    
    if (!completedSnapshot.empty) {
      const sampleCompleted = completedSnapshot.docs[0].data();
      console.log('\nSample completed quiz structure:');
      console.log('- quizId:', sampleCompleted.quizId);
      console.log('- userAccount:', sampleCompleted.userAccount);
      console.log('- answer:', sampleCompleted.answer);
      console.log('- correct:', sampleCompleted.correct);
      console.log('- rewardAmount:', sampleCompleted.rewardAmount);
      console.log('- txHash:', sampleCompleted.txHash);
      console.log('- completedAt:', sampleCompleted.completedAt?.toDate?.());
      console.log('- quizData available:', !!sampleCompleted.quizData);
      if (sampleCompleted.quizData) {
        console.log('  - question:', sampleCompleted.quizData.question?.substring(0, 50) + '...');
        console.log('  - category:', sampleCompleted.quizData.category);
        console.log('  - difficulty:', sampleCompleted.quizData.difficulty);
      }
    }
    
    // 3. Check User Answers Collection
    console.log('\n\n👤 Checking User Answers Collection:');
    console.log('====================================');
    
    const userAnswersSnapshot = await db.collection('user_answers').get();
    console.log(`Total user answers: ${userAnswersSnapshot.size}`);
    
    // 4. Check User Stats Collection
    console.log('\n\n📊 Checking User Stats Collection:');
    console.log('==================================');
    
    const userStatsSnapshot = await db.collection('user_stats').get();
    console.log(`Total user stats: ${userStatsSnapshot.size}`);
    
    if (!userStatsSnapshot.empty) {
      const sampleStats = userStatsSnapshot.docs[0].data();
      console.log('\nSample user stats:');
      console.log('- userAccount:', sampleStats.userAccount);
      console.log('- totalAnswered:', sampleStats.totalAnswered);
      console.log('- totalCorrect:', sampleStats.totalCorrect);
      console.log('- accuracy:', sampleStats.accuracy + '%');
      console.log('- totalEarned:', sampleStats.totalEarned);
      console.log('- streak:', sampleStats.streak);
    }
    
    // 5. Check Merkle Collections
    console.log('\n\n🌿 Checking Merkle Collections:');
    console.log('===============================');
    
    const batchesSnapshot = await db.collection('merkle_batches').get();
    const leavesSnapshot = await db.collection('merkle_leaves').get();
    
    console.log(`Total merkle batches: ${batchesSnapshot.size}`);
    console.log(`Total merkle leaves: ${leavesSnapshot.size}`);
    
    // 6. Data Consistency Checks
    console.log('\n\n🔍 Data Consistency Analysis:');
    console.log('=============================');
    
    // Check if completed quizzes have corresponding questions
    let matchingQuestions = 0;
    let missingQuestions = 0;
    
    for (const completedDoc of completedSnapshot.docs) {
      const completed = completedDoc.data();
      const questionDoc = await db.collection('questions').doc(completed.quizId).get();
      
      if (questionDoc.exists) {
        matchingQuestions++;
      } else {
        missingQuestions++;
        console.log(`⚠️  Missing question for completed quiz: ${completed.quizId}`);
      }
    }
    
    console.log(`✅ Completed quizzes with matching questions: ${matchingQuestions}`);
    console.log(`❌ Completed quizzes with missing questions: ${missingQuestions}`);
    
    // Check for specific quiz IDs mentioned in the user's data
    console.log('\n\n🎯 Checking Specific Quiz IDs:');
    console.log('==============================');
    
    const specificQuizIds = [
      'q_1760335333_1',
      'q_1760357746_1',
      'q_1760190436_16'
    ];
    
    for (const quizId of specificQuizIds) {
      console.log(`\nChecking ${quizId}:`);
      
      // Check in questions collection
      const questionDoc = await db.collection('questions').doc(quizId).get();
      console.log(`  - In questions collection: ${questionDoc.exists ? '✅' : '❌'}`);
      
      if (questionDoc.exists) {
        const qData = questionDoc.data();
        console.log(`    Question: ${qData.question?.substring(0, 50)}...`);
        console.log(`    Answer: ${qData.correctAnswer}`);
        console.log(`    Options: ${qData.options?.length} options`);
      }
      
      // Check in completed_quizzes collection
      const completedQuery = await db.collection('completed_quizzes')
        .where('quizId', '==', quizId)
        .get();
      
      console.log(`  - In completed_quizzes: ${completedQuery.size} entries`);
      
      if (!completedQuery.empty) {
        const completed = completedQuery.docs[0].data();
        console.log(`    User: ${completed.userAccount}`);
        console.log(`    Answer: ${completed.answer}`);
        console.log(`    Correct: ${completed.correct}`);
        console.log(`    Reward: ${completed.rewardAmount}`);
        console.log(`    TxHash: ${completed.txHash}`);
      }
    }
    
    console.log('\n\n✅ Firebase data verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the verification
verifyFirebaseData().then(() => {
  console.log('\n🔚 Verification script finished.');
  process.exit(0);
}).catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
