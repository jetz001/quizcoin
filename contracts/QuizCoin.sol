// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract QuizCoin is ERC20, Ownable {
    constructor() ERC20("QuizCoin", "QZC") Ownable(msg.sender) {
        // Mint บางส่วนให้กับผู้ deploy เพื่อเริ่มต้น
        _mint(msg.sender, 1000000 * 10**18); // 1,000,000 QZC
    }

    // ฟังก์ชันสำหรับ minting (อาจจะจำกัดเฉพาะ owner หรือ role)
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}