// contracts/QuizGame.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // ใช้ Solidity 0.8.20 หรือใหม่กว่า

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./QuizCoin.sol"; // Import QuizCoin contract (สำหรับเรียก mint)
import "./interfaces/IPoolManager.sol"; // Import the interface

contract QuizGame is AccessControl {
    // --- Roles ---
    // AccessControl จะประกาศ DEFAULT_ADMIN_ROLE ให้เราอยู่แล้ว
    bytes32 public constant GAME_ADMIN_ROLE = keccak256("GAME_ADMIN_ROLE"); // Role ที่คุณกำหนดเอง (ใน PoolManager ใช้ชื่อคล้ายกัน)

    // --- State Variables ---
    QuizCoin public quizCoin; // Instance of the QuizCoin contract (ใช้ QuizCoin เพื่อเรียก mint)
    IPoolManager public poolManager; // Instance of the PoolManager contract

    address public developerFundAddress; // Address to receive fees (hint cost, reward fee)

    // Struct to store question details
    struct Question {
        uint256 id;
        bytes32 answerHash; // Hash of the correct answer
        bytes32 hintHash;   // Hash of the hint text
        uint256 difficulty; // Difficulty level
        uint256 hintCost;   // Cost to get a hint in QZC
        bool isSolved;      // True if the question has been solved
        address solver;     // Address of the solver
        uint256 createdBlock; // Block number when question was created
    }

    mapping(uint256 => Question) public questions; // Maps question ID to Question struct
    uint256 public nextQuestionId; // Counter for new question IDs

    // --- Reward System Parameters ---
    uint256 public constant INITIAL_BASE_REWARD_LEVEL_1_99 = 5000 * (10 ** 18); // 5000 QZC for difficulty 1-99 (initial)
    uint256 public constant MIN_REWARD_LEVEL_1_99 = 100 * (10 ** 18); // 100 QZC min for difficulty 1-99
    uint256 public constant REWARD_MULTIPLIER_LEVEL_1_99 = 100; // Multiplier for difficulty 1-99 (e.g., diff 10 -> 10*100 = 1000%)
    
    uint256 public constant INITIAL_REWARD_LEVEL_100 = 20000 * (10 ** 18); // 20000 QZC for difficulty 100 (initial)
    uint256 public constant MIN_REWARD_LEVEL_100 = 10000 * (10 ** 18); // 10000 QZC min for difficulty 100

    uint256 public constant BLOCKS_PER_HALVING_PERIOD = 42076800; // Approximately 6 months (1 block/3s * 60s/min * 60min/hr * 24hr/day * 30 days/month * 6 months)
    uint256 public constant HALVING_RATE_BPS = 5000; // 50% halving rate (5000 basis points)

    uint256 public constant REWARD_FEE_PERCENTAGE_BPS = 500; // 5% fee (500 basis points) from the reward

    // --- Events ---
    event QuestionCreated(uint256 indexed id, uint256 difficulty, uint256 hintCost);
    event QuestionSolved(uint256 indexed id, address indexed solver, uint256 rewardAmount, uint256 feeAmount);
    event HintRequested(uint256 indexed questionId, address indexed requester, uint256 hintCost);
    event PoolManagerAddressSet(address indexed _poolManagerAddress);
    event DeveloperFundAddressSet(address indexed _newAddress);
    event RewardFeeTransferred(address indexed to, uint256 amount); // New event for clarity

    // --- Constructor ---
    constructor(address _quizCoinAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); // ทำให้ Deployer เป็น Admin ทันที
        
        quizCoin = QuizCoin(_quizCoinAddress);
        nextQuestionId = 1; // Initialize question ID counter
        developerFundAddress = msg.sender; // Set deployer as initial developer fund address
    }

    // --- Admin Functions ---

    /// @notice Allows the DEFAULT_ADMIN_ROLE to set the PoolManager contract address.
    /// @param _poolManagerAddress The address of the deployed PoolManager contract.
    function setPoolManagerAddress(address _poolManagerAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_poolManagerAddress != address(0), "QuizGame: PoolManager address cannot be zero");
        poolManager = IPoolManager(_poolManagerAddress);
        emit PoolManagerAddressSet(_poolManagerAddress);
    }

    /// @notice Allows the DEFAULT_ADMIN_ROLE to set the developer fund address.
    /// @param _newAddress The new address for the developer fund.
    function setDeveloperFundAddress(address _newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newAddress != address(0), "QuizGame: New address cannot be zero");
        developerFundAddress = _newAddress;
        emit DeveloperFundAddressSet(_newAddress);
    }

    // --- User Functions ---

    /// @notice Allows anyone to create a new question. (ถ้าต้องการให้ admin เท่านั้น ให้ใส่ onlyRole(DEFAULT_ADMIN_ROLE))
    /// @param _answerHash Keccak256 hash of the correct answer.
    /// @param _hintHash Keccak256 hash of the hint text.
    /// @param _difficulty Difficulty level of the question (1-100).
    /// @param _hintCost Cost in QZC to get a hint.
    /// @return The ID of the newly created question.
    // แก้ไข: เพิ่ม onlyRole(DEFAULT_ADMIN_ROLE) หากต้องการให้เฉพาะ admin สร้างคำถามได้
    function createQuestion(bytes32 _answerHash, bytes32 _hintHash, uint256 _difficulty, uint256 _hintCost) public onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        require(_answerHash != bytes32(0), "QuizGame: Answer hash cannot be zero");
        require(_difficulty > 0 && _difficulty <= 100, "QuizGame: Difficulty must be between 1 and 100");
        require(_hintCost > 0, "QuizGame: Hint cost must be greater than zero");

        questions[nextQuestionId] = Question({
            id: nextQuestionId,
            answerHash: _answerHash,
            hintHash: _hintHash,
            difficulty: _difficulty,
            hintCost: _hintCost,
            isSolved: false,
            solver: address(0),
            createdBlock: block.number
        });

        emit QuestionCreated(nextQuestionId, _difficulty, _hintCost);
        nextQuestionId++; // Increment for the next question
        return nextQuestionId - 1; // Return the ID of the just-created question
    }

    /// @notice Allows a player to submit an answer for a question.
    /// @param _questionId The ID of the question.
    /// @param _answer The actual answer string (e.g., "4").
    function submitAnswer(uint256 _questionId, string calldata _answer) public {
        require(questions[_questionId].id != 0, "QuizGame: Question does not exist");
        require(!questions[_questionId].isSolved, "QuizGame: Question already solved");

        bytes32 hashedAnswer = keccak256(abi.encodePacked(_answer));
        require(hashedAnswer == questions[_questionId].answerHash, "QuizGame: Incorrect answer");

        questions[_questionId].isSolved = true;
        questions[_questionId].solver = msg.sender;

        _mintReward(msg.sender, _questionId);
    }

    /// @notice Allows a player to get a hint for a question by paying QZC from their pool.
    /// @param _questionId The ID of the question.
    /// @return The hash of the hint text.
    function getHint(uint256 _questionId) public returns (bytes32) {
        require(questions[_questionId].id != 0, "QuizGame: Question does not exist");
        require(questions[_questionId].hintHash != bytes32(0), "QuizGame: No hint available for this question");
        
        // Ensure PoolManager is set before interacting with it
        require(address(poolManager) != address(0), "QuizGame: PoolManager not set");

        // Request PoolManager to withdraw hint cost from player's pool
        poolManager.withdrawForHint(msg.sender, questions[_questionId].hintCost);

        emit HintRequested(_questionId, msg.sender, questions[_questionId].hintCost);
        return questions[_questionId].hintHash;
    }

    // --- Internal/Pure/View Functions ---

    /// @notice Calculates the reward for a given difficulty based on halving periods.
    /// @param _difficulty The difficulty level of the question.
    /// @return The calculated reward in QuizCoin wei.
    function calculateReward(uint256 _difficulty) public view returns (uint256) {
        uint256 currentBlockNumber = block.number;
        uint256 halvingPeriods = currentBlockNumber / BLOCKS_PER_HALVING_PERIOD;

        uint256 baseReward;
        uint256 minReward;

        if (_difficulty < 100) {
            baseReward = INITIAL_BASE_REWARD_LEVEL_1_99;
            minReward = MIN_REWARD_LEVEL_1_99;
            // คำนวณ baseReward โดยใช้ difficulty
            // เช่น difficulty 10 -> baseReward = (5000 * 10) / 100 = 500 QZC
            baseReward = (baseReward * _difficulty) / REWARD_MULTIPLIER_LEVEL_1_99;
            minReward = (minReward * _difficulty) / REWARD_MULTIPLIER_LEVEL_1_99;
            if (minReward == 0 && _difficulty > 0) minReward = 1 * (10**18); // Ensure minimum is at least 1 QZC for diff > 0
        } else { // Difficulty 100
            baseReward = INITIAL_REWARD_LEVEL_100;
            minReward = MIN_REWARD_LEVEL_100;
        }

        // Apply halving
        for (uint256 i = 0; i < halvingPeriods; i++) {
            baseReward = (baseReward * HALVING_RATE_BPS) / 10000;
            if (baseReward < minReward) {
                baseReward = minReward;
                break;
            }
        }
        return baseReward;
    }

    /// @notice Mints the reward for a solver and applies the fee.
    /// @param solver The address of the player who solved the question.
    /// @param questionId The ID of the solved question.
    function _mintReward(address solver, uint256 questionId) internal {
        uint256 reward = calculateReward(questions[questionId].difficulty);
        uint256 feeAmount = (reward * REWARD_FEE_PERCENTAGE_BPS) / 10000;
        uint256 amountToPlayer = reward - feeAmount;

        // Mint reward to the solver (QuizGame ต้องมี MINTER_ROLE ใน QuizCoin)
        quizCoin.mint(solver, amountToPlayer); 

        // Mint ค่าธรรมเนียมตรงไปที่ dev fund (QuizGame ต้องมี MINTER_ROLE ใน QuizCoin)
        if (feeAmount > 0) {
            require(developerFundAddress != address(0), "QuizGame: Developer fund address not set for reward fees");
            quizCoin.mint(developerFundAddress, feeAmount);
            emit RewardFeeTransferred(developerFundAddress, feeAmount);
        }
        
        emit QuestionSolved(questionId, solver, amountToPlayer, feeAmount);
    }

    // --- AccessControl required function ---
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}