// contracts/PoolManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IPoolManager.sol"; // เพื่อ implements interface

contract PoolManager is AccessControl, IPoolManager {
    using SafeERC20 for IERC20; // ใช้ SafeERC20

    // Roles
    bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE"); // อาจจะไม่ได้ใช้โดยตรงใน QuizGame
    bytes32 public constant GAME_ADMIN_ROLE_IN_POOL_MANAGER = keccak256("GAME_ADMIN_ROLE_IN_POOL_MANAGER"); // Role สำหรับ QuizGame Contract

    // แก้ไข: เปลี่ยนประเภทของ quizCoin จาก QuizCoin เป็น IERC20
    IERC20 public quizCoin;
    address public developerFundAddress; // Address เพื่อรับค่า hint cost

    mapping(address => uint256) public poolBalances; // ยอดเงินใน Pool ของแต่ละผู้เล่น

    event Deposited(address indexed user, uint256 amount);
    event Withdrew(address indexed user, uint256 amount);
    event HintCostWithdrawn(address indexed user, uint256 amount, address indexed recipient);
    event DeveloperFundAddressSet(address indexed _newAddress);

    constructor(address _quizCoinAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); // ผู้สร้างเป็น admin
        quizCoin = IERC20(_quizCoinAddress); // Cast to IERC20
        developerFundAddress = msg.sender; // ตั้งค่าเริ่มต้น
    }

    /// @notice Allows admin to set the developer fund address.
    /// @param _newAddress The new address for the developer fund.
    function setDeveloperFundAddress(address _newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newAddress != address(0), "PoolManager: New address cannot be zero");
        developerFundAddress = _newAddress;
        emit DeveloperFundAddressSet(_newAddress);
    }

    /// @notice Players deposit QZC into their pool.
    /// @param _amount Amount of QZC to deposit.
    function deposit(uint256 _amount) public {
        require(_amount > 0, "PoolManager: Deposit amount must be greater than zero");
        // โอน QZC จากผู้เล่นเข้าสัญญา PoolManager - ต้องมีการ approve ก่อน
        quizCoin.safeTransferFrom(msg.sender, address(this), _amount);
        poolBalances[msg.sender] += _amount;
        emit Deposited(msg.sender, _amount);
    }

    /// @notice Players withdraw QZC from their pool.
    /// @param _amount Amount of QZC to withdraw.
    function withdraw(uint256 _amount) public {
        require(_amount > 0, "PoolManager: Withdraw amount must be greater than zero");
        require(poolBalances[msg.sender] >= _amount, "PoolManager: Insufficient balance in pool");
        poolBalances[msg.sender] -= _amount;
        // โอน QZC จากสัญญา PoolManager ไปผู้เล่น
        quizCoin.safeTransfer(msg.sender, _amount);
        emit Withdrew(msg.sender, _amount);
    }

    /// @notice Allows QuizGame contract (with GAME_ADMIN_ROLE_IN_POOL_MANAGER) to withdraw hint cost.
    /// @param _from The address of the player to withdraw from.
    /// @param _amount The amount of QZC to withdraw as hint cost.
    function withdrawForHint(address _from, uint256 _amount) public onlyRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER) {
        require(_amount > 0, "PoolManager: Hint cost must be greater than zero");
        require(poolBalances[_from] >= _amount, "PoolManager: Player has insufficient QZC in pool for hint");
        
        poolBalances[_from] -= _amount;
        // โอนค่า Hint จาก PoolManager ไปยัง Developer Fund Address
        // PoolManager ไม่ต้องมี Role ใน QuizCoin เพราะเป็น transfer จาก balance ของ PoolManager เอง
        quizCoin.safeTransfer(developerFundAddress, _amount);
        emit HintCostWithdrawn(_from, _amount, developerFundAddress);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}