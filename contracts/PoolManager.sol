// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// นำเข้าไลบรารี OpenZeppelin เวอร์ชัน Upgradeable
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // <-- เพิ่มบรรทัดนี้
// บรรทัดนี้ถูกลบออก: import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// Interface สำหรับสัญญา QuizCoin (เพื่อให้ PoolManager สามารถโต้ตอบกับ QuizCoin ได้)
interface IQuizCoin {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

// Interface สำหรับสัญญา QuizGame (เพื่อให้ PoolManager สามารถตรวจสอบบทบาทของ QuizGame ได้)
interface IQuizGame {
    function hasRole(bytes32 role, address account) external view returns (bool);
    // บรรทัดนี้ถูกลบออก: bytes32 constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");
}

contract PoolManager is Initializable, OwnableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable { // <-- เพิ่ม UUPSUpgradeable ที่นี่
    // ตัวแปรสถานะ
    IQuizCoin public i_quizCoin; // Instance ของสัญญา QuizCoin
    address public i_quizGameAddress; // ที่อยู่ของสัญญา QuizGame

    mapping(address => uint256) public poolBalances; // ยอดคงเหลือ QZC ของแต่ละผู้เล่นใน Pool

    // บทบาทสำหรับ AccessControl
    // Role นี้จะถูกมอบให้ QuizGame เพื่อให้สามารถถอนเงินจาก Pool ของผู้เล่นได้เมื่อซื้อ Hint
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");

    // Events ที่เพิ่มเข้ามา
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    // Constructor นี้มีไว้เพื่อป้องกันการเรียก 'initialize' โดยตรงเท่านั้น
    constructor() {
        _disableInitializers(); 
    }

    // ฟังก์ชัน initialize จะถูกเรียกเพียงครั้งเดียวเมื่อสัญญาถูก Deploy ผ่าน Proxy
    // ใช้สำหรับกำหนดค่าเริ่มต้นของสัญญา
    function initialize(address _quizCoinAddress, address _quizGameAddress) public initializer {
        // เรียก initialize ของสัญญาแม่
        __Ownable_init(msg.sender);
        __AccessControl_init();
        // ไม่ต้องเรียก __UUPSUpgradeable_init() ที่นี่ เพราะ OwnableUpgradeable และ AccessControlUpgradeable จัดการให้แล้ว

        // กำหนดค่าเริ่มต้นให้กับตัวแปรสถานะ
        i_quizCoin = IQuizCoin(_quizCoinAddress);
        i_quizGameAddress = _quizGameAddress; // ตั้งค่า QuizGame Address ในตอนเริ่มต้น

        // มอบบทบาทเริ่มต้นให้ผู้ Deploy (สำหรับ Admin Role)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); // <-- แก้ไขจาก DEFAULT_ADMIN_ADMIN_ROLE เป็น DEFAULT_ADMIN_ROLE
        // PoolManager จะไม่ได้รับ POOL_MANAGER_ROLE ให้ตัวเอง เพราะบทบาทนี้มีไว้สำหรับ QuizGame ที่จะเรียก PoolManager
    }

    // ฟังก์ชันฝาก QZC เข้า Pool
    function deposit(uint256 _amount) public {
        if (_amount == 0) {
            revert ZeroDepositAmount();
        }

        // ตรวจสอบว่าผู้เล่นได้อนุมัติให้ PoolManager ถอน QZC ไปยังสัญญา PoolManager ได้
        if (i_quizCoin.allowance(msg.sender, address(this)) < _amount) {
            revert InsufficientAllowance();
        }

        // โอน QZC จากผู้เล่นไปยังสัญญา PoolManager
        bool success = i_quizCoin.transferFrom(msg.sender, address(this), _amount);
        if (!success) {
            revert TransferFailed();
        }
        poolBalances[msg.sender] += _amount; // เพิ่มยอดใน Pool Balance ของผู้เล่น

        emit Deposited(msg.sender, _amount);
    }

    // ฟังก์ชันถอน QZC ออกจาก Pool (สำหรับผู้เล่นถอนของตัวเอง)
    function withdraw(uint256 _amount) public {
        if (_amount == 0) {
            revert ZeroWithdrawAmount();
        }
        // ป้องกันไม่ให้สัญญา QuizGame เรียกฟังก์ชันนี้โดยตรง
        if (msg.sender == i_quizGameAddress) {
             revert UnauthorizedWithdraw(); 
        }

        // ตรวจสอบยอดคงเหลือของผู้เล่นใน Pool
        if (poolBalances[msg.sender] < _amount) {
            revert InsufficientBalance();
        }

        poolBalances[msg.sender] -= _amount; // ลดยอดใน Pool Balance ของผู้เล่น
        bool success = i_quizCoin.transfer(msg.sender, _amount); // โอน QZC กลับไปให้ผู้เล่น
        if (!success) {
            revert TransferFailed();
        }

        emit Withdrawn(msg.sender, _amount);
    }

    // ฟังก์ชันสำหรับ QuizGame Contract เพื่อถอน QZC ของผู้เล่นที่ซื้อ Hint
    // เฉพาะผู้ที่มี POOL_MANAGER_ROLE (ซึ่งก็คือ QuizGame Contract) เท่านั้นที่เรียกได้
    function withdrawForUser(address _user, uint256 _amount) public onlyRole(POOL_MANAGER_ROLE) {
        // ตรวจสอบว่าผู้เรียกฟังก์ชันนี้คือ QuizGame Contract จริงๆ
        if (msg.sender != i_quizGameAddress) {
            revert UnauthorizedCaller(); // อนุญาตให้ QuizGame เท่านั้นที่เรียกได้
        }
        if (_amount == 0) {
            revert ZeroWithdrawAmount();
        }
        if (poolBalances[_user] < _amount) {
            revert InsufficientBalance();
        }

        poolBalances[_user] -= _amount; // ลดยอดใน Pool Balance ของผู้เล่น
        bool success = i_quizCoin.transfer(_user, _amount); // โอน QZC ให้ผู้ใช้โดยตรง
        if (!success) {
            revert TransferFailed();
        }
        emit Withdrawn(_user, _amount);
    }

    // Setter สำหรับเปลี่ยนที่อยู่ของ QuizGame
    // เฉพาะเจ้าของสัญญาเท่านั้นที่เรียกได้
    function setQuizGameAddress(address _newQuizGameAddress) public onlyOwner {
        if (_newQuizGameAddress == address(0)) {
            revert InvalidAddress();
        }
        i_quizGameAddress = _newQuizGameAddress;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    // ฟังก์ชันสำหรับดูยอดคงเหลือของผู้เล่นใน Pool
    function getBalance(address _user) public view returns (uint256) {
        return poolBalances[_user];
    }

    // Custom Errors
    error ZeroDepositAmount();
    error InsufficientAllowance();
    error ZeroWithdrawAmount();
    error InsufficientBalance();
    error InvalidAddress();
    error TransferFailed();
    error UnauthorizedWithdraw();
    error UnauthorizedCaller();
}