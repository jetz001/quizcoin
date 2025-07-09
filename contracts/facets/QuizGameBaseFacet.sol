// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import Libraries และ Interfaces ที่จำเป็น
import { LibAppStorage, QuestionMode, Question } from '../libraries/LibAppStorage.sol'; // เข้าถึง AppStorage และ Enums/Structs
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol'; // สำหรับใช้ Role

// Import Interfaces สำหรับสัญญาภายนอก
import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizCoin.sol';

// Facet ฐานสำหรับ QuizGame จะเก็บ State (ผ่าน AppStorage) และฟังก์ชันพื้นฐาน
contract QuizGameBaseFacet {
    // ไม่มี state variables ใน Facet นี้โดยตรง เพราะจะใช้ AppStorage จาก LibAppStorage

    // ฟังก์ชัน initialize สำหรับ QuizGame (จะถูกเรียกครั้งเดียวเมื่อ Diamond ถูก Deploy ครั้งแรก)
    // Facet นี้จะถูก Add เป็นหนึ่งใน Facet แรกๆ และจะถูกเรียก initialize()
    function initializeQuizGame() public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();

        // ตรวจสอบว่าถูก initialize แล้วหรือยัง
        require(ds.GAME_START_TIMESTAMP == 0, "QuizGame: Already initialized");

        // กำหนด Role Constants
        ds.DEFAULT_ADMIN_ROLE = AccessControlUpgradeable(address(this)).DEFAULT_ADMIN_ROLE();
        ds.REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
        ds.CREATOR_ROLE = keccak256("CREATOR_ROLE");

        // กำหนดค่าคงที่และเริ่มต้นตัวแปรเกม
        ds.HINT_COST_AMOUNT = 10 * 10**18; // 10 QuizCoin
        ds.BLOCK_DURATION_SECONDS = 180; // 3 นาที
        ds.BASE_REWARD_FOR_LEVEL_99 = 5000 * 10**18; // 5000 QuizCoin
        ds.REWARD_FOR_LEVEL_100 = 10000 * 10**18; // 10000 QuizCoin
        ds.HALVING_PERIOD_SECONDS = 4 * 365 * 24 * 60 * 60; // 4 ปี
        ds.MIN_REWARD_AFTER_HALVING = 100 * 10**18; // 100 QuizCoin
        ds.TREASURY_FEE_PERCENTAGE = 50; // 0.5% (50 = 0.5 * 100)

        ds.nextQuestionId = 1;
        ds.GAME_START_TIMESTAMP = block.timestamp;
    }

    // --- Events (ประกาศใน Facet นี้ หรือ Facet ที่เกี่ยวข้อง) ---
    event QuestionCreated(uint256 indexed questionId, address indexed creator, uint256 difficulty, uint256 baseReward);
    event HintPurchased(uint256 indexed questionId, address indexed buyer, uint256 cost);
    event AnswerSubmitted(uint256 indexed questionId, address indexed submitter, bytes32 submittedHash);
    event QuestionRewardWindowStarted(uint256 indexed questionId, uint256 windowStartTime);
    event RewardDistributed(uint256 indexed questionId, address indexed recipient, uint256 amount);
    event QuestionClosed(uint256 indexed questionId);
    event PoolManagerAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event QuizCoinAddressUpdated(address indexed oldAddress, address indexed newAddress);

    // --- Admin Functions for setting external contract addresses ---
    function setPoolManagerAddress(address _newPoolManagerAddress) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        require(AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender), "AccessControl: Caller is not a game admin");
        require(_newPoolManagerAddress != address(0), "Quiz: PoolManager address cannot be zero");
        emit PoolManagerAddressUpdated(address(ds.poolManager), _newPoolManagerAddress);
        ds.poolManager = IPoolManager(_newPoolManagerAddress);
    }

    function setQuizCoinAddress(address _newQuizCoinAddress) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        require(AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender), "AccessControl: Caller is not a game admin");
        require(_newQuizCoinAddress != address(0), "Quiz: QuizCoin address cannot be zero");
        emit QuizCoinAddressUpdated(address(ds.quizCoin), _newQuizCoinAddress);
        ds.quizCoin = IQuizCoin(_newQuizCoinAddress);
    }

    // ฟังก์ชัน Getter สำหรับ Role Constants (เพื่อความสะดวกในการเรียกใช้จากภายนอก)
    function DEFAULT_ADMIN_ROLE() public view returns (bytes32) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        return ds.DEFAULT_ADMIN_ROLE;
    }
    function REWARD_DISTRIBUTOR_ROLE() public view returns (bytes32) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        return ds.REWARD_DISTRIBUTOR_ROLE;
    }
    function CREATOR_ROLE() public view returns (bytes32) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        return ds.CREATOR_ROLE;
    }

    // ฟังก์ชันสำหรับตรวจสอบ Role (จาก AccessControl)
    // Facets อื่นๆ จะเรียกใช้ฟังก์ชันนี้เพื่อตรวจสอบ Role
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return AccessControlUpgradeable(address(this)).hasRole(role, account);
    }
}