// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibQuizStorage} from "../libraries/LibQuizStorage.sol";
import {IERC173} from "../interfaces/IERC173.sol";
import {Quiz, Question} from "../QuizTypes.sol";

// Interface for Ownership
interface IOwnership {
    function owner() external view returns (address contractOwner);
}

// --- Events for QuizCreation ---
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

    // Modifier to check if the caller is the Diamond owner
    modifier onlyOwner() {
        require(IOwnership(address(this)).owner() == msg.sender, "QuizCreationFacet: Must be owner");
        _;
    }

    /// @notice Creates a new Quiz
    /// @param _name The name of the Quiz
    /// @param _rewardAmount The reward amount per correct answer (in wei)
    /// @param _maxParticipants The maximum number of participants
    /// @return quizId The ID of the created Quiz
    function createQuiz(string memory _name, uint256 _rewardAmount, uint256 _maxParticipants)
        external
        onlyOwner
        returns (uint256 quizId)
    {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        quizId = qs.nextQuizId;

        Quiz storage newQuiz = qs.quizzes[quizId];
        newQuiz.name = _name;
        newQuiz.creator = msg.sender;
        newQuiz.rewardAmount = _rewardAmount;
        newQuiz.totalQuestions = 0;
        newQuiz.maxParticipants = _maxParticipants;
        newQuiz.isActive = false;

        qs.nextQuizId++;

        emit QuizCreated(quizId, _name, msg.sender, _rewardAmount);
        return quizId;
    }

    /// @notice Adds a question to a Quiz
    /// @param _quizId The ID of the Quiz to add the question to
    /// @param _questionText The question text
    /// @param _options The answer options
    /// @param _correctAnswerIndex The index of the correct answer (starting from 0)
    function addQuestion(uint256 _quizId, string memory _questionText, string[] memory _options, uint8 _correctAnswerIndex)
        external
        onlyOwner
    {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];

        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(quiz.creator == msg.sender, "QuizCreationFacet: Must be quiz creator to add questions");
        require(!quiz.isActive, "QuizCreationFacet: Cannot add questions to an active quiz");

        require(_options.length >= 2, "QuizCreationFacet: Must provide at least two options");
        require(_correctAnswerIndex < _options.length, "QuizCreationFacet: Invalid correct answer index");

        uint256 questionIndex = quiz.totalQuestions;
        
        Question storage newQuestion = qs.quizQuestions[_quizId][questionIndex];
        newQuestion.questionText = _questionText;
        newQuestion.options = _options;
        newQuestion.correctAnswerIndex = _correctAnswerIndex;
        
        quiz.totalQuestions++;

        emit QuestionAdded(_quizId, questionIndex);
    }

    /// @notice Activates a Quiz
    /// @param _quizId The ID of the Quiz to activate
    function activateQuiz(uint256 _quizId) external onlyOwner {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];

        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(quiz.creator == msg.sender, "QuizCreationFacet: Must be quiz creator to activate");
        require(quiz.totalQuestions > 0, "QuizCreationFacet: Cannot activate a quiz with no questions");
        require(!quiz.isActive, "QuizCreationFacet: Quiz is already active");

        quiz.isActive = true;
        emit QuizActivated(_quizId);
    }

    /// @notice Deactivates a Quiz
    /// @param _quizId The ID of the Quiz to deactivate
    function deactivateQuiz(uint256 _quizId) external onlyOwner {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];

        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(quiz.creator == msg.sender, "QuizCreationFacet: Must be quiz creator to deactivate");
        require(quiz.isActive, "QuizCreationFacet: Quiz is not active");

        quiz.isActive = false;
        emit QuizDeactivated(_quizId);
    }

    /// @notice Retrieves Quiz data
    /// @param _quizId The ID of the Quiz
    /// @return name The name of the quiz
    /// @return creator The address of the quiz creator
    /// @return rewardAmount The reward amount for the quiz
    /// @return totalQuestions The total number of questions in the quiz
    /// @return maxParticipants The maximum number of participants allowed
    /// @return isActive The active status of the quiz
    function getQuiz(uint256 _quizId) external view returns (
        string memory name,
        address creator,
        uint256 rewardAmount,
        uint256 totalQuestions,
        uint256 maxParticipants,
        bool isActive
    ) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];
        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        
        return (
            quiz.name,
            quiz.creator,
            quiz.rewardAmount,
            quiz.totalQuestions,
            quiz.maxParticipants,
            quiz.isActive
        );
    }

    /// @notice Retrieves specific question data
    /// @param _quizId The ID of the Quiz
    /// @param _questionIndex The index of the question
    /// @return questionText The text of the question
    /// @return options The options for the question
    /// @return correctAnswerIndex The index of the correct answer
    function getQuestion(uint256 _quizId, uint256 _questionIndex) external view returns (
        string memory questionText,
        string[] memory options,
        uint8 correctAnswerIndex
    ) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        Quiz storage quiz = qs.quizzes[_quizId];
        require(quiz.creator != address(0), "QuizCreationFacet: Quiz does not exist");
        require(_questionIndex < quiz.totalQuestions, "QuizCreationFacet: Invalid question index");
        
        Question storage question = qs.quizQuestions[_quizId][_questionIndex];
        
        return (
            question.questionText,
            question.options,
            question.correctAnswerIndex
        );
    }

    /// @notice Retrieves the total number of Quizzes created
    /// @return totalQuizzes The total number of Quizzes
    function getTotalQuizzes() external view returns (uint256 totalQuizzes) {
        LibQuizStorage.QuizStorage storage qs = _quizStorage();
        return qs.nextQuizId;
    }
}
