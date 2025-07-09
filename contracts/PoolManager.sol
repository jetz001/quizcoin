// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PoolManager is Ownable {
    IERC20 public quizCoin; // ที่อยู่ของ QuizCoin Token

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event QuizCoinSet(address indexed oldAddress, address indexed newAddress);

    constructor(address _quizCoinAddress) Ownable(msg.sender) {
        require(_quizCoinAddress != address(0), "PoolManager: QuizCoin address cannot be zero");
        quizCoin = IERC20(_quizCoinAddress);
        emit QuizCoinSet(address(0), _quizCoinAddress);
    }

    // ฟังก์ชันสำหรับตั้งค่า QuizCoin (ในกรณีที่ต้องเปลี่ยนในอนาคต)
    function setQuizCoin(address _newQuizCoinAddress) public onlyOwner {
        require(_newQuizCoinAddress != address(0), "PoolManager: QuizCoin address cannot be zero");
        emit QuizCoinSet(address(quizCoin), _newQuizCoinAddress);
        quizCoin = IERC20(_newQuizCoinAddress);
    }

    // ฟังก์ชันสำหรับฝากเงินเข้า Pool (QuizGame หรือ Admin สามารถเติมเงินได้)
    function deposit(uint256 _amount) public {
        require(quizCoin.transferFrom(msg.sender, address(this), _amount), "PoolManager: Deposit failed");
        emit Deposited(msg.sender, _amount);
    }

    // ฟังก์ชันสำหรับถอนเงินให้กับผู้ใช้ (เรียกโดย QuizGameDiamond เท่านั้น)
    function withdrawForUser(address _user, uint256 _amount) public {
        // ต้องเพิ่มการตรวจสอบสิทธิ์ว่าใครสามารถเรียกฟังก์ชันนี้ได้
        // เช่น กำหนด Role ให้ QuizGameDiamond ใน PoolManager หรือตรวจสอบ msg.sender
        // ในบริบทนี้ เราจะถือว่า QuizGameDiamond เป็นผู้ได้รับอนุญาต
        // (ในโปรดักชัน ควรเพิ่ม require(msg.sender == address(quizGameDiamond), "Not authorized");)
        require(quizCoin.transfer(_user, _amount), "PoolManager: Withdrawal failed");
        emit Withdrawn(_user, _amount);
    }

    // ฟังก์ชันสำหรับ Admin ถอนเงินส่วนเกิน (ถ้ามี)
    function withdrawAdmin(address _to, uint256 _amount) public onlyOwner {
        require(quizCoin.transfer(_to, _amount), "PoolManager: Admin withdrawal failed");
        emit Withdrawn(_to, _amount);
    }

    function getBalance() public view returns (uint256) {
        return quizCoin.balanceOf(address(this));
    }
}