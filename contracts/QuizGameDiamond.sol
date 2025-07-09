// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IPoolManager.sol"; // เพิ่มบรรทัดนี้
import "./interfaces/IQuizCoin.sol";     // เพิ่มบรรทัดนี้

// QuizGameDiamond จะ Inherit UUPSUpgradeable และ AccessControlUpgradeable โดยตรง
// เพื่อให้ AccessControl สามารถจัดการ Role ของ Diamond Proxy ได้
contract QuizGameDiamond is UUPSUpgradeable, AccessControlUpgradeable {
    // ไม่มี state variables ของเกมที่นี่
    // State ของเกมจะถูกจัดการผ่าน AppStorage ใน LibAppStorage

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // สำคัญสำหรับ Upgradeable contracts
    }

    // ฟังก์ชัน initialize ของ Diamond (จะถูกเรียกครั้งเดียวเมื่อ Deploy Proxy)
    // _initialAdmin คือผู้ที่จะเป็น DEFAULT_ADMIN_ROLE
    // _poolManagerAddress คือที่อยู่ของสัญญา PoolManager
    // _quizCoinAddress คือที่อยู่ของสัญญา QuizCoin
    function initialize(address _initialAdmin, address _poolManagerAddress, address _quizCoinAddress) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init(); // Initialize AccessControl ที่นี่
        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin); // กำหนดผู้ deploy เป็น admin

        // ตั้งค่า PoolManager และ QuizCoin ใน LibAppStorage
        // ต้องเรียกฟังก์ชัน setPoolManagerAddress และ setQuizCoinAddress บน Diamond Proxy
        // ซึ่งจะ delegate call ไปยัง QuizGameBaseFacet
        IPoolManager(_poolManagerAddress).setQuizGameDiamondAddress(address(this)); // แจ้ง PoolManager ว่า Diamond Address คืออะไร
        
        // กำหนด MINTER_ROLE ให้ PoolManager บน QuizCoin contract
        IQuizCoin(_quizCoinAddress).grantRole(IQuizCoin(_quizCoinAddress).MINTER_ROLE(), _poolManagerAddress);
        
        // โค้ดสำหรับ initialize QuizGame (จะถูกเรียกผ่าน DiamondCut)
        // โดยจะเรียก initializeQuizGame() ใน QuizGameBaseFacet
        // (ส่วนนี้จะถูกจัดการเมื่อคุณทำการ deploy diamond และ add facets)
    }

    // UUPS upgrade authorization function
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}