// backend/services/quizService.js
import { ethers } from 'ethers';

class QuizService {
  constructor(db, geminiService) {
    this.db = db;
    this.geminiService = geminiService;
  }

  // ✅ แก้ไขฟังก์ชันเก็บคำถาม - เพิ่มการเก็บ quiz_answers
  async storeQuestionToFirestore(quizId, quizData) {
    if (!this.db) {
      console.warn("⚠️ Firebase not initialized, skipping Firestore storage");
      return { success: true, correctAnswer: quizData.answer };
    }
    
    try {
      const answerIndex = quizData.options.indexOf(quizData.answer);
      if (answerIndex === -1) {
        console.warn("⚠️ Correct answer not in options, skipping", quizId);
        return { success: false, correctAnswer: null };
      }

      // 1. เก็บข้อมูลคำถามในเดิม
      const questionDoc = {
        quizId,
        question: quizData.question,
        options: quizData.options,
        answerIndex,
        difficulty: Math.floor(Math.random() * 100),
        mode: 'solo',
        category: quizData.category || 'general',
        createdAt: this.db.FieldValue.serverTimestamp(),
        isAnswered: false
      };
      await this.db.collection('questions').doc(quizId).set(questionDoc);

      // 2. ✅ เก็บ mapping ระหว่าง quizId กับ correctAnswer ใน collection ใหม่
      const answerDoc = {
        quizId: quizId,
        correctAnswer: quizData.answer,
        answerHash: ethers.keccak256(ethers.toUtf8Bytes(quizData.answer)),
        createdAt: this.db.FieldValue.serverTimestamp()
      };
      await this.db.collection('quiz_answers').doc(quizId).set(answerDoc);

      console.log(`📥 Stored question ${quizId} and answer mapping to Firestore.`);
      return { success: true, correctAnswer: quizData.answer };
    } catch (err) {
      console.error("storeQuestionToFirestore error:", err);
      return { success: false, correctAnswer: null };
    }
  }

  // สร้างคำถามจาก Gemini
  async generateQuizQuestion() {
    if (!this.geminiService) {
      throw new Error("Gemini service not available");
    }

    const prompt = `
Generate a single quiz question suitable for a mobile game.
The question must have four options, and only one correct answer.
Output JSON:
{
  "question": "text",
  "options": ["A","B","C","D"],
  "answer": "the correct option text"
}
`;
    try {
      console.log("⚡ Requesting new quiz question from Gemini...");
      const raw = await this.geminiService.callGemini(prompt);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      console.log("✅ Quiz question generated.");
      return parsed;
    } catch (e) {
      console.error("generateQuizQuestion error:", e.message || e);
      return null;
    }
  }

  // ดึงคำตอบที่ถูกต้องจาก quiz_answers collection
  async getCorrectAnswer(quizId) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    const quizAnswerDoc = await this.db.collection('quiz_answers')
      .doc(quizId)
      .get();

    if (!quizAnswerDoc.exists) {
      return null;
    }

    return quizAnswerDoc.data().correctAnswer;
  }

  // ตรวจสอบคำตอบ
  async verifyAnswer(quizId, answer) {
    const correctAnswer = await this.getCorrectAnswer(quizId);
    if (!correctAnswer) {
      return false;
    }

    return answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  }

  // เก็บผลการตอบของผู้ใช้
  async recordUserAnswer(userAccount, quizId, answer, correct, mode, rewardAmount, txHash) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    // ตรวจสอบว่าตอบแล้วหรือยัง
    const existingQuery = await this.db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .where('quizId', '==', quizId)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      throw new Error("Quiz already answered by this user");
    }

    // บันทึกคำตอบ
    const answerDoc = {
      userAccount: userAccount.toLowerCase(),
      quizId: quizId,
      answer: answer,
      correct: correct || false,
      mode: mode || 'solo',
      rewardAmount: rewardAmount || "0",
      txHash: txHash || null,
      answeredAt: this.db.FieldValue.serverTimestamp(),
      createdAt: this.db.FieldValue.serverTimestamp()
    };

    await this.db.collection('user_answers').add(answerDoc);

    // อัพเดทสถิติผู้ใช้
    await this.updateUserStats(userAccount, correct, rewardAmount);
  }

  // อัพเดทสถิติผู้ใช้
  async updateUserStats(userAccount, correct, rewardAmount) {
    if (!this.db) return;

    const userStatsRef = this.db.collection('user_stats').doc(userAccount.toLowerCase());
    const userStats = await userStatsRef.get();

    if (userStats.exists) {
      const currentStats = userStats.data();
      await userStatsRef.update({
        totalAnswered: (currentStats.totalAnswered || 0) + 1,
        totalCorrect: (currentStats.totalCorrect || 0) + (correct ? 1 : 0),
        totalEarned: (parseFloat(currentStats.totalEarned || "0") + parseFloat(rewardAmount || "0")).toString(),
        lastAnsweredAt: this.db.FieldValue.serverTimestamp(),
        streak: correct ? (currentStats.streak || 0) + 1 : 0
      });
    } else {
      await userStatsRef.set({
        userAccount: userAccount.toLowerCase(),
        totalAnswered: 1,
        totalCorrect: correct ? 1 : 0,
        totalEarned: rewardAmount || "0",
        firstAnsweredAt: this.db.FieldValue.serverTimestamp(),
        lastAnsweredAt: this.db.FieldValue.serverTimestamp(),
        streak: correct ? 1 : 0
      });
    }
  }

  // ดึงคำถามที่ยังไม่ได้ตอบ
  async getAvailableQuizzes(userAccount, limit = 50) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    // ดึงคำถามที่ตอบแล้ว
    const answeredQuery = await this.db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .get();

    const answeredQuizIds = new Set(
      answeredQuery.docs.map(doc => doc.data().quizId)
    );

    // ดึงคำถามที่ยังไม่ได้ตอบ
    const questionsQuery = await this.db.collection('questions')
      .where('isAnswered', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const availableQuizzes = questionsQuery.docs
      .map(doc => ({
        ...doc.data(),
        quizId: doc.id
      }))
      .filter(quiz => !answeredQuizIds.has(quiz.quizId));

    return availableQuizzes;
  }

  // ดึงสถิติผู้ใช้
  async getUserStats(userAccount) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    const userStatsDoc = await this.db.collection('user_stats')
      .doc(userAccount.toLowerCase())
      .get();

    if (!userStatsDoc.exists) {
      return {
        totalAnswered: 0,
        totalCorrect: 0,
        totalEarned: "0",
        streak: 0,
        accuracy: 0
      };
    }

    const data = userStatsDoc.data();
    return {
      totalAnswered: data.totalAnswered || 0,
      totalCorrect: data.totalCorrect || 0,
      totalEarned: data.totalEarned || "0",
      streak: data.streak || 0,
      accuracy: data.totalAnswered > 0 ? 
        Math.round((data.totalCorrect / data.totalAnswered) * 100) : 0,
      firstAnsweredAt: data.firstAnsweredAt?.toMillis(),
      lastAnsweredAt: data.lastAnsweredAt?.toMillis()
    };
  }

  // ดึงคำถามที่ผู้ใช้ตอบแล้ว
  async getUserAnsweredQuizzes(userAccount) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    const answeredQuery = await this.db.collection('user_answers')
      .where('userAccount', '==', userAccount.toLowerCase())
      .orderBy('answeredAt', 'desc')
      .get();

    return answeredQuery.docs.map(doc => ({
      ...doc.data(),
      answeredAt: doc.data().answeredAt?.toMillis()
    }));
  }
}

export default QuizService;