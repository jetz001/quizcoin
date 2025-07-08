// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./QuizCoin.sol"; // Import สัญญา QuizCoin
import "./PoolManager.sol"; // Import สัญญา PoolManager

// ตรวจสอบให้แน่ใจว่าโค้ดทั้งหมดอยู่ภายในบล็อกของสัญญา QuizGame นี้
contract QuizGame is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    // --- บทบาท (Roles) ---
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE"); // บทบาทสำหรับผู้สร้างคำถาม (ไม่บังคับ, สามารถใช้ onlyOwner ได้)

    // --- ตัวแปรสถานะ (State Variables) ---
    IERC20 public quizCoin; // บรรทัดนี้ต้องอยู่ภายในสัญญา
    PoolManager public poolManager;
    uint256 public nextQuestionId;
    uint256 public GAME_START_TIMESTAMP; // เวลาเริ่มต้นของเกม (Unix timestamp)

    // --- ค่าคงที่สำหรับ Logic ของเกม (Constants for Game Logic) ---
    uint256 public constant HINT_COST_AMOUNT = 10 * 10**18; // 10 QuizCoin สำหรับคำใบ้
    uint256 public constant BLOCK_DURATION_SECONDS = 180; // 3 นาที สำหรับหน้าต่างคำถามในโหมด Pool
    uint256 public constant BASE_REWARD_FOR_LEVEL_99 = 5000 * 10**18; // 5000 QZC สำหรับความยาก 1-99 (ก่อน Halving)
    uint256 public constant REWARD_FOR_LEVEL_100 = 10000 * 10**18; // 10000 QZC สำหรับความยาก 100 (ไม่มี Halving)

    // --- ค่าคงที่สำหรับ Halving (Halving Constants) ---
    uint256 public constant HALVING_PERIOD_SECONDS = 4 * 365 * 24 * 60 * 60; // 4 ปี ในหน่วยวินาที (โดยประมาณ)
    uint256 public constant MIN_REWARD_AFTER_HALVING = 100 * 10**18; // รางวัลขั้นต่ำสำหรับระดับ 1-99 หลัง Halving

    // --- Enum ---
    enum QuestionMode {
        Solo, // ผู้ตอบถูกคนแรกชนะทั้งหมด คำถามปิดทันที
        Pool  // ผู้ตอบถูกคนแรกจะเปิดหน้าต่างเวลา ผู้ตอบถูกทุกคนจะแบ่งรางวัลกันหลังจากหน้าต่างปิด
    }

    // --- Struct ---
    struct Question {
        bytes32 correctAnswerHash;
        bytes32 hintHash;
        address questionCreator;
        uint256 difficultyLevel;
        uint256 baseRewardAmount;     // รางวัลเริ่มต้นสำหรับคำถามนี้ก่อนการคำนวณ Halving
        bool isClosed;                // เป็นจริงถ้าคำถามถูกตอบและรางวัลถูกกระจายแล้ว
        QuestionMode mode;            // Solo หรือ Pool
        uint256 blockCreationTime;    // Timestamp เมื่อคำถามถูกสร้าง
        uint256 firstCorrectAnswerTime; // Timestamp เมื่อคำตอบที่ถูกต้องแรกถูกส่ง
        address firstSolverAddress;   // ที่อยู่ของผู้ตอบถูกคนแรก (เกี่ยวข้องกับ Solo/Pool initial time)
        address[] poolCorrectSolvers; // รายชื่อที่อยู่ของผู้ที่ตอบถูกในหน้าต่างโหมด Pool
        mapping(address => uint256) lastAnswerDay; // เก็บ Day ID สำหรับคำตอบล่าสุดของผู้ใช้แต่ละคนสำหรับคำถามนี้
    }

    // --- Mappings ---
    mapping(uint256 => Question) public questions;
    mapping(address => uint256) public lastPlayedDay; // เก็บ Day ID ล่าสุดที่ผู้ใช้ส่งคำตอบใดๆ
    mapping(address => QuestionMode) public playerModeChoice; // เก็บโหมดที่ผู้ใช้เลือกสำหรับ Day ID ปัจจุบัน

    // --- Events ---
    event QuestionCreated(uint256 indexed questionId, address indexed creator, uint256 difficulty, uint256 baseReward);
    event HintPurchased(uint256 indexed questionId, address indexed buyer, uint256 cost);
    event AnswerSubmitted(uint256 indexed questionId, address indexed submitter, bytes32 submittedHash);
    event QuestionRewardWindowStarted(uint256 indexed questionId, uint256 windowStartTime);
    event RewardDistributed(uint256 indexed questionId, address indexed recipient, uint256 amount);
    event QuestionClosed(uint256 indexed questionId);
    event PoolManagerAddressUpdated(address indexed oldAddress, address indexed newAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _quizCoinAddress,
        address _poolManagerAddress,
        address _defaultAdmin,
        uint256 _gameStartTimestamp
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, _defaultAdmin); // Default admin เป็นผู้กระจายรางวัลด้วย

        quizCoin = IERC20(_quizCoinAddress); // <<--- แก้ไขเป็นแบบนี้
        poolManager = PoolManager(_poolManagerAddress);
        nextQuestionId = 1;
        GAME_START_TIMESTAMP = _gameStartTimestamp;
    }

    // --- Modifiers ---
    modifier onlyRewardDistributor() {
        require(hasRole(REWARD_DISTRIBUTOR_ROLE, msg.sender), "AccessControl: Caller is not a reward distributor");
        _;
    }

    modifier onlyGameAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "AccessControl: Caller is not a game admin");
        _;
    }

    // --- ฟังก์ชันสำหรับผู้ดูแล (Admin Functions) ---
    function setPoolManagerAddress(address _newPoolManagerAddress) public onlyGameAdmin {
        require(_newPoolManagerAddress != address(0), "Quiz: PoolManager address cannot be zero");
        emit PoolManagerAddressUpdated(address(poolManager), _newPoolManagerAddress);
        poolManager = PoolManager(_newPoolManagerAddress);
    }

    // --- ฟังก์ชันช่วยภายใน/Pure (Internal/Pure Helper Functions) ---

    /**
     * @dev คำนวณจำนวนรางวัลจริงสำหรับคำถาม โดยคำนึงถึงรอบ Halving
     * @param _baseRewardAmount จำนวนรางวัลเริ่มต้นสำหรับคำถาม (ก่อน Halving)
     * @param _difficultyLevel ระดับความยากของคำถาม
     * @return จำนวนรางวัลสุดท้ายหลังจากใช้กฎ Halving
     */
    function _calculateCurrentReward(uint256 _baseRewardAmount, uint256 _difficultyLevel) private view returns (uint256) {
        // คำถามระดับ 100 ไม่ได้รับผลกระทบจาก Halving
        if (_difficultyLevel == 100) {
            return _baseRewardAmount;
        }

        // คำนวณรอบ Halving โดยอิงจากเวลาเริ่มเกม
        uint256 currentTimestamp = block.timestamp;
        uint256 timeElapsed = currentTimestamp - GAME_START_TIMESTAMP;
        uint256 halvingCycles = timeElapsed / HALVING_PERIOD_SECONDS;

        uint256 currentReward = _baseRewardAmount;
        // ใช้ Halving สำหรับแต่ละรอบ แต่ไม่ให้ต่ำกว่า MIN_REWARD_AFTER_HALVING
        for (uint256 i = 0; i < halvingCycles; i++) {
            currentReward /= 2; // ลดรางวัลลงครึ่งหนึ่ง

            // ตรวจสอบให้แน่ใจว่ารางวัลไม่ต่ำกว่าเกณฑ์ขั้นต่ำ
            if (currentReward < MIN_REWARD_AFTER_HALVING) {
                currentReward = MIN_REWARD_AFTER_HALVING;
                break; // หยุด Halving เมื่อถึงขั้นต่ำ
            }
        }
        return currentReward;
    }

    /**
     * @dev สร้างคำถาม Quiz ใหม่ เรียกใช้ได้โดยผู้ดูแลเกมเท่านั้น
     * @param _correctAnswerHash คำตอบที่ถูกต้องแบบ Hashed
     * @param _hintHash คำใบ้แบบ Hashed
     * @param _difficultyLevel ระดับความยากของคำถาม (1-100)
     * @param _mode โหมดเกมสำหรับคำถามนี้ (Solo หรือ Pool)
     */
    function createQuestion(
        bytes32 _correctAnswerHash,
        bytes32 _hintHash,
        uint256 _difficultyLevel,
        QuestionMode _mode
    ) public onlyGameAdmin {
        require(_correctAnswerHash != bytes32(0), "Quiz: Correct answer hash cannot be zero");
        require(_difficultyLevel >= 1 && _difficultyLevel <= 100, "Quiz: Difficulty level must be between 1 and 100");

        uint256 questionId = nextQuestionId;
        nextQuestionId++;

        // คำนวณ baseRewardAmount ตามระดับความยาก ก่อน Halving
        uint256 calculatedBaseReward;
        if (_difficultyLevel == 100) {
            calculatedBaseReward = REWARD_FOR_LEVEL_100; // 10,000 QZC สำหรับระดับ 100
        } else {
            calculatedBaseReward = (BASE_REWARD_FOR_LEVEL_99 * _difficultyLevel) / 99;
        }

        // ขั้นตอนที่ 1: สร้าง reference ไปยัง struct ใน storage
        Question storage newQuestion = questions[questionId];

        // ขั้นตอนที่ 2: กำหนดค่าให้กับแต่ละฟิลด์ทีละตัว
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
        // ไม่ต้องกำหนดค่าให้ newQuestion.lastAnswerDay เพราะ mapping ถูก initialize โดยอัตโนมัติเมื่อเข้าถึง

        emit QuestionCreated(questionId, msg.sender, _difficultyLevel, calculatedBaseReward);
    }

    /**
     * @dev อนุญาตให้ผู้ใช้ส่งคำตอบสำหรับคำถาม
     * จัดการ Logic ทั้งโหมด Solo และ Pool รวมถึงการจำกัดการส่งคำตอบรายวัน
     * @param _questionId ID ของคำถาม
     * @param _submittedAnswerHash คำตอบที่ถูก Hashed ซึ่งผู้ใช้ส่งมา
     */
    function submitAnswer(uint256 _questionId, bytes32 _submittedAnswerHash) public nonReentrant {
        Question storage question = questions[_questionId];
        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");
        require(_submittedAnswerHash == question.correctAnswerHash, "Quiz: Incorrect answer.");

        uint256 currentDayId = block.timestamp / (24 * 60 * 60); // คำนวณ Day ID ปัจจุบันตาม Unix epoch

        // --- กฎ 1: หนึ่งที่อยู่สามารถเลือกโหมดได้เพียงโหมดเดียวต่อวัน ---
        if (lastPlayedDay[msg.sender] != currentDayId) {
            // ผู้ใช้ยังไม่ได้เล่นวันนี้ หรือเป็นวันใหม่
            // บันทึกโหมดที่เลือกสำหรับวันนี้
            lastPlayedDay[msg.sender] = currentDayId;
            playerModeChoice[msg.sender] = question.mode;
        } else {
            // ผู้ใช้ได้เล่นวันนี้แล้ว ตรวจสอบให้แน่ใจว่าโหมดตรงกับที่เลือกไว้ก่อนหน้าสำหรับวันนี้
            require(playerModeChoice[msg.sender] == question.mode, "Quiz: You have already chosen a different game mode for today.");
        }

        // --- กฎ 2: หนึ่งคำตอบต่อคำถามต่อวันสำหรับคำถามเฉพาะเจาะจงนี้ ---
        require(question.lastAnswerDay[msg.sender] != currentDayId, "Quiz: You can only answer this specific question once per day.");
        question.lastAnswerDay[msg.sender] = currentDayId;

        emit AnswerSubmitted(_questionId, msg.sender, _submittedAnswerHash);

        if (question.mode == QuestionMode.Solo) {
            // --- Logic โหมด Solo ---
            require(question.firstSolverAddress == address(0), "Quiz: Solo mode already solved.");

            question.firstSolverAddress = msg.sender; // ทำเครื่องหมายว่าผู้ใช้นี้แก้ปัญหาได้
            question.isClosed = true; // ปิดคำถามทันที

            uint256 finalReward = _calculateCurrentReward(question.baseRewardAmount, question.difficultyLevel);

            // โอนรางวัลจาก PoolManager ให้ผู้แก้ปัญหา
            // PoolManager ต้องมี MINTER_ROLE สำหรับ QuizCoin
            poolManager.withdrawForUser(msg.sender, finalReward);

            emit RewardDistributed(_questionId, msg.sender, finalReward);
            emit QuestionClosed(_questionId);

        } else if (question.mode == QuestionMode.Pool) {
            // --- Logic โหมด Pool ---
            // ถ้าเป็นคำตอบที่ถูกต้องแรก ให้เริ่มหน้าต่างรางวัล
            if (question.firstCorrectAnswerTime == 0) {
                question.firstCorrectAnswerTime = block.timestamp;
                emit QuestionRewardWindowStarted(_questionId, block.timestamp);
            }

            // ตรวจสอบว่าหน้าต่างรางวัลยังเปิดอยู่
            require(block.timestamp <= question.firstCorrectAnswerTime + BLOCK_DURATION_SECONDS, "Quiz: Pool reward window is closed.");

            // เพิ่มผู้แก้ปัญหาลงในรายการหากยังไม่มี
            bool alreadyInPool = false;
            for (uint256 i = 0; i < question.poolCorrectSolvers.length; i++) {
                if (question.poolCorrectSolvers[i] == msg.sender) {
                    alreadyInPool = true;
                    break;
                }
            }
            if (!alreadyInPool) {
                question.poolCorrectSolvers.push(msg.sender);
            }
            // หมายเหตุ: การกระจายรางวัลสำหรับโหมด Pool จะเกิดขึ้นผ่านการเรียก distributeRewards แยกต่างหาก
        }
    }

    /**
     * @dev กระจายรางวัลสำหรับคำถามโหมด Pool หลังจากหน้าต่างเวลาของมันปิดลง
     * เรียกใช้ได้โดยผู้กระจายรางวัลเท่านั้น
     * @param _questionId ID ของคำถามที่จะกระจายรางวัล
     */
    function distributeRewards(uint256 _questionId) public onlyRewardDistributor nonReentrant {
        Question storage question = questions[_questionId];

        require(question.correctAnswerHash != bytes32(0), "Quiz: Question does not exist.");
        require(!question.isClosed, "Quiz: Question is already closed.");
        require(question.mode == QuestionMode.Pool, "Quiz: Reward distribution is only for Pool mode questions.");

        // ตรวจสอบให้แน่ใจว่าหน้าต่างคำตอบได้ปิดลงแล้ว
        require(block.timestamp >= question.firstCorrectAnswerTime + BLOCK_DURATION_SECONDS, "Quiz: Pool window is not over yet.");

        // ตรวจสอบให้แน่ใจว่ามีผู้แก้ปัญหาที่จะกระจายรางวัลให้
        require(question.poolCorrectSolvers.length > 0, "Quiz: No one answered correctly in Pool mode window.");

        // คำนวณรางวัลสุดท้ายทั้งหมดสำหรับคำถามนี้
        uint256 totalFinalReward = _calculateCurrentReward(question.baseRewardAmount, question.difficultyLevel);

        // คำนวณรางวัลต่อผู้แก้ปัญหา
        uint256 rewardPerSolver = totalFinalReward / question.poolCorrectSolvers.length;

        // ทำเครื่องหมายคำถามว่าปิดแล้ว ก่อนวนลูป เพื่อป้องกันปัญหา Re-entry
        question.isClosed = true;

        // วนลูปผ่านผู้แก้ปัญหาทั้งหมดและกระจายรางวัล
        for (uint256 i = 0; i < question.poolCorrectSolvers.length; i++) {
            address solver = question.poolCorrectSolvers[i];
            // โอนรางวัลจาก PoolManager ให้ผู้แก้ปัญหาแต่ละคน
            poolManager.withdrawForUser(solver, rewardPerSolver);
            emit RewardDistributed(_questionId, solver, rewardPerSolver);
        }

        // ล้างรายการผู้แก้ปัญหาเพื่อประหยัด Gas สำหรับการเรียกใช้ในอนาคต (ไม่บังคับแต่เป็นแนวปฏิบัติที่ดี)
        delete question.poolCorrectSolvers;

        emit QuestionClosed(_questionId);
    }
} // สิ้นสุดบล็อกของสัญญา QuizGame