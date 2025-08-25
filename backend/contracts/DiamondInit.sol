// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondCut} from "./interfaces/IDiamondCut.sol"; // ตรวจสอบพาธให้ถูกต้อง
import {IERC173} from "./interfaces/IERC173.sol"; // ตรวจสอบพาธให้ถูกต้อง

// DiamondInit จะถูกใช้เพียงครั้งเดียวในการ Deploy ครั้งแรก
// เพื่อทำการ diamondCut เพื่อเพิ่ม Facet พื้นฐานและกำหนด Owner
contract DiamondInit {
    // init() ถูกเรียกโดย delegatecall จาก DiamondCutFacet ในระหว่างการ Deploy ครั้งแรก
    // มันจะกำหนด owner ของ Diamond และสามารถทำ setup เริ่มต้นอื่นๆ ได้
    function init() external {
        // ต้องตรวจสอบว่า caller คือ Diamond (this)
        // เพื่อป้องกันการเรียกใช้โดยตรง
        // (จริงๆ แล้ว delegatecall จะทำให้ msg.sender คือ Diamond)

        // กำหนด owner (owner จะมาจาก _owner ที่ส่งมาจากสคริปต์ deployDiamond.js)
        IERC173(address(this)).transferOwnership(msg.sender); // msg.sender จะเป็น owner ที่แท้จริง (จากสคริปต์)
        // คุณสามารถเพิ่ม logic การเริ่มต้นอื่นๆ ได้ที่นี่
    }
}