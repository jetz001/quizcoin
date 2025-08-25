// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IPoolManager.sol";
import "./interfaces/IQuizCoin.sol";
import "./libraries/LibDiamond.sol"; // Import LibDiamond ที่นี่
import "./interfaces/IDiamondCut.sol"; // จำเป็นสำหรับ FacetCutAction

// QuizGameDiamond จะ Inherit UUPSUpgradeable และ AccessControlUpgradeable โดยตรง
// เพื่อให้ AccessControl สามารถจัดการ Role ของ Diamond Proxy ได้
contract QuizGameDiamond is UUPSUpgradeable, AccessControlUpgradeable {
    // ไม่มี state variables ของเกมที่นี่
    // State ของเกมจะถูกจัดการผ่าน AppStorage ใน LibAppStorage

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // constructor ว่างเปล่าสำหรับ UUPSUpgradeable
    }

    // ฟังก์ชัน initialize ของ Diamond (จะถูกเรียกครั้งเดียวเมื่อ Deploy Proxy)
    // _initialAdmin คือผู้ที่จะเป็น DEFAULT_ADMIN_ROLE และ ContractOwner ของ Diamond
    // _facetAddresses และ _facetSelectors คืออาร์เรย์ของที่อยู่ Facet และ selectors ที่เกี่ยวข้อง
    // ที่จะถูกเพิ่มในการตั้งค่าเริ่มต้น
    function initialize(
        address _initialAdmin,
        address[] memory _facetAddresses,
        bytes4[][] memory _facetSelectors
    ) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init(); // Initialize AccessControl ที่นี่
        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin); // กำหนดผู้ deploy เป็น admin

        // *** สำคัญ: ทำการ Diamond Cut ครั้งแรกเพื่อเพิ่ม Facets หลักก่อนตั้งค่า owner ***
        // สิ่งนี้จะทำให้ฟังก์ชัน diamondCut, facetAddresses, owner เป็นต้น พร้อมใช้งานทันที
        require(_facetAddresses.length == _facetSelectors.length, "QuizGameDiamond: Mismatched facet arrays");
        
        IDiamondCut.FacetCut[] memory _diamondCut = new IDiamondCut.FacetCut[](_facetAddresses.length);

        for (uint i = 0; i < _facetAddresses.length; i++) {
            _diamondCut[i] = IDiamondCut.FacetCut({
                facetAddress: _facetAddresses[i],
                action: IDiamondCut.FacetCutAction.Add,
                functionSelectors: _facetSelectors[i]
            });
        }

        LibDiamond.diamondCut(_diamondCut, address(0), ""); // เรียก diamondCut ผ่าน LibDiamond

        // *** หลังจาก facets หลักถูกเพิ่มแล้ว ค่อยตั้งค่า Contract Owner ของ Diamond ***
        LibDiamond.setContractOwner(_initialAdmin);

        // *** ลบ logic การตั้งค่า PoolManager และ QuizCoin ออกจาก initialize ของ Diamond ***
        // *** เพราะการเรียกเหล่านี้ต้องทำโดยเจ้าของสัญญา PoolManager/QuizCoin โดยตรง ***
        // IPoolManager(_poolManagerAddress).setQuizGameDiamondAddress(address(this));
        // IQuizCoin(_quizCoinAddress).grantRole(IQuizCoin(_quizCoinAddress).MINTER_ROLE(), _poolManagerAddress);
    }

    // UUPS upgrade authorization function
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // *** สำคัญมาก: ฟังก์ชัน fallback นี้จะรับการเรียกใช้ฟังก์ชันทั้งหมด
    // ที่ Diamond proxy ไม่รู้จักโดยตรง และส่งต่อ (delegatecall) ไปยัง facet ที่ถูกต้อง
    fallback() external payable {
        LibDiamond.diamondFallback(); // เรียกใช้ logic การส่งต่อจากไลบรารี Diamond ของคุณ
    }

    // Allow contract to receive Ether
    receive() external payable {}
}
