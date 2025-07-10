// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
//import {IAccessControlUpgradeable as IAccessControl} from "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {LibDiamond} from "../libraries/LibDiamond.sol";

contract OwnershipFacet is OwnableUpgradeable, AccessControlUpgradeable {
    function init() external initializer {
        __Ownable_init(msg.sender);
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); // เรียกใช้ DEFAULT_ADMIN_ROLE() โดยตรง ไม่ใช่ _DEFAULT_ADMIN_ROLE()
    }

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

    // ลบฟังก์ชัน _setupRole ออกไปทั้งหมด หากยังคงอยู่และทำให้เกิด TypeError
    // เพราะมันเป็น internal ของ AccessControlUpgradeable และไม่ควร override ใน Facet นี้
    // ถ้าคุณยังไม่ได้ลบในรอบก่อนหน้านี้ ให้ลบบรรทัดนี้ออกไป:
    // function _setupRole(bytes32 role, address account) internal virtual override {
    //    AccessControlUpgradeable._setupRole(role, account);
    // }

    // ลบฟังก์ชัน DEFAULT_ADMIN_ROLE() ที่เคยสร้างขึ้นมา เพราะมันซ้ำซ้อนกับ AccessControlUpgradeable
    // คุณสามารถเข้าถึง DEFAULT_ADMIN_ROLE ได้โดยตรงจาก AccessControlUpgradeable
}