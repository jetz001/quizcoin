// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import Interfaces
import "../interfaces/IQuizCoin.sol";
import "../interfaces/IPoolManager.sol";

// Library นี้จัดการการจัดเก็บข้อมูล (State) ของ Diamond ทั้งหมด
library LibAppStorage {
    // ตำแหน่งของ AppStorage ใน Storage ของ Diamond Proxy
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.storage.quizgame");

    // โครงสร้าง AppStorage นี้จะเก็บตัวแปรสถานะทั้งหมดของ Diamond QuizGame
    // รวมถึงตัวแปรที่ Facets ทุกตัวจะเข้าถึง
    struct AppStorage {
        // --- Roles Constants ---
        bytes32 DEFAULT_ADMIN_ROLE;
        bytes32 REWARD_DISTRIBUTOR_ROLE;
        bytes32 CREATOR_ROLE;

        // --- State Variables of QuizGame ---
        IQuizCoin quizCoin;
        IPoolManager poolManager;
        uint256 nextQuestionId;
        uint256 GAME_START_TIMESTAMP; // เวลาเริ่มต้นของเกม (Unix timestamp)

        // --- Constants for Game Logic ---
        uint256 HINT_COST_AMOUNT;
        uint256 BLOCK_DURATION_SECONDS;
        uint256 BASE_REWARD_FOR_LEVEL_99;
        uint256 REWARD_FOR_LEVEL_100;
        uint256 TREASURY_FEE_PERCENTAGE; // ค่าธรรมเนียมสำหรับ Treasury (เช่น 50 สำหรับ 0.5%)

        // --- Halving Constants ---
        uint256 HALVING_PERIOD_SECONDS;
        uint256 MIN_REWARD_AFTER_HALVING;

        // --- Mappings and Arrays ---
        mapping(uint256 => Question) questions;
        mapping(address => uint256) lastPlayedDay;
        mapping(address => QuestionMode) playerModeChoice;
    }

    // Helper function เพื่อให้ Facets ทุกตัวเข้าถึง AppStorage ได้ง่าย
    function s() internal pure returns (AppStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    // ฟังก์ชันคำนวณรางวัล
    function _calculateCurrentReward(
        AppStorage storage ds, // รับ ds เข้ามา
        uint256 _baseRewardAmount,
        uint256 _difficultyLevel
    ) public view returns (uint256) {
        if (_difficultyLevel == 100) {
            return _baseRewardAmount;
        }

        uint256 currentTimestamp = block.timestamp;
        uint256 timeElapsed = currentTimestamp - ds.GAME_START_TIMESTAMP;
        uint256 halvingCycles = timeElapsed / ds.HALVING_PERIOD_SECONDS;

        uint256 currentReward = _baseRewardAmount;
        for (uint256 i = 0; i < halvingCycles; i++) {
            currentReward /= 2;
            if (currentReward < ds.MIN_REWARD_AFTER_HALVING) {
                currentReward = ds.MIN_REWARD_AFTER_HALVING;
                break;
            }
        }
        return currentReward;
    }
}

// Structs และ Enums ที่ Facets ต้องการใช้
enum QuestionMode {
    Solo,
    Pool
}

struct Question {
    bytes32 correctAnswerHash;
    bytes32 hintHash;
    address questionCreator;
    uint256 difficultyLevel;
    uint256 baseRewardAmount;
    bool isClosed;
    QuestionMode mode;
    uint256 blockCreationTime;
    uint256 firstCorrectAnswerTime;
    address firstSolverAddress;
    address[] poolCorrectSolvers;
    mapping(address => uint256) lastAnswerDay; // last answered day for this specific question by user
}