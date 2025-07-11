// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibDiamond} from "./libraries/LibDiamond.sol"; // ตรวจสอบ path นี้ให้แน่ใจว่าถูกต้อง
import {IDiamondCut} from "./interfaces/IDiamondCut.sol"; // ตรวจสอบ path นี้ให้แน่ใจว่าถูกต้อง
import "hardhat/console.sol"; // สำหรับ development เท่านั้น

// Diamond Contract เป็น Proxy ที่จะ delegatecall ไปยัง Facets ที่เหมาะสม
contract Diamond {
    // Constructor ของ Diamond Contract
    // กำหนดเจ้าของเริ่มต้นและทำการ Initial Diamond Cut เพื่อเพิ่ม DiamondCutFacet
    constructor(address _contractOwner, address _diamondCutFacetAddress) payable {
        // ตรวจสอบว่า _contractOwner ไม่ใช่ address(0)
        require(_contractOwner != address(0), "Diamond: Invalid owner address");
        // ตรวจสอบว่า _diamondCutFacetAddress ไม่ใช่ address(0) และเป็น contract
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(_diamondCutFacetAddress)
        }
        require(_diamondCutFacetAddress != address(0) && codeSize > 0, "Diamond: Invalid DiamondCutFacet address or not a contract");

        // *** เปลี่ยนตรงนี้: ใช้ LibDiamond.setContractOwner เพื่อตั้งค่าเจ้าของ ***
        LibDiamond.setContractOwner(_contractOwner); 
        // *******************************************************************

        console.log("Diamond.sol: Constructor called.");
        console.log("Diamond.sol: _owner:", string(abi.encodePacked(_contractOwner)));
        console.log("Diamond.sol: _diamondCutFacet (address for DiamondCutFacet):", string(abi.encodePacked(_diamondCutFacetAddress)));

        // ทำ Initial Diamond Cut เพื่อเพิ่ม DiamondCutFacet เข้าไป
        // เพื่อให้ Diamond Contract สามารถรับคำสั่ง diamondCut ได้ตั้งแต่เริ่มต้น
        IDiamondCut.FacetCut[] memory diamondCut_ = new IDiamondCut.FacetCut[](1);
        bytes4[] memory functionSelectors_ = new bytes4[](1);
        functionSelectors_[0] = IDiamondCut.diamondCut.selector; // Selector ของ diamondCut()

        console.log("Diamond.sol: IDiamondCut.diamondCut.selector:", string(abi.encodePacked(IDiamondCut.diamondCut.selector)));

        diamondCut_[0] = IDiamondCut.FacetCut({
            facetAddress: _diamondCutFacetAddress,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors_
        });
        console.log("Diamond.sol: Calling LibDiamond.diamondCut from constructor...");

        LibDiamond.diamondCut(diamondCut_, address(0), ""); // ไม่มีการเรียก init contract ในขั้นตอนนี้
        console.log("Diamond.sol: LibDiamond.diamondCut in constructor SUCCEEDED.");
    }

    // Fallback function: ถูกเรียกเมื่อมีการเรียกฟังก์ชันที่ไม่มีอยู่ใน Diamond Contract
    // จะส่งต่อการเรียกไปยัง Facet ที่ถูกต้องผ่าน LibDiamond.diamondFallback()
    fallback() external payable {
        LibDiamond.diamondFallback();
    }

    // Receive function: ถูกเรียกเมื่อมีการส่ง ETH มายัง Diamond Contract โดยไม่มี calldata
    // หากไม่ต้องการให้ Diamond รับ ETH โดยตรง สามารถลบฟังก์ชันนี้ออกได้
    receive() external payable {
        // สามารถเพิ่ม logic อื่นๆ ได้ที่นี่ หากต้องการ
    }
}