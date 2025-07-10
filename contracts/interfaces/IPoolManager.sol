// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoolManager {
    function withdrawForUser(address _user, uint256 _amount) external;
    function mintAndTransferToTreasury(uint256 _amount) external; // เพิ่มบรรทัดนี้
    function deposit(uint256 _amount) external; // เพิ่มบรรทัดนี้
    function setQuizGameDiamondAddress(address _newQuizGameDiamondAddress) external;
}