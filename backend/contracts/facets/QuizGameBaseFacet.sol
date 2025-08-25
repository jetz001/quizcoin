// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizCoin.sol';
import '../interfaces/IQuizGameEvents.sol';
import { Question } from '../QuizTypes.sol'; // อ้างอิงถึง Question struct โดยตรง

event PoolManagerAddressUpdated(address oldAddress, address newAddress);
event QuizCoinAddressUpdated(address oldAddress, address newAddress);

contract QuizGameBaseFacet is IQuizGameEvents {
    function initializeQuizGame() public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();

        require(ds.GAME_START_TIMESTAMP == 0, "QuizGame: Already initialized");

        ds.DEFAULT_ADMIN_ROLE = AccessControlUpgradeable(address(this)).DEFAULT_ADMIN_ROLE();
        ds.REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
        ds.CREATOR_ROLE = keccak256("CREATOR_ROLE");

        ds.HINT_COST_AMOUNT = 10 * 10**18;
        ds.POOL_REWARD_WINDOW_DURATION_SECONDS = 180;
        ds.LEVEL_100_QUESTION_VALIDITY_SECONDS = 24 * 60 * 60;
        ds.REWARD_FOR_LEVEL_1_99 = 5000 * 10**18;
        ds.REWARD_FOR_LEVEL_100 = 10000 * 10**18;
        ds.HALVING_PERIOD_SECONDS = 4 * 365 * 24 * 60 * 60;
        ds.MIN_REWARD_AFTER_HALVING = 100 * 10**18;
        ds.TREASURY_FEE_PERCENTAGE = 50;
        ds.nextQuestionId = 1;
        ds.GAME_START_TIMESTAMP = block.timestamp;
    }

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

    // --- Public Getters for AppStorage Constants and Addresses ---
    function getPoolManagerAddress() public view returns (address) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        return address(ds.poolManager);
    }

    function getQuizCoinAddress() public view returns (address) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        return address(ds.quizCoin);
    }

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

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return AccessControlUpgradeable(address(this)).hasRole(role, account);
    }

    function getPoolRewardWindowDuration() public view returns (uint256) {
        return LibAppStorage.s().POOL_REWARD_WINDOW_DURATION_SECONDS;
    }
    function getLevel100QuestionValiditySeconds() public view returns (uint256) {
        return LibAppStorage.s().LEVEL_100_QUESTION_VALIDITY_SECONDS;
    }
    function getBaseRewardForLevel99() public view returns (uint256) {
        return LibAppStorage.s().REWARD_FOR_LEVEL_1_99;
    }
    function getRewardForLevel100() public view returns (uint256) {
        return LibAppStorage.s().REWARD_FOR_LEVEL_100;
    }
    function getTreasuryFeePercentage() public view returns (uint256) {
        return LibAppStorage.s().TREASURY_FEE_PERCENTAGE;
    }
    function getHalvingPeriodSeconds() public view returns (uint256) {
        return LibAppStorage.s().HALVING_PERIOD_SECONDS;
    }
    function getMinRewardAfterHalving() public view returns (uint256) {
        return LibAppStorage.s().MIN_REWARD_AFTER_HALVING;
    }
    function getGameStartTimestamp() public view returns (uint256) {
        return LibAppStorage.s().GAME_START_TIMESTAMP;
    }
    function getNextQuestionId() public view returns (uint256) {
        return LibAppStorage.s().nextQuestionId;
    }
    
    // แก้ไข: ใช้ Question struct ที่นำเข้าโดยตรง
    function getQuestion(uint256 _questionId) public view returns (
        bytes32 correctAnswerHash,
        bytes32 hintHash,
        address questionCreator,
        uint256 difficultyLevel,
        uint256 baseRewardAmount,
        bool isClosed,
        LibAppStorage.QuestionMode mode,
        uint256 blockCreationTime,
        uint256 firstCorrectAnswerTime,
        address firstSolverAddress,
        address[] memory poolCorrectSolvers
    ) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        // แก้ไขบรรทัดนี้: ลบ LibAppStorage. ออก
        Question storage question = ds.questions[_questionId];
        return (
            question.correctAnswerHash,
            question.hintHash,
            question.questionCreator,
            question.difficultyLevel,
            question.baseRewardAmount,
            question.isClosed,
            question.mode,
            question.blockCreationTime,
            question.firstCorrectAnswerTime,
            question.firstSolverAddress,
            question.poolCorrectSolvers
        );
    }
}
