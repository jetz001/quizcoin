// backend/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configurations
import { CONFIG, displayConfig } from './config/constants.js';
import { initializeFirebase } from './config/database.js';
import { initializeBlockchain } from './config/blockchain.js';

// Import middleware
import { setupGlobalErrorHandlers, errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import adminRoutes from './routes/adminRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import merkleRoutes from './routes/merkleRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup global error handlers
setupGlobalErrorHandlers();

const app = express();

// Middleware
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize services
console.log("Initializing QuizCoin Backend...");
displayConfig();

const db = initializeFirebase();
const merkleContract = initializeBlockchain();

// Routes
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/api', merkleRoutes);

// Admin dashboard route
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'public', 'admin.html');
  res.sendFile(adminPath, (err) => {
    if (err) {
      console.error('Error sending admin.html:', err);
      res.status(500).send('Error loading admin page');
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'QuizCoin Backend (Refactored)',
    status: 'running',
    timestamp: new Date().toISOString(),
    config: {
      TOTAL_QUESTIONS: CONFIG.TOTAL_QUESTIONS,
      SUB_BATCH_SIZE: CONFIG.SUB_BATCH_SIZE,
      SUBMIT_LEAVES: CONFIG.SUBMIT_LEAVES,
      SUBMIT_CHUNK_SIZE: CONFIG.SUBMIT_CHUNK_SIZE,
      SUB_BATCH_DELAY: CONFIG.SUB_BATCH_DELAY,
      TX_DELAY: CONFIG.TX_DELAY
    },
    services: {
      firebase: !!db,
      gemini: !!CONFIG.GEMINI_API_KEY,
      blockchain: !!merkleContract
    },
    endpoints: [
      'POST /admin/generate-batch - Create new batch',
      'POST /admin/commit-batch - Commit batch to blockchain',
      'POST /admin/generate-and-commit - Generate and commit in one go',
      'GET /admin/config - View current configuration',
      'GET /admin/batches - View all batches',
      'POST /api/get-available-quizzes - Get available quizzes',
      'POST /api/get-answered-quizzes - Get user answered quizzes',
      'POST /api/get-user-stats - Get user statistics',
      'POST /api/record-answer - Record user answer',
      'POST /api/generate-merkle-proof - Generate Merkle proof',
      'POST /api/verify-merkle-proof - Verify Merkle proof',
      'GET /admin - Admin dashboard'
    ]
  });
});

// Error handling
app.use(errorHandler);
app.use(notFoundHandler);

// Start server
const server = app.listen(CONFIG.PORT, () => {
  console.log(`Server listening on port ${CONFIG.PORT}`);
  console.log(`Ready to generate batches with ${CONFIG.TOTAL_QUESTIONS} questions each`);
  console.log(`Admin dashboard: http://localhost:${CONFIG.PORT}/admin`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
// เพิ่ม API endpoint ใหม่สำหรับ debug
app.get('/api/debug/questions', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log('🔍 Debugging questions in database');

    // Get all questions from database
    const questionsQuery = await db.collection('questions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const questions = questionsQuery.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
      questionId: doc.data().questionId || 'Not set'
    }));

    console.log(`✅ Found ${questions.length} questions in database`);

    res.json({
      success: true,
      total: questions.length,
      questions: questions.map(q => ({
        dbId: q.id,
        questionId: q.questionId,
        difficultyLevel: q.data.difficultyLevel,
        isAnswered: q.data.isAnswered,
        createdAt: q.data.createdAt?.toMillis()
      }))
    });

  } catch (error) {
    console.error("Error debugging questions:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// แก้ไข API get-available-quizzes ให้รวม questionId
app.post('/api/get-available-quizzes', async (req, res) => {
  try {
    const { userAccount } = req.body;

    if (!userAccount) {
      return res.status(400).json({
        success: false,
        error: "userAccount is required"
      });
    }

    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`🔍 Finding available quizzes for ${userAccount}`);

    // Get all answered quizzes by this user
    const answeredQuery = await db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .get();

    const answeredQuizIds = new Set(
      answeredQuery.docs.map(doc => doc.data().quizId)
    );

    // Get all available questions
    const questionsQuery = await db.collection('questions')
      .where('isAnswered', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const availableQuizzes = questionsQuery.docs
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          quizId: doc.id,
          // เพิ่ม questionId สำหรับ smart contract
          questionId: data.questionId || generateQuestionIdFromDocId(doc.id),
        };
      })
      .filter(quiz => !answeredQuizIds.has(quiz.quizId));

    console.log(`✅ Found ${availableQuizzes.length} available quizzes`);

    res.json({
      success: true,
      quizzes: availableQuizzes,
      total: availableQuizzes.length
    });

  } catch (error) {
    console.error("Error fetching available quizzes:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Helper function: สร้าง questionId จาก document ID
function generateQuestionIdFromDocId(docId) {
  // สร้าง deterministic questionId จาก document ID
  let hash = 0;
  for (let i = 0; i < docId.length; i++) {
    const char = docId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 1000 + 1; // 1-1000 range
}

// แก้ไข generate-merkle-proof API ให้ใช้ questionId ที่ถูกต้อง
app.post('/api/generate-merkle-proof', async (req, res) => {
  try {
    const { quizId, answer } = req.body;

    if (!quizId || !answer) {
      return res.status(400).json({
        success: false,
        error: "quizId and answer are required"
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Firebase not available"
      });
    }

    console.log(`🔍 Generating Merkle proof for quiz: ${quizId}, answer: ${answer}`);

    // Get quiz data from database
    const quizDoc = await db.collection('questions').doc(quizId).get();
    
    if (!quizDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Quiz not found"
      });
    }

    const quizData = quizDoc.data();
    
    // Get or generate questionId for smart contract
    const questionId = quizData.questionId || generateQuestionIdFromDocId(quizId);
    
    console.log(`📊 Quiz: ${quizId}, QuestionId: ${questionId}, Correct Answer: ${quizData.correctAnswer}`);

    // Check if answer is correct
    const isCorrect = answer.toString().toLowerCase() === quizData.correctAnswer.toString().toLowerCase();
    
    if (!isCorrect) {
      return res.status(400).json({
        success: false,
        error: "Incorrect answer"
      });
    }

    // Create answer leaf with questionId and answer
    const answerString = `${questionId}:${answer}`;
    const leaf = ethers.keccak256(ethers.toUtf8Bytes(answerString));

    console.log(`🌿 Generated leaf: ${leaf} from "${answerString}"`);

    // For now, return a simple proof structure
    // In production, this should integrate with your Merkle tree system
    const proof = [leaf]; // Simplified proof
    const root = leaf;    // Simplified root
    const batchId = Math.floor(Date.now() / 1000);

    // Store proof for verification
    await db.collection('merkle_proofs').add({
      quizId: quizId,
      questionId: questionId,
      answer: answer,
      leaf: leaf,
      proof: proof,
      root: root,
      batchId: batchId,
      isValid: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      leaf: leaf,
      proof: proof,
      root: root,
      isValid: true,
      batchId: batchId,
      questionId: questionId,
      message: `Proof generated for question ${questionId}`
    });

  } catch (error) {
    console.error("Error generating Merkle proof:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API ใหม่: ตรวจสอบสถานะคำถามบน smart contract
app.post('/api/check-question-status', async (req, res) => {
  try {
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: "questionId is required"
      });
    }

    // สำหรับตอนนี้ return mock data
    // ในอนาคตควรเชื่อมต่อกับ smart contract จริง
    res.json({
      success: true,
      questionId: questionId,
      exists: true, // ในอนาคตควรเช็คจาก smart contract จริง
      isClosed: false,
      difficultyLevel: 50,
      message: `Question ${questionId} status checked`
    });

  } catch (error) {
    console.error("Error checking question status:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});