// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDiamondCut {
    enum FacetCutAction { Add, Replace, Remove }
    // Add: เพิ่มฟังก์ชันใหม่หรือเปลี่ยนไปใช้ที่อยู่ Facet ใหม่
    // Replace: เปลี่ยนที่อยู่ Facet ของฟังก์ชันที่มีอยู่แล้ว (ต้องเป็นฟังก์ชันที่มีอยู่)
    // Remove: ลบฟังก์ชันออก

    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

   

    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external;
}