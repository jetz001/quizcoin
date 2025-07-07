// contracts/interfaces/IPoolManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoolManager {
    // ฟังก์ชันที่ QuizGame เรียกใช้จาก PoolManager
    function withdrawForHint(address _user, uint256 _amount) external;
    // หากในอนาคต QuizGame ต้องการเรียกฟังก์ชันอื่นๆ ใน PoolManager
    // จะต้องมาเพิ่มการประกาศฟังก์ชันนั้นๆ ที่นี่ด้วย
}