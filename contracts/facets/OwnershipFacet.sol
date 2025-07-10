// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// นี่คือพาธการ import ที่ถูกต้องสำหรับ OpenZeppelin Contracts-Upgradeable v5.x.x
// โดยไม่ใช้ /contracts/ เนื่องจากโครงสร้างโฟลเดอร์สำหรับเวอร์ชันนี้
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
//import {IAccessControlUpgradeable as IAccessControl} from "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

// ตรวจสอบพาธ LibDiamond ให้ถูกต้อง
import {LibDiamond} from "../libraries/LibDiamond.sol";

// Facet สำหรับจัดการความเป็นเจ้าของ (Owner) และบทบาท (Roles)
// โดยใช้ OpenZeppelin's OwnableUpgradeable และ AccessControlUpgradeable
contract OwnershipFacet is OwnableUpgradeable, AccessControlUpgradeable {
    function init() external initializer {
        // init Ownable
        __Ownable_init(msg.sender);
        // init AccessControl
        __AccessControl_init();
        // กำหนด DEFAULT_ADMIN_ROLE ให้กับ owner
        _grantRole(DEFAULT_ADMIN_ROLE(), msg.sender);
    }

    // ฟังก์ชันที่ใช้ใน Diamond proxy
    // owner() และ renounceOwnership() มีอยู่แล้วใน OwnableUpgradeable

    // ฟังก์ชัน AccessControl
    function hasRole(bytes32 role, address account) public view virtual override returns (bool) {
        return AccessControlUpgradeable.hasRole(role, account);
    }

    function getRoleAdmin(bytes32 role) public view virtual override returns (bytes32) {
        return AccessControlUpgradeable.getRoleAdmin(role);
    }

    function grantRole(bytes32 role, address account) public virtual override {
        AccessControlUpgradeable.grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public virtual override {
        AccessControlUpgradeable.revokeRole(role, account);
    }

    function renounceRole(bytes32 role, address account) public virtual override {
        AccessControlUpgradeable.renounceRole(role, account);
    }

    function _setupRole(bytes32 role, address account) internal virtual override {
        AccessControlUpgradeable._setupRole(role, account);
    }

    
}