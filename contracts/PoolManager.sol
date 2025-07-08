// contracts/PoolManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
// import "hardhat/console.sol"; // uncomment this if you need console.log in PoolManager

// นี่คือส่วนที่เราต้องแก้ไข/ตรวจสอบ
interface IQuizCoinLocal {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256); // <--- ต้องมีบรรทัดนี้
    function mint(address to, uint256 amount) external; // <--- ต้องมีบรรทัดนี้ (เพราะ PoolManager เรียกใช้)
    function burn(uint256 amount) external; // <--- ต้องมีบรรทัดนี้ (เพราะ PoolManager เรียกใช้)

    // หาก QuizCoin มี MINTER_ROLE หรือ BURNER_ROLE ที่ PoolManager หรือ QuizGame ต้องใช้
    // ต้องเพิ่มประกาศฟังก์ชันที่เกี่ยวข้องกับ Role ใน interface นี้ด้วย
    // ตัวอย่างเช่น:
    // function MINTER_ROLE() external view returns (bytes32);
    // function grantRole(bytes32 role, address account) external;
}

contract PoolManager is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    IQuizCoinLocal public quizCoin;
    address public quizGameAddress;

    bytes32 public constant GAME_ADMIN_ROLE_IN_POOL_MANAGER = keccak256("GAME_ADMIN_ROLE_IN_POOL_MANAGER");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _quizCoinAddress, address _defaultAdmin, address _quizGameAddress) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        require(_quizCoinAddress != address(0), "PoolManager: QuizCoin address cannot be zero.");
        require(_quizGameAddress != address(0), "PoolManager: QuizGame address cannot be zero.");

        quizCoin = IQuizCoinLocal(_quizCoinAddress);
        quizGameAddress = _quizGameAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        // กำหนดให้ _defaultAdmin มี Role นี้ด้วย เพื่อให้สามารถทำสิ่งต่างๆ ได้ใน test
        _grantRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER, _defaultAdmin);
    }

    function setQuizGameAddress(address _quizGameAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_quizGameAddress != address(0), "PoolManager: QuizGame address cannot be zero.");
        quizGameAddress = _quizGameAddress;
    }

    // ฟังก์ชันสำหรับฝากเหรียญเข้า Pool
    function deposit(uint256 _amount) public nonReentrant {
        require(quizCoin.transferFrom(msg.sender, address(this), _amount), "PoolManager: QZC transfer failed for deposit.");
    }

    // ฟังก์ชันสำหรับถอนเหรียญออกจาก Pool (เรียกใช้โดย QuizGame เท่านั้น)
    function withdrawForUser(address _recipient, uint256 _amount) public nonReentrant onlyRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER) {
        // console.log("PM: withdrawForUser called by:", msg.sender);
        // console.log("PM: _recipient:", _recipient);
        // console.log("PM: _amount:", _amount);
        // console.log("PM: Pool balance before withdraw:", quizCoin.balanceOf(address(this)));
        require(quizCoin.balanceOf(address(this)) >= _amount, "PoolManager: Insufficient pool balance for withdrawal.");
        // We use mint here as the PoolManager is assumed to be the minter/burner for rewards.
        // If QuizCoin has a burn/mint model, this is where it's handled.
        // If the reward comes from an existing pool, then it would be a transferFrom here.
        // Assuming rewards are minted by PoolManager (which has MINTER_ROLE in QuizCoin)
        quizCoin.mint(_recipient, _amount);
        // console.log("PM: Pool balance after withdraw:", quizCoin.balanceOf(address(this)));
    }

    // ฟังก์ชันสำหรับดูยอดคงเหลือของ Pool
    function getPoolBalance() public view returns (uint256) {
        return quizCoin.balanceOf(address(this));
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}