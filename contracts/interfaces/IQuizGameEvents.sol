// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IQuizGameEvents {
    event QuestionCreated(uint256 indexed questionId, address indexed creator, uint256 difficulty, uint256 baseReward);
    event HintPurchased(uint256 indexed questionId, address indexed buyer, uint256 cost);
    event AnswerSubmitted(uint256 indexed questionId, address indexed submitter, bytes32 submittedHash);
    event QuestionRewardWindowStarted(uint256 indexed questionId, uint256 windowStartTime);
    event RewardDistributed(uint256 indexed questionId, address indexed recipient, uint256 amount);
    event QuestionClosed(uint256 indexed questionId);
    event PoolManagerAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event QuizCoinAddressUpdated(address indexed oldAddress, address indexed newAddress);
}