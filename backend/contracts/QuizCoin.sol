// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol"; // ใช้ AccessControl แทน Ownable

contract QuizCoin is ERC20, AccessControl {
    // กำหนด Role สำหรับผู้ที่สามารถ Mint เหรียญได้
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("QuizCoin", "QZC") {
        // กำหนดผู้ deploy เป็น ADMIN โดยอัตโนมัติ
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // ไม่มีการ Mint เหรียญเริ่มต้น ตาม Tokenomics: "จะเริ่มมีอุปทานเมื่อ ตอบถูก บล็อคแรก"
    }

    // ฟังก์ชันสำหรับ Minting (จำกัดเฉพาะผู้ที่มี MINTER_ROLE เท่านั้น)
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // ฟังก์ชันเพื่อ override _update (จาก ERC20) หากต้องการเพิ่ม logic เพิ่มเติมในการโอน/Mint/Burn
    // function _update(address from, address to, uint256 value) internal override {
    //     super._update(from, to, value);
    // }
}