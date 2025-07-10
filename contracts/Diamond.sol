// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ไม่ต้อง import IDiamondCut ใน Diamond.sol โดยตรง เพราะ Diamond.sol ไม่ได้ implement ทุกฟังก์ชันเอง
// import {IDiamondCut} from "./interfaces/IDiamondCut.sol";
import {LibDiamond} from "./libraries/LibDiamond.sol"; // ตรวจสอบพาธให้ถูกต้อง

// Diamond Contract หลักที่ใช้ LibDiamond
contract Diamond { // ลบ 'is IDiamondCut' ออกไป
    constructor(address _owner, address _diamondCutFacet) payable {
        // เรียกใช้ diamondCut จาก LibDiamond เพื่อตั้งค่าเริ่มต้น
        // ฟังก์ชัน diamondCut นี้จะถูกเรียกผ่าน proxy ไปที่ _diamondCutFacet
        LibDiamond.diamondCut(
            new LibDiamond.FacetCut[](0), // ใช้ FacetCut จาก LibDiamond
            _diamondCutFacet,
            LibDiamond.getInitializationCalldata(_owner)
        );
    }

    // fallback function จะถูกเรียกเมื่อมีการเรียกใช้ selector ที่ไม่รู้จัก
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        
        // ใช้ ds.facetAddressAndSelectorPosition[msg.sig].facetAddress;
        // เพราะตาม Diamond pattern ข้อมูลจะถูกจัดเก็บใน struct นั้น
        address facetAddress = ds.facetAddressAndSelectorPosition[msg.sig].facetAddress;
        require(facetAddress != address(0), "Diamond: Function does not exist");
        
        assembly {
            // กระโดดไปยัง facetAddress ที่ถูกต้อง
            calldatacopy(0, 0, calldatasize())
            // ใช้ delegatecall เพื่อรันโค้ดของ facet ในบริบทของ Diamond
            let result := delegatecall(gas(), facetAddress, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    // receive function จะถูกเรียกเมื่อมีการส่ง Ether โดยไม่มี calldata
    receive() external payable {}
}