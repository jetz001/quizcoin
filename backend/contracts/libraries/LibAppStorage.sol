// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizCoin.sol';
import '../QuizTypes.sol';

library LibAppStorage {
    bytes32 constant APP_STORAGE_POSITION = keccak256("app.storage.quizgame");

    // เพิ่ม enum QuestionMode กลับเข้ามา
    enum QuestionMode { Solo, Pool }

    struct PlayerParticipation {
        bool hasJoined;
        uint256 score;
        uint256 lastAnsweredQuestionIndex;
        mapping(uint256 => uint8) playerAnswers;
        mapping(uint256 => bool) hasAnswered;
    }

    struct AppStorage {
        bytes32 DEFAULT_ADMIN_ROLE;
        bytes32 REWARD_DISTRIBUTOR_ROLE;
        bytes32 CREATOR_ROLE;
        
        uint256 HINT_COST_AMOUNT;
        uint256 POOL_REWARD_WINDOW_DURATION_SECONDS;
        uint256 LEVEL_100_QUESTION_VALIDITY_SECONDS;
        uint256 REWARD_FOR_LEVEL_1_99;
        uint256 REWARD_FOR_LEVEL_100;
        uint256 HALVING_PERIOD_SECONDS;
        uint256 MIN_REWARD_AFTER_HALVING;
        uint256 TREASURY_FEE_PERCENTAGE;
        uint256 GAME_START_TIMESTAMP;
        uint256 nextQuestionId;

        mapping(address => uint256) lastPlayedDay;
        mapping(address => QuestionMode) playerModeChoice;
        mapping(uint256 => Question) questions;

        mapping(uint256 => Quiz) quizzes;
        mapping(uint256 => mapping(address => PlayerParticipation)) quizParticipations;
        mapping(uint256 => address[]) quizPlayers;
        
        IPoolManager poolManager;
        IQuizCoin quizCoin;
    }

    function s() internal pure returns (AppStorage storage ds) {
        bytes32 position = APP_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
