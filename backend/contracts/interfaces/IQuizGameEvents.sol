// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';

interface IQuizGameEvents {
    event QuestionCreated(uint256 indexed questionId, address indexed creator, uint256 difficultyLevel, uint256 baseRewardAmount);
    event AnswerSubmitted(uint256 indexed questionId, address indexed solver, bytes32 submittedAnswerHash, bool isCorrect);
    event HintPurchased(uint256 indexed questionId, address indexed buyer, uint256 cost);
    event RewardDistributed(uint256 indexed questionId, address indexed solver, uint256 rewardAmount);
    event QuestionClosed(uint256 indexed questionId);
    event QuestionRewardWindowStarted(uint256 indexed questionId, uint256 startTime);
    event QuestionActivatedFromBank(uint256 indexed questionId, address indexed activator);
    event PlayerJoinedQuiz(address indexed player, uint256 indexed quizId);
    event QuizAnswerSubmitted(address indexed player, uint256 indexed quizId, uint256 indexed questionIndex, uint8 submittedAnswerIndex, bool isCorrect);
    event QuizCreated(address indexed creator, uint256 indexed quizId, uint256 rewardAmount, uint256 totalQuestions);
    
    // 🚪 Leaf-Level Door System Events
    event LeafSolved(uint256 indexed questionId, bytes32 indexed answerLeaf, address indexed solver, uint256 rewardAmount);
    event LeafRegistered(uint256 indexed questionId, bytes32 indexed answerLeaf);
}
