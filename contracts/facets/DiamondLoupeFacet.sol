// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IDiamondLoupe } from '../interfaces/IDiamondLoupe.sol';
import { LibDiamond } from '../libraries/LibDiamond.sol';

// Import สำหรับ IERC165 จาก OpenZeppelin (เพื่อให้ supportsInterface override ได้)
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// DiamondLoupeFacet implements the functions required by EIP-2535 Diamond Loupe
// to inspect the Diamond's structure.
// Facet นี้จะ Inherit ทั้ง IDiamondLoupe และ IERC165
contract DiamondLoupeFacet is IDiamondLoupe, IERC165 {
    // Facet นี้ไม่ต้องการ state variables ของตัวเอง
    // มันจะอ่านโดยตรงจาก storage ที่แชร์ของ Diamond ผ่าน LibDiamond.

    // ฟังก์ชันสำหรับรับที่อยู่ Facet ทั้งหมดใน Diamond.
    function facets() external view override returns (IDiamondLoupe.Facet[] memory _facets) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.ds();
        uint256 numFacets = ds.facetAddresses.length;
        _facets = new IDiamondLoupe.Facet[](numFacets);
        for (uint256 i; i < numFacets; i++) {
            address facetAddress_ = ds.facetAddresses[i];
            _facets[i].facetAddress = facetAddress_;
            _facets[i].functionSelectors = ds.facetAddressAndSelectors[facetAddress_];
        }
    }

    // ฟังก์ชันสำหรับรับ function selectors สำหรับที่อยู่ Facet ที่กำหนด.
    function facetFunctionSelectors(
        address _facet
    ) external view override returns (bytes4[] memory _selectors) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.ds();
        _selectors = ds.facetAddressAndSelectors[_facet];
    }

    // ฟังก์ชันสำหรับรับที่อยู่ Facet ที่ implement selector นี้.
    function facetAddress(bytes4 _selector) external view override returns (address _facetAddress) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.ds(); // *** แก้จาก .s() เป็น .ds() แล้ว ***
        _facetAddress = ds.selectors[_selector];
    }

    // Required by EIP-165, which EIP-2535 implements.
    // This allows external tools to detect if a contract supports a given interface.
    function supportsInterface(bytes4 _interfaceId) external pure override returns (bool) {
        return
            _interfaceId == type(IDiamondLoupe).interfaceId || // รองรับ Diamond Loupe interface
            _interfaceId == type(IERC165).interfaceId;          // รองรับ ERC165 interface
    }
}