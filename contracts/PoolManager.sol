// contracts/PoolManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @custom:security-contact security@example.com
contract PoolManager is Initializable, OwnableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");

    // Address ของ QuizCoin token
    IERC20 private s_quizCoin; 

    // Address ของ QuizGame contract ที่ได้รับอนุญาตให้โต้ตอบกับ PoolManager
    address public i_quizGameAddress; 

    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event QuizGameAddressUpdated(address oldAddress, address newAddress);


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _quizCoinAddress, address _initialOwner, address _defaultAdmin) public initializer {
        __Ownable_init(_initialOwner);
        __AccessControl_init(); 
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin); 
        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner); 
        _grantRole(POOL_MANAGER_ROLE, _initialOwner); // Grant initial owner the POOL_MANAGER_ROLE initially

        require(_quizCoinAddress != address(0), "QuizCoin address cannot be zero");
        s_quizCoin = IERC20(_quizCoinAddress);
    }

    // Public getter function for s_quizCoin
    function quizCoin() public view returns (address) {
        return address(s_quizCoin);
    }

    /**
     * @notice ฟังก์ชันนี้ใช้สำหรับตั้งค่า address ของ QuizGame Contract
     * มีเพียงเจ้าของสัญญาเท่านั้นที่สามารถเรียกฟังก์ชันนี้ได้
     * @param _quizGameAddress The address of the QuizGame contract.
     */
    function setQuizGameAddress(address _quizGameAddress) public onlyOwner {
        require(_quizGameAddress != address(0), "QuizGame address cannot be zero");
        
        // Revoke POOL_MANAGER_ROLE from old QuizGame address if it was set
        if (i_quizGameAddress != address(0)) {
            _revokeRole(POOL_MANAGER_ROLE, i_quizGameAddress);
        }
        
        emit QuizGameAddressUpdated(i_quizGameAddress, _quizGameAddress);
        i_quizGameAddress = _quizGameAddress;
        
        // Grant POOL_MANAGER_ROLE to the new QuizGame address
        _grantRole(POOL_MANAGER_ROLE, _quizGameAddress);
    }

    /**
     * @notice ฟังก์ชันรับฝาก QuizCoin จากผู้เล่นเข้าสู่ Pool
     * ผู้ส่ง (msg.sender) ต้องทำการ approve PoolManager ก่อนเรียกฟังก์ชันนี้
     * @param _amount จำนวน QuizCoin ที่ต้องการฝาก
     */
    function deposit(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");
        require(s_quizCoin.transferFrom(msg.sender, address(this), _amount), "Pool: Deposit transfer failed.");
        emit Deposited(msg.sender, _amount);
    }

    /**
     * @notice ฟังก์ชันสำหรับเบิก QuizCoin ออกจาก Pool ให้กับผู้ใช้
     * ฟังก์ชันนี้มีเพียง Contract ที่มี POOL_MANAGER_ROLE เท่านั้นที่สามารถเรียกได้
     * (ในกรณีนี้คือ QuizGame contract)
     * @param _user The address of the user to withdraw for.
     * @param _amount The amount of QuizCoin to withdraw.
     */
    function withdrawForUser(address _user, uint256 _amount) external onlyRole(POOL_MANAGER_ROLE) {
        // ตรวจสอบว่าผู้เรียกคือ i_quizGameAddress (เสริมความปลอดภัย)
        require(msg.sender == i_quizGameAddress, "Pool: Caller must be the authorized QuizGame contract.");
        require(_amount > 0, "Amount must be greater than zero");
        require(s_quizCoin.balanceOf(address(this)) >= _amount, "Pool: Insufficient balance for withdrawal.");
        
        require(s_quizCoin.transfer(_user, _amount), "Pool: Withdrawal transfer failed.");
        emit Withdrawn(_user, _amount);
    }

    /**
     * @notice ตรวจสอบยอดคงเหลือของ QuizCoin ใน PoolManager
     */
    function getPoolBalance() public view returns (uint256) {
        return s_quizCoin.balanceOf(address(this));
    }

    /**
     * @notice เพื่อให้ PoolManager สามารถอัปเกรดได้ มีเพียงเจ้าของเท่านั้นที่สามารถเรียกได้
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // *** ลบทั้ง fallback() และ receive() function ออกไปเลย ***
    // สัญญาจะปฏิเสธการรับ Ether โดยอัตโนมัติและคืนเงินให้ผู้ส่ง
}