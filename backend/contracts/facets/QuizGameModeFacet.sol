// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import { IPoolManager } from '../interfaces/IPoolManager.sol';
import { IQuizGameEvents } from '../interfaces/IQuizGameEvents.sol';
import { IQuizCoin } from '../interfaces/IQuizCoin.sol';
import { IQuizGameReward } from '../interfaces/IQuizGameReward.sol';
import { Question } from '../QuizTypes.sol';
import { IMerkleFacet } from "../interfaces/IMerkleFacet.sol";

contract QuizGameModeFacet is IQuizGameEvents {

    function _appStorage() internal pure returns (LibAppStorage.AppStorage storage ds) {
        ds = LibAppStorage.s();
    }

    modifier onlyAdmin() {
        LibAppStorage.AppStorage storage ds = _appStorage();
        require(
            AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender),
            "AccessControl: Caller is not a game admin"
        );
        _;
    }

    modifier onlyAdminOrDistributor() {
        LibAppStorage.AppStorage storage ds = _appStorage();
        require(
            AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender) ||
            AccessControlUpgradeable(address(this)).hasRole(ds.REWARD_DISTRIBUTOR_ROLE, msg.sender),
            "AccessControl: Caller is not an admin or reward distributor"
        );
        _;
    }

    /// @notice สร้างคำถามใหม่และบันทึกข้อมูลบน Smart Contract
    function createQuestion(
        bytes32 _answerLeaf, // leaf ของคำตอบที่จะไปอยู่ใน Merkle Tree
        bytes32 _hintHash,
        uint256 _difficultyLevel,
        LibAppStorage.QuestionMode _mode
    ) public onlyAdmin {
        LibAppStorage.AppStorage storage ds = _appStorage();

        require(_answerLeaf != bytes32(0), "Quiz: Answer leaf cannot be zero");
        require(_difficultyLevel >= 1 && _difficultyLevel <= 100, "Quiz: Difficulty must be 1-100");

        uint256 questionId = ds.nextQuestionId;
        ds.nextQuestionId++;

        uint256 calculatedBaseReward;
        if (_difficultyLevel == 100) {
            calculatedBaseReward = ds.REWARD_FOR_LEVEL_100;
        } else {
            calculatedBaseReward = (ds.REWARD_FOR_LEVEL_1_99 * _difficultyLevel) / 99;
        }

        Question storage newQuestion = ds.questions[questionId];
        newQuestion.correctAnswerHash = _answerLeaf; // เก็บ leaf ที่ backend สร้าง
        newQuestion.hintHash = _hintHash;
        newQuestion.questionCreator = msg.sender;
        newQuestion.difficultyLevel = _difficultyLevel;
        newQuestion.baseRewardAmount = calculatedBaseReward;
        newQuestion.isClosed = false;
        newQuestion.mode = _mode;
        newQuestion.blockCreationTime = block.timestamp;
        newQuestion.firstCorrectAnswerTime = 0;
        newQuestion.firstSolverAddress = address(0);
        newQuestion.poolCorrectSolvers = new address [](0);

        emit QuestionCreated(questionId, msg.sender, _difficultyLevel, calculatedBaseReward);
    }

    /// @notice 🚪 NEW: ผู้เล่นส่งคำตอบ + Merkle proof (Leaf-Level Door System)
    function submitAnswer(
        uint256 _questionId,
        bytes32 _answerLeaf,
        bytes32[] calldata _merkleProof
    ) public {
        LibAppStorage.AppStorage storage ds = _appStorage();
        Question storage question = ds.questions[_questionId];

        // Basic validations
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        
        // 🚪 NEW: Check individual leaf door instead of main door
        require(!ds.leafSolved[_answerLeaf], "Quiz: This specific quiz already solved.");

        // Level 100 expiry check
        if (question.difficultyLevel == 100) {
            require(block.timestamp <= question.blockCreationTime + ds.LEVEL_100_QUESTION_VALIDITY_SECONDS,
                "Quiz: Level 100 expired.");
        }

        // ✅ Verify with Merkle proof
        bool isCorrect = IMerkleFacet(address(this)).verifyQuiz(_questionId, _answerLeaf, _merkleProof);
        require(isCorrect, "Quiz: Wrong answer or invalid proof");

        // Daily play restrictions (keep existing logic)
        uint256 currentDayId = block.timestamp / (24 * 60 * 60);
        if (ds.lastPlayedDay[msg.sender] != currentDayId) {
            ds.lastPlayedDay[msg.sender] = currentDayId;
            ds.playerModeChoice[msg.sender] = question.mode;
        } else {
            require(ds.playerModeChoice[msg.sender] == question.mode,
                "Quiz: Already chosen different mode today.");
        }

        // 🚪 REMOVED: Daily limit - now using leaf-level doors only
        // Each leaf can only be solved once, enabling true concurrent gameplay

        // 🚪 NEW: Close THIS leaf's door only
        ds.leafSolved[_answerLeaf] = true;
        ds.leafSolver[_answerLeaf] = msg.sender;
        ds.leafSolveTime[_answerLeaf] = block.timestamp;
        ds.leafQuestionId[_answerLeaf] = _questionId;

        // Calculate and distribute reward for this specific leaf
        uint256 totalReward = IQuizGameReward(address(this)).calculateCurrentReward(question.difficultyLevel);
        uint256 treasuryFee = (totalReward * ds.TREASURY_FEE_PERCENTAGE) / 10000;
        uint256 rewardForSolver = totalReward - treasuryFee;

        ds.poolManager.mintAndTransferToTreasury(treasuryFee);
        ds.poolManager.withdrawForUser(msg.sender, rewardForSolver);

        // Emit new leaf-specific events
        emit LeafSolved(_questionId, _answerLeaf, msg.sender, rewardForSolver);
        emit AnswerSubmitted(_questionId, msg.sender, _answerLeaf, isCorrect);
    }
        function buyHint(uint256 _questionId) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        
        Question storage question = ds.questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");

        if (question.difficultyLevel == 100) {
            require(block.timestamp <= question.blockCreationTime + ds.LEVEL_100_QUESTION_VALIDITY_SECONDS, "Quiz: Level 100 question has expired, cannot buy hint.");
        }

        require(ds.quizCoin.transferFrom(msg.sender, address(this), ds.HINT_COST_AMOUNT), "Quiz: QuizCoin transfer failed for hint.");

        emit HintPurchased(_questionId, msg.sender, ds.HINT_COST_AMOUNT);
    }

    // --- เพิ่มฟังก์ชันสำหรับ Question Bank ---
    function activateQuestionFromBank(uint256 _questionId) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        require(
            AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender) ||
            AccessControlUpgradeable(address(this)).hasRole(ds.CREATOR_ROLE, msg.sender),
            "AccessControl: Caller is not a game admin or creator"
        );

        Question storage question = ds.questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist in bank.");
        
        // Reset สถานะคำถามเพื่อเปิดใช้งานใหม่
        question.isClosed = false;
        question.firstCorrectAnswerTime = 0;
        question.firstSolverAddress = address(0);
        // เคลียร์ Pool Solvers หากมี (สำหรับ Pool Mode)
        question.poolCorrectSolvers = new address[](0);
        // blockCreationTime และ mode ไม่ได้รีเซ็ต เพราะเป็นส่วนหนึ่งของคำถามที่ถูกสร้างขึ้นมาแล้ว
        // lastAnswerDay (mapping) จะถูกรีเซ็ตโดยอัตโนมัติเมื่อผู้เล่นตอบในวันใหม่

        emit QuestionActivatedFromBank(_questionId, msg.sender);
    }

    // 🚪 NEW: Leaf Management Functions
    
    /// @notice Register a leaf as belonging to a question (for tracking)
    function registerLeaf(uint256 _questionId, bytes32 _answerLeaf) public onlyAdmin {
        LibAppStorage.AppStorage storage ds = _appStorage();
        require(ds.questions[_questionId].correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        
        ds.leafQuestionId[_answerLeaf] = _questionId;
        emit LeafRegistered(_questionId, _answerLeaf);
    }

    /// @notice Check if a specific leaf (quiz) is solved
    function isLeafSolved(bytes32 _answerLeaf) public view returns (bool) {
        return LibAppStorage.s().leafSolved[_answerLeaf];
    }

    /// @notice Get who solved a specific leaf
    function getLeafSolver(bytes32 _answerLeaf) public view returns (address) {
        return LibAppStorage.s().leafSolver[_answerLeaf];
    }

    /// @notice Get when a leaf was solved
    function getLeafSolveTime(bytes32 _answerLeaf) public view returns (uint256) {
        return LibAppStorage.s().leafSolveTime[_answerLeaf];
    }

    /// @notice Get which question a leaf belongs to
    function getLeafQuestionId(bytes32 _answerLeaf) public view returns (uint256) {
        return LibAppStorage.s().leafQuestionId[_answerLeaf];
    }

    /// @notice Admin function to reset a leaf (reopen a quiz)
    function resetLeaf(bytes32 _answerLeaf) public onlyAdmin {
        LibAppStorage.AppStorage storage ds = _appStorage();
        ds.leafSolved[_answerLeaf] = false;
        ds.leafSolver[_answerLeaf] = address(0);
        ds.leafSolveTime[_answerLeaf] = 0;
        // Keep leafQuestionId for tracking
    }
}
