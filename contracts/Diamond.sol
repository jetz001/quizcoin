// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondCut} from "./interfaces/IDiamondCut.sol";
import {LibDiamond} from "./libraries/LibDiamond.sol";
import {IDiamondLoupe} from "./interfaces/IDiamondLoupe.sol";
import {DiamondLoupeFacet} from "./facets/DiamondLoupeFacet.sol";
import {DiamondCutFacet} from "./facets/DiamondCutFacet.sol";

contract Diamond {
    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

    constructor(address _owner) payable { // เปลี่ยนกลับมาใช้ _owner
        DiamondCutFacet diamondCutFacet = new DiamondCutFacet();
        DiamondLoupeFacet diamondLoupeFacet = new DiamondLoupeFacet();

        // สร้าง dynamic array สำหรับ DiamondCutFacet selectors
        bytes4[] memory diamondCutSelectors = new bytes4[](1);
        diamondCutSelectors[0] = bytes4(keccak256("diamondCut((address,uint8,bytes4[])[],address,bytes)"));

        // FacetCut สำหรับ DiamondCutFacet
        IDiamondCut.FacetCut memory cutDiamondCutFacet = IDiamondCut.FacetCut({
            facetAddress: address(diamondCutFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: diamondCutSelectors // ใช้ตัวแปร dynamic array ที่สร้างไว้
        });

        // สร้าง dynamic array สำหรับ DiamondLoupeFacet selectors
        bytes4[] memory diamondLoupeSelectors = new bytes4[](4);
        diamondLoupeSelectors[0] = bytes4(keccak256("facetAddresses()"));
        diamondLoupeSelectors[1] = bytes4(keccak256("facetFunctionSelectors(address)"));
        diamondLoupeSelectors[2] = bytes4(keccak256("facets()"));
        diamondLoupeSelectors[3] = bytes4(keccak256("facetAddress(bytes4)"));

        // FacetCut สำหรับ DiamondLoupeFacet
        IDiamondCut.FacetCut memory cutDiamondLoupeFacet = IDiamondCut.FacetCut({
            facetAddress: address(diamondLoupeFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: diamondLoupeSelectors // ใช้ตัวแปร dynamic array ที่สร้างไว้
        });

        IDiamondCut.FacetCut[] memory _diamondCut = new IDiamondCut.FacetCut[](2);
        _diamondCut[0] = cutDiamondCutFacet;
        _diamondCut[1] = cutDiamondLoupeFacet;

        LibDiamond.diamondCut(
            _diamondCut,
            address(0),
            ""
        );

        emit DiamondCut(_diamondCut, address(0), "");
    }

    fallback() external payable {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        address facetAddress = ds.facetAddressAndSelectorPosition[msg.sig].facetAddress;
        require(facetAddress != address(0), "Diamond: Function does not exist");

        assembly {
            calldatacopy(0, 0, calldatasize())
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

    receive() external payable {}
}