// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IQuizCoin is IERC20 {
    // หากสัญญา QuizCoin.sol ของคุณมีฟังก์ชันพิเศษอื่นๆ ที่ Facet ของ QuizGame จำเป็นต้องเรียกใช้โดยตรง
    // คุณจะต้องประกาศฟังก์ชันเหล่านั้นเพิ่มเติมที่นี่
    // function mint(address to, uint256 amount) external;
}