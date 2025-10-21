// backend/services/database.js - PostgreSQL service to replace Firebase
import { PrismaClient } from '@prisma/client';

let prisma;

export async function initializeDatabase() {
  try {
    prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
    
    // Test connection
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully');
    return prisma;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw new Error("Database initialization failed");
  }
}

// Store question in PostgreSQL
export async function storeQuestionToDatabase(quizId, quizData, batchId) {
  if (!prisma) {
    console.warn("⚠️ Database not initialized");
    return false;
  }
  
  try {
    const answerIndex = quizData.options.indexOf(quizData.answer);
    if (answerIndex === -1) {
      console.warn("⚠️ Correct answer not in options, skipping", quizId);
      return false;
    }

    await prisma.question.create({
      data: {
        quizId,
        batchId,
        question: quizData.question,
        options: quizData.options,
        answerIndex,
        correctAnswer: quizData.answer,
        difficulty: Math.floor(Math.random() * 100) + 1,
        mode: 'solo',
        category: quizData.category || 'general',
        status: 'active'
      }
    });

    console.log(`📥 Stored question ${quizId} to database`);
    return true;
  } catch (error) {
    console.error("storeQuestionToDatabase error:", error);
    return false;
  }
}

// Store Merkle leaf data
export async function storeMerkleLeaf(batchId, leaf, quizId, correctAnswer) {
  if (!prisma) {
    console.warn("⚠️ Database not initialized");
    return false;
  }

  try {
    await prisma.merkleLeaf.create({
      data: {
        batchId: parseInt(batchId),
        leaf,
        quizId,
        correctAnswer,
        answerHash: leaf,
        status: 'active'
      }
    });

    console.log(`🌿 Stored leaf for ${quizId} (batch: ${batchId})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to store leaf for ${quizId}:`, error);
    return false;
  }
}

// Create batch document
export async function createBatchDocument(batchId, totalQuestions) {
  if (!prisma) return false;

  try {
    await prisma.merkleBatch.create({
      data: {
        batchId: parseInt(batchId),
        totalQuestions,
        status: 'generating',
        progress: 0
      }
    });
    
    console.log(`📁 Created batch document: ${batchId}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to create batch document:", error);
    return false;
  }
}

// Update batch progress
export async function updateBatchProgress(batchId, progress) {
  if (!prisma) return false;

  try {
    await prisma.merkleBatch.update({
      where: { batchId: parseInt(batchId) },
      data: { progress: Math.floor(progress) }
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to update batch progress:", error);
    return false;
  }
}

// Complete batch
export async function completeBatch(batchId, created, merkleRoot, allLeaves, allQuizIds) {
  if (!prisma) return false;

  try {
    await prisma.merkleBatch.update({
      where: { batchId: parseInt(batchId) },
      data: {
        status: 'ready',
        progress: 100,
        totalCreated: created,
        merkleRoot: merkleRoot,
        leaves: allLeaves,
        quizIds: allQuizIds,
        readyAt: new Date()
      }
    });
    
    console.log(`✅ Completed batch: ${batchId}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to complete batch:", error);
    return false;
  }
}

// Get batch by ID
export async function getBatch(batchId) {
  if (!prisma) return null;

  try {
    const batch = await prisma.merkleBatch.findUnique({
      where: { batchId: parseInt(batchId) }
    });
    return batch;
  } catch (error) {
    console.error("❌ Failed to get batch:", error);
    return null;
  }
}

// Get leaves for batch
export async function getLeavesForBatch(batchId) {
  if (!prisma) return [];

  try {
    console.log(`🔍 Getting leaves for batch ${batchId}...`);
    
    const leaves = await prisma.merkleLeaf.findMany({
      where: { batchId: parseInt(batchId) },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`✅ Found ${leaves.length} leaves for batch ${batchId}`);
    return leaves;
  } catch (error) {
    console.error("❌ Failed to get leaves:", error);
    return [];
  }
}

// Find quiz leaf
export async function findQuizLeaf(quizId) {
  if (!prisma) return null;

  try {
    const leaf = await prisma.merkleLeaf.findFirst({
      where: { quizId }
    });
    return leaf;
  } catch (error) {
    console.error("❌ Failed to find quiz leaf:", error);
    return null;
  }
}

// Record answer submission
export async function recordAnswerSubmission(quizId, userAccount, answer, isCorrect, merkleProof, txHash, mode, rewardAmount) {
  if (!prisma) return false;

  try {
    await prisma.userAnswer.create({
      data: {
        quizId,
        userAccount: userAccount.toLowerCase(),
        answer,
        isCorrect,
        merkleProof: merkleProof || null,
        txHash: txHash || null,
        mode: mode || 'solo',
        rewardAmount: rewardAmount || "0"
      }
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to record answer:", error);
    return false;
  }
}

// Update question statistics
export async function updateQuestionStats(quizId, isCorrect, userAccount) {
  if (!prisma) return false;

  try {
    const question = await prisma.question.findUnique({
      where: { quizId }
    });
    
    if (!question) return false;

    const updateData = {
      totalAnswers: question.totalAnswers + 1
    };

    if (isCorrect) {
      updateData.correctAnswers = question.correctAnswers + 1;
      
      if (!question.firstSolverAddress) {
        updateData.firstSolverAddress = userAccount.toLowerCase();
        updateData.firstCorrectAnswerTime = new Date();
      }
    }

    await prisma.question.update({
      where: { quizId },
      data: updateData
    });
    
    return true;
  } catch (error) {
    console.error("❌ Failed to update question stats:", error);
    return false;
  }
}

// Get question by ID
export async function getQuestion(quizId) {
  if (!prisma) return null;

  try {
    const question = await prisma.question.findUnique({
      where: { quizId }
    });
    return question;
  } catch (error) {
    console.error("❌ Failed to get question:", error);
    return null;
  }
}

// Get quizzes with filters
export async function getQuizzes(limit = 20, category = null, difficulty = null) {
  if (!prisma) return [];

  try {
    const where = {
      status: 'active'
    };

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = parseInt(difficulty);
    }

    const quizzes = await prisma.question.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    return quizzes;
  } catch (error) {
    console.error("❌ Failed to get quizzes:", error);
    return [];
  }
}

// Graceful shutdown
export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
  }
}

export { prisma };
