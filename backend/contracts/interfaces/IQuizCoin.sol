// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol"; // Import IAccessControl

interface IQuizCoin is IERC20, IAccessControl { // Inherit IAccessControl
    // ฟังก์ชันสำหรับ minting (เฉพาะผู้ที่มี MINTER_ROLE)
    function mint(address to, uint256 amount) external;

    // ฟังก์ชันเพื่อให้ contract อื่นสามารถอ้างอิง MINTER_ROLE ได้
    function MINTER_ROLE() external view returns (bytes32);
}