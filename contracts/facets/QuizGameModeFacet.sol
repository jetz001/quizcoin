// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizGameEvents.sol';
import '../interfaces/IQuizCoin.sol';

contract QuizGameModeFacet is IQuizGameEvents {
    function createQuestion(
        bytes32 _correctAnswerHash,
        bytes32 _hintHash,
        uint256 _difficultyLevel,
        LibAppStorage.QuestionMode _mode,
        LibAppStorage.QuestionCategory _category
    ) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        require(
            AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender),
            "AccessControl: Caller is not a game admin"
        );

        require(_correctAnswerHash != bytes32(0), "Quiz: Correct answer hash cannot be zero");
        require(_difficultyLevel >= 1 && _difficultyLevel <= 100, "Quiz: Difficulty level must be between 1 and 100");

        uint256 questionId = ds.nextQuestionId;
        ds.nextQuestionId++;

        uint256 calculatedBaseReward;
        if (_difficultyLevel == 100) {
            calculatedBaseReward = ds.REWARD_FOR_LEVEL_100;
        } else {
            calculatedBaseReward = (ds.BASE_REWARD_FOR_LEVEL_99 * _difficultyLevel) / 99;
        }

        LibAppStorage.Question storage newQuestion = ds.questions[questionId];
        newQuestion.correctAnswerHash = _correctAnswerHash;
        newQuestion.hintHash = _hintHash;
        newQuestion.questionCreator = msg.sender;
        newQuestion.difficultyLevel = _difficultyLevel;
        newQuestion.baseRewardAmount = calculatedBaseReward;
        newQuestion.isClosed = false;
        newQuestion.mode = _mode;
        newQuestion.category = _category;
        newQuestion.blockCreationTime = block.timestamp;
        newQuestion.firstCorrectAnswerTime = 0;
        newQuestion.firstSolverAddress = address(0);
        newQuestion.poolCorrectSolvers = new address[](0);

        emit QuestionCreated(questionId, msg.sender, _difficultyLevel, calculatedBaseReward);
    }

    function submitAnswer(uint256 _questionId, bytes32 _submittedAnswerHash) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();

        LibAppStorage.Question storage question = ds.questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");
        
        if (question.difficultyLevel == 100) {
            require(block.timestamp <= question.blockCreationTime + ds.LEVEL_100_QUESTION_VALIDITY_SECONDS, "Quiz: Level 100 question has expired.");
        }

        require(_submittedAnswerHash == question.correctAnswerHash, "Quiz: Incorrect answer.");

        uint256 currentDayId = block.timestamp / (24 * 60 * 60);

        if (ds.lastPlayedDay[msg.sender] != currentDayId) {
            ds.lastPlayedDay[msg.sender] = currentDayId;
            ds.playerModeChoice[msg.sender] = question.mode;
        } else {
            require(ds.playerModeChoice[msg.sender] == question.mode, "Quiz: You have already chosen a different game mode for today.");
        }

        require(question.lastAnswerDay[msg.sender] != currentDayId, "Quiz: You can only answer this specific question once per day.");
        question.lastAnswerDay[msg.sender] = currentDayId;

        emit AnswerSubmitted(_questionId, msg.sender, _submittedAnswerHash);

        if (question.mode == LibAppStorage.QuestionMode.Solo) {
            require(question.firstSolverAddress == address(0), "Quiz: Solo mode already solved.");

            question.firstSolverAddress = msg.sender;
            question.isClosed = true;

            uint256 totalReward = LibAppStorage._calculateCurrentReward(ds, question.difficultyLevel);
            
            uint256 treasuryFee = (totalReward * ds.TREASURY_FEE_PERCENTAGE) / 10000;
            uint256 rewardForSoloSolver = totalReward - treasuryFee;

            ds.poolManager.mintAndTransferToTreasury(treasuryFee);

            ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver);

            emit RewardDistributed(_questionId, msg.sender, rewardForSoloSolver);
            emit QuestionClosed(_questionId);

        } else if (question.mode == LibAppStorage.QuestionMode.Pool) {
            if (question.firstCorrectAnswerTime == 0) {
                question.firstCorrectAnswerTime = block.timestamp;
                emit QuestionRewardWindowStarted(_questionId, block.timestamp);
            }

            uint256 duration;
            if (question.difficultyLevel == 100) {
                duration = ds.LEVEL_100_QUESTION_VALIDITY_SECONDS;
            } else {
                duration = ds.POOL_REWARD_WINDOW_DURATION_SECONDS;
            }
            require(block.timestamp <= question.firstCorrectAnswerTime + duration, "Quiz: Pool reward window is closed or Level 100 question expired.");


            bool alreadyInPool = false;
            for (uint256 i = 0; i < question.poolCorrectSolvers.length; i++) {
                if (question.poolCorrectSolvers[i] == msg.sender) {
                    alreadyInPool = true;
                    break;
                }
            }
            if (!alreadyInPool) {
                question.poolCorrectSolvers.push(msg.sender);
            }
        }
    }

    function buyHint(uint256 _questionId) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        
        LibAppStorage.Question storage question = ds.questions[_questionId];
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

        LibAppStorage.Question storage question = ds.questions[_questionId];
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
}