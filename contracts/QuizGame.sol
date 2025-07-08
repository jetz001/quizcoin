// contracts/QuizGame.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IQuizCoin.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./PoolManager.sol";

contract QuizGame is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    IQuizCoin public quizCoin;
    PoolManager public poolManager; 

    // Constants
    uint256 public GAME_START_TIMESTAMP; // Changed to dynamic, set in initialize
    uint256 public constant HALVING_PERIOD = 365 days; // 1 year for easier testing
    uint256 public constant ANSWER_WINDOW_DURATION = 3 minutes;
    
    // กำหนดค่าเหล่านี้เป็น public constant เพื่อให้ test เข้าถึงได้ง่าย
    uint256 public constant BASE_REWARD_MULTIPLIER = 5000 * (10**18); // 5000 QZC in wei for base difficulty 99
    uint256 public constant MAX_REWARD_FOR_100_DIFFICULTY = 10000 * (10**18); // 10000 QZC in wei for difficulty 100
    uint256 public constant HINT_COST_AMOUNT = 10 * (10**18); // 10 QZC in wei

    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    struct Question {
        bytes32 correctAnswerHash;
        bytes32 hintHash;
        uint256 rewardAmount;
        uint256 difficultyLevel;
        address questionCreator;
        bool isClosed;
        uint256 answerWindowStartTime;
        address[] correctAnswersInWindow; // ใช้เก็บ address ของผู้ที่ตอบถูกใน window
        mapping(address => bool) hasAnsweredInWindow; // ใช้เช็คว่า address นี้ตอบไปแล้วหรือยัง
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

    /**
     * @notice Initializes the QuizGame contract.
     * @param _quizCoinAddress The address of the QuizCoin token contract.
     * @param _poolManagerAddress The address of the PoolManager contract.
     * @param _defaultAdmin The address to be granted the DEFAULT_ADMIN_ROLE and REWARD_DISTRIBUTOR_ROLE.
     * @param _gameStartTimestamp The timestamp when the game officially starts for halving calculation.
     */
    function initialize(address _quizCoinAddress, address _poolManagerAddress, address _defaultAdmin, uint256 _gameStartTimestamp) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        quizCoin = IQuizCoin(_quizCoinAddress);
        poolManager = PoolManager(_poolManagerAddress);
        nextQuestionId = 1;
        GAME_START_TIMESTAMP = _gameStartTimestamp; // Set dynamically

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, _defaultAdmin);
    }

    /**
     * @dev สร้างคำถามใหม่
     * @param _correctAnswerHash Hash ของคำตอบที่ถูกต้อง
     * @param _hintHash Hash ของ Hint ที่เกี่ยวข้อง
     * @param _difficultyLevel ระดับความยากของคำถาม (1-100)
     */
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

        uint256 currentQuestionId = nextQuestionId++; // Use a local variable then increment
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

    /**
     * @dev ผู้เล่นส่งคำตอบสำหรับคำถาม
     * จะบันทึกผู้ตอบถูกและเริ่มนับเวลา หากเป็นคนแรกที่ตอบถูกในรอบนั้น
     * @param _questionId ID ของคำถาม
     * @param _answerHash Hash ของคำตอบที่ผู้เล่นส่งมา
     */
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

    /**
     * @dev อนุญาตให้ผู้เล่นซื้อ Hint สำหรับคำถาม
     * @param _questionId ID ของคำถาม
     */
    function purchaseHint(uint256 _questionId) public nonReentrant {
        Question storage question = questions[_questionId];

        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");

        require(quizCoin.transferFrom(msg.sender, address(poolManager), HINT_COST_AMOUNT), "Quiz: QZC transfer failed for hint purchase.");
        
        emit HintPurchased(_questionId, msg.sender, HINT_COST_AMOUNT);
    }

    /**
     * @dev ผู้เล่นสามารถรับ Hint ได้หลังจากซื้อไปแล้ว
     * @param _questionId ID ของคำถาม
     * @return bytes32 Hash ของ Hint
     */
    function getHint(uint256 _questionId) public view returns (bytes32) {
        Question storage question = questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        return question.hintHash;
    }

    /**
     * @dev ฟังก์ชันสำหรับกระจายรางวัลให้กับผู้ที่ตอบถูกภายใน Window เวลา
     * ต้องถูกเรียกโดย REWARD_DISTRIBUTOR_ROLE (เช่น Chainlink Keeper หรือ Bot)
     * @param _questionId ID ของคำถามที่จะกระจายรางวัล
     */
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
        // ล้าง array correctAnswersInWindow หลังจากกระจายรางวัลแล้ว
        delete question.correctAnswersInWindow; // <-- เพิ่มบรรทัดนี้เพื่อแก้ไขปัญหา numCorrectAnswerers ใน test
        
        emit QuestionClosed(_questionId); 
    }

    /**
     * @dev คำนวณ Base Reward ตามระดับความยาก (1-99)
     * @param _difficulty ระดับความยาก (1-99)
     * @return จำนวน Base Reward (ในหน่วย wei)
     */
    function _getBaseRewardByDifficulty(uint256 _difficulty) internal pure returns (uint256) {
        return (BASE_REWARD_MULTIPLIER * _difficulty) / 99;
    }

    /**
     * @dev คำนวณ Halving Factor ตามเวลาที่ผ่านไปจาก GAME_START_TIMESTAMP
     * Factor จะเพิ่มขึ้นเป็น 2, 4, 8... ทุก HALVING_PERIOD (เช่น 4 ปี)
     * @return Halving Factor (เช่น 1, 2, 4, 8...)
     */
    function _getHalvingFactor() internal view returns (uint256) {
        if (block.timestamp < GAME_START_TIMESTAMP) {
            return 1; 
        }

        uint256 periodsSinceStart = (block.timestamp - GAME_START_TIMESTAMP) / HALVING_PERIOD;
        return (1 << periodsSinceStart); 
    }

    /**
     * @dev Getter function เพื่อตรวจสอบว่าผู้ใช้ได้ตอบคำถามใน window ปัจจุบันแล้วหรือยัง
     * @param _questionId ID ของคำถาม
     * @param _user ที่อยู่ของผู้ใช้
     * @return bool True ถ้าผู้ใช้ได้ตอบไปแล้ว False ถ้ายัง
     */
    function getHasAnsweredInWindow(uint256 _questionId, address _user) public view returns (bool) {
        // ตรวจสอบว่าคำถามมีอยู่จริงก่อน
        require(questions[_questionId].correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        return questions[_questionId].hasAnsweredInWindow[_user];
    }

    // ฟังก์ชันเพิ่มเติมสำหรับ Debugging หรือข้อมูล
    function getQuestionDetails(uint256 _questionId) public view returns (
        bytes32 correctAnswerHash,
        bytes32 hintHash,
        uint256 rewardAmount,
        uint256 difficultyLevel,
        address questionCreator,
        bool isClosed,
        uint256 answerWindowStartTime,
        uint256 numCorrectAnswerers, // จำนวนคนตอบถูก
        bool isRewardWindowActive,
        uint256 rewardWindowEndTime
    ) {
        Question storage q = questions[_questionId];
        require(q.correctAnswerHash != bytes32(0), "Quiz: Question does not exist."); // ตรวจสอบว่าคำถามมีอยู่จริง

        correctAnswerHash = q.correctAnswerHash;
        hintHash = q.hintHash;
        rewardAmount = q.rewardAmount;
        difficultyLevel = q.difficultyLevel;
        questionCreator = q.questionCreator;
        isClosed = q.isClosed;
        answerWindowStartTime = q.answerWindowStartTime;
        numCorrectAnswerers = q.correctAnswersInWindow.length; // ดึงจาก length ของ array
        
        // ตรวจสอบว่า reward window ยัง active หรือไม่
        isRewardWindowActive = (q.answerWindowStartTime != 0 && block.timestamp <= q.answerWindowStartTime + ANSWER_WINDOW_DURATION && !q.isClosed);
        rewardWindowEndTime = (q.answerWindowStartTime != 0) ? (q.answerWindowStartTime + ANSWER_WINDOW_DURATION) : 0;
    }
}
