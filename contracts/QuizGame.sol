// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./QuizCoin.sol";

contract QuizGame is AccessControl {
    QuizCoin public quizCoin;
    bytes32 public constant GAME_ADMIN_ROLE = keccak256("GAME_ADMIN_ROLE");

    struct Question {
        bytes32 correctAnswerHash;
        uint8 difficulty;
        uint256 startTime;
        bytes32 hintTextHash;
        uint256 hintCost;
        bool exists;
        bool isSolved;
        address solverAddress;
        uint256 rewardMinted;
        uint256 solvedTime;
        bool isPoolInitiated;
        uint256 poolInitiatedTime;
    }

    mapping(uint256 => Question) public questions;
    uint256 public nextQuestionId;
    mapping(uint256 => mapping(address => uint256)) public lastAnswerAttemptDay;

    uint256 public constant LEVEL_100_REWARD_AMOUNT = 10_000 * (10 ** 18);
    uint256 public constant POOL_SOLVE_WINDOW_DURATION = 3 minutes;
    uint256 public constant REWARD_FEE_PERCENTAGE_BPS = 50;

    uint256 public constant BLOCKS_PER_HALVING_PERIOD = 700_800; // Adjust as needed for BSC Testnet block time
    uint256 public constant INITIAL_BASE_REWARD_LEVEL_1_99 = 100 * (10 ** 18);

    event QuestionCreated(uint256 indexed questionId, uint8 difficulty, uint256 startTime);
    event QuestionSolved(uint256 indexed questionId, address indexed solver, uint256 rewardAmount, bool isSoloSolve);
    event PoolSolveInitiated(uint256 indexed questionId, address indexed initiator, uint256 initiatedTime);
    event HintBought(uint256 indexed questionId, address indexed buyer, uint256 cost);

    constructor(address _quizCoinAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GAME_ADMIN_ROLE, msg.sender);
        require(_quizCoinAddress != address(0), "QuizGame: Invalid QuizCoin address");
        quizCoin = QuizCoin(_quizCoinAddress);
        nextQuestionId = 1;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function createQuestion(bytes32 _correctAnswerHash, uint8 _difficulty, bytes32 _hintTextHash, uint256 _hintCost) public onlyRole(GAME_ADMIN_ROLE) returns (uint256) {
        require(_difficulty >= 1 && _difficulty <= 100, "QuizGame: Difficulty must be between 1 and 100");
        require(_correctAnswerHash != bytes32(0), "QuizGame: Correct answer hash cannot be empty");

        questions[nextQuestionId] = Question({
            correctAnswerHash: _correctAnswerHash,
            difficulty: _difficulty,
            startTime: block.timestamp,
            hintTextHash: _hintTextHash,
            hintCost: _hintCost,
            exists: true,
            isSolved: false,
            solverAddress: address(0),
            rewardMinted: 0,
            solvedTime: 0,
            isPoolInitiated: false,
            poolInitiatedTime: 0
        });

        emit QuestionCreated(nextQuestionId, _difficulty, block.timestamp);
        nextQuestionId++;
        return nextQuestionId - 1;
    }

    function submitAnswer(uint256 _questionId, bytes32 _userAnswerHash) public {
        Question storage q = questions[_questionId];
        require(q.exists, "QuizGame: Question does not exist");
        require(!q.isSolved, "QuizGame: Question already solved");

        uint256 currentDay = block.timestamp / 1 days;
        require(lastAnswerAttemptDay[_questionId][msg.sender] != currentDay, "QuizGame: You can only attempt this question once per day.");

        require(q.correctAnswerHash == _userAnswerHash, "QuizGame: Incorrect answer");

        if (!q.isPoolInitiated || (q.isPoolInitiated && block.timestamp > q.poolInitiatedTime + POOL_SOLVE_WINDOW_DURATION)) {
            uint256 rewardAmount = calculateReward(q.difficulty);
            uint256 feeAmount = rewardAmount * REWARD_FEE_PERCENTAGE_BPS / 10_000;
            uint256 netReward = rewardAmount - feeAmount;

            q.isSolved = true;
            q.solverAddress = msg.sender;
            q.rewardMinted = rewardAmount;
            q.solvedTime = block.timestamp;

            quizCoin.mint(msg.sender, netReward);
            
            quizCoin.transfer(address(quizCoin), feeAmount);
            quizCoin.burn(feeAmount);
            
            emit QuestionSolved(_questionId, msg.sender, rewardAmount, true);
        } else {
            revert("QuizGame: Use PoolManager for Pool submissions");
        }

        lastAnswerAttemptDay[_questionId][msg.sender] = currentDay;
    }

    function buyHint(uint256 _questionId) public {
        Question storage q = questions[_questionId];
        require(q.exists, "QuizGame: Question does not exist");
        require(q.hintCost > 0, "QuizGame: No hint available or free");

        quizCoin.transferFrom(msg.sender, address(quizCoin), q.hintCost);
        
        quizCoin.burn(q.hintCost);
        
        emit HintBought(_questionId, msg.sender, q.hintCost);
    }

    function initiatePoolSolve(uint256 _questionId, address _initiator) public onlyRole(GAME_ADMIN_ROLE) {
        Question storage q = questions[_questionId];
        require(q.exists, "QuizGame: Question does not exist");
        require(!q.isSolved, "QuizGame: Question already solved");
        require(!q.isPoolInitiated, "QuizGame: Pool already initiated");

        q.isPoolInitiated = true;
        q.poolInitiatedTime = block.timestamp;
        emit PoolSolveInitiated(_questionId, _initiator, block.timestamp);
    }

    function settlePoolQuestion(uint256 _questionId, address _finalSolver, uint256 _totalRewardMinted) public onlyRole(GAME_ADMIN_ROLE) {
        Question storage q = questions[_questionId];
        require(q.exists, "QuizGame: Question does not exist");
        require(!q.isSolved, "QuizGame: Question already solved");
        require(q.isPoolInitiated, "QuizGame: Pool not initiated");
        
        require(block.timestamp >= q.poolInitiatedTime + POOL_SOLVE_WINDOW_DURATION, "QuizGame: Pool window not closed");

        q.isSolved = true;
        q.solverAddress = _finalSolver;
        q.rewardMinted = _totalRewardMinted;
        q.solvedTime = block.timestamp;

        emit QuestionSolved(_questionId, address(0), _totalRewardMinted, false);
    }

    function calculateReward(uint8 _difficulty) public view returns (uint256) {
        if (_difficulty == 100) {
            return LEVEL_100_REWARD_AMOUNT;
        }

        uint256 currentBlockNumber = block.number;
        uint256 halvingPeriods = currentBlockNumber / BLOCKS_PER_HALVING_PERIOD;

        uint256 baseReward = INITIAL_BASE_REWARD_LEVEL_1_99;
        if (halvingPeriods > 0) {
            baseReward = baseReward / (2 ** halvingPeriods);
        }

        return baseReward * _difficulty;
    }
}