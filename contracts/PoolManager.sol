// contracts/PoolManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IQuizCoin.sol"; // ตรวจสอบว่ามี IQuizCoin.sol อยู่ในโฟลเดอร์เดียวกันหรือเปล่า

contract PoolManager is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    IQuizCoin public quizCoin;
    address public quizGameAddress; // เก็บ address ของ QuizGame
    address public developerFundAddress; // ที่อยู่สำหรับ Developer Fund

    // กำหนดบทบาทสำหรับ Admin ของ Game ที่สามารถสั่งถอนเงินจาก Pool ได้
    bytes32 public constant GAME_ADMIN_ROLE_IN_POOL_MANAGER = keccak256("GAME_ADMIN_ROLE_IN_POOL_MANAGER"); // <--- เพิ่มบรรทัดนี้

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the PoolManager contract.
     * @param _quizCoinAddress The address of the QuizCoin token contract.
     * @param _defaultAdmin The address to be granted the DEFAULT_ADMIN_ROLE and GAME_ADMIN_ROLE_IN_POOL_MANAGER.
     * @param _quizGameAddress The address of the QuizGame contract.
     */
    function initialize(address _quizCoinAddress, address _defaultAdmin, address _quizGameAddress) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        quizCoin = IQuizCoin(_quizCoinAddress);
        quizGameAddress = _quizGameAddress; // ตั้งค่า QuizGame address ใน initialize

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        // ให้ DEFAULT_ADMIN_ROLE มีสิทธิ์ GAME_ADMIN_ROLE_IN_POOL_MANAGER ด้วย
        _grantRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER, _defaultAdmin); // <--- เพิ่มบรรทัดนี้ หรือจะให้เฉพาะ _quizGameAddress อย่างเดียวก็ได้
    }

    /**
     * @dev Required for UUPS upgradeability.
     * Only the DEFAULT_ADMIN_ROLE can authorize upgrades.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /**
     * @dev รับโทเคน QZC เข้าสู่ Pool
     * ต้องถูกเรียกโดยสัญญา QuizCoin ผ่าน transferFrom
     * เพื่อรับโทเคนที่ผู้ใช้จ่ายมา (เช่น ค่า Hint)
     */
    function receiveTokens(uint256 amount) external {
        // ต้องตรวจสอบให้แน่ใจว่าฟังก์ชันนี้ถูกเรียกโดย QuizCoin หรือ QuizGame เท่านั้น
        // ขึ้นอยู่กับ logic การไหลของ token ของคุณ
        // ตัวอย่างเช่น อาจจะใช้ onlyRole(MINTER_ROLE_OF_POOLMANAGER) หรือ onlyQuizCoin/onlyQuizGame
        // แต่ถ้า QuizCoin มีการอนุญาต (approve) และ transferFrom มาที่ PoolManager โดยตรง
        // ก็ไม่จำเป็นต้องมี require(msg.sender == address(quizCoin), "...");
        // require(msg.sender == address(quizCoin), "PoolManager: Only QuizCoin can send tokens here.");
        // require(quizCoin.transferFrom(msg.sender, address(this), amount), "PoolManager: QZC transfer failed.");
        // โทเคนจะเข้ามาในสัญญาโดยตรงผ่าน transferFrom ของ ERC20
    }

    /**
     * @dev ถอนโทเคน QZC ออกจาก Pool เพื่อจ่ายรางวัล หรือค่าใช้จ่าย
     * เฉพาะผู้ที่มี GAME_ADMIN_ROLE_IN_POOL_MANAGER หรือ ADMIN เท่านั้นที่สามารถเรียกได้
     * @param recipient ผู้รับโทเคน
     * @param amount จำนวนโทเคนที่จะถอน
     */
    function withdrawForUser(address recipient, uint256 amount) public onlyRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER) nonReentrant {
        require(quizCoin.balanceOf(address(this)) >= amount, "PoolManager: Insufficient pool balance.");
        require(quizCoin.transfer(recipient, amount), "PoolManager: QZC withdrawal failed.");
    }

    /**
     * @dev ตั้งค่าที่อยู่ Developer Fund (เฉพาะ ADMIN เท่านั้นที่เรียกได้)
     * @param _developerFundAddress Address ของ Developer Fund
     */
    function setDeveloperFundAddress(address _developerFundAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_developerFundAddress != address(0), "PoolManager: Developer fund address cannot be zero.");
        developerFundAddress = _developerFundAddress;
    }

    /**
     * @dev ถอนเงินสำหรับ Developer Fund (เฉพาะ ADMIN เท่านั้นที่เรียกได้)
     * @param amount จำนวนโทเคนที่จะถอน
     */
    function withdrawToDeveloperFund(uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(developerFundAddress != address(0), "PoolManager: Developer fund address not set.");
        require(quizCoin.balanceOf(address(this)) >= amount, "PoolManager: Insufficient pool balance for dev fund.");
        require(quizCoin.transfer(developerFundAddress, amount), "PoolManager: QZC transfer to dev fund failed.");
    }

    /**
     * @dev ตรวจสอบยอดคงเหลือของ QZC ใน Pool
     * @return จำนวนโทเคน QZC ใน Pool
     */
    function getPoolBalance() public view returns (uint256) {
        return quizCoin.balanceOf(address(this));
    }
}