// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol"; // ตรวจสอบว่ามีบรรทัดนี้
// import "@openzeppelin/contracts/utils/math/SafeMath.sol"; // บรรทัดนี้ต้องถูกลบไปแล้ว

import "./QuizCoin.sol";
import "./QuizGame.sol";

contract PoolManager is AccessControl {
    // using SafeMath for uint256; // บรรทัดนี้ต้องถูกลบไปแล้ว

    QuizCoin public quizCoin;
    QuizGame public quizGame; // เพิ่มตัวแปรนี้

    bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

    // <<<--- ตำแหน่งที่ถูกต้องสำหรับการประกาศ struct และ mapping --->>>
    struct PoolData {
        uint256 questionId;
        address[] participantsInWindow;
        mapping(address => bool) hasParticipated;
        bool isSettled;
        uint256 totalRewardToMint;
        uint256 totalFeeAmount;
    }

    mapping(uint256 => PoolData) public pools;
    // <<<--- สิ้นสุดตำแหน่งที่ถูกต้อง --->>>


    // Constants
    uint256 public constant POOL_SOLVE_WINDOW_DURATION = 3 minutes;
    uint256 public constant REWARD_FEE_PERCENTAGE_BPS = 50;

    event PoolAnswerSubmitted(uint256 indexed questionId, address indexed participant, bool indexed isInitiator);
    event PoolSettled(uint256 indexed questionId, uint256 totalRewardMinted, address[] indexed winners);
    event PoolFeeBurned(uint256 indexed questionId, uint256 feeAmount);

    // แก้ไข constructor ให้รับ _quizGameAddress ด้วย
    constructor(address _quizCoinAddress, address _quizGameAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POOL_ADMIN_ROLE, msg.sender);
        require(_quizCoinAddress != address(0), "PoolManager: Invalid QuizCoin address");
        quizCoin = QuizCoin(_quizCoinAddress);
        
        require(_quizGameAddress != address(0), "PoolManager: Invalid QuizGame address");
        quizGame = QuizGame(_quizGameAddress);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ฟังก์ชัน setQuizGameAddress ถูกลบออกไปแล้วใน deploy.js เพราะเราตั้งค่าใน constructor แทน

    function submitPoolAnswer(uint256 _questionId, bytes32 _userAnswerHash) public {
        // แก้ไขการเรียก getter function ของ mapping public questions ใน QuizGame
        (
            bytes32 correctAnswerHash,
            uint8 difficulty,
            uint256 startTime,
            bytes32 hintTextHash,
            uint256 hintCost,
            bool exists,
            bool isSolved,
            address solverAddress,
            uint256 rewardMinted,
            uint256 solvedTime,
            bool isPoolInitiated,
            uint256 poolInitiatedTime
        ) = quizGame.questions(_questionId);

        require(exists, "PoolManager: Question does not exist");
        require(!isSolved, "PoolManager: Question already solved by Solo or settled Pool");
        require(correctAnswerHash == _userAnswerHash, "PoolManager: Incorrect answer");

        PoolData storage currentPool = pools[_questionId];

        require(!currentPool.hasParticipated[msg.sender], "PoolManager: Already submitted correct answer to this pool");

        if (!isPoolInitiated) {
            quizGame.initiatePoolSolve(_questionId, msg.sender);
            currentPool.participantsInWindow.push(msg.sender);
            currentPool.hasParticipated[msg.sender] = true;
            emit PoolAnswerSubmitted(_questionId, msg.sender, true);
        } else {
            require(block.timestamp <= poolInitiatedTime + POOL_SOLVE_WINDOW_DURATION, "PoolManager: Pool submission window closed");
            currentPool.participantsInWindow.push(msg.sender);
            currentPool.hasParticipated[msg.sender] = true;
            emit PoolAnswerSubmitted(_questionId, msg.sender, false);
        }
    }

    function settlePool(uint256 _questionId) public onlyRole(POOL_ADMIN_ROLE) {
        // แก้ไขการเรียก getter function ของ mapping public questions ใน QuizGame
        (
            bytes32 correctAnswerHash, // ไม่ได้ใช้
            uint8 difficulty,
            uint256 startTime, // ไม่ได้ใช้
            bytes32 hintTextHash, // ไม่ได้ใช้
            uint256 hintCost, // ไม่ได้ใช้
            bool exists,
            bool isSolved,
            address solverAddress, // ไม่ได้ใช้
            uint256 rewardMinted, // ไม่ได้ใช้
            uint256 solvedTime, // ไม่ได้ใช้
            bool isPoolInitiated,
            uint256 poolInitiatedTime
        ) = quizGame.questions(_questionId);

        PoolData storage currentPool = pools[_questionId];

        require(exists, "PoolManager: Question does not exist");
        require(!isSolved, "PoolManager: Question already solved");
        require(isPoolInitiated, "PoolManager: Pool not initiated");
        require(!currentPool.isSettled, "PoolManager: Pool already settled");

        require(block.timestamp >= poolInitiatedTime + POOL_SOLVE_WINDOW_DURATION, "PoolManager: Pool window not yet closed");

        address[] memory actualWinners = new address[](currentPool.participantsInWindow.length);
        uint256 winnerCount = 0;

        for (uint i = 0; i < currentPool.participantsInWindow.length; i++) {
            address participant = currentPool.participantsInWindow[i];
            actualWinners[winnerCount] = participant;
            winnerCount++;
        }
        
        address[] memory finalWinners = new address[](winnerCount);
        for (uint i = 0; i < winnerCount; i++) {
            finalWinners[i] = actualWinners[i];
        }

        uint256 totalRewardToMint = quizGame.calculateReward(difficulty);
        uint256 totalFeeAmount = 0;

        if (winnerCount > 0) {
            uint256 rewardPerWinner = totalRewardToMint / winnerCount; // แก้ไข: ใช้ / แทน .div()
            uint256 feePerWinner = rewardPerWinner * REWARD_FEE_PERCENTAGE_BPS / 10_000; // แก้ไข: ใช้ * แทน .mul()
            uint256 netRewardPerWinner = rewardPerWinner - feePerWinner; // แก้ไข: ใช้ - แทน .sub()

            totalFeeAmount = feePerWinner * winnerCount; // แก้ไข: ใช้ * แทน .mul()

            for (uint i = 0; i < winnerCount; i++) {
                if (finalWinners[i] != address(0)) {
                    quizCoin.mint(finalWinners[i], netRewardPerWinner);
                }
            }
            quizCoin.transfer(address(quizCoin), totalFeeAmount);
            quizCoin.burn(totalFeeAmount);
        }

        currentPool.isSettled = true;
        currentPool.totalRewardToMint = totalRewardToMint;
        currentPool.totalFeeAmount = totalFeeAmount;

        quizGame.settlePoolQuestion(_questionId, address(0), totalRewardToMint);

        emit PoolSettled(_questionId, totalRewardToMint, finalWinners);
        emit PoolFeeBurned(_questionId, totalFeeAmount);
    }
}