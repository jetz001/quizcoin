// scripts/import-to-postgresql.js
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function importToPostgreSQL() {
  try {
    console.log('🚀 Starting PostgreSQL import...');
    
    // Read exported data
    const exportPath = join(__dirname, '..', 'firebase-export.json');
    const exportData = JSON.parse(readFileSync(exportPath, 'utf8'));
    
    console.log('📊 Import summary:');
    console.log(`  Questions: ${exportData.totalRecords.questions}`);
    console.log(`  Merkle Leaves: ${exportData.totalRecords.merkleLeaves}`);
    console.log(`  Merkle Batches: ${exportData.totalRecords.merkleBatches}`);
    console.log(`  User Answers: ${exportData.totalRecords.userAnswers}`);
    
    // Import Merkle Batches first (referenced by leaves)
    console.log('📁 Importing merkle batches...');
    for (const batch of exportData.merkleBatches) {
      await prisma.merkleBatch.upsert({
        where: { batchId: batch.batchId },
        update: {
          totalQuestions: batch.totalQuestions,
          status: batch.status,
          progress: batch.progress,
          totalCreated: batch.totalCreated,
          merkleRoot: batch.merkleRoot,
          leaves: batch.leaves || [],
          quizIds: batch.quizIds || [],
          readyAt: batch.readyAt ? new Date(batch.readyAt) : null
        },
        create: {
          batchId: batch.batchId,
          totalQuestions: batch.totalQuestions,
          createdAt: new Date(batch.createdAt),
          status: batch.status,
          progress: batch.progress,
          totalCreated: batch.totalCreated,
          merkleRoot: batch.merkleRoot,
          leaves: batch.leaves || [],
          quizIds: batch.quizIds || [],
          readyAt: batch.readyAt ? new Date(batch.readyAt) : null
        }
      });
    }
    
    // Import Questions
    console.log('📥 Importing questions...');
    for (const question of exportData.questions) {
      await prisma.question.upsert({
        where: { quizId: question.quizId },
        update: {
          batchId: question.batchId,
          question: question.question,
          options: question.options || [],
          answerIndex: question.answerIndex,
          correctAnswer: question.correctAnswer,
          difficulty: question.difficulty || 1,
          mode: question.mode || 'solo',
          category: question.category || 'general',
          isAnswered: question.isAnswered || false,
          totalAnswers: question.totalAnswers || 0,
          correctAnswers: question.correctAnswers || 0,
          status: question.status || 'active',
          firstSolverAddress: question.firstSolverAddress,
          firstCorrectAnswerTime: question.firstCorrectAnswerTime ? new Date(question.firstCorrectAnswerTime) : null
        },
        create: {
          quizId: question.quizId,
          batchId: question.batchId,
          question: question.question,
          options: question.options || [],
          answerIndex: question.answerIndex,
          correctAnswer: question.correctAnswer,
          difficulty: question.difficulty || 1,
          mode: question.mode || 'solo',
          category: question.category || 'general',
          createdAt: new Date(question.createdAt),
          isAnswered: question.isAnswered || false,
          totalAnswers: question.totalAnswers || 0,
          correctAnswers: question.correctAnswers || 0,
          status: question.status || 'active',
          firstSolverAddress: question.firstSolverAddress,
          firstCorrectAnswerTime: question.firstCorrectAnswerTime ? new Date(question.firstCorrectAnswerTime) : null
        }
      });
    }
    
    // Import Merkle Leaves
    console.log('🌿 Importing merkle leaves...');
    for (const leaf of exportData.merkleLeaves) {
      // Check if batch exists
      const batchExists = await prisma.merkleBatch.findUnique({
        where: { batchId: leaf.batchId }
      });
      
      // Check if question exists
      const questionExists = await prisma.question.findUnique({
        where: { quizId: leaf.quizId }
      });
      
      if (batchExists && questionExists) {
        await prisma.merkleLeaf.create({
          data: {
            batchId: leaf.batchId,
            leaf: leaf.leaf,
            quizId: leaf.quizId,
            correctAnswer: leaf.correctAnswer,
            answerHash: leaf.answerHash || leaf.leaf,
            createdAt: new Date(leaf.createdAt),
            status: leaf.status || 'active'
          }
        });
      } else {
        console.warn(`⚠️ Skipping leaf for ${leaf.quizId} - missing batch or question`);
      }
    }
    
    // Import User Answers
    console.log('👤 Importing user answers...');
    for (const answer of exportData.userAnswers) {
      // Check if question exists
      const questionExists = await prisma.question.findUnique({
        where: { quizId: answer.quizId }
      });
      
      if (questionExists) {
        await prisma.userAnswer.create({
          data: {
            quizId: answer.quizId,
            userAccount: answer.userAccount.toLowerCase(),
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            answeredAt: new Date(answer.answeredAt),
            merkleProof: answer.merkleProof,
            txHash: answer.txHash,
            mode: answer.mode || 'solo',
            rewardAmount: answer.rewardAmount || '0'
          }
        });
      } else {
        console.warn(`⚠️ Skipping answer for ${answer.quizId} - question not found`);
      }
    }
    
    console.log('✅ Import completed successfully!');
    
    // Verify import
    const counts = await Promise.all([
      prisma.question.count(),
      prisma.merkleLeaf.count(),
      prisma.merkleBatch.count(),
      prisma.userAnswer.count()
    ]);
    
    console.log('📊 Final counts:');
    console.log(`  Questions: ${counts[0]}`);
    console.log(`  Merkle Leaves: ${counts[1]}`);
    console.log(`  Merkle Batches: ${counts[2]}`);
    console.log(`  User Answers: ${counts[3]}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importToPostgreSQL();
