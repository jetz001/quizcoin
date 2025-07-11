// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
// import "hardhat/console.sol"; // ลบหรือคอมเมนต์ออกเมื่อ deploy บน testnet/mainnet

library LibDiamond {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    struct DiamondStorage {
        mapping(bytes4 => address) selectorToFacet;
        mapping(address => bytes4[]) facetFunctionSelectors;
        address[] facetAddresses;
        address contractOwner; // สล็อต 3
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    // *** ฟังก์ชันนี้จะถูกเรียกใน constructor ของ Diamond.sol เพื่อตั้งค่า owner ครั้งแรก ***
    // *** และจะถูกเรียกโดย owner ปัจจุบันเท่านั้น เมื่อต้องการเปลี่ยน owner ***
    function setContractOwner(address _newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        // ตรวจสอบว่า msg.sender คือเจ้าของปัจจุบัน (ยกเว้นกรณีที่ยังไม่มีเจ้าของ (address(0)))
        // Hardhat deployer จะตั้งค่า owner ครั้งแรกผ่าน constructor ของ Diamond.sol
        // ใน constructor ของ Diamond.sol จะไม่มี msg.sender เป็น ds.contractOwner
        // ดังนั้น การตรวจสอบนี้จะใช้ได้เฉพาะกับการเปลี่ยนเจ้าของหลังจาก deploy เท่านั้น
        // แต่ใน constructor ของ Diamond.sol, เราจะตั้งค่า ds.contractOwner โดยตรง
        if (ds.contractOwner != address(0)) {
            require(msg.sender == ds.contractOwner, "LibDiamond: Must be contract owner");
        }
        require(_newOwner != address(0), "LibDiamond: New owner cannot be the zero address");
        ds.contractOwner = _newOwner;
    }

    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        DiamondStorage storage ds = diamondStorage();
        // *** เพิ่มการตรวจสอบว่า msg.sender คือเจ้าของสัญญา ***
        // *** หรือ ถ้าเป็น constructor ของ Diamond, msg.sender จะเป็นตัว Diamond Contract เอง ***
        // *** หรือถ้า owner ยังเป็น address(0) (คือครั้งแรกสุดใน constructor) ก็ให้ผ่าน ***
        // *** การตรวจสอบนี้สำคัญมากสำหรับการเรียก diamondCut หลัง deploy ***
        require(
            msg.sender == ds.contractOwner || ds.contractOwner == address(0), // ยอมให้ constructor ผ่าน (owner จะเป็น 0x0)
            "LibDiamond: Must be contract owner or initial cut"
        );
        // console.log("LibDiamond: diamondCut called by owner:", string(abi.encodePacked(msg.sender)));
        // console.log("LibDiamond: Current contract owner (in diamondCut):", string(abi.encodePacked(ds.contractOwner)));
        
        for (uint256 i = 0; i < _diamondCut.length; i++) {
            address facetAddress = _diamondCut[i].facetAddress;
            IDiamondCut.FacetCutAction action = _diamondCut[i].action;
            bytes4[] memory functionSelectors = _diamondCut[i].functionSelectors;

            if (action == IDiamondCut.FacetCutAction.Add) {
                _addFacet(ds, functionSelectors, facetAddress);
            } else if (action == IDiamondCut.FacetCutAction.Replace) {
                _replaceFacet(ds, functionSelectors, facetAddress);
            } else if (action == IDiamondCut.FacetCutAction.Remove) {
                _removeFacet(ds, functionSelectors, facetAddress);
            } else {
                revert("LibDiamond: Invalid FacetCutAction");
            }
        }

        emit IDiamondCut.DiamondCut(_diamondCut, _init, _calldata);

        if (_init != address(0)) {
            uint256 initCodeSize;
            assembly {
                initCodeSize := extcodesize(_init)
            }
            require(initCodeSize > 0, "LibDiamond: Init address is not a contract");

            // console.log("LibDiamond: Performing delegatecall to init function at:", string(abi.encodePacked(_init)));

            (bool success, bytes memory result) = _init.delegatecall(_calldata);
            // if (!success) {
            //     console.log("LibDiamond: _init delegatecall FAILED!");
            //     console.log("LibDiamond: Revert reason (if any):", string(result));
            // }
            require(success, string(abi.encodePacked("LibDiamond: _init delegatecall failed: ", result)));
        }
    }

    function _addFacet(DiamondStorage storage ds, bytes4[] memory selectors, address facet) internal {
        require(facet != address(0), "LibDiamond: Can't add zero address");
        // console.log("LibDiamond:_addFacet: Adding facet:", string(abi.encodePacked(facet)));

        for (uint256 i = 0; i < selectors.length; i++) {
            bytes4 selector = selectors[i];
            // console.log("LibDiamond:_addFacet: Adding selector:", string(abi.encodePacked(selector)));
            require(ds.selectorToFacet[selector] == address(0), "LibDiamond: Selector exists");
            ds.selectorToFacet[selector] = facet;
            ds.facetFunctionSelectors[facet].push(selector);
        }

        bool exists = false;
        for (uint256 i = 0; i < ds.facetAddresses.length; i++) {
            if (ds.facetAddresses[i] == facet) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            ds.facetAddresses.push(facet);
            // console.log("LibDiamond:_addFacet: Added facet address to list.");
        }
    }

    function _replaceFacet(DiamondStorage storage ds, bytes4[] memory selectors, address newFacet) internal {
        require(newFacet != address(0), "LibDiamond: Can't replace with zero address");

        for (uint256 i = 0; i < selectors.length; i++) {
            bytes4 selector = selectors[i];
            address oldFacet = ds.selectorToFacet[selector];
            require(oldFacet != address(0), "LibDiamond: Selector does not exist");
            ds.selectorToFacet[selector] = newFacet;

            _removeSelectorFromFacet(ds, oldFacet, selector);
            _addSelectorToFacet(ds, newFacet, selector);
        }

        _updateFacetAddresses(ds);
    }

    function _removeFacet(DiamondStorage storage ds, bytes4[] memory selectors, address facetAddr) internal {
        require(facetAddr != address(0), "LibDiamond: Remove uses zero address");

        for (uint256 i = 0; i < selectors.length; i++) {
            bytes4 selector = selectors[i];
            address oldFacet = ds.selectorToFacet[selector];
            require(oldFacet != address(0), "LibDiamond: Selector does not exist");

            delete ds.selectorToFacet[selector];
            _removeSelectorFromFacet(ds, oldFacet, selector);
        }

        _updateFacetAddresses(ds);
    }

    function _removeSelectorFromFacet(DiamondStorage storage ds, address facet, bytes4 selector) internal {
        bytes4[] storage selectors = ds.facetFunctionSelectors[facet];
        uint256 length = selectors.length;

        for (uint256 i = 0; i < length; i++) {
            if (selectors[i] == selector) {
                selectors[i] = selectors[length - 1];
                selectors.pop();
                break;
            }
        }
    }

    function _addSelectorToFacet(DiamondStorage storage ds, address facet, bytes4 selector) internal {
        ds.facetFunctionSelectors[facet].push(selector);

        bool found = false;
        for (uint256 i = 0; i < ds.facetAddresses.length; i++) {
            if (ds.facetAddresses[i] == facet) {
                found = true;
                break;
            }
        }

        if (!found) {
            ds.facetAddresses.push(facet);
        }
    }

    function _updateFacetAddresses(DiamondStorage storage ds) internal {
        uint256 validCount = 0;
        for (uint256 i = 0; i < ds.facetAddresses.length; i++) {
            address facet = ds.facetAddresses[i];
            if (ds.facetFunctionSelectors[facet].length > 0) {
                ds.facetAddresses[validCount] = facet;
                validCount++;
            }
        }

        while (ds.facetAddresses.length > validCount) {
            ds.facetAddresses.pop();
        }
    }

    function diamondFallback() internal {
        DiamondStorage storage ds = diamondStorage();
        address facet = ds.selectorToFacet[msg.sig];
        // console.log("LibDiamond: Fallback called. msg.sig:", string(abi.encodePacked(msg.sig)));
        // console.log("LibDiamond: Current contract owner (in Fallback):", string(abi.encodePacked(ds.contractOwner)));
        
        require(facet != address(0), "Diamond: Function does not exist");

        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}