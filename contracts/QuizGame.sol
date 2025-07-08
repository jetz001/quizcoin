// contracts/QuizGame.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IQuizCoin.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./PoolManager.sol";

contract QuizGame is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    IQuizCoin public quizCoin;
    PoolManager public poolManager; 

    // Constants
    uint256 public GAME_START_TIMESTAMP; 
    uint256 public constant HALVING_PERIOD = 365 days; 
    uint256 public constant ANSWER_WINDOW_DURATION = 3 minutes;
    
    uint256 public constant BASE_REWARD_MULTIPLIER = 5000 * (10**18); 
    uint256 public constant MAX_REWARD_FOR_100_DIFFICULTY = 10000 * (10**18); 
    uint256 public constant HINT_COST_AMOUNT = 10 * (10**18); 

    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    struct Question {
        bytes32 correctAnswerHash;
        bytes32 hintHash;
        uint256 rewardAmount;
        uint256 difficultyLevel;
        address questionCreator;
        bool isClosed;
        uint256 answerWindowStartTime;
        address[] correctAnswersInWindow; 
        mapping(address => bool) hasAnsweredInWindow; 
    }

    mapping(uint256 => Question) public questions;
    uint256 public nextQuestionId;

    event QuestionCreated(uint256 indexed questionId, address indexed creator, uint256 difficultyLevel, uint256 rewardAmount);
    event AnswerSubmitted(uint256 indexed questionId, address indexed participant, bytes32 answerHash);
    event HintPurchased(uint256 indexed questionId, address indexed buyer, uint256 cost);
    event RewardDistributed(uint256 indexed questionId, address indexed recipient, uint256 amount);
    event QuestionClosed(uint256 indexed questionId);
    event QuestionRewardWindowStarted(uint256 indexed questionId, uint256 startTime, uint256 endTime);


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _quizCoinAddress, address _poolManagerAddress, address _defaultAdmin, uint256 _gameStartTimestamp) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init(); 

        quizCoin = IQuizCoin(_quizCoinAddress);
        poolManager = PoolManager(_poolManagerAddress);
        nextQuestionId = 1;
        GAME_START_TIMESTAMP = _gameStartTimestamp; 

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, _defaultAdmin);
    }

    function setPoolManagerAddress(address _poolManagerAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_poolManagerAddress != address(0), "QuizGame: PoolManager address cannot be zero.");
        poolManager = PoolManager(_poolManagerAddress);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function createQuestion(bytes32 _correctAnswerHash, bytes32 _hintHash, uint256 _difficultyLevel)
        public
    {
        require(_difficultyLevel > 0 && _difficultyLevel <= 100, "Quiz: Invalid difficulty level (1-100).");
        
        uint256 calculatedReward;
        if (_difficultyLevel == 100) {
            calculatedReward = MAX_REWARD_FOR_100_DIFFICULTY;
        } else {
            uint256 baseReward = _getBaseRewardByDifficulty(_difficultyLevel);
            uint256 halvingFactor = _getHalvingFactor();
            
            require(halvingFactor > 0, "Quiz: Halving factor cannot be zero (should be at least 1).");
            calculatedReward = baseReward / halvingFactor;
        }
        
        require(calculatedReward > 0, "Quiz: Calculated reward is zero. Halving may have reduced it too much.");

        uint256 currentQuestionId = nextQuestionId++; 
        Question storage newQuestion = questions[currentQuestionId]; 
        
        newQuestion.correctAnswerHash = _correctAnswerHash;
        newQuestion.hintHash = _hintHash;
        newQuestion.rewardAmount = calculatedReward;
        newQuestion.difficultyLevel = _difficultyLevel;
        newQuestion.questionCreator = msg.sender;
        newQuestion.isClosed = false;
        newQuestion.answerWindowStartTime = 0;
        
        emit QuestionCreated(currentQuestionId, msg.sender, _difficultyLevel, calculatedReward);
    }

    function submitAnswer(uint256 _questionId, bytes32 _answerHash) public nonReentrant {
        Question storage question = questions[_questionId];

        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");
        
        require(question.correctAnswerHash == _answerHash, "Quiz: Incorrect answer.");

        require(!question.hasAnsweredInWindow[msg.sender], "Quiz: You have already submitted a correct answer in this round.");

        if (question.answerWindowStartTime == 0) {
            question.answerWindowStartTime = block.timestamp;
            emit QuestionRewardWindowStarted(_questionId, question.answerWindowStartTime, question.answerWindowStartTime + ANSWER_WINDOW_DURATION);
        } else {
            require(block.timestamp <= question.answerWindowStartTime + ANSWER_WINDOW_DURATION, "Quiz: Answer window has closed for this question.");
        }

        question.correctAnswersInWindow.push(msg.sender);
        question.hasAnsweredInWindow[msg.sender] = true;

        emit AnswerSubmitted(_questionId, msg.sender, _answerHash);
    }

    function purchaseHint(uint256 _questionId) public nonReentrant {
        Question storage question = questions[_questionId];

        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");

        require(quizCoin.transferFrom(msg.sender, address(poolManager), HINT_COST_AMOUNT), "Quiz: QZC transfer failed for hint purchase.");
        
        emit HintPurchased(_questionId, msg.sender, HINT_COST_AMOUNT);
    }

    function getHint(uint256 _questionId) public view returns (bytes32) {
        Question storage question = questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        return question.hintHash;
    }

    function distributeRewards(uint256 _questionId) public onlyRole(REWARD_DISTRIBUTOR_ROLE) nonReentrant {
        Question storage question = questions[_questionId];

        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Rewards already distributed or question closed.");
        require(question.answerWindowStartTime != 0, "Quiz: No one has answered correctly yet for this question.");
        
        require(block.timestamp > question.answerWindowStartTime + ANSWER_WINDOW_DURATION, "Quiz: Reward distribution window is not over yet.");

        uint256 numCorrectAnswerers = question.correctAnswersInWindow.length;
        require(numCorrectAnswerers > 0, "Quiz: No correct answers found in the window.");

        uint256 totalRewardAmount = question.rewardAmount;
        uint256 rewardPerPerson = totalRewardAmount / numCorrectAnswerers; 
        require(rewardPerPerson > 0, "Quiz: Reward per person is zero."); 

        require(poolManager.getPoolBalance() >= totalRewardAmount, "Quiz: Insufficient pool balance for rewards.");

        for (uint256 i = 0; i < numCorrectAnswerers; i++) {
            address recipient = question.correctAnswersInWindow[i];
            poolManager.withdrawForUser(recipient, rewardPerPerson);
            emit RewardDistributed(_questionId, recipient, rewardPerPerson);
        }

        question.isClosed = true;
        delete question.correctAnswersInWindow; 
        
        emit QuestionClosed(_questionId); 
    }

    function _getBaseRewardByDifficulty(uint256 _difficulty) internal pure returns (uint256) {
        return (BASE_REWARD_MULTIPLIER * _difficulty) / 99;
    }

    function _getHalvingFactor() internal view returns (uint256) {
        if (block.timestamp < GAME_START_TIMESTAMP) {
            return 1; 
        }

        uint256 periodsSinceStart = (block.timestamp - GAME_START_TIMESTAMP) / HALVING_PERIOD;
        return (1 << periodsSinceStart); 
    }

    function getHasAnsweredInWindow(uint256 _questionId, address _user) public view returns (bool) {
        require(questions[_questionId].correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        return questions[_questionId].hasAnsweredInWindow[_user];
    }

    function getQuestionDetails(uint256 _questionId) public view returns (
        bytes32 correctAnswerHash,
        bytes32 hintHash,
        uint256 rewardAmount,
        uint256 difficultyLevel,
        address questionCreator,
        bool isClosed,
        uint256 answerWindowStartTime,
        uint256 numCorrectAnswerers, 
        bool isRewardWindowActive,
        uint256 rewardWindowEndTime
    ) {
        Question storage q = questions[_questionId];
        require(q.correctAnswerHash != bytes32(0), "Quiz: Question does not exist."); 

        correctAnswerHash = q.correctAnswerHash;
        hintHash = q.hintHash;
        rewardAmount = q.rewardAmount;
        difficultyLevel = q.difficultyLevel;
        questionCreator = q.questionCreator;
        isClosed = q.isClosed;
        answerWindowStartTime = q.answerWindowStartTime;
        numCorrectAnswerers = q.correctAnswersInWindow.length; 
        
        isRewardWindowActive = (q.answerWindowStartTime != 0 && block.timestamp <= q.answerWindowStartTime + ANSWER_WINDOW_DURATION && !q.isClosed);
        rewardWindowEndTime = (q.answerWindowStartTime != 0) ? (q.answerWindowStartTime + ANSWER_WINDOW_DURATION) : 0;
    }
}