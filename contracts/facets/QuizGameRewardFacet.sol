// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import เพื่อเข้าถึง AppStorage, Enums/Structs และ AccessControl
import { LibAppStorage, QuestionMode, Question } from '../libraries/LibAppStorage.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '../interfaces/IPoolManager.sol';
import '../interfaces/IQuizGameEvents.sol';

// Facet สำหรับ Logic การคำนวณรางวัลและการแจกจ่าย
contract QuizGameRewardFacet is IQuizGameEvents {
    // ใช้ LibAppStorage.s() เพื่อเข้าถึง state ของ Diamond

    function distributeRewards(uint256 _questionId) public {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        
        require(
            AccessControlUpgradeable(address(this)).hasRole(ds.REWARD_DISTRIBUTOR_ROLE, msg.sender),
            "AccessControl: Caller is not a reward distributor"
        );

        Question storage question = ds.questions[_questionId];

        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");
        require(question.mode == QuestionMode.Pool, "Quiz: Reward distribution is only for Pool mode questions.");

        require(block.timestamp >= question.firstCorrectAnswerTime + ds.BLOCK_DURATION_SECONDS, "Quiz: Pool window is not over yet.");
        require(question.poolCorrectSolvers.length > 0, "Quiz: No one answered correctly in Pool mode window.");

        // เรียกใช้ _calculateCurrentReward จาก LibAppStorage โดยตรง
        uint256 totalFinalReward = LibAppStorage._calculateCurrentReward(ds, question.baseRewardAmount, question.difficultyLevel);

        // คำนวณค่าธรรมเนียม 0.5%
        uint256 treasuryFee = (totalFinalReward * ds.TREASURY_FEE_PERCENTAGE) / 10000; // 0.5% = 50 / 10000
        uint256 rewardForPoolSolvers = totalFinalReward - treasuryFee;

        // Mint ค่าธรรมเนียมไปที่ Treasury (Diamond Contract)
        ds.poolManager.mintAndTransferToTreasury(treasuryFee);

        // คำนวณรางวัลต่อผู้แก้ไข (เฉลี่ยเท่ากัน)
        // ตรวจสอบไม่ให้หารด้วยศูนย์
        uint256 rewardPerSolver = 0;
        if (question.poolCorrectSolvers.length > 0) {
            rewardPerSolver = rewardForPoolSolvers / question.poolCorrectSolvers.length;
        }

        question.isClosed = true;

        for (uint256 i = 0; i < question.poolCorrectSolvers.length; i++) {
            address solver = question.poolCorrectSolvers[i];
            ds.poolManager.withdrawForUser(solver, rewardPerSolver);
            emit RewardDistributed(_questionId, solver, rewardPerSolver);
        }

        // ลบ array poolCorrectSolvers หลังแจกรางวัล
        delete question.poolCorrectSolvers;

        emit QuestionClosed(_questionId);
    }
}