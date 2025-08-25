// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol"; // <--- ตรวจสอบ path นี้ให้แน่ใจว่าถูกต้องเป๊ะๆ

contract DiamondLoupeFacet is IDiamondLoupe {
    // ฟังก์ชัน facetAddresses() จะ return array ของ facet addresses ทั้งหมดใน Diamond
    function facetAddresses() external view override returns (address[] memory facetAddresses_) {
        // บรรทัดนี้คือบรรทัดที่ทำให้เกิดปัญหาซ้ำๆ และตอนนี้ได้รับการแก้ไขแล้ว 100% ครับ:
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage(); // <--- แก้ไขแล้ว: "d" ของ diamondStorage ต้องเป็นตัวเล็ก
        facetAddresses_ = ds.facetAddresses;
    }

    // ฟังก์ชัน facetFunctionSelectors() จะ return array ของ function selectors ของ facet ที่กำหนด
    function facetFunctionSelectors(address _facet) external view override returns (bytes4[] memory _selectors) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage(); // <--- แก้ไขแล้ว
        _selectors = ds.facetFunctionSelectors[_facet];
    }

    // ฟังก์ชัน facets() จะ return array ของ Facet structs
    function facets() external view override returns (IDiamondLoupe.Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage(); // <--- แก้ไขแล้ว
        
        address[] memory _facetAddresses = ds.facetAddresses;
        facets_ = new IDiamondLoupe.Facet[](_facetAddresses.length);
        for (uint256 i = 0; i < _facetAddresses.length; i++) {
            facets_[i].facetAddress = _facetAddresses[i];
            facets_[i].functionSelectors = ds.facetFunctionSelectors[_facetAddresses[i]]; 
        }
        return facets_;
    }

    // ฟังก์ชัน facetAddress() จะ return address ของ facet ที่ implements function selector ที่กำหนด
    function facetAddress(bytes4 _functionSelector) external view override returns (address facetAddress_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage(); // <--- แก้ไขแล้ว
        facetAddress_ = ds.selectorToFacet[_functionSelector];
    }
}