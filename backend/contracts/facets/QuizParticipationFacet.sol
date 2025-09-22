// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import { IQuizGameEvents } from '../interfaces/IQuizGameEvents.sol';
import { Question, Quiz } from '../QuizTypes.sol';
import { IMerkleFacet } from "../interfaces/IMerkleFacet.sol";

/**
 * @title QuizParticipationFacet
 * @dev Facet ที่จัดการ Logic การเข้าร่วมเกมควิซ
 */
contract QuizParticipationFacet is IQuizGameEvents {

    function _appStorage() internal pure returns (LibAppStorage.AppStorage storage ds) {
        ds = LibAppStorage.s();
    }

    modifier onlyCreator(uint256 _quizId) {
        LibAppStorage.AppStorage storage ds = _appStorage();
        require(
            ds.quizzes[_quizId].creator == msg.sender,
            "AccessControl: Caller is not the quiz creator"
        );
        _;
    }

    /// @notice ผู้เล่นเข้าร่วมเกมควิซ
    function joinQuiz(uint256 _quizId) public {
        LibAppStorage.AppStorage storage ds = _appStorage();
        Quiz storage quiz = ds.quizzes[_quizId];

        require(quiz.isActive, "Quiz: Quiz is not active.");
        require(ds.quizParticipations[_quizId][msg.sender].hasJoined == false, "Quiz: You have already joined this quiz.");
        require(ds.quizPlayers[_quizId].length < quiz.maxParticipants, "Quiz: The quiz is full.");

        ds.quizParticipations[_quizId][msg.sender].hasJoined = true;
        ds.quizPlayers[_quizId].push(msg.sender);

        emit PlayerJoinedQuiz(msg.sender, _quizId);
    }

    /// @notice ผู้เล่นส่งคำตอบสำหรับคำถามในเกมควิซ
    function submitQuizAnswer(
        uint256 _quizId,
        uint256 _questionIndex,
        uint8 _submittedAnswerIndex,
        bytes32 leaf,
        bytes32[] calldata proof
    ) public {
        LibAppStorage.AppStorage storage ds = _appStorage();
        LibAppStorage.PlayerParticipation storage player = ds.quizParticipations[_quizId][msg.sender];
        Quiz storage quiz = ds.quizzes[_quizId];

        require(player.hasJoined, "Quiz: You must join the quiz first.");
        require(quiz.isActive, "Quiz: Quiz is not active.");
        require(_questionIndex < quiz.totalQuestions, "Quiz: Question index out of bounds.");
        require(player.lastAnsweredQuestionIndex < _questionIndex, "Quiz: You have already answered a higher or equal index question.");

        // ✅ Verify ผ่าน MerkleFacet
        bool verified = IMerkleFacet(address(this)).verifyQuiz(_quizId, leaf, proof);

        require(verified, "Quiz: Invalid answer proof.");

        player.lastAnsweredQuestionIndex = _questionIndex;
        player.playerAnswers[_questionIndex] = _submittedAnswerIndex;
        player.hasAnswered[_questionIndex] = true;
        player.score++;

        emit QuizAnswerSubmitted(msg.sender, _quizId, _questionIndex, _submittedAnswerIndex, true);
    }
}
