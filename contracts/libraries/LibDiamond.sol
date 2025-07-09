// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IDiamondCut } from '../interfaces/IDiamondCut.sol';
import { LibAppStorage } from './LibAppStorage.sol';

// Library สำหรับ Logic การทำ Diamond Cut และการจัดการโครงสร้าง Diamond
library LibDiamond {
    // ตำแหน่งของ DiamondStorage ใน Storage ของ Diamond Proxy
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.storage.quizgame");

    // Struct สำหรับเก็บข้อมูลเฉพาะของ Diamond (ไม่ใช่ Logic ของเกม)
    struct DiamondStorage {
        // AppStorage ของเกม (เพื่อให้ Facets เข้าถึง state ของเกมได้)
        LibAppStorage.AppStorage appStorage;

        // Diamond-specific storage (จาก EIP-2535)
        mapping(bytes4 => address) selectors; // map function selector to facet address
        mapping(address => bytes4[]) facetAddressAndSelectors; // map facet address to all its selectors
        address[] facetAddresses; // array of all active facet addresses
        mapping(address => bool) isFacetAddress; // check if an address is an active facet
    }

    // Helper function to get DiamondStorage
    function ds() internal pure returns (DiamondStorage storage s_) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            s_.slot := position
        }
    }

    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

    // ฟังก์ชันหลักสำหรับการทำ Diamond Cut
    function diamondCut(
        IDiamondCut.FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) internal {
        DiamondStorage storage ds_ = ds();

        for (uint256 i = 0; i < _diamondCut.length; i++) {
            IDiamondCut.FacetCutAction action = _diamondCut[i].action;
            address facetAddress = _diamondCut[i].facetAddress;
            bytes4[] memory functionSelectors = _diamondCut[i].functionSelectors;

            if (action == IDiamondCut.FacetCutAction.Add) {
                _addFacet(ds_, facetAddress, functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Replace) {
                _replaceFacet(ds_, facetAddress, functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Remove) {
                _removeFacet(ds_, facetAddress, functionSelectors);
            } else {
                revert("LibDiamond: Invalid FacetCutAction");
            }
        }

        // หากมีการเรียก init contract
        if (_init != address(0)) {
            (bool success, bytes memory result) = _init.delegatecall(_calldata);
            require(success, string(abi.encodePacked("LibDiamond: _init delegatecall failed: ", result)));
        }

        emit DiamondCut(_diamondCut, _init, _calldata);
    }

    function _addFacet(
        DiamondStorage storage ds_,
        address _facetAddress,
        bytes4[] memory _functionSelectors
    ) internal {
        require(_facetAddress != address(0), "LibDiamond: Add facet address cannot be zero");
        require(!ds_.isFacetAddress[_facetAddress], "LibDiamond: Facet has already been added");

        _addFacetAddress(ds_, _facetAddress);

        for (uint256 i = 0; i < _functionSelectors.length; i++) {
            bytes4 selector = _functionSelectors[i];
            require(ds_.selectors[selector] == address(0), "LibDiamond: Function selector already exists");
            ds_.selectors[selector] = _facetAddress;
            ds_.facetAddressAndSelectors[_facetAddress].push(selector);
        }
    }

    function _replaceFacet(
        DiamondStorage storage ds_,
        address _facetAddress,
        bytes4[] memory _functionSelectors
    ) internal {
        require(_facetAddress != address(0), "LibDiamond: Replace facet address cannot be zero");

        for (uint256 i = 0; i < _functionSelectors.length; i++) {
            bytes4 selector = _functionSelectors[i];
            address oldFacetAddress = ds_.selectors[selector];
            require(oldFacetAddress != address(0), "LibDiamond: Function selector does not exist");
            require(oldFacetAddress != _facetAddress, "LibDiamond: Cannot replace with same facet address");

            _removeSelector(ds_, oldFacetAddress, selector); // ลบ selector จาก Facet เก่า
            ds_.selectors[selector] = _facetAddress; // กำหนด selector ไป Facet ใหม่
            ds_.facetAddressAndSelectors[_facetAddress].push(selector); // เพิ่ม selector ใน Facet ใหม่
        }
        _addFacetAddress(ds_, _facetAddress); // เพิ่ม Facet Address ใหม่ ถ้ายังไม่มี
    }

    function _removeFacet(
        DiamondStorage storage ds_,
        address _facetAddress,
        bytes4[] memory _functionSelectors
    ) internal {
        require(_facetAddress != address(0), "LibDiamond: Remove facet address cannot be zero");

        if (_functionSelectors.length == 0) { // ถ้า _functionSelectors ว่างเปล่า ให้ลบ Facet ทั้งหมด
            require(ds_.isFacetAddress[_facetAddress], "LibDiamond: Facet has not been added");

            bytes4[] storage selectorsToRemove = ds_.facetAddressAndSelectors[_facetAddress];
            for (uint256 i = 0; i < selectorsToRemove.length; i++) {
                _removeSelector(ds_, _facetAddress, selectorsToRemove[i]);
            }
            _removeFacetAddress(ds_, _facetAddress);
        } else { // ถ้า _functionSelectors ไม่ว่างเปล่า ให้ลบเฉพาะฟังก์ชันที่ระบุ
            for (uint256 i = 0; i < _functionSelectors.length; i++) {
                bytes4 selector = _functionSelectors[i];
                require(ds_.selectors[selector] == _facetAddress, "LibDiamond: Function selector does not belong to specified facet");
                _removeSelector(ds_, _facetAddress, selector);
            }
        }
    }

    function _addFacetAddress(DiamondStorage storage ds_, address _facetAddress) internal {
        if (!ds_.isFacetAddress[_facetAddress]) {
            ds_.isFacetAddress[_facetAddress] = true;
            ds_.facetAddresses.push(_facetAddress);
        }
    }

    function _removeFacetAddress(DiamondStorage storage ds_, address _facetAddress) internal {
        ds_.isFacetAddress[_facetAddress] = false;
        // หาตำแหน่งของ Facet Address ใน array และลบออก
        uint256 facetAddressPos;
        for (uint256 i = 0; i < ds_.facetAddresses.length; i++) {
            if (ds_.facetAddresses[i] == _facetAddress) {
                facetAddressPos = i;
                break;
            }
        }
        // ย้าย element สุดท้ายมาแทนที่ และลดขนาด array
        ds_.facetAddresses[facetAddressPos] = ds_.facetAddresses[ds_.facetAddresses.length - 1];
        ds_.facetAddresses.pop();
    }

    function _removeSelector(DiamondStorage storage ds_, address _facetAddress, bytes4 _selector) internal {
        ds_.selectors[_selector] = address(0); // ลบ selector ออกจาก mapping หลัก

        // ลบ selector ออกจาก array ของ Facet นั้นๆ
        bytes4[] storage selectors_ = ds_.facetAddressAndSelectors[_facetAddress];
        uint256 selectorPos;
        for (uint256 i = 0; i < selectors_.length; i++) {
            if (selectors_[i] == _selector) {
                selectorPos = i;
                break;
            }
        }
        selectors_[selectorPos] = selectors_[selectors_.length - 1];
        selectors_.pop();
    }
}