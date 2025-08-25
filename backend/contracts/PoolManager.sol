// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IQuizCoin.sol"; // ใช้ IQuizCoin แทน IERC20

contract PoolManager is Ownable {
    IQuizCoin public quizCoin; // ที่อยู่ของ QuizCoin Token (ใช้ IQuizCoin ของเราเอง)
    address public quizGameDiamondAddress; // ที่อยู่ของ QuizGameDiamond (สำหรับตรวจสอบสิทธิ์)

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event QuizCoinSet(address indexed oldAddress, address indexed newAddress);
    event QuizGameDiamondAddressSet(address indexed oldAddress, address indexed newAddress);
    event MintedToTreasury(uint256 amount);

    constructor(address _quizCoinAddress) Ownable(msg.sender) {
        require(_quizCoinAddress != address(0), "PoolManager: QuizCoin address cannot be zero");
        quizCoin = IQuizCoin(_quizCoinAddress);
        emit QuizCoinSet(address(0), _quizCoinAddress);
    }

    // ฟังก์ชันสำหรับตั้งค่า QuizCoin (ในกรณีที่ต้องเปลี่ยนในอนาคต)
    function setQuizCoin(address _newQuizCoinAddress) public onlyOwner {
        require(_newQuizCoinAddress != address(0), "PoolManager: QuizCoin address cannot be zero");
        emit QuizCoinSet(address(quizCoin), _newQuizCoinAddress);
        quizCoin = IQuizCoin(_newQuizCoinAddress);
    }

    // ฟังก์ชันสำหรับตั้งค่า QuizGameDiamond Address
    // จะถูกเรียกโดย admin ของ Diamond หลังจาก deploy PoolManager และ QuizGameDiamond
    function setQuizGameDiamondAddress(address _newQuizGameDiamondAddress) public onlyOwner {
        require(_newQuizGameDiamondAddress != address(0), "PoolManager: QuizGameDiamond address cannot be zero");
        emit QuizGameDiamondAddressSet(quizGameDiamondAddress, _newQuizGameDiamondAddress);
        quizGameDiamondAddress = _newQuizGameDiamondAddress;
    }

    // ฟังก์ชันสำหรับฝากเงินเข้า Pool (QuizGame หรือ Admin สามารถเติมเงินได้)
    // ใช้สำหรับรับค่าธรรมเนียม buyHint จาก Diamond Facet (DiamondProxy จะโอนมาให้ PoolManager)
    // หรือ Admin ฝากเข้า Pool
    function deposit(uint256 _amount) public {
        // ให้เฉพาะ QuizGameDiamond หรือ Owner สามารถเรียก deposit ได้
        require(msg.sender == quizGameDiamondAddress || msg.sender == owner(), "PoolManager: Not authorized to deposit");
        require(quizCoin.transferFrom(msg.sender, address(this), _amount), "PoolManager: Deposit failed");
        emit Deposited(msg.sender, _amount);
    }

    // ฟังก์ชันสำหรับถอนเงินให้กับผู้ใช้ (โดยการ Mint)
    // เรียกโดย QuizGameDiamond เท่านั้น (ผ่าน Facet)
    function withdrawForUser(address _user, uint256 _amount) public {
        require(msg.sender == quizGameDiamondAddress, "PoolManager: Not authorized to withdraw for user");
        // Mint เหรียญใหม่ให้กับผู้ใช้โดยตรง ตาม Tokenomics
        quizCoin.mint(_user, _amount);
        emit Withdrawn(_user, _amount);
    }

    // ฟังก์ชันสำหรับ Mint และโอนไปยัง Treasury (Diamond Contract)
    // เรียกโดย QuizGameDiamond เท่านั้น (ผ่าน Facet)
    function mintAndTransferToTreasury(uint256 _amount) public {
        require(msg.sender == quizGameDiamondAddress, "PoolManager: Not authorized to mint and transfer to treasury");
        // Mint เหรียญใหม่และโอนไปยัง Diamond Contract (ซึ่งทำหน้าที่เป็น Treasury)
        quizCoin.mint(quizGameDiamondAddress, _amount);
        emit MintedToTreasury(_amount);
    }

    // ฟังก์ชันสำหรับ Admin ถอนเงินส่วนเกิน (ถ้ามี)
    // โทเค็นที่อยู่ใน PoolManager (ซึ่งควรจะมีเฉพาะจากค่าธรรมเนียมการซื้อ Hint)
    function withdrawAdmin(address _to, uint256 _amount) public onlyOwner {
        require(_to != address(0), "PoolManager: Target address cannot be zero");
        require(quizCoin.transfer(_to, _amount), "PoolManager: Admin withdrawal failed");
        emit Withdrawn(_to, _amount);
    }

    function getBalance() public view returns (uint256) {
        return quizCoin.balanceOf(address(this));
    }
}