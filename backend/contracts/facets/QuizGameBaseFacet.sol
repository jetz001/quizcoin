// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import Libraries และ Interfaces ที่จำเป็น
import { LibAppStorage } from '../libraries/LibAppStorage.sol'; // สำหรับเข้าถึง AppStorage
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol'; // สำหรับใช้ Role

// Import Interfaces สำหรับสัญญาภายนอก
import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizCoin.sol';
import '../interfaces/IQuizGameEvents.sol'; // เพิ่ม IQuizGameEvents เพื่อให้ Facet นี้สามารถ emit events ได้

// Facet ฐานสำหรับ QuizGame จะเก็บ State (ผ่าน AppStorage) และฟังก์ชันพื้นฐาน
contract QuizGameBaseFacet is IQuizGameEvents { // เพิ่ม implements IQuizGameEvents
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
        ds.POOL_REWARD_WINDOW_DURATION_SECONDS = 180; // 3 นาที สำหรับ Pool Mode
        ds.LEVEL_100_QUESTION_VALIDITY_SECONDS = 24 * 60 * 60; // 1 วัน สำหรับคำถามระดับ 100
        ds.BASE_REWARD_FOR_LEVEL_99 = 5000 * 10**18; // 5000 QuizCoin
        ds.REWARD_FOR_LEVEL_100 = 10000 * 10**18; // 10000 QuizCoin
        ds.HALVING_PERIOD_SECONDS = 4 * 365 * 24 * 60 * 60; // 4 ปี
        ds.MIN_REWARD_AFTER_HALVING = 100 * 10**18; // 100 QuizCoin
        ds.TREASURY_FEE_PERCENTAGE = 50; // 0.5% (50 = 0.5 * 100)

        ds.nextQuestionId = 1; // เริ่มต้น ID คำถามที่ 1
        ds.GAME_START_TIMESTAMP = block.timestamp;

        // ไม่ต้องตั้งค่า poolManager และ quizCoin ที่นี่
        // เพราะจะถูกตั้งค่าผ่าน setPoolManagerAddress และ setQuizCoinAddress
    }

    // --- Admin Functions for setting external contract addresses ---
    // ต้องเรียกโดย DEFAULT_ADMIN_ROLE
    function setPoolManagerAddress(address _newPoolManagerAddress) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        // ใช้ AccessControlUpgradeable(address(this)) เพื่อเรียก hasRole บน Diamond Proxy
        require(AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender), "AccessControl: Caller is not a game admin");
        require(_newPoolManagerAddress != address(0), "Quiz: PoolManager address cannot be zero");
        emit PoolManagerAddressUpdated(address(ds.poolManager), _newPoolManagerAddress);
        ds.poolManager = IPoolManager(_newPoolManagerAddress);
    }

    // ต้องเรียกโดย DEFAULT_ADMIN_ROLE
    function setQuizCoinAddress(address _newQuizCoinAddress) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        // ใช้ AccessControlUpgradeable(address(this)) เพื่อเรียก hasRole บน Diamond Proxy
        require(AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender), "AccessControl: Caller is not a game admin");
        require(_newQuizCoinAddress != address(0), "Quiz: QuizCoin address cannot be zero");
        emit QuizCoinAddressUpdated(address(ds.quizCoin), _newQuizCoinAddress);
        ds.quizCoin = IQuizCoin(_newQuizCoinAddress);
    }

    // --- Public Getters for AppStorage Constants and Addresses ---
    // ฟังก์ชัน Getter สำหรับ PoolManager address
    function getPoolManagerAddress() public view returns (address) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        return address(ds.poolManager);
    }

    // ฟังก์ชัน Getter สำหรับ QuizCoin address
    function getQuizCoinAddress() public view returns (address) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        return address(ds.quizCoin);
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

    // --- Public Getters for AppStorage Constants ---
    function getPoolRewardWindowDuration() public view returns (uint256) {
        return LibAppStorage.s().POOL_REWARD_WINDOW_DURATION_SECONDS;
    }
    function getLevel100QuestionValiditySeconds() public view returns (uint256) {
        return LibAppStorage.s().LEVEL_100_QUESTION_VALIDITY_SECONDS;
    }
    function getBaseRewardForLevel99() public view returns (uint256) {
        return LibAppStorage.s().BASE_REWARD_FOR_LEVEL_99;
    }
    function getRewardForLevel100() public view returns (uint256) {
        return LibAppStorage.s().REWARD_FOR_LEVEL_100;
    }
    function getTreasuryFeePercentage() public view returns (uint256) {
        return LibAppStorage.s().TREASURY_FEE_PERCENTAGE;
    }
    function getHalvingPeriodSeconds() public view returns (uint256) { // เพิ่ม getter สำหรับ HalvingPeriod
        return LibAppStorage.s().HALVING_PERIOD_SECONDS;
    }
    function getMinRewardAfterHalving() public view returns (uint256) { // เพิ่ม getter สำหรับ MinRewardAfterHalving
        return LibAppStorage.s().MIN_REWARD_AFTER_HALVING;
    }
    function getGameStartTimestamp() public view returns (uint256) {
        return LibAppStorage.s().GAME_START_TIMESTAMP;
    }
    function getNextQuestionId() public view returns (uint256) { // เพิ่ม getter สำหรับ nextQuestionId
        return LibAppStorage.s().nextQuestionId;
    }
    // เพิ่ม getter สำหรับ question struct เพื่อให้ test สามารถตรวจสอบสถานะคำถามได้
    function getQuestion(uint256 _questionId) public view returns (
        bytes32 correctAnswerHash,
        bytes32 hintHash,
        address questionCreator,
        uint256 difficultyLevel,
        uint256 baseRewardAmount,
        bool isClosed,
        LibAppStorage.QuestionMode mode,
        LibAppStorage.QuestionCategory category,
        uint256 blockCreationTime,
        uint256 firstCorrectAnswerTime,
        address firstSolverAddress,
        address[] memory poolCorrectSolvers // ต้องใช้ memory สำหรับ array ที่ส่งคืน
    ) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        LibAppStorage.Question storage question = ds.questions[_questionId];
        return (
            question.correctAnswerHash,
            question.hintHash,
            question.questionCreator,
            question.difficultyLevel,
            question.baseRewardAmount,
            question.isClosed,
            question.mode,
            question.category,
            question.blockCreationTime,
            question.firstCorrectAnswerTime,
            question.firstSolverAddress,
            question.poolCorrectSolvers
        );
    }
}
