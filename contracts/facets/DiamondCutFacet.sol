// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IDiamondCut } from '../interfaces/IDiamondCut.sol';
import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibAppStorage } from '../libraries/LibAppStorage.sol'; // Import LibAppStorage เพื่อเข้าถึง Role constants
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol'; // สำหรับใช้ hasRole

contract DiamondCutFacet {
    function diamondCut(
        IDiamondCut.FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        
        // ตรวจสอบ Role ผ่าน AccessControlUpgradeable บน Diamond Proxy
        require(
            AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender),
            "DiamondCut: Caller is not a diamond cut admin"
        );

        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}