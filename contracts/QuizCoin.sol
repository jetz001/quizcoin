// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// นำเข้าไลบรารี OpenZeppelin เวอร์ชัน Upgradeable
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // <-- เพิ่มบรรทัดนี้

contract QuizCoin is Initializable, ERC20Upgradeable, AccessControlUpgradeable, UUPSUpgradeable { // <-- เพิ่ม UUPSUpgradeable ที่นี่
    // กำหนดบทบาท MINTER_ROLE สำหรับผู้ที่สามารถสร้าง (mint) โทเคนได้
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    // Constructor นี้มีไว้เพื่อป้องกันการเรียก 'initialize' โดยตรงเท่านั้น
    // ไม่ได้ใช้กำหนดค่าเริ่มต้นเหมือนสัญญาปกติ
    constructor() {
        _disableInitializers(); 
    }

    // ฟังก์ชัน initialize จะถูกเรียกเพียงครั้งเดียวเมื่อสัญญาถูก Deploy ผ่าน Proxy
    // ใช้สำหรับกำหนดค่าเริ่มต้นของสัญญา
    function initialize() public initializer {
        // เรียก initialize ของสัญญาแม่ (super contracts)
        __ERC20_init("QuizCoin", "QZC"); // กำหนดชื่อและสัญลักษณ์ของโทเคน
        __AccessControl_init();          // กำหนดค่าเริ่มต้นของ AccessControl
        __UUPSUpgradeable_init();        // <-- เพิ่มบรรทัดนี้เพื่อ initialize UUPSUpgradeable

        // มอบบทบาท DEFAULT_ADMIN_ROLE และ MINTER_ROLE ให้กับผู้ที่ Deploy สัญญา
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
    // ฟังก์ชัน mint สำหรับสร้างโทเคนใหม่
    // เฉพาะผู้ที่มี MINTER_ROLE เท่านั้นที่เรียกได้ (เช่น สัญญา QuizGame)
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}