// backend/routes/quiz.js - Fixed for ES modules
import express from 'express';
import { 
  getQuestion, 
  getQuizzes, 
  recordAnswerSubmission, 
  updateQuestionStats 
} from '../services/firebase.js';

const router = express.Router();

// Get quiz question by ID
router.get('/quiz/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    const questionData = await getQuestion(quizId);
    
    if (!questionData) {
      return res.status(404).json({
        success: false,
        error: "Quiz not found"
      });
    }

    // Don't send the correct answer or answer index to the client
    const sanitizedData = {
      quizId: questionData.quizId,
      question: questionData.question,
      options: questionData.options,
      category: questionData.category,
      difficulty: questionData.difficulty,
      mode: questionData.mode,
      totalAnswers: questionData.totalAnswers || 0,
      correctAnswers: questionData.correctAnswers || 0,
      status: questionData.status,
      batchId: questionData.batchId
    };

    res.json({
      success: true,
      quiz: sanitizedData
    });

  } catch (error) {
    console.error("Error fetching quiz:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get available quizzes with filters
router.get('/quizzes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category || null;
    const difficulty = req.query.difficulty || null;

    const quizzes = await getQuizzes(limit, category, difficulty);

    // Sanitize quiz data (remove sensitive information)
    const sanitizedQuizzes = quizzes.map(quiz => ({
      quizId: quiz.quizId,
      question: quiz.question,
      options: quiz.options,
      category: quiz.category,
      difficulty: quiz.difficulty,
      mode: quiz.mode,
      totalAnswers: quiz.totalAnswers || 0,
      correctAnswers: quiz.correctAnswers || 0,
      batchId: quiz.batchId
    }));

    res.json({
      success: true,
      quizzes: sanitizedQuizzes,
      total: sanitizedQuizzes.length,
      filters: {
        limit,
        category,
        difficulty
      }
    });

  } catch (error) {
    console.error("Error fetching quizzes:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Submit answer and record transaction
router.post('/submit-answer', async (req, res) => {
  try {
    const { quizId, answer, userAccount, merkleProof, txHash } = req.body;

    if (!quizId || !answer || !userAccount) {
      return res.status(400).json({
        success: false,
        error: "quizId, answer, and userAccount are required"
      });
    }

    console.log(`📝 Recording answer submission for quiz ${quizId} by ${userAccount}`);

    // Get question data to verify answer
    const questionData = await getQuestion(quizId);
    if (!questionData) {
      return res.status(404).json({
        success: false,
        error: "Question not found"
      });
    }

    // Check if question is still active
    if (questionData.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: "Question is no longer active"
      });
    }

    // Verify the answer
    const isCorrect = questionData.correctAnswer === answer;
    const rewardAmount = isCorrect ? (questionData.baseRewardAmount || "100") : "0";

    // Record the answer submission
    const recorded = await recordAnswerSubmission(
      quizId, 
      userAccount, 
      answer, 
      isCorrect, 
      merkleProof, 
      txHash, 
      questionData.mode, 
      rewardAmount
    );

    if (!recorded) {
      return res.status(500).json({
        success: false,
        error: "Failed to record answer submission"
      });
    }

    // Update question statistics
    await updateQuestionStats(quizId, isCorrect, userAccount);

    console.log(`✅ Answer recorded for ${quizId}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    res.json({
      success: true,
      isCorrect,
      message: isCorrect ? "Correct answer! Reward will be processed." : "Incorrect answer.",
      rewardAmount: rewardAmount,
      quiz: {
        quizId,
        category: questionData.category,
        difficulty: questionData.difficulty,
        mode: questionData.mode
      }
    });

  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get user's answered quizzes
router.post('/get-answered-quizzes', async (req, res) => {
  try {
    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    console.log(`📊 Fetching answered quizzes for ${userAccount}`);

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    // Get user's answered quizzes from Firestore
    const answeredQuery = await db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .orderBy('answeredAt', 'desc')
      .limit(50) // Limit to prevent large responses
      .get();

    const answeredQuizzes = answeredQuery.docs.map(doc => {
      const data = doc.data();
      return {
        quizId: data.quizId,
        answeredAt: data.answeredAt?.toMillis() || Date.now(),
        isCorrect: data.isCorrect || false,
        mode: data.mode || 'solo',
        rewardAmount: data.rewardAmount || "0",
        txHash: data.txHash || null,
        answer: data.answer
      };
    });

    console.log(`✅ Found ${answeredQuizzes.length} answered quizzes for ${userAccount}`);

    res.json({
      success: true,
      answeredQuizzes: answeredQuizzes,
      total: answeredQuizzes.length,
      userAccount: userAccount.toLowerCase()
    });

  } catch (error) {
    console.error("Error fetching answered quizzes:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get quiz statistics
router.get('/quiz/:quizId/stats', async (req, res) => {
  try {
    const { quizId } = req.params;

    const questionData = await getQuestion(quizId);
    
    if (!questionData) {
      return res.status(404).json({
        success: false,
        error: "Quiz not found"
      });
    }

    const stats = {
      quizId: questionData.quizId,
      totalAnswers: questionData.totalAnswers || 0,
      correctAnswers: questionData.correctAnswers || 0,
      accuracyRate: questionData.totalAnswers > 0 
        ? ((questionData.correctAnswers || 0) / questionData.totalAnswers * 100).toFixed(2) 
        : "0.00",
      difficulty: questionData.difficulty,
      category: questionData.category,
      mode: questionData.mode,
      status: questionData.status,
      firstSolverAddress: questionData.firstSolverAddress || null,
      firstCorrectAnswerTime: questionData.firstCorrectAnswerTime || null,
      createdAt: questionData.createdAt
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error("Error fetching quiz stats:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;

// =================== MERKLE ROUTES ===================
// backend/routes/merkle.js - Fixed for ES modules
import express from 'express';
import { generateProofForQuizAnswer, verifyMerkleProof } from '../services/merkle.js';
import { findQuizLeaf, getBatch } from '../services/firebase.js';

const merkleRouter = express.Router();

// Generate Merkle proof for answer verification
merkleRouter.post('/generate-merkle-proof', async (req, res) => {
  try {
    const { quizId, answer } = req.body;
    
    if (!quizId || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: "quizId and answer are required" 
      });
    }

    console.log(`🔍 Generating Merkle proof for quiz ${quizId}, answer: ${answer}`);

    // Find the quiz leaf data
    const leafData = await findQuizLeaf(quizId);
    if (!leafData) {
      return res.status(404).json({
        success: false,
        error: "Quiz not found in Merkle tree"
      });
    }

    // Generate proof for this answer
    const proofData = await generateProofForQuizAnswer(leafData.batchId, quizId, answer);

    console.log(`✅ Generated proof for ${quizId}: valid=${proofData.isValid}`);

    res.json({
      success: true,
      leaf: proofData.leaf,
      proof: proofData.proof,
      root: proofData.root,
      isValid: proofData.isValid,
      batchId: leafData.batchId,
      quizId: quizId
    });

  } catch (error) {
    console.error("Error generating Merkle proof:", error);
    
    if (error.message.includes("Incorrect answer")) {
      return res.status(400).json({ 
        success: false, 
        error: "Incorrect answer provided" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Verify Merkle proof
merkleRouter.post('/verify-merkle-proof', async (req, res) => {
  try {
    const { leaf, proof, batchId } = req.body;

    if (!leaf || !proof || !batchId) {
      return res.status(400).json({
        success: false,
        error: "leaf, proof, and batchId are required"
      });
    }

    console.log(`🔍 Verifying Merkle proof for batch ${batchId}`);

    // Get the root for this batch
    const batchData = await getBatch(batchId);
    if (!batchData) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    const root = batchData.merkleRoot;
    if (!root) {
      return res.status(400).json({
        success: false,
        error: "Batch root not available"
      });
    }

    // Verify using Merkle library
    const isValid = verifyMerkleProof(proof, leaf, root);

    console.log(`✅ Proof verification result: ${isValid}`);

    res.json({
      success: true,
      isValid: isValid,
      root: root,
      batchId: batchId
    });

  } catch (error) {
    console.error("Error verifying Merkle proof:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get batch information
merkleRouter.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;

    const batchData = await getBatch(parseInt(batchId));
    if (!batchData) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    // Return sanitized batch info (don't expose sensitive data)
    const sanitizedBatch = {
      batchId: batchData.batchId,
      status: batchData.status,
      totalQuestions: batchData.totalQuestions,
      totalCreated: batchData.totalCreated,
      progress: batchData.progress,
      merkleRoot: batchData.merkleRoot,
      totalLeaves: batchData.leaves ? batchData.leaves.length : 0,
      createdAt: batchData.createdAt,
      readyAt: batchData.readyAt,
      committedAt: batchData.committedAt
    };

    res.json({
      success: true,
      batch: sanitizedBatch
    });

  } catch (error) {
    console.error("Error getting batch:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export { router as default, merkleRouter };