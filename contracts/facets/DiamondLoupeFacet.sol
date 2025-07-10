// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol"; // ตรวจสอบพาธให้ถูกต้อง
import {LibDiamond} from "../libraries/LibDiamond.sol"; // ตรวจสอบพาธให้ถูกต้อง

// Facet สำหรับตรวจสอบข้อมูลของ Diamond (เช่น ฟังก์ชัน, Facet ต่างๆ)
contract DiamondLoupeFacet is IDiamondLoupe {
    function facets() external view override returns (IDiamondLoupe.Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 numFacets = ds.facetAddressToSelectorsLength[address(this)]; // This seems off, should be counting unique facet addresses
        // Fix: Iterate over all unique facet addresses
        address[] memory facetAddresses;
        uint256 currentUniqueFacets = 0;
        // Collect all unique facet addresses from registered selectors
        for (uint256 i = 0; i < ds.selectors.length; i++) {
            address facetAddress = ds.selectorToFacetAddressAndPosition[ds.selectors[i]].facetAddress;
            bool found = false;
            for(uint256 j = 0; j < currentUniqueFacets; j++) {
                if (facetAddresses[j] == facetAddress) {
                    found = true;
                    break;
                }
            }
            if (!found && facetAddress != address(0)) {
                if (facetAddresses.length == 0 || currentUniqueFacets == facetAddresses.length) {
                    // Dynamically resize array if needed (simple example, better way needed for real dApp)
                    address[] memory temp = new address[](currentUniqueFacets + 5); // Add some buffer
                    for(uint256 k = 0; k < currentUniqueFacets; k++) {
                        temp[k] = facetAddresses[k];
                    }
                    facetAddresses = temp;
                }
                facetAddresses[currentUniqueFacets++] = facetAddress;
            }
        }
        
        facets_ = new IDiamondLoupe.Facet[](currentUniqueFacets);
        for (uint256 i = 0; i < currentUniqueFacets; i++) {
            address facetAddress_ = facetAddresses[i];
            facets_[i].facetAddress = facetAddress_;
            facets_[i].functionSelectors = new bytes4[](ds.facetAddressToSelectorsLength[facetAddress_]);
            for (uint256 j = 0; j < ds.facetAddressToSelectorsLength[facetAddress_]; j++) {
                facets_[i].functionSelectors[j] = ds.facetAddressToSelectors[facetAddress_][j];
            }
        }
    }

    function facetFunctionSelectors(address _facet) external view override returns (bytes4[] memory _selectors) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        _selectors = new bytes4[](ds.facetAddressToSelectorsLength[_facet]);
        for (uint256 i = 0; i < ds.facetAddressToSelectorsLength[_facet]; i++) {
            _selectors[i] = ds.facetAddressToSelectors[_facet][i];
        }
    }

    function facetAddresses() external view override returns (address[] memory facetAddresses_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        address[] memory uniqueFacetAddresses;
        uint256 currentUniqueFacets = 0;

        // Collect all unique facet addresses from registered selectors
        for (uint256 i = 0; i < ds.selectors.length; i++) {
            address facetAddress = ds.selectorToFacetAddressAndPosition[ds.selectors[i]].facetAddress;
            bool found = false;
            for(uint256 j = 0; j < currentUniqueFacets; j++) {
                if (uniqueFacetAddresses[j] == facetAddress) {
                    found = true;
                    break;
                }
            }
            if (!found && facetAddress != address(0)) {
                // Dynamically resize array if needed (simple example)
                if (uniqueFacetAddresses.length == 0 || currentUniqueFacets == uniqueFacetAddresses.length) {
                    address[] memory temp = new address[](currentUniqueFacets + 5);
                    for(uint256 k = 0; k < currentUniqueFacets; k++) {
                        temp[k] = uniqueFacetAddresses[k];
                    }
                    uniqueFacetAddresses = temp;
                }
                uniqueFacetAddresses[currentUniqueFacets++] = facetAddress;
            }
        }
        // Resize final array to actual size
        facetAddresses_ = new address[](currentUniqueFacets);
        for (uint256 i = 0; i < currentUniqueFacets; i++) {
            facetAddresses_[i] = uniqueFacetAddresses[i];
        }
    }

    function facetAddress(bytes4 _functionSelector) external view override returns (address facetAddress_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetAddress_ = ds.selectorToFacetAddressAndPosition[_functionSelector].facetAddress;
    }
}