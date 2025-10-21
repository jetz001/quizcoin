// scripts/export-firebase-data.js
import { initializeFirebase } from '../services/firebase.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function exportFirebaseData() {
  try {
    console.log('🚀 Starting Firebase data export...');
    
    const db = await initializeFirebase();
    
    // Export Questions
    console.log('📥 Exporting questions...');
    const questionsSnapshot = await db.collection('questions').get();
    const questions = questionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      firstCorrectAnswerTime: doc.data().firstCorrectAnswerTime?.toDate?.()?.toISOString() || null
    }));
    
    // Export Merkle Leaves
    console.log('🌿 Exporting merkle leaves...');
    const leavesSnapshot = await db.collection('merkle_leaves').get();
    const merkleLeaves = leavesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    }));
    
    // Export Merkle Batches
    console.log('📁 Exporting merkle batches...');
    const batchesSnapshot = await db.collection('merkle_batches').get();
    const merkleBatches = batchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      readyAt: doc.data().readyAt?.toDate?.()?.toISOString() || null
    }));
    
    // Export User Answers
    console.log('👤 Exporting user answers...');
    const answersSnapshot = await db.collection('user_answers').get();
    const userAnswers = answersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      answeredAt: doc.data().answeredAt?.toDate?.()?.toISOString() || new Date().toISOString()
    }));
    
    // Create export data object
    const exportData = {
      questions,
      merkleLeaves,
      merkleBatches,
      userAnswers,
      exportedAt: new Date().toISOString(),
      totalRecords: {
        questions: questions.length,
        merkleLeaves: merkleLeaves.length,
        merkleBatches: merkleBatches.length,
        userAnswers: userAnswers.length
      }
    };
    
    // Save to file
    const exportPath = join(__dirname, '..', 'firebase-export.json');
    writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log('✅ Export completed!');
    console.log(`📊 Exported ${exportData.totalRecords.questions} questions`);
    console.log(`📊 Exported ${exportData.totalRecords.merkleLeaves} merkle leaves`);
    console.log(`📊 Exported ${exportData.totalRecords.merkleBatches} merkle batches`);
    console.log(`📊 Exported ${exportData.totalRecords.userAnswers} user answers`);
    console.log(`💾 Data saved to: ${exportPath}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportFirebaseData();
