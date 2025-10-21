-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "batchId" TEXT,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "answerIndex" INTEGER NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'solo',
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAnswered" BOOLEAN NOT NULL DEFAULT false,
    "totalAnswers" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "firstSolverAddress" TEXT,
    "firstCorrectAnswerTime" DATETIME
);

-- CreateTable
CREATE TABLE "merkle_leaves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" INTEGER NOT NULL,
    "leaf" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "answerHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "merkle_leaves_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "questions" ("quizId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "merkle_leaves_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "merkle_batches" ("batchId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "merkle_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalCreated" INTEGER,
    "merkleRoot" TEXT,
    "leaves" TEXT NOT NULL,
    "quizIds" TEXT NOT NULL,
    "readyAt" DATETIME
);

-- CreateTable
CREATE TABLE "user_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "userAccount" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "merkleProof" TEXT,
    "txHash" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'solo',
    "rewardAmount" TEXT NOT NULL DEFAULT '0',
    CONSTRAINT "user_answers_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "questions" ("quizId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "questions_quizId_key" ON "questions"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "merkle_batches_batchId_key" ON "merkle_batches"("batchId");
