// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoolManager {
    function withdrawForUser(address _user, uint256 _amount) external;
    // หาก PoolManager.sol ของคุณมีฟังก์ชันอื่นๆ ที่ Facet ของ QuizGame จำเป็นต้องเรียกใช้โดยตรง
    // คุณจะต้องประกาศฟังก์ชันเหล่านั้นเพิ่มเติมที่นี่
    // function deposit(uint256 _amount) external;
    // function getBalance() external view returns (uint256);
}