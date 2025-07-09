// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol"; // Import AccessControlUpgradeable ที่นี่

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
    function initialize(address _initialAdmin) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init(); // Initialize AccessControl ที่นี่
        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin); // กำหนดผู้ deploy เป็น admin

        // โค้ดสำหรับ initialize QuizGame (จะถูกเรียกผ่าน DiamondCut)
        // โดยจะเรียก initializeQuizGame() ใน QuizGameBaseFacet
    }

    // UUPS upgrade authorization function
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}