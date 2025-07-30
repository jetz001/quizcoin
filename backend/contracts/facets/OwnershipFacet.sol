// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {LibDiamond} from "../libraries/LibDiamond.sol"; // ตรวจสอบ path นี้ให้แน่ใจว่าถูกต้อง

contract OwnershipFacet is OwnableUpgradeable, AccessControlUpgradeable {
    // ปรับปรุงฟังก์ชัน init ให้รับ address _owner
    function init(address _owner) external initializer { // <<< เพิ่ม address _owner ตรงนี้!
        __Ownable_init(_owner); // ส่ง _owner ไปยัง Ownable initializer
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner); // ให้ admin role แก่ _owner
    }

    // ฟังก์ชันอื่นๆ ที่เหลือเหมือนเดิม
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
}