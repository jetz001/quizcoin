// scripts/deploy.js

const { ethers } = require("hardhat");
// ไม่ต้อง import getSelectors และ FacetCutAction จากไฟล์ diamond.js แล้ว เพราะเราจะเขียนในไฟล์นี้โดยตรง
// const { getSelectors, FacetCutAction } = require("./libraries/diamond.js");

// กำหนด gas limit เพื่อหลีกเลี่ยง Out of Gas บน Testnet/Mainnet
// ค่านี้สามารถปรับได้ตามความเหมาะสมของเครือข่ายที่คุณ deploy
const gasLimit = 6000000;

async function deployDiamond() {
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying contracts with the account: ${deployer.address}`);

  // ใช้ gasLimit ที่ประกาศไว้ด้านบน
  const deployGasLimit = 8000000; // แยกตัวแปรเพื่อความชัดเจน อาจจะใช้ค่าเดียวกับ gasLimit ด้านบนก็ได้

  console.log("\n--- Deploying Facets ---");

  // DiamondCutFacet
  const DiamondCutFacetFactory = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacetFactory.deploy({ gasLimit: deployGasLimit });
  await diamondCutFacet.waitForDeployment();
  const diamondCutFacetAddress = await diamondCutFacet.getAddress();
  console.log(`DiamondCutFacet deployed to: ${diamondCutFacetAddress}`);

  // DiamondLoupeFacet
  const DiamondLoupeFacetFactory = await ethers.getContractFactory("DiamondLoupeFacet");
  const diamondLoupeFacet = await DiamondLoupeFacetFactory.deploy({ gasLimit: deployGasLimit });
  await diamondLoupeFacet.waitForDeployment();
  const diamondLoupeFacetAddress = await diamondLoupeFacet.getAddress();
  console.log(`DiamondLoupeFacet deployed to: ${diamondLoupeFacetAddress}`);

  // OwnershipFacet
  const OwnershipFacetFactory = await ethers.getContractFactory("OwnershipFacet");
  const ownershipFacet = await OwnershipFacetFactory.deploy({ gasLimit: deployGasLimit });
  await ownershipFacet.waitForDeployment();
  const ownershipFacetAddress = await ownershipFacet.getAddress();
  console.log(`OwnershipFacet deployed to: ${ownershipFacetAddress}`);

  // QuizCreationFacet
  const QuizCreationFacetFactory = await ethers.getContractFactory("QuizCreationFacet");
  const quizCreationFacet = await QuizCreationFacetFactory.deploy({ gasLimit: deployGasLimit });
  await quizCreationFacet.waitForDeployment();
  const quizCreationFacetAddress = await quizCreationFacet.getAddress();
  console.log(`QuizCreationFacet deployed to: ${quizCreationFacetAddress}`);

  // QuizParticipationFacet
  const QuizParticipationFacetFactory = await ethers.getContractFactory("QuizParticipationFacet");
  // บรรทัดที่ 51 (ในโค้ดเก่าของคุณ)
const quizParticipationFacet = await QuizParticipationFacetFactory.deploy({ gasLimit: deployGasLimit });
  await quizParticipationFacet.waitForDeployment();
  const quizParticipationFacetAddress = await quizParticipationFacet.getAddress();
  console.log(`QuizParticipationFacet deployed to: ${quizParticipationFacetAddress}`);

  

 

  console.log("\n--- Deploying new Diamond Contract ---");
  const Diamond = await ethers.getContractFactory("Diamond");

  // ส่ง deployer.address (owner) และ diamondCutFacetAddress ไปยัง Diamond constructor
  console.log("Deploying Diamond with owner:", deployer.address, "and DiamondCutFacetAddress:", diamondCutFacetAddress);
  const diamond = await Diamond.deploy(deployer.address, diamondCutFacetAddress, { gasLimit: deployGasLimit });
  await diamond.waitForDeployment();
  const currentDiamondAddress = await diamond.getAddress();
  console.log(`New Diamond Contract deployed to: ${currentDiamondAddress}`);

 

  console.log("\n--- Performing Initial Diamond Cut for remaining Facets ---");

  // Define FacetCutAction enum ภายในไฟล์นี้เลย
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  // Helper function: getSelectors
  function getSelectors(contractFactory) {
    const selectors = [];
    contractFactory.interface.forEachFunction(func => {
      // ไม่ต้องใช้ func.selector.slice(0, 10) อีกต่อไป
      // .selector จะให้ bytes4 อยู่แล้ว (e.g., '0xabcdef01')
      selectors.push(func.selector);
    });
    return selectors;
  }

  const cuts = [];

  // DiamondLoupeFacet
  const loupeSelectors = getSelectors(DiamondLoupeFacetFactory);
  console.log(`Deploy: DiamondLoupeFacet selectors (${loupeSelectors.length}):`, loupeSelectors);
  cuts.push({
    facetAddress: diamondLoupeFacetAddress,
    action: FacetCutAction.Add,
    functionSelectors: loupeSelectors,
  });

  // OwnershipFacet
  const ownershipSelectors = getSelectors(OwnershipFacetFactory);
  console.log(`Deploy: OwnershipFacet selectors (${ownershipSelectors.length}):`, ownershipSelectors);
  cuts.push({
    facetAddress: ownershipFacetAddress,
    action: FacetCutAction.Add,
    functionSelectors: ownershipSelectors,
  });

  // QuizCreationFacet
  const quizCreationSelectors = getSelectors(QuizCreationFacetFactory);
  console.log(`Deploy: QuizCreationFacet selectors (${quizCreationSelectors.length}):`, quizCreationSelectors);
  cuts.push({
    facetAddress: quizCreationFacetAddress,
    action: FacetCutAction.Add,
    functionSelectors: quizCreationSelectors,
  });

  // QuizParticipationFacet
  const quizParticipationSelectors = getSelectors(QuizParticipationFacetFactory);
  console.log(`Deploy: QuizParticipationFacet selectors (${quizParticipationSelectors.length}):`, quizParticipationSelectors);
  cuts.push({
    facetAddress: quizParticipationFacetAddress,
    action: FacetCutAction.Add,
    functionSelectors: quizParticipationSelectors,
  });

  console.log("Adding remaining facets to the Diamond...");
  console.log("Deploy: Full diamondCut array:", JSON.stringify(cuts, null, 2));

  const diamondCutContract = await ethers.getContractAt("IDiamondCut", currentDiamondAddress);

  // *** แก้ไขตรงนี้: เรียกฟังก์ชัน `init` ของ OwnershipFacet ผ่าน diamondCut ***
  // เพื่อให้ OwnershipFacet ตั้งค่า owner ของ Diamond Contract อย่างถูกต้อง
  const initCalldata = OwnershipFacetFactory.interface.encodeFunctionData("init", [deployer.address]);

  try {
    const tx = await diamondCutContract.diamondCut(
      cuts,
      ownershipFacetAddress, // ที่อยู่ของ Facet ที่มีฟังก์ชัน init()
      initCalldata,         // calldata สำหรับการเรียก init()
      { gasLimit: deployGasLimit }
    );
    console.log("Deploy: diamondCut transaction sent. Hash:", tx.hash);
    await tx.wait();
    console.log("All remaining facets added successfully!");
  } catch (error) {
    console.error("Deploy: Error during diamondCut transaction:");
    console.error(error);
    throw error; // โยน error ออกไปเพื่อให้ process.exit(1) ทำงาน
  }

 

  const ownerFacet = await ethers.getContractAt("OwnershipFacet", currentDiamondAddress);
  const diamondOwner = await ownerFacet.owner();

  console.log(`\nDiamond owner is: ${diamondOwner}`);
  console.log(`Deployer address is: ${deployer.address}`);

  // ตรวจสอบ Owner เพียงครั้งเดียว
  if (diamondOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`❌ Owner mismatch: expected ${deployer.address}, got ${diamondOwner}`);
  } else {
    console.log("✅ Diamond owner matches deployer address. Deployment successful!");
  }
}

// เรียกใช้ฟังก์ชัน deployDiamond
deployDiamond()
  .then(() => {
    console.log("\nDeployment process completed successfully.");
    process.exit(0); // ออกจาก process ด้วยโค้ด 0 (สำเร็จ)
  })
  .catch((error) => {
    console.error("\nDeployment failed with error:");
    console.error(error);
    process.exit(1); // ออกจาก process ด้วยโค้ด 1 (มี error)
  });