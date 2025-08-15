const { ethers } = require('hardhat');

// FacetCutAction enum จาก IDiamondCut.sol
const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2
};

/**
 * @notice Helper function to get all function selectors from a contract artifact or instance.
 * @param contract The ContractFactory or Contract instance (ethers.js v6 compatible).
 * @returns An array of bytes4 function selectors.
 */
function getSelectors (contract) {
    if (!contract || !contract.interface || !Array.isArray(contract.interface.fragments)) {
        console.error("Error: Invalid contract object or missing interface/fragments for getSelectors.");
        throw new Error("Invalid contract object passed to getSelectors.");
    }

    const selectors = contract.interface.fragments.reduce((acc, val) => {
        if (val.type === 'function') {
            if (val.format() !== 'constructor' && val.format() !== 'fallback' && val.format() !== 'receive') {
                acc.push(val.selector); // ใช้ val.selector สำหรับ ethers.js v6
            }
        }
        return acc;
    }, []);
    return selectors;
}

// ฟังก์ชันสำหรับดึงเฉพาะ function selectors ที่ต้องการ (ไม่จำเป็นต้องใช้ใน deploy.js นี้ แต่มีไว้เผื่อ)
function getSelector (funcName) {
    return ethers.id(funcName).slice(0, 10);
}

exports.getSelectors = getSelectors;
exports.FacetCutAction = FacetCutAction;
exports.getSelector = getSelector;