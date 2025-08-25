/* global ethers */
/* eslint prefer-const: "off" */

// ใน Hardhat, Ethers.js จะถูก injet เป็น global variable
// require("dotenv").config(); // ไม่จำเป็นถ้าใช้ [dotenv@17.0.1] injecting env
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js'); // ต้องมีไฟล์ diamond.js ใน scripts/libraries

async function deployQuizGame() {
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];

  console.log(`Deploying contracts with the account: ${contractOwner.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(contractOwner.address))} ETH`);

  // --- 1. ตรวจสอบว่า Diamond Contract ถูก Deploy แล้วและมี Address ---
  // คุณต้องแทนที่ 'YOUR_DIAMOND_ADDRESS' ด้วย Address ของ Diamond Contract ที่ Deploy แล้วของคุณ
  // หากคุณยังไม่ได้ Deploy Diamond Contract หลัก ให้ Deploy Diamond Contract หลักและ Facet พื้นฐาน (DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet) ก่อน
  // และเรียกใช้ DiamondInit หากมี
  const diamondAddress = 'YOUR_DIAMOND_ADDRESS'; // *** ต้องแก้ไขตรงนี้ ***
  if (diamondAddress === 'YOUR_DIAMOND_ADDRESS' || !ethers.isAddress(diamondAddress)) {
      console.error("ERROR: Please replace 'YOUR_DIAMOND_ADDRESS' with your actual Diamond contract address.");
      console.error("If you haven't deployed the core Diamond, you need to do that first.");
      process.exit(1);
  }

  const diamond = await ethers.getContractAt('IDiamondCut', diamondAddress);
  const diamondLoupeFacet = await ethers.getContractAt('IDiamondLoupe', diamondAddress);
  const ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress); // ใช้ OwnershipFacet เพื่อตรวจสอบ owner

  console.log('Diamond deployed at:', diamondAddress);
  console.log('Diamond owner:', await ownershipFacet.owner());

  // --- 2. Deploy Game Facets ของคุณ ---
  console.log('\nDeploying QuizGameBaseFacet...');
  const QuizGameBaseFacet = await ethers.getContractFactory('QuizGameBaseFacet');
  const quizGameBaseFacet = await QuizGameBaseFacet.deploy();
  await quizGameBaseFacet.waitForDeployment();
  console.log('QuizGameBaseFacet deployed:', await quizGameBaseFacet.getAddress());

  console.log('Deploying QuizGameModeFacet...');
  const QuizGameModeFacet = await ethers.getContractFactory('QuizGameModeFacet');
  const quizGameModeFacet = await QuizGameModeFacet.deploy();
  await quizGameModeModeFacet.waitForDeployment();
  console.log('QuizGameModeFacet deployed:', await quizGameModeModeFacet.getAddress());

  console.log('Deploying QuizGameRewardFacet...');
  const QuizGameRewardFacet = await ethers.getContractFactory('QuizGameRewardFacet');
  const quizGameRewardFacet = await QuizGameRewardFacet.deploy();
  await quizGameRewardFacet.waitForDeployment();
  console.log('QuizGameRewardFacet deployed:', await quizGameRewardFacet.getAddress());

  // --- 3. เพิ่ม Facets ใหม่ไปยัง Diamond Contract โดยใช้ DiamondCut ---
  const facets = [
    quizGameBaseFacet,
    quizGameModeFacet,
    quizGameRewardFacet
  ];

  const cuts = [];
  for (const facet of facets) {
    console.log(`Adding ${facet.constructor.name} to Diamond...`);
    cuts.push({
      facetAddress: await facet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    });
  }

  // ใช้ IDiamondCut เพื่อทำการ diamondCut
  console('\nPerforming diamond cut to add game facets...');
  const tx = await diamond.diamondCut(
    cuts,
    ethers.ZeroAddress, // ไม่มี init contract ในการ cut นี้ เพราะ initializeQuizGame จะเรียกแยก
    '0x'
  );
  const receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Diamond cut failed: ${tx.hash}`);
  }
  console.log('Diamond cut successful. Gas used:', receipt.gasUsed.toString());

  // ตรวจสอบว่า Facet ถูกเพิ่มเข้ามาแล้ว
  for (const facet of facets) {
      const facetAddress = await facet.getAddress();
      const selectors = getSelectors(facet);
      for (const selector of selectors) {
          const result = await diamondLoupeFacet.facetAddress(selector);
          if (result.toLowerCase() !== facetAddress.toLowerCase()) {
              console.error(`Selector ${selector} from ${facet.constructor.name} not found at expected address.`);
          }
      }
      console.log(`${facet.constructor.name} selectors confirmed.`);
  }

  // --- 4. เรียกใช้ initializeQuizGame() บน Diamond Contract ---
  // เนื่องจาก initializeQuizGame อยู่ใน QuizGameBaseFacet ซึ่งได้เพิ่มเข้าไปแล้ว
  console('\nInitializing QuizGame...');
  const quizGameBaseFacetInterface = await ethers.getContractAt('QuizGameBaseFacet', diamondAddress);
  const initTx = await quizGameBaseFacetInterface.initializeQuizGame();
  await initTx.wait();
  console.log('QuizGame initialized successfully!');

  // --- 5. ตั้งค่า Address สัญญาภายนอก (PoolManager, QuizCoin) และกำหนด Role ---
  // คุณต้องแทนที่ 'YOUR_POOL_MANAGER_ADDRESS' และ 'YOUR_QUIZ_COIN_ADDRESS' ด้วย Address จริง
  // และ 'ADDRESS_FOR_REWARD_DISTRIBUTOR_ROLE', 'ADDRESS_FOR_CREATOR_ROLE' ด้วย Address ที่ต้องการ
  const poolManagerAddress = 'YOUR_POOL_MANAGER_ADDRESS'; // *** ต้องแก้ไขตรงนี้ ***
  const quizCoinAddress = 'YOUR_QUIZ_COIN_ADDRESS';     // *** ต้องแก้ไขตรงนี้ ***

  const rewardDistributorRoleAddress = 'ADDRESS_FOR_REWARD_DISTRIBUTOR_ROLE'; // *** ต้องแก้ไขตรงนี้ ***
  const creatorRoleAddress = 'ADDRESS_FOR_CREATOR_ROLE';       // *** ต้องแก้ไขตรงนี้ ***


  if (poolManagerAddress === 'YOUR_POOL_MANAGER_ADDRESS' || quizCoinAddress === 'YOUR_QUIZ_COIN_ADDRESS') {
      console.warn("WARNING: PoolManager or QuizCoin addresses are placeholders. Please update them after deploying those contracts.");
  } else {
      console.log('\nSetting PoolManager address...');
      const setPoolTx = await quizGameBaseFacetInterface.setPoolManagerAddress(poolManagerAddress);
      await setPoolTx.wait();
      console.log('PoolManager address set.');

      console.log('Setting QuizCoin address...');
      const setCoinTx = await quizGameBaseFacetInterface.setQuizCoinAddress(quizCoinAddress);
      await setCoinTx.wait();
      console.log('QuizCoin address set.');
  }

  // กำหนด Role (ถ้า Account ที่รัน script ไม่ใช่ Admin อยู่แล้ว)
  // ตรวจสอบว่า `contractOwner` มี DEFAULT_ADMIN_ROLE แล้ว (จากการ Deploy Diamond ครั้งแรก)
  // และใช้ `quizGameBaseFacetInterface` เพื่อเข้าถึงฟังก์ชัน `DEFAULT_ADMIN_ROLE`, `REWARD_DISTRIBUTOR_ROLE`, `CREATOR_ROLE` และ `grantRole` (ที่มาจาก AccessControl)
  const DEFAULT_ADMIN_ROLE = await quizGameBaseFacetInterface.DEFAULT_ADMIN_ROLE();
  const REWARD_DISTRIBUTOR_ROLE = await quizGameBaseFacetInterface.REWARD_DISTRIBUTOR_ROLE();
  const CREATOR_ROLE = await quizGameBaseFacetInterface.CREATOR_ROLE();

  // ตัวอย่างการ Grant Role:
  if (rewardDistributorRoleAddress !== 'ADDRESS_FOR_REWARD_DISTRIBUTOR_ROLE') {
      const hasRewardDistributorRole = await quizGameBaseFacetInterface.hasRole(REWARD_DISTRIBUTOR_ROLE, rewardDistributorRoleAddress);
      if (!hasRewardDistributorRole) {
          console.log(`Granting REWARD_DISTRIBUTOR_ROLE to ${rewardDistributorRoleAddress}...`);
          const grantTx = await ownershipFacet.grantRole(REWARD_DISTRIBUTOR_ROLE, rewardDistributorRoleAddress);
          await grantTx.wait();
          console.log('REWARD_DISTRIBUTOR_ROLE granted.');
      } else {
          console.log(`REWARD_DISTRIBUTOR_ROLE already granted to ${rewardDistributorRoleAddress}.`);
      }
  }

  if (creatorRoleAddress !== 'ADDRESS_FOR_CREATOR_ROLE') {
      const hasCreatorRole = await quizGameBaseFacetInterface.hasRole(CREATOR_ROLE, creatorRoleAddress);
      if (!hasCreatorRole) {
          console.log(`Granting CREATOR_ROLE to ${creatorRoleAddress}...`);
          const grantTx = await ownershipFacet.grantRole(CREATOR_ROLE, creatorRoleAddress);
          await grantTx.wait();
          console.log('CREATOR_ROLE granted.');
      } else {
          console.log(`CREATOR_ROLE already granted to ${creatorRoleAddress}.`);
      }
  }


  console.log('\nDeployment and setup complete!');
}

if (require.main === module) {
  deployQuizGame()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

exports.deployQuizGame = deployQuizGame;