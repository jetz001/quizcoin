// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDiamondLoupe {
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    function facets() external view returns (Facet[] memory _facets);

    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory _selectors);

    function facetAddress(bytes4 _selector) external view returns (address _facetAddress);
}