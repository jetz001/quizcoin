// contracts/QuizCoin.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol"; // เพิ่ม import Context

contract QuizCoin is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() ERC20("QuizCoin", "QZC") {
        // ให้ผู้สร้างสัญญา (deployer) เป็น DEFAULT_ADMIN_ROLE
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // ให้ผู้สร้างสัญญา (deployer) เป็น MINTER_ROLE และ BURNER_ROLE ด้วย
        // เพื่อให้ deployer สามารถ mint เหรียญเริ่มต้นให้กับผู้เล่นเพื่อการทดสอบได้
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    // ฟังก์ชัน Mint ที่มีสิทธิ์เฉพาะ MINTER_ROLE
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // ฟังก์ชัน Burn ที่มีสิทธิ์เฉพาะ BURNER_ROLE
    function burn(address from, uint256 amount) public onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    // Overrides เพื่อให้ AccessControl ทำงานกับ IERC165
    // แก้ไข: ลบ ERC20 ออกจาก override list ตามที่คอมไพเลอร์แจ้ง
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}