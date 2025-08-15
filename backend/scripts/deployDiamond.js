/* global ethers */
/* eslint prefer-const: "off" */

// ใน Hardhat, Ethers.js จะถูก injet เป็น global variable
// require("dotenv").config(); // ไม่จำเป็นถ้าใช้ [dotenv@17.0.1] injecting env
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js'); // ต้องมีไฟล์ diamond.js ใน scripts/libraries

async function deployDiamond() {
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];

  console.log(`Deploying core Diamond contracts with the account: ${contractOwner.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(contractOwner.address))} ETH`);

  // --- 1. Deploy Facets พื้นฐานของ Diamond Standard ---
  console.log('\nDeploying DiamondCutFacet...');
  const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();
  console.log('DiamondCutFacet deployed:', await diamondCutFacet.getAddress());

  console.log('Deploying DiamondLoupeFacet...');
  const DiamondLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet');
  const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
  await diamondLoupeFacet.waitForDeployment();
  console.log('DiamondLoupeFacet deployed:', await diamondLoupeFacet.getAddress());

  console.log('Deploying OwnershipFacet...');
  const OwnershipFacet = await ethers.getContractFactory('OwnershipFacet');
  const ownershipFacet = await OwnershipFacet.deploy();
  await ownershipFacet.waitForDeployment();
  console.log('OwnershipFacet deployed:', await ownershipFacet.getAddress());

  // --- 2. Deploy Diamond Contract หลัก ---
  console.log('\nDeploying Diamond...');
  const Diamond = await ethers.getContractFactory('Diamond');
  const diamond = await Diamond.deploy(
    await contractOwner.getAddress(), // Owner ของ Diamond (ผู้สร้างสัญญา)
    await diamondCutFacet.getAddress() // Address ของ DiamondCutFacet
  );
  await diamond.waitForDeployment();
  const diamondAddress = await diamond.getAddress();
  console.log('Diamond deployed:', diamondAddress);

  // --- 3. Deploy DiamondInit (สัญญาที่ใช้สำหรับ Initialization ครั้งแรก) ---
  // DiamondInit มีหน้าที่เรียก diamondCut ครั้งแรกเพื่อเพิ่ม Facet พื้นฐาน
  console.log('\nDeploying DiamondInit...');
  const DiamondInit = await ethers.getContractFactory('DiamondInit');
  const diamondInit = await DiamondInit.deploy();
  await diamondInit.waitForDeployment();
  console.log('DiamondInit deployed:', await diamondInit.getAddress());

  // --- 4. ทำการ DiamondCut ครั้งแรกเพื่อเพิ่ม Facet พื้นฐาน ---
  // Facets ที่จะเพิ่มในการ Cut ครั้งแรก
  const cut = [];
  cut.push({
    facetAddress: await diamondLoupeFacet.getAddress(),
    action: FacetCutAction.Add,
    functionSelectors: getSelectors(diamondLoupeFacet)
  });
  cut.push({
    facetAddress: await ownershipFacet.getAddress(),
    action: FacetCutAction.Add,
    functionSelectors: getSelectors(ownershipFacet)
  });

  console.log('\nPerforming initial diamond cut to add core facets...');
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress);
  const tx = await diamondCut.diamondCut(
    cut,
    await diamondInit.getAddress(), // Address ของ DiamondInit
    diamondInit.interface.encodeFunctionData('init') // Call init() function ใน DiamondInit
  );
  const receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Initial diamond cut failed: ${tx.hash}`);
  }
  console.log('Initial diamond cut successful. Gas used:', receipt.gasUsed.toString());

  console.log('\nCore Diamond deployment complete!');
  console.log(`\n*** Your Diamond Contract Address: ${diamondAddress} ***`);
  console.log('Please copy this address and paste it into `scripts/deployQuizGame.js` as YOUR_DIAMOND_ADDRESS.');

  return diamondAddress; // คืนค่า diamondAddress เผื่อนำไปใช้ใน script อื่น
}

if (require.main === module) {
  deployDiamond()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

exports.deployDiamond = deployDiamond;