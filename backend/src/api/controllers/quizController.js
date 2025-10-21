import express from 'express';
import admin from 'firebase-admin';

const router = express.Router();

router.post('/record-answer', async (req, res) => {
  // Copy from old server.js
});

router.post('/get-answered-quizzes', async (req, res) => {
  // Copy from old server.js
});

router.post('/get-user-stats', async (req, res) => {
  // Copy from old server.js
});

router.post('/get-available-quizzes', async (req, res) => {
  // Copy from old server.js
});

export default router;