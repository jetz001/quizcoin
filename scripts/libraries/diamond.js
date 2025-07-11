// scripts/libraries/diamond.js

const { ethers } = require("hardhat");

exports.FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
};

/**
 * @notice ดึง function selectors จาก ContractFactory หรือ Contract instance ที่ Deploy แล้ว
 * @param contractOrFactory ออบเจกต์ ContractFactory หรือ Contract instance
 * @returns อาร์เรย์ของ bytes4 selectors
 */
exports.getSelectors = (contractOrFactory) => {
  const selectors = [];

  if (!contractOrFactory || !contractOrFactory.interface) {
    console.error("Error: Invalid contract object or missing 'interface' property passed to getSelectors.");
    console.error("Received object:", contractOrFactory);
    throw new Error("Invalid contract object for selector extraction.");
  }

  const abiFragments = contractOrFactory.interface.fragments;
  if (!Array.isArray(abiFragments)) {
    console.error("Error: 'interface.fragments' is not an array on the contract object.", contractOrFactory);
    throw new Error("Invalid 'interface.fragments' for selector extraction.");
  }

  for (const fragment of abiFragments) {
    if (fragment.type === 'function') {
      // ใช้ ethers.id() เพื่อสร้าง full hash (bytes32)
      const fullHash = ethers.id(fragment.format("sighash"));
      // ตัด 4 ไบต์แรกเพื่อเป็น function selector (bytes4)
      selectors.push(fullHash.substring(0, 10)); // "0x" + 8 hex chars = 10 characters
    }
  }
  return selectors;
};

/**
 * @notice ดึง function selectors ทั้งหมดจากอาร์เรย์ของ Facet objects
 * @param facets อาร์เรย์ของ Facet objects (เช่น FacetFactory หรือ deployed Facet instances)
 * @returns อาร์เรย์ของ bytes4 selectors ทั้งหมด
 */
exports.getSelectorsFromFacets = (facets) => {
  let selectors = [];
  for (const facet of facets) {
    selectors = selectors.concat(exports.getSelectors(facet));
  }
  return selectors;
};