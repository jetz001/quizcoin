// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, QuestionMode, Question } from '../libraries/LibAppStorage.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizGameEvents.sol';
import '../interfaces/IQuizCoin.sol'; // Import IQuizCoin

// Facet สำหรับ Logic การสร้างคำถามและการส่งคำตอบ
contract QuizGameModeFacet is IQuizGameEvents {
    // ใช้ LibAppStorage.s() เพื่อเข้าถึง state ของ Diamond

    function createQuestion(
        bytes32 _correctAnswerHash,
        bytes32 _hintHash,
        uint256 _difficultyLevel,
        QuestionMode _mode
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
            // คำนวณ baseReward สำหรับระดับ 1-99
            calculatedBaseReward = (ds.BASE_REWARD_FOR_LEVEL_99 * _difficultyLevel) / 99;
        }

        Question storage newQuestion = ds.questions[questionId];
        newQuestion.correctAnswerHash = _correctAnswerHash;
        newQuestion.hintHash = _hintHash;
        newQuestion.questionCreator = msg.sender;
        newQuestion.difficultyLevel = _difficultyLevel;
        newQuestion.baseRewardAmount = calculatedBaseReward;
        newQuestion.isClosed = false;
        newQuestion.mode = _mode;
        newQuestion.blockCreationTime = block.timestamp;
        newQuestion.firstCorrectAnswerTime = 0;
        newQuestion.firstSolverAddress = address(0);
        newQuestion.poolCorrectSolvers = new address[](0);

        emit QuestionCreated(questionId, msg.sender, _difficultyLevel, calculatedBaseReward);
    }

    function submitAnswer(uint256 _questionId, bytes32 _submittedAnswerHash) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();

        Question storage question = ds.questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");
        require(_submittedAnswerHash == question.correctAnswerHash, "Quiz: Incorrect answer.");

        uint256 currentDayId = block.timestamp / (24 * 60 * 60); // คำนวณวันปัจจุบัน (Unix epoch day)

        // ตรวจสอบโหมดเกมรายวัน
        if (ds.lastPlayedDay[msg.sender] != currentDayId) {
            // ถ้าวันนี้ยังไม่เคยเล่น หรือเล่นคนละวันแล้ว
            ds.lastPlayedDay[msg.sender] = currentDayId;
            ds.playerModeChoice[msg.sender] = question.mode;
        } else {
            // ถ้าเคยเล่นวันนี้แล้ว ต้องเล่นโหมดเดิมเท่านั้น
            require(ds.playerModeChoice[msg.sender] == question.mode, "Quiz: You have already chosen a different game mode for today.");
        }

        // ตรวจสอบว่าผู้ใช้ตอบคำถามนี้ไปแล้วในวันนี้หรือไม่
        require(question.lastAnswerDay[msg.sender] != currentDayId, "Quiz: You can only answer this specific question once per day.");
        question.lastAnswerDay[msg.sender] = currentDayId;

        emit AnswerSubmitted(_questionId, msg.sender, _submittedAnswerHash);

        if (question.mode == QuestionMode.Solo) {
            require(question.firstSolverAddress == address(0), "Quiz: Solo mode already solved.");

            question.firstSolverAddress = msg.sender;
            question.isClosed = true;

            // เรียกใช้ _calculateCurrentReward จาก LibAppStorage โดยตรง
            uint256 totalReward = LibAppStorage._calculateCurrentReward(ds, question.baseRewardAmount, question.difficultyLevel);
            
            // คำนวณค่าธรรมเนียม 0.5%
            uint256 treasuryFee = (totalReward * ds.TREASURY_FEE_PERCENTAGE) / 10000; // 0.5% = 50 / 10000
            uint256 rewardForSoloSolver = totalReward - treasuryFee;

            // Mint ค่าธรรมเนียมไปที่ Treasury (Diamond Contract)
            ds.poolManager.mintAndTransferToTreasury(treasuryFee);

            // Mint รางวัลให้ผู้เล่นผ่าน PoolManager
            ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver);

            emit RewardDistributed(_questionId, msg.sender, rewardForSoloSolver);
            emit QuestionClosed(_questionId);

        } else if (question.mode == QuestionMode.Pool) {
            if (question.firstCorrectAnswerTime == 0) {
                // ถ้าเป็นผู้ตอบถูกคนแรกในโหมด Pool ให้เริ่มจับเวลา Reward Window
                question.firstCorrectAnswerTime = block.timestamp;
                emit QuestionRewardWindowStarted(_questionId, block.timestamp);
            }

            // ต้องตอบถูกภายใน Reward Window
            require(block.timestamp <= question.firstCorrectAnswerTime + ds.BLOCK_DURATION_SECONDS, "Quiz: Pool reward window is closed.");

            // ตรวจสอบว่าผู้เล่นนี้อยู่ใน Pool แล้วหรือไม่
            bool alreadyInPool = false;
            for (uint256 i = 0; i < question.poolCorrectSolvers.length; i++) {
                if (question.poolCorrectSolvers[i] == msg.sender) {
                    alreadyInPool = true;
                    break;
                }
            }
            // ถ้ายังไม่อยู่ใน Pool ให้เพิ่มเข้ามา
            if (!alreadyInPool) {
                question.poolCorrectSolvers.push(msg.sender);
            }
        }
    }

    // ฟังก์ชันซื้อ Hint (ต้องใช้ QuizCoin)
    function buyHint(uint256 _questionId) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        
        Question storage question = ds.questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");

        // หักค่าใช้จ่าย Hint จากผู้เล่นและโอนเข้า Diamond Contract (Treasury) โดยตรง
        // ผู้เล่นต้อง approve ให้ Diamond Contract สามารถใช้ QuizCoin ได้ก่อน
        require(ds.quizCoin.transferFrom(msg.sender, address(this), ds.HINT_COST_AMOUNT), "Quiz: QuizCoin transfer failed for hint.");

        emit HintPurchased(_questionId, msg.sender, ds.HINT_COST_AMOUNT);
    }
}