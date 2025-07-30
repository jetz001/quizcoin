// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizCoin.sol';

library LibAppStorage {
    bytes32 constant APP_STORAGE_POSITION = keccak256("app.storage.quizgame");

    // --- เพิ่ม Enum สำหรับหมวดหมู่คำถาม ---
    enum QuestionCategory {
        None,    // ค่าเริ่มต้น หรือ ไม่ได้ระบุหมวดหมู่
        Math,
        Science,
        General  // สามารถเพิ่มหมวดหมู่อื่นๆ ได้ตามต้องการ
    }

    // Enum สำหรับโหมดคำถาม (มีอยู่แล้ว)
    enum QuestionMode { Solo, Pool }

    // Struct สำหรับเก็บข้อมูลคำถาม
    struct Question {
        bytes32 correctAnswerHash;
        bytes32 hintHash;
        address questionCreator;
        uint256 difficultyLevel;
        uint256 baseRewardAmount;
        bool isClosed;
        QuestionMode mode;
        QuestionCategory category; // *** เพิ่มฟิลด์หมวดหมู่เข้ามาใน Question Struct ***
        uint256 blockCreationTime; // เวลาที่สร้างคำถาม (Unix timestamp)
        uint256 firstCorrectAnswerTime; // เวลาที่ผู้เล่นคนแรกตอบถูก (สำหรับ Pool Mode)
        address firstSolverAddress; // ผู้เล่นคนแรกที่ตอบถูก (สำหรับ Solo Mode)
        address[] poolCorrectSolvers; // รายชื่อผู้เล่นที่ตอบถูกใน Pool Mode
        mapping(address => uint256) lastAnswerDay; // เก็บวันล่าสุดที่แต่ละ address ตอบคำถามนี้ (สำหรับจำกัด 1 คำถาม/วัน)
    }

    // Struct สำหรับ AppStorage
    struct AppStorage {
        bytes32 DEFAULT_ADMIN_ROLE;
        bytes32 REWARD_DISTRIBUTOR_ROLE;
        bytes32 CREATOR_ROLE;

        uint256 HINT_COST_AMOUNT;
        uint256 POOL_REWARD_WINDOW_DURATION_SECONDS;
        uint256 BASE_REWARD_FOR_LEVEL_99;
        uint256 REWARD_FOR_LEVEL_100;
        uint256 HALVING_PERIOD_SECONDS;
        uint256 MIN_REWARD_AFTER_HALVING;
        uint256 TREASURY_FEE_PERCENTAGE;

        uint256 nextQuestionId;
        mapping(uint256 => Question) questions;
        uint256 GAME_START_TIMESTAMP;

        mapping(address => uint256) lastPlayedDay;
        mapping(address => QuestionMode) playerModeChoice;

        IPoolManager poolManager;
        IQuizCoin quizCoin;

        uint256 LEVEL_100_QUESTION_VALIDITY_SECONDS;
    }

    function s() internal pure returns (AppStorage storage ds) {
        bytes32 position = APP_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function _calculateCurrentReward(AppStorage storage ds, uint256 _level) internal view returns (uint256) {
        if (_level == 100) {
            return ds.REWARD_FOR_LEVEL_100;
        }

        require(_level >= 1 && _level <= 99, "LibAppStorage: Invalid question level for halving calculation");

        uint256 currentBaseReward = (ds.BASE_REWARD_FOR_LEVEL_99 * _level) / 99;

        uint256 timeElapsed = block.timestamp - ds.GAME_START_TIMESTAMP;
        uint256 halvingCycles = timeElapsed / ds.HALVING_PERIOD_SECONDS;

        uint256 finalReward = currentBaseReward;
        for (uint256 i = 0; i < halvingCycles; i++) {
            finalReward /= 2;
            if (finalReward < ds.MIN_REWARD_AFTER_HALVING) {
                finalReward = ds.MIN_REWARD_AFTER_HALVING;
                break;
            }
        }
        return finalReward;
    }
}