// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibQuizStorage} from "../libraries/LibQuizStorage.sol";
import {IERC173} from "../interfaces/IERC173.sol";
import {Quiz, Question} from "../QuizTypes.sol"; // Import the shared structs

interface IOwnership {
    function owner() external view returns (address contractOwner);
}

event QuizCreated(uint256 indexed quizId, string name, address indexed creator, uint256 rewardAmount);
event QuestionAdded(uint256 indexed quizId, uint256 indexed questionIndex);
event QuizActivated(uint256 indexed quizId);
event QuizDeactivated(uint256 indexed quizId);

contract QuizCreationFacet {
    function _diamondStorage() internal pure returns (LibDiamond.DiamondStorage storage ds) {
        ds = LibDiamond.diamondStorage();
    }

    function _quizStorage() internal pure returns (LibQuizStorage.QuizStorage storage qs) {
        qs = LibQuizStorage.quizStorage();
    }

    modifier onlyOwner() {
        require(IOwnership(address(this)).owner() == msg.sender, "QuizCreationFacet: Must be owner");
        _;
    }

    function createQuiz(
        string memory _name,
        uint256 _rewardAmount,
        uint256 _maxParticipants
    ) external onlyOwner returns (uint256 quizId) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();

        quizId = qs.nextQuizId;
        qs.quizzes[quizId] = Quiz({
            name: _name,
            creator: msg.sender,
            rewardAmount: _rewardAmount,
            maxParticipants: _maxParticipants,
            totalQuestions: 0,
            isActive: false
        });

        qs.nextQuizId++;
        emit QuizCreated(quizId, _name, msg.sender, _rewardAmount);
        return quizId;
    }

    function addQuestion(
        uint256 _quizId,
        string memory _questionText,
        string[] memory _options,
        uint8 _correctAnswerIndex
    ) external onlyOwner {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        require(qs.quizzes[_quizId].creator == msg.sender, "QuizCreationFacet: Only quiz creator can add questions");
        require(qs.quizzes[_quizId].isActive == false, "QuizCreationFacet: Cannot add questions to an active quiz");
        require(_options.length >= 2, "QuizCreationFacet: Must have at least 2 options");
        require(_correctAnswerIndex < _options.length, "QuizCreationFacet: Invalid correct answer index");

        uint256 questionIndex = qs.quizzes[_quizId].totalQuestions;
        qs.quizQuestions[_quizId][questionIndex] = Question({
            questionText: _questionText,
            options: _options,
            correctAnswerIndex: _correctAnswerIndex
        });

        qs.quizzes[_quizId].totalQuestions++;
        emit QuestionAdded(_quizId, questionIndex);
    }

    function activateQuiz(uint256 _quizId) external onlyOwner {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        require(qs.quizzes[_quizId].creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(qs.quizzes[_quizId].creator == msg.sender, "QuizCreationFacet: Only quiz creator can activate quiz");
        require(qs.quizzes[_quizId].totalQuestions > 0, "QuizCreationFacet: Quiz must have questions to be activated");
        require(qs.quizzes[_quizId].isActive == false, "QuizCreationFacet: Quiz is already active");

        qs.quizzes[_quizId].isActive = true;
        emit QuizActivated(_quizId);
    }

    function deactivateQuiz(uint256 _quizId) external onlyOwner {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        require(qs.quizzes[_quizId].creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(qs.quizzes[_quizId].creator == msg.sender, "QuizCreationFacet: Only quiz creator can deactivate quiz");
        require(qs.quizzes[_quizId].isActive == true, "QuizCreationFacet: Quiz is already inactive");

        qs.quizzes[_quizId].isActive = false;
        emit QuizDeactivated(_quizId);
    }

    function getQuiz(uint256 _quizId) external view returns (Quiz memory) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        require(qs.quizzes[_quizId].creator != address(0), "QuizCreationFacet: Quiz does not exist");
        return qs.quizzes[_quizId];
    }

    function getQuestion(uint256 _quizId, uint256 _questionIndex) external view returns (Question memory) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        require(_questionIndex < qs.quizzes[_quizId].totalQuestions, "QuizCreationFacet: Invalid question index");
        require(qs.quizzes[_quizId].creator != address(0), "QuizCreationFacet: Quiz does not exist");
        return qs.quizQuestions[_quizId][_questionIndex];
    }

    function getTotalQuizzes() external view returns (uint256 totalQuizzes) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        return qs.nextQuizId;
    }
}