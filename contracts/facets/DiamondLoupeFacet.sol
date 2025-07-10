// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

// DiamondLoupeFacet implements the Diamond Loupe functions (EIP-2535)
// ซึ่งใช้สำหรับตรวจสอบว่า Diamond มี Facet และฟังก์ชันใดบ้าง
contract DiamondLoupeFacet is IDiamondLoupe {

    // ลบ LibDiamond.DiamondStorage ds; ตรงนี้ออกไป
    // เราจะประกาศ ds เป็น local storage reference ในแต่ละฟังก์ชันแทน

    /// @notice รับข้อมูล Facet ทั้งหมดของ Diamond
    /// @return facetAddresses_ อาร์เรย์ของที่อยู่ Facet ทั้งหมด
    function facetAddresses() external view override returns (address[] memory facetAddresses_) {
        // ประกาศและกำหนดค่า ds ในบรรทัดเดียว เป็น storage reference
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.selectors.length;

        // สำหรับ uniqueFacetAddresses ให้ใช้ mapping ใน memory แทน
        // เนื่องจาก mapping ใน storage ต้องถูกประกาศเป็น state variable
        // และเราต้องการแค่ใช้งานชั่วคราวในฟังก์ชันนี้
        // การใช้ mapping ใน memory ไม่ใช่เรื่องปกติและอาจไม่รองรับใน Solidity บางเวอร์ชัน
        // วิธีที่นิยมกว่าคือการใช้ Array หรือ set data structure ที่สามารถใส่ใน memory ได้

        // **ทางเลือกที่ 1: ใช้ address array และ sort/remove duplicates (ประสิทธิภาพอาจจะต่ำกว่า)**
        // address[] memory tempFacetAddresses = new address[](selectorCount);
        // uint256 uniqueCount = 0;
        // for (uint256 i = 0; i < selectorCount; i++) {
        //     address currentFacetAddress = ds.facetAddressAndSelectorPosition[ds.selectors[i]].facetAddress;
        //     bool found = false;
        //     for (uint256 j = 0; j < uniqueCount; j++) {
        //         if (tempFacetAddresses[j] == currentFacetAddress) {
        //             found = true;
        //             break;
        //         }
        //     }
        //     if (!found) {
        //         tempFacetAddresses[uniqueCount] = currentFacetAddress;
        //         uniqueCount++;
        //     }
        // }
        // facetAddresses_ = new address[](uniqueCount);
        // for (uint256 i = 0; i < uniqueCount; i++) {
        //     facetAddresses_[i] = tempFacetAddresses[i];
        // }

        // **ทางเลือกที่ 2: ใช้ mapping ใน memory (ถ้า Solidity อนุญาต)**
        // **แต่ Solidity ไม่อนุญาตให้ประกาศ mapping ใน memory แบบนี้**
        // **ดังนั้น เราต้องใช้เทคนิคอื่นครับ**

        // **ทางเลือกที่ 3: ใช้ LibDiamond.DiamondStorage.facetAddressToSelectorsLength
        // เพื่อหา Facet ทั้งหมด (ซึ่งมีอยู่แล้วใน LibDiamond)**
        // วิธีนี้จะใช้ข้อมูลที่มีอยู่แล้วใน storage ซึ่งดีกว่า

        // ไปที่ LibDiamond.sol เพื่อดึง facet addresses โดยตรง
        // (ซึ่ง IDiamondLoupe.sol อาจจะต้องการข้อมูลนี้อยู่แล้ว)

        // **แก้ปัญหา DocstringParsingError: เพิ่มชื่อตัวแปรใน @return**
        // @return facetAddresses_ อาร์เรย์ของที่อยู่ Facet ทั้งหมด

        // ในการได้ unique facet addresses เราจะวนลูปผ่าน ds.selectors และเก็บ address ที่ไม่ซ้ำกัน
        // แล้วค่อยสร้าง array ขึ้นมา

        // วิธีที่ถูกต้องและเป็นไปตาม Diamond Standard ในการหา unique facet addresses
        // คือการวนลูปผ่าน ds.selectors และใช้ mapping ชั่วคราว (ใน memory) เพื่อติดตามว่า
        // address ไหนถูกเพิ่มไปแล้วบ้าง อย่างไรก็ตาม mapping ไม่สามารถประกาศใน memory โดยตรงได้
        // ดังนั้นเราจะใช้แนวทางที่คล้ายกับ EIP-2535 standard implementation

        // การแก้ปัญหาเรื่อง uniqueFacetAddresses ไม่สามารถประกาศใน memory ได้โดยตรง
        // ให้สร้าง array ชั่วคราวและใช้ loop เพื่อตรวจสอบค่าซ้ำซ้อน
        // หรือใช้ LibDiamond's existing structure to get the data

        // หากคุณต้องการดึงข้อมูล Facet ทั้งหมดที่แตกต่างกัน
        // คุณสามารถวนลูปผ่าน ds.facetAddressToSelectorsLength
        // ซึ่งเก็บข้อมูลจำนวน selector ของแต่ละ Facet
        // แต่ต้องระมัดระวัง เพราะ mapping นี้อาจไม่เก็บเฉพาะ Facet ที่ "active" อยู่

        // แก้ไข: เพื่อความสอดคล้องกับ implementation ทั่วไป, เราจะใช้ mapping ชั่วคราว
        // แต่ต้องเป็น mapping ใน "storage" และเป็น state variable
        // อย่างไรก็ตาม EIP-2535 Diamond Loupe Facet มักจะไม่มี state variable ของตัวเอง
        // ดังนั้นการคำนวณใน memory เป็นสิ่งจำเป็น

        // เนื่องจาก `mapping` ไม่สามารถประกาศใน `memory` ได้
        // และเราไม่ต้องการให้ `DiamondLoupeFacet` มี `state variable` เพิ่มเติม
        // เราจะใช้วิธีที่ EIP-2535 แนะนำคือการวนลูป `ds.selectors`
        // และสร้าง `tempFacetAddresses` ใน `memory` จากนั้นใช้ `seen` array เพื่อตรวจสอบซ้ำ
        // ซึ่งอาจจะดูซับซ้อนขึ้นเล็กน้อย

        address[] memory tempFacetAddresses = new address[](selectorCount);
        

        // ดึง Facet Addresses ทั้งหมดมาเก็บไว้ใน temp array ก่อน
        for (uint256 i = 0; i < selectorCount; i++) {
            tempFacetAddresses[i] = ds.facetAddressAndSelectorPosition[ds.selectors[i]].facetAddress;
        }

        // กรองหา Facet Addresses ที่ไม่ซ้ำกัน
        address[] memory uniqueAddresses = new address[](selectorCount); // Max possible unique addresses
        uint256 uniqueIndex = 0;

        for (uint256 i = 0; i < selectorCount; i++) {
            bool isDuplicate = false;
            for (uint256 j = 0; j < uniqueIndex; j++) {
                if (uniqueAddresses[j] == tempFacetAddresses[i]) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueAddresses[uniqueIndex] = tempFacetAddresses[i];
                uniqueIndex++;
            }
        }

        facetAddresses_ = new address[](uniqueIndex);
        for (uint256 i = 0; i < uniqueIndex; i++) {
            facetAddresses_[i] = uniqueAddresses[i];
        }

        return facetAddresses_;
    }

    /// @notice รับข้อมูลของ Facet ที่กำหนด
    /// @param _facetAddress ที่อยู่ของ Facet
    /// @return facetFunctionSelectors_ โครงสร้าง Facet ที่มีที่อยู่และฟังก์ชัน
    // แก้ Docstring: @return facetFunctionSelectors_ ...
    function facetFunctionSelectors(address _facetAddress) public view override returns (bytes4[] memory facetFunctionSelectors_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.facetAddressToSelectorsLength[_facetAddress];
        facetFunctionSelectors_ = new bytes4[](selectorCount);
        for (uint256 i = 0; i < selectorCount; i++) {
            facetFunctionSelectors_[i] = ds.facetAddressToSelectors[_facetAddress][i];
        }
        return facetFunctionSelectors_;
    }

    /// @notice รับข้อมูล Facet ทั้งหมดของ Diamond
    /// @return facets_ อาร์เรย์ของโครงสร้าง Facet
    function facets() external view override returns (IDiamondLoupe.Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.selectors.length;

        address[] memory tempFacetAddresses = new address[](selectorCount);
        

        // ดึง Facet Addresses ทั้งหมดมาเก็บไว้ใน temp array ก่อน
        for (uint256 i = 0; i < selectorCount; i++) {
            tempFacetAddresses[i] = ds.facetAddressAndSelectorPosition[ds.selectors[i]].facetAddress;
        }

        // กรองหา Facet Addresses ที่ไม่ซ้ำกัน
        address[] memory uniqueAddresses = new address[](selectorCount);
        uint256 uniqueIndex = 0;

        for (uint256 i = 0; i < selectorCount; i++) {
            bool isDuplicate = false;
            for (uint256 j = 0; j < uniqueIndex; j++) {
                if (uniqueAddresses[j] == tempFacetAddresses[i]) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueAddresses[uniqueIndex] = tempFacetAddresses[i];
                uniqueIndex++;
            }
        }

        facets_ = new IDiamondLoupe.Facet[](uniqueIndex);
        
        for (uint256 i = 0; i < uniqueIndex; i++) {
            address facetAddress_ = uniqueAddresses[i];
            bytes4[] memory functionSelectors_ = facetFunctionSelectors(facetAddress_);
            facets_[i] = IDiamondLoupe.Facet(facetAddress_, functionSelectors_);
        }
        return facets_;
    }

    /// @notice รับที่อยู่ของ Facet ที่มีฟังก์ชัน Selector นั้นๆ
    /// @param _functionSelector ฟังก์ชัน Selector ที่ต้องการค้นหา
    /// @return facetAddress_ ที่อยู่ของ Facet
    function facetAddress(bytes4 _functionSelector) external view override returns (address facetAddress_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetAddress_ = ds.facetAddressAndSelectorPosition[_functionSelector].facetAddress;
    }
}