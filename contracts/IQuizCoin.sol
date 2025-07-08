// contracts/IQuizCoin.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // Import IERC20 base interface

interface IQuizCoin is IERC20 {
    // เพิ่มฟังก์ชัน mint ที่มีใน QuizCoin (ERC20Upgradeable) ของคุณ
    // ฟังก์ชันนี้มีอยู่ใน ERC20Upgradeable แต่ไม่อยู่ใน IERC20 มาตรฐาน
    function mint(address to, uint256 amount) external returns (bool);

    // ถ้าคุณมีฟังก์ชันอื่นๆ ที่ QuizGame ต้องเรียกใช้จาก QuizCoin
    // เช่น function burn(uint256 amount) external; ก็เพิ่มในนี้ได้
}