// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// นำเข้าไลบรารี OpenZeppelin เวอร์ชัน Upgradeable
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // <-- เพิ่มบรรทัดนี้
// บรรทัดนี้ถูกลบออก: import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// Interface สำหรับสัญญา PoolManager (เพื่อให้ QuizGame สามารถโต้ตอบกับ PoolManager ได้)
interface IPoolManager {
    // QuizGame จะเรียกฟังก์ชันนี้เพื่อถอน QZC ของผู้เล่นที่ซื้อ Hint
    function withdrawForUser(address _user, uint256 _amount) external; 
    function getBalance(address _user) external view returns (uint256); // ใช้เพื่อตรวจสอบยอดเงินของผู้เล่นใน Pool
    function hasRole(bytes32 role, address account) external view returns (bool);
    // บรรทัดนี้ถูกลบออก: bytes32 constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");
}

// Interface สำหรับสัญญา QuizCoin (เพื่อให้ QuizGame สามารถโต้ตอบกับ QuizCoin ได้)
interface IQuizCoin {
    function mint(address to, uint256 amount) external;
}

contract QuizGame is Initializable, OwnableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable { // <-- เพิ่ม UUPSUpgradeable ที่นี่
    // ตัวแปรสถานะ
    IQuizCoin public QZ_COIN; // Instance ของสัญญา QuizCoin
    IPoolManager public i_poolManagerAddress; // Instance ของสัญญา PoolManager
    address public i_developerFundAddress; // ที่อยู่ของ Developer Fund

    // Mapping สำหรับเก็บคำถาม
    struct Question {
        bytes32 answerHash;
        bytes32 hintHash;
        uint256 difficulty;
        uint256 createdAt;
        bool isSolved;
        address solver;
        uint256 hintCost;
        uint256 solvedAt;
    }

    mapping(uint256 => Question) public questions;
    mapping(uint256 => mapping(address => bool)) public hasPurchasedHint; // questionId => userAddress => bool

    uint256 public nextQuestionId; // ใช้สำหรับ ID คำถามถัดไป

    // ค่าคงที่ (ยังคงเป็น constant เพื่อประหยัด Gas)
    uint256 public constant HALVING_RATE_BPS = 1000; // 10% (1000 basis points)
    uint256 public constant SECONDS_PER_HALVING_PERIOD = 24 * 60 * 60 * 30; // ประมาณ 30 วัน
    uint256 public constant INITIAL_REWARD_LEVEL_1_99 = 100 * (10 ** 18); // 100 QZC
    uint256 public constant INITIAL_REWARD_LEVEL_100 = 500 * (10 ** 18); // 500 QZC
    uint256 public constant REWARD_MULTIPLIER_LEVEL_1_99 = 100; // สำหรับ Difficulty 1-99
    uint256 public constant MIN_REWARD_LEVEL_1_99 = 10 * (10 ** 18); // 10 QZC
    uint256 public constant MIN_REWARD_LEVEL_100 = 50 * (10 ** 18); // 50 QZC
    uint256 public constant DEVELOPER_FEE_BPS = 50; // 5% (500 basis points)
    uint256 public constant HINT_COST_MULTIPLIER = 10; // Hint Cost is difficulty * 10

    // บทบาทสำหรับ AccessControl
    bytes32 public constant QUESTION_CREATOR_ROLE = keccak256("QUESTION_CREATOR_ROLE");
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE"); // Role สำหรับ PoolManager ใน QuizGame

    // Events
    event QuestionCreated(uint256 indexed questionId, bytes32 answerHash, uint256 difficulty, uint256 hintCost, uint256 timestamp);
    event QuestionSolved(uint256 indexed questionId, address indexed solver, uint256 rewardAmount, uint256 feeAmount, uint256 timestamp);
    event HintPurchased(uint256 indexed questionId, address indexed buyer, uint256 cost, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    // Constructor นี้มีไว้เพื่อป้องกันการเรียก 'initialize' โดยตรงเท่านั้น
    constructor() {
        _disableInitializers(); 
    }

    // ฟังก์ชัน initialize จะถูกเรียกเพียงครั้งเดียวเมื่อสัญญาถูก Deploy ผ่าน Proxy
    // ใช้สำหรับกำหนดค่าเริ่มต้นของสัญญา
    function initialize(address _quizCoinAddress, address _developerFundAddress, address _poolManagerAddress) public initializer {
        // เรียก initialize ของสัญญาแม่
        __Ownable_init(msg.sender);
        __AccessControl_init();
        // ไม่ต้องเรียก __UUPSUpgradeable_init() ที่นี่ เพราะ OwnableUpgradeable และ AccessControlUpgradeable จัดการให้แล้ว

        // กำหนดค่าเริ่มต้นให้กับตัวแปรสถานะ
        QZ_COIN = IQuizCoin(_quizCoinAddress);
        i_developerFundAddress = _developerFundAddress;
        i_poolManagerAddress = IPoolManager(_poolManagerAddress);
        nextQuestionId = 1;

        // มอบบทบาทเริ่มต้น
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(QUESTION_CREATOR_ROLE, msg.sender);
        _grantRole(POOL_MANAGER_ROLE, _poolManagerAddress); // มอบ POOL_MANAGER_ROLE ให้ PoolManager
    }

    // --- FUNCTIONS ---
    function createQuestion(bytes32 _answerHash, bytes32 _hintHash, uint256 _difficulty) public onlyRole(QUESTION_CREATOR_ROLE) returns (uint256) {
        if (_difficulty == 0) {
            revert InvalidDifficulty();
        }

        uint256 hintCost = _difficulty * HINT_COST_MULTIPLIER * (10 ** 18);

        questions[nextQuestionId] = Question({
            answerHash: _answerHash,
            hintHash: _hintHash,
            difficulty: _difficulty,
            createdAt: block.timestamp,
            isSolved: false,
            solver: address(0),
            hintCost: hintCost,
            solvedAt: 0
        });

        emit QuestionCreated(nextQuestionId, _answerHash, _difficulty, hintCost, block.timestamp);
        nextQuestionId++;
        return nextQuestionId - 1;
    }

    function submitAnswer(uint256 _questionId, bytes32 _answerHash) public {
        Question storage question = questions[_questionId];

        if (question.createdAt == 0) {
            revert QuestionDoesNotExist(_questionId);
        }
        if (question.isSolved) {
            revert QuestionAlreadySolved(_questionId);
        }
        if (question.answerHash != _answerHash) {
            revert IncorrectAnswer();
        }

        question.isSolved = true;
        question.solver = msg.sender;
        question.solvedAt = block.timestamp;

        _mintReward(_questionId, msg.sender, question.difficulty, question.createdAt, question.solvedAt);
    }

    function purchaseHint(uint256 _questionId) public {
        Question storage question = questions[_questionId];

        if (question.createdAt == 0) {
            revert QuestionDoesNotExist(_questionId);
        }
        if (hasPurchasedHint[_questionId][msg.sender]) {
            revert HintAlreadyPurchased();
        }
        if (question.hintCost == 0) {
            revert HintCostZero();
        }

        // ตรวจสอบว่าผู้เล่นมี QZC ใน PoolManager เพียงพอ
        if (i_poolManagerAddress.getBalance(msg.sender) < question.hintCost) {
            revert InsufficientPoolBalanceForHint(); 
        }

        // เรียก PoolManager เพื่อถอน QZC จากผู้เล่นที่ซื้อ Hint
        // QuizGame จะเป็นผู้เรียก PoolManager.withdrawForUser โดยส่ง address ของผู้เล่นปัจจุบัน (msg.sender) ไปด้วย
        i_poolManagerAddress.withdrawForUser(msg.sender, question.hintCost);

        hasPurchasedHint[_questionId][msg.sender] = true;
        emit HintPurchased(_questionId, msg.sender, question.hintCost, block.timestamp);
    }

    function getHint(uint256 _questionId) public view returns (bytes32) {
        Question storage question = questions[_questionId];

        if (question.createdAt == 0) {
            revert QuestionDoesNotExist(_questionId);
        }
        if (!hasPurchasedHint[_questionId][msg.sender]) {
            revert HintNotPurchased();
        }
        return question.hintHash;
    }

    // --- Internal/Private Functions ---
    function _mintReward(uint256 _questionId, address _solver, uint256 _difficulty, uint256 _createdAt, uint256 _solvedAt) internal {
        uint256 timeElapsed = _solvedAt - _createdAt;
        uint256 numHalvingPeriods = timeElapsed / SECONDS_PER_HALVING_PERIOD;

        uint256 initialReward;
        uint256 minReward;

        if (_difficulty < 100) {
            initialReward = INITIAL_REWARD_LEVEL_1_99 * _difficulty / REWARD_MULTIPLIER_LEVEL_1_99;
            minReward = MIN_REWARD_LEVEL_1_99;
        } else if (_difficulty == 100) {
            initialReward = INITIAL_REWARD_LEVEL_100;
            minReward = MIN_REWARD_LEVEL_100;
        } else {
            revert InvalidDifficulty();
        }

        uint256 currentReward = initialReward;
        for (uint256 i = 0; i < numHalvingPeriods; i++) {
            currentReward = currentReward * (10000 - HALVING_RATE_BPS) / 10000;
            if (currentReward < minReward) {
                currentReward = minReward;
                break;
            }
        }

        uint256 feeAmount = currentReward * DEVELOPER_FEE_BPS / 10000;
        uint256 rewardAmountToSolver = currentReward - feeAmount;

        QZ_COIN.mint(_solver, rewardAmountToSolver);
        QZ_COIN.mint(i_developerFundAddress, feeAmount);

        emit QuestionSolved(_questionId, _solver, rewardAmountToSolver, feeAmount, block.timestamp);
    }

    // Setters for admin/owner
    function setDeveloperFundAddress(address _newDeveloperFundAddress) public onlyOwner {
        if (_newDeveloperFundAddress == address(0)) {
            revert InvalidAddress();
        }
        i_developerFundAddress = _newDeveloperFundAddress;
    }

    function setPoolManagerAddress(address _newPoolManagerAddress) public onlyOwner {
        if (_newPoolManagerAddress == address(0)) {
            revert InvalidAddress();
        }
        i_poolManagerAddress = IPoolManager(_newPoolManagerAddress);
        // เมื่อเปลี่ยน PoolManager Address ต้องแน่ใจว่า Role ถูกต้องใน PoolManager ใหม่ด้วย
        // โดยปกติจะจัดการใน deploy script หรือ upgrade script
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    // Custom Errors
    error InvalidDifficulty();
    error QuestionDoesNotExist(uint256 questionId);
    error QuestionAlreadySolved(uint256 questionId);
    error IncorrectAnswer();
    error HintAlreadyPurchased();
    error HintNotPurchased();
    error HintCostZero();
    error InvalidAddress();
    error InsufficientPoolBalanceForHint();
}