// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondCut} from "../interfaces/IDiamondCut.sol"; // ตรวจสอบพาธให้ถูกต้อง
import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol"; // ตรวจสอบพาธให้ถูกต้อง
import {IERC173} from "../interfaces/IERC173.sol"; // ตรวจสอบพาธให้ถูกต้อง

library LibDiamond {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    struct FacetAddressAndPosition {
        address facetAddress;
        uint96 position;
    }

    struct DiamondStorage {
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAddressAndPosition;
        mapping(address => mapping(uint256 => bytes4)) facetAddressToSelectors;
        mapping(address => uint256) facetAddressToSelectorsLength;
        bytes4[] selectors;
        uint256 initAddress;
        bytes initCalldata;
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

    function setSelectors(
        bytes4[] memory _selectors,
        address _facetAddress,
        IDiamondCut.FacetCutAction _action
    ) internal {
        require(_selectors.length > 0, "LibDiamondCut: No selectors in facet to cut");
        DiamondStorage storage ds = diamondStorage();
        require(_facetAddress != address(0) || _action == IDiamondCut.FacetCutAction.Remove, "LibDiamondCut: Invalid facet address");

        if (_action == IDiamondCut.FacetCutAction.Add) {
            enforceHasNoContractCode(_facetAddress, "LibDiamondCut: Can't add an address that has no contract code");
            for (uint256 i = 0; i < _selectors.length; i++) {
                bytes4 selector = _selectors[i];
                address oldFacetAddress = ds.selectorToFacetAddressAndPosition[selector].facetAddress;
                require(oldFacetAddress == address(0), "LibDiamondCut: Can't add function that already exists");
                ds.selectorToFacetAddressAndPosition[selector].facetAddress = _facetAddress;
                ds.selectorToFacetAddressAndPosition[selector].position = uint96(ds.selectors.length);
                ds.selectors.push(selector);
                ds.facetAddressToSelectors[ _facetAddress][ds.facetAddressToSelectorsLength[_facetAddress]] = selector;
                ds.facetAddressToSelectorsLength[_facetAddress]++;
            }
        } else if (_action == IDiamondCut.FacetCutAction.Replace) {
            enforceHasContractCode(_facetAddress, "LibDiamondCut: Can't replace with an address that has no contract code");
            for (uint256 i = 0; i < _selectors.length; i++) {
                bytes4 selector = _selectors[i];
                address oldFacetAddress = ds.selectorToFacetAddressAndPosition[selector].facetAddress;
                require(oldFacetAddress != address(0), "LibDiamondCut: Can't replace function that doesn't exist");
                require(oldFacetAddress == _facetAddress, "LibDiamondCut: Can't replace function with different facet address"); // Should be same facet address
                ds.selectorToFacetAddressAndPosition[selector].facetAddress = _facetAddress;
            }
        } else if (_action == IDiamondCut.FacetCutAction.Remove) {
            require(_facetAddress == address(0), "LibDiamondCut: Can't remove functions from a specific facet address");
            for (uint256 i = 0; i < _selectors.length; i++) {
                bytes4 selector = _selectors[i];
                address oldFacetAddress = ds.selectorToFacetAddressAndPosition[selector].facetAddress;
                require(oldFacetAddress != address(0), "LibDiamondCut: Can't remove function that doesn't exist");
                // Clear the selector
                ds.selectorToFacetAddressAndPosition[selector].facetAddress = address(0);
                // Remove from facet's selectors list (not strictly necessary but good for cleanup)
                for (uint256 j = 0; j < ds.facetAddressToSelectorsLength[oldFacetAddress]; j++) {
                    if (ds.facetAddressToSelectors[oldFacetAddress][j] == selector) {
                        if (j < ds.facetAddressToSelectorsLength[oldFacetAddress] - 1) {
                            ds.facetAddressToSelectors[oldFacetAddress][j] = ds.facetAddressToSelectors[oldFacetAddress][ds.facetAddressToSelectorsLength[oldFacetAddress] - 1];
                        }
                        ds.facetAddressToSelectorsLength[oldFacetAddress]--;
                        break;
                    }
                }
                // Remove from the global selectors array
                uint96 selectorPosition = ds.selectorToFacetAddressAndPosition[selector].position;
                bytes4 lastSelector = ds.selectors[ds.selectors.length - 1];
                ds.selectors[selectorPosition] = lastSelector;
                ds.selectorToFacetAddressAndPosition[lastSelector].position = selectorPosition;
                ds.selectors.pop();
            }
        } else {
            revert("LibDiamondCut: Invalid FacetCutAction");
        }
    }

    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        DiamondStorage storage ds = diamondStorage();
        uint256 originalSelectorCount = ds.selectors.length;
        for (uint256 i = 0; i < _diamondCut.length; i++) {
            setSelectors(
                _diamondCut[i].functionSelectors,
                _diamondCut[i].facetAddress,
                _diamondCut[i].action
            );
        }
        if (_init != address(0)) {
            require(ds.selectors.length > originalSelectorCount || _init != address(0), "LibDiamondCut: Init function must be called when adding facets");
            enforceHasContractCode(_init, "LibDiamondCut: Init address has no contract code");
            (bool success, bytes memory result) = _init.delegatecall(_calldata);
            if (!success) {
                // If the init delegatecall failed, copy the revert reason
                // The `result` will contain the revert reason.
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        }
        emit DiamondCut(_diamondCut, _init, _calldata);
    }

    function getInitializationCalldata(address _owner) internal pure returns (bytes memory) {
        // Encode the function call for the init function in DiamondInit
        return abi.encodeWithSelector(bytes4(keccak256("init()")), _owner);
    }

    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize > 0, _errorMessage);
    }

    function enforceHasNoContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize == 0, _errorMessage);
    }
}