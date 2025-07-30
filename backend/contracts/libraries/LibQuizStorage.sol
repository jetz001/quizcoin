// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Quiz, Question} from "../QuizTypes.sol"; // Import the shared structs

library LibQuizStorage {
    bytes32 constant QUIZ_STORAGE_POSITION = keccak256("quizcoin.diamond.quiz.storage");

    struct PlayerParticipation {
        bool hasJoined;
        uint256 score;
        mapping(uint256 => uint8) playerAnswers;
        mapping(uint256 => bool) hasAnswered;
        uint256 lastAnsweredQuestionIndex;
    }

    struct QuizStorage {
        uint256 nextQuizId;
        mapping(uint256 => Quiz) quizzes; // Now 'Quiz' is recognized
        mapping(uint256 => mapping(uint256 => Question)) quizQuestions; // Now 'Question' is recognized

        mapping(uint256 => mapping(address => PlayerParticipation)) quizParticipations;
        mapping(uint256 => address[]) quizPlayers;
    }

    function quizStorage() internal pure returns (QuizStorage storage qs) {
        bytes32 position = QUIZ_STORAGE_POSITION;
        assembly {
            qs.slot := position
        }
    }
}