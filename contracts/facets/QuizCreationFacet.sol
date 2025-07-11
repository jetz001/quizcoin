// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibQuizStorage} from "../libraries/LibQuizStorage.sol";
import {IERC173} from "../interfaces/IERC173.sol";
import {Quiz, Question} from "../QuizTypes.sol"; // Import the shared structs

// Interface สำหรับ Ownership (จำเป็นสำหรับ onlyOwner)
interface IOwnership {
    function owner() external view returns (address contractOwner);
}

// --- Events สำหรับ QuizCreation ---
event QuizCreated(uint256 indexed quizId, string name, address indexed creator, uint256 rewardAmount);
event QuestionAdded(uint256 indexed quizId, uint256 indexed questionIndex);
event QuizActivated(uint256 indexed quizId);
event QuizDeactivated(uint256 indexed quizId);


// --- QuizCreationFacet Contract ---
contract QuizCreationFacet {
    function _diamondStorage() internal pure returns (LibDiamond.DiamondStorage storage ds) {
        ds = LibDiamond.diamondStorage();
    }

    function _quizStorage() internal pure returns (LibQuizStorage.QuizStorage storage qs) {
        qs = LibQuizStorage.quizStorage();
    }

    // Modifier เพื่อตรวจสอบว่าผู้เรียกเป็นเจ้าของ Diamond หรือไม่
    modifier onlyOwner() {
        require(IOwnership(address(this)).owner() == msg.sender, "QuizCreationFacet: Must be owner");
        _;
    }

    /// @notice สร้าง Quiz ใหม่
    /// @param _name ชื่อของ Quiz
    /// @param _rewardAmount จำนวนรางวัลต่อคำตอบที่ถูกต้อง (ในหน่วย wei)
    /// @param _maxParticipants จำนวนผู้เข้าร่วมสูงสุด
    /// @return quizId ID ของ Quiz ที่สร้างขึ้น
    function createQuiz(string memory _name, uint256 _rewardAmount, uint256 _maxParticipants)
        external
        onlyOwner
        returns (uint256 quizId)
    {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        quizId = qs.nextQuizId;
        qs.quizzes[quizId] = Quiz({
            name: _name, // ใช้ 'name' เพื่อให้ตรงกับ Quiz struct ใน QuizTypes.sol
            creator: msg.sender,
            rewardAmount: _rewardAmount,
            totalQuestions: 0, // เริ่มต้นด้วย 0 คำถาม
            maxParticipants: _maxParticipants,
            isActive: false // เริ่มต้นด้วยสถานะไม่ active
        });
        qs.nextQuizId++; // เพิ่ม ID สำหรับ Quiz ถัดไป

        emit QuizCreated(quizId, _name, msg.sender, _rewardAmount);
        return quizId;
    }

    /// @notice เพิ่มคำถามเข้าไปใน Quiz
    /// @param _quizId ID ของ Quiz ที่ต้องการเพิ่มคำถาม
    /// @param _questionText ข้อความของคำถาม
    /// @param _options ตัวเลือกคำตอบ
    /// @param _correctAnswerIndex ดัชนีของคำตอบที่ถูกต้อง (เริ่มจาก 0)
    function addQuestion(uint256 _quizId, string memory _questionText, string[] memory _options, uint8 _correctAnswerIndex)
        external
        onlyOwner
    {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];

        // ตรวจสอบว่า Quiz มีอยู่จริงและผู้เรียกเป็นเจ้าของ
        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(quiz.creator == msg.sender, "QuizCreationFacet: Must be quiz creator to add questions");
        require(!quiz.isActive, "QuizCreationFacet: Cannot add questions to an active quiz"); // ห้ามเพิ่มคำถามถ้า Quiz Active แล้ว

        // ตรวจสอบว่ามีตัวเลือกอย่างน้อย 2 ตัว
        require(_options.length >= 2, "QuizCreationFacet: Must provide at least two options");
        // ตรวจสอบว่าดัชนีคำตอบที่ถูกต้องอยู่ในช่วงที่ถูกต้อง
        require(_correctAnswerIndex < _options.length, "QuizCreationFacet: Invalid correct answer index");

        uint256 questionIndex = quiz.totalQuestions;
        qs.quizQuestions[_quizId][questionIndex] = Question({
            questionText: _questionText,
            options: _options,
            correctAnswerIndex: _correctAnswerIndex
        });
        quiz.totalQuestions++;

        emit QuestionAdded(_quizId, questionIndex);
    }

    /// @notice เปิดใช้งาน Quiz
    /// @param _quizId ID ของ Quiz ที่ต้องการเปิดใช้งาน
    function activateQuiz(uint256 _quizId) external onlyOwner {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];

        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(quiz.creator == msg.sender, "QuizCreationFacet: Must be quiz creator to activate");
        require(quiz.totalQuestions > 0, "QuizCreationFacet: Cannot activate a quiz with no questions"); // ต้องมีคำถามอย่างน้อย 1 ข้อ
        require(!quiz.isActive, "QuizCreationFacet: Quiz is already active");

        quiz.isActive = true;
        emit QuizActivated(_quizId);
    }

    /// @notice ปิดใช้งาน Quiz
    /// @param _quizId ID ของ Quiz ที่ต้องการปิดใช้งาน
    function deactivateQuiz(uint256 _quizId) external onlyOwner {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];

        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(quiz.creator == msg.sender, "QuizCreationFacet: Must be quiz creator to deactivate");
        require(quiz.isActive, "QuizCreationFacet: Quiz is not active");

        quiz.isActive = false;
        emit QuizDeactivated(_quizId);
    }

    /// @notice ดึงข้อมูล Quiz
    /// @param _quizId ID ของ Quiz
    /// @return Quiz struct
    function getQuiz(uint256 _quizId) external view returns (Quiz memory) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        require(qs.quizzes[_quizId].creator != address(0), "QuizCreationFacet: Quiz does not exist");
        return qs.quizzes[_quizId];
    }

    /// @notice ดึงข้อมูลคำถามเฉพาะเจาะจง
    /// @param _quizId ID ของ Quiz
    /// @param _questionIndex ดัชนีของคำถาม
    /// @return Question struct
    function getQuestion(uint256 _quizId, uint256 _questionIndex) external view returns (Question memory) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        require(qs.quizzes[_quizId].creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(_questionIndex < qs.quizzes[_quizId].totalQuestions, "QuizCreationFacet: Invalid question index");
        return qs.quizQuestions[_quizId][_questionIndex];
    }
    
    /// @notice ดึงจำนวน Quiz ทั้งหมดที่สร้างขึ้น
    /// @return totalQuizzes จำนวน Quiz ทั้งหมด
    function getTotalQuizzes() external view returns (uint256 totalQuizzes) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        return qs.nextQuizId;
    }
}