// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondCut} from "../interfaces/IDiamondCut.sol"; // ตรวจสอบพาธให้ถูกต้อง
import {LibDiamond} from "../libraries/LibDiamond.sol"; // ตรวจสอบพาธให้ถูกต้อง

// Facet สำหรับการเพิ่ม/ลบ/แทนที่ฟังก์ชันใน Diamond
contract DiamondCutFacet is IDiamondCut {
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external override {
        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}