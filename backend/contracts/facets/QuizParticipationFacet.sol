// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibQuizStorage} from "../libraries/LibQuizStorage.sol";
import {IERC173} from "../interfaces/IERC173.sol";
import {Quiz, Question} from "../QuizTypes.sol"; // Import the shared structs
// ไม่ต้อง import "hardhat/console.sol"; ในไฟล์นี้เมื่อ deploy ไป Testnet

// Interface สำหรับ Ownership (จำเป็นสำหรับ onlyOwner)
interface IOwnership {
    function owner() external view returns (address contractOwner);
}

// --- Events สำหรับ QuizParticipation ---
event QuizJoined(uint256 indexed quizId, address indexed player);
// *** แก้ไข: เพิ่ม uint256 newScore เข้าไปใน Event ***
event AnswerSubmitted(uint256 indexed quizId, address indexed player, uint256 questionIndex, uint8 chosenAnswerIndex, uint256 newScore);
event QuizCompleted(uint256 indexed quizId, address indexed player, uint256 finalScore);


// --- QuizParticipationFacet Contract ---
contract QuizParticipationFacet {
    function _diamondStorage() internal pure returns (LibDiamond.DiamondStorage storage ds) {
        ds = LibDiamond.diamondStorage();
    }

    function _quizStorage() internal pure returns (LibQuizStorage.QuizStorage storage qs) {
        qs = LibQuizStorage.quizStorage();
    }

    // Modifier เพื่อตรวจสอบว่าผู้เรียกเป็นเจ้าของ Diamond หรือไม่ (หากจำเป็น)
    modifier onlyOwner() {
        require(IOwnership(address(this)).owner() == msg.sender, "QuizParticipationFacet: Must be owner");
        _;
    }

    /// @notice ผู้เล่นเข้าร่วม Quiz
    /// @param _quizId ID ของ Quiz ที่ต้องการเข้าร่วม
    function joinQuiz(uint256 _quizId) external {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        LibQuizStorage.PlayerParticipation storage playerParticipation = qs.quizParticipations[_quizId][msg.sender];

        // ตรวจสอบว่า Quiz มีอยู่จริงและกำลังใช้งานอยู่
        require(qs.quizzes[_quizId].creator != address(0), "QuizParticipationFacet: Quiz does not exist");
        require(qs.quizzes[_quizId].isActive, "QuizParticipationFacet: Quiz is not active");

        // ตรวจสอบว่าผู้เล่นยังไม่ได้เข้าร่วม
        require(!playerParticipation.hasJoined, "QuizParticipationFacet: Already joined this quiz");

        // ตรวจสอบจำนวนผู้เข้าร่วมสูงสุด
        require(qs.quizPlayers[_quizId].length < qs.quizzes[_quizId].maxParticipants, "QuizParticipationFacet: Max participants reached");

        // อัปเดตสถานะการเข้าร่วม
        playerParticipation.hasJoined = true;
        playerParticipation.score = 0;
        playerParticipation.lastAnsweredQuestionIndex = type(uint256).max; // ตั้งค่าเริ่มต้นให้ไม่เคยตอบคำถามใดๆ

        // เพิ่มผู้เล่นเข้าในรายการผู้เข้าร่วมของ Quiz นั้น
        qs.quizPlayers[_quizId].push(msg.sender);

        emit QuizJoined(_quizId, msg.sender);
    }

    /// @notice ผู้เล่นส่งคำตอบสำหรับคำถามใน Quiz
    /// @param _quizId ID ของ Quiz
    /// @param _questionIndex ดัชนีของคำถามที่ตอบ
    /// @param _chosenAnswerIndex ดัชนีของคำตอบที่ผู้เล่นเลือก
    function submitAnswer(uint256 _quizId, uint256 _questionIndex, uint8 _chosenAnswerIndex) external {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        LibQuizStorage.PlayerParticipation storage playerParticipation = qs.quizParticipations[_quizId][msg.sender];

        // ตรวจสอบว่าผู้เล่นเข้าร่วม Quiz นี้แล้ว
        require(playerParticipation.hasJoined, "QuizParticipationFacet: Must join quiz first");

        // ตรวจสอบว่า Quiz มีอยู่จริงและกำลังใช้งานอยู่
        require(qs.quizzes[_quizId].creator != address(0), "QuizParticipationFacet: Quiz does not exist");
        require(qs.quizzes[_quizId].isActive, "QuizParticipationFacet: Quiz is not active");

        // ตรวจสอบว่าคำถามมีอยู่จริง
        require(_questionIndex < qs.quizzes[_quizId].totalQuestions, "QuizParticipationFacet: Invalid question index");

        // ตรวจสอบว่าผู้เล่นยังไม่เคยตอบคำถามนี้
        require(!playerParticipation.hasAnswered[_questionIndex], "QuizParticipationFacet: Question already answered");

        // ตรวจสอบว่าคำตอบที่เลือกถูกต้องตามตัวเลือก
        Question storage question = qs.quizQuestions[_quizId][_questionIndex];
        require(_chosenAnswerIndex < question.options.length, "QuizParticipationFacet: Invalid answer option");

        // Optional: Enforce answering questions in order. Uncomment if desired.
        // require(playerParticipation.lastAnsweredQuestionIndex == type(uint256).max || _questionIndex == playerParticipation.lastAnsweredQuestionIndex + 1, "QuizParticipationFacet: Answer questions in order");

        // บันทึกคำตอบ
        playerParticipation.playerAnswers[_questionIndex] = _chosenAnswerIndex;
        playerParticipation.hasAnswered[_questionIndex] = true;
        playerParticipation.lastAnsweredQuestionIndex = _questionIndex;

        // ตรวจสอบคำตอบและเพิ่มคะแนน
        if (_chosenAnswerIndex == question.correctAnswerIndex) {
            playerParticipation.score += qs.quizzes[_quizId].rewardAmount;
        }

        // *** แก้ไข: เพิ่ม playerParticipation.score เข้าไปใน emit ***
        emit AnswerSubmitted(_quizId, msg.sender, _questionIndex, _chosenAnswerIndex, playerParticipation.score);

        // ตรวจสอบว่าผู้เล่นตอบคำถามครบทุกข้อแล้วหรือไม่
        if (playerParticipation.lastAnsweredQuestionIndex == qs.quizzes[_quizId].totalQuestions - 1) {
            emit QuizCompleted(_quizId, msg.sender, playerParticipation.score);
        }
    }

    /// @notice Retrieves a player's participation status in a quiz.
    /// @param _quizId ID of the quiz.
    /// @param _player Address of the player.
    /// @return hasJoined True if the player has joined, false otherwise.
    /// @return score The player's current score.
    /// @return lastAnsweredQuestionIndex The index of the last question answered by the player.
    function getQuizParticipationStatus(uint256 _quizId, address _player)
        external view
        returns (bool hasJoined, uint256 score, uint256 lastAnsweredQuestionIndex)
    {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        LibQuizStorage.PlayerParticipation storage playerParticipation = qs.quizParticipations[_quizId][_player];

        // Check if the quiz exists.
        require(qs.quizzes[_quizId].creator != address(0), "QuizParticipationFacet: Quiz does not exist");

        return (
            playerParticipation.hasJoined,
            playerParticipation.score,
            playerParticipation.lastAnsweredQuestionIndex
        );
    }

    /// @notice Retrieves a player's score in a quiz.
    /// @param _quizId ID of the quiz.
    /// @param _player Address of the player.
    /// @return score The player's score.
    function getPlayerScore(uint256 _quizId, address _player) external view returns (uint256 score) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        LibQuizStorage.PlayerParticipation storage playerParticipation = qs.quizParticipations[_quizId][_player];

        // Check if the quiz exists.
        require(qs.quizzes[_quizId].creator != address(0), "QuizParticipationFacet: Quiz does not exist");
        
        return playerParticipation.score;
    }
}