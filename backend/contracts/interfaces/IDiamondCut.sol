// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDiamondCut {
    enum FacetCutAction { Add, Replace, Remove }
    
    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    // This event is required by the EIP-2535 Diamond Standard.
    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata); // <--- ต้องมีบรรทัดนี้

    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external;
}