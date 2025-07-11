// scripts/deploy.js

const { ethers } = require("hardhat");
const { getSelectors, FacetCutAction } = require("./libraries/diamond.js");

// กำหนด gas limit เพื่อหลีกเลี่ยง Out of Gas บน Testnet/Mainnet
const gasLimit = 6000000; 

async function deployDiamond() {
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying contracts with the account: ${deployer.address}`);

  const gasLimit = 8000000;

  console.log("\n--- Deploying Facets ---");

  // DiamondCutFacet
  const DiamondCutFacetFactory = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacetFactory.deploy({ gasLimit: gasLimit });
  await diamondCutFacet.waitForDeployment();
  const diamondCutFacetAddress = await diamondCutFacet.getAddress();
  console.log(`DiamondCutFacet deployed to: ${diamondCutFacetAddress}`);

  // DiamondLoupeFacet
  const DiamondLoupeFacetFactory = await ethers.getContractFactory("DiamondLoupeFacet");
  const diamondLoupeFacet = await DiamondLoupeFacetFactory.deploy({ gasLimit: gasLimit });
  await diamondLoupeFacet.waitForDeployment();
  const diamondLoupeFacetAddress = await diamondLoupeFacet.getAddress();
  console.log(`DiamondLoupeFacet deployed to: ${diamondLoupeFacetAddress}`);

  // OwnershipFacet
  const OwnershipFacetFactory = await ethers.getContractFactory("OwnershipFacet");
  const ownershipFacet = await OwnershipFacetFactory.deploy({ gasLimit: gasLimit });
  await ownershipFacet.waitForDeployment();
  const ownershipFacetAddress = await ownershipFacet.getAddress();
  console.log(`OwnershipFacet deployed to: ${ownershipFacetAddress}`);

  // QuizCreationFacet
  const QuizCreationFacetFactory = await ethers.getContractFactory("QuizCreationFacet");
  const quizCreationFacet = await QuizCreationFacetFactory.deploy({ gasLimit: gasLimit });
  await quizCreationFacet.waitForDeployment();
  const quizCreationFacetAddress = await quizCreationFacet.getAddress();
  console.log(`QuizCreationFacet deployed to: ${quizCreationFacetAddress}`);

  // QuizParticipationFacet
  const QuizParticipationFacetFactory = await ethers.getContractFactory("QuizParticipationFacet");
  const quizParticipationFacet = await QuizParticipationFacetFactory.deploy({ gasLimit: gasLimit });
  await quizParticipationFacet.waitForDeployment();
  const quizParticipationFacetAddress = await quizParticipationFacet.getAddress();
  console.log(`QuizParticipationFacet deployed to: ${quizParticipationFacetAddress}`);

  // --- Deploying new Diamond Contract ---
  console.log("\n--- Deploying new Diamond Contract ---");
  const Diamond = await ethers.getContractFactory("Diamond");

  // *** แก้ไขตรงนี้: ส่ง deployer.address และ diamondCutFacetAddress ไปยัง Diamond constructor ***
  console.log("Deploying Diamond with owner:", deployer.address, "and DiamondCutFacetAddress:", diamondCutFacetAddress);
  const diamond = await Diamond.deploy(deployer.address, diamondCutFacetAddress, { gasLimit: gasLimit }); // <--- ตรงนี้ครับ
  // ******************************************************************************************

  await diamond.waitForDeployment();
  const currentDiamondAddress = await diamond.getAddress();
  console.log(`New Diamond Contract deployed to: ${currentDiamondAddress}`);

  // --- Performing Initial Diamond Cut for remaining Facets ---
  console.log("\n--- Performing Initial Diamond Cut for remaining Facets ---");

  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  function getSelectors(contractFactory) {
    const selectors = [];
    contractFactory.interface.forEachFunction(func => {
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
  
  try {
    const tx = await diamondCutContract.diamondCut(cuts, ethers.ZeroAddress, "0x", { gasLimit: gasLimit });
    console.log("Deploy: diamondCut transaction sent. Hash:", tx.hash);
    await tx.wait(); 
    console.log("All remaining facets added successfully!");
  } catch (error) {
    console.error("Deploy: Error during diamondCut transaction:");
    console.error(error);
    throw error;
  }


  // --- Verify Diamond Owner ---
const ownerFacet = await ethers.getContractAt("OwnershipFacet", currentDiamondAddress);
const diamondOwner = await ownerFacet.owner();

console.log(`\nDiamond owner is: ${diamondOwner}`);
console.log(`Deployer address is: ${deployer.address}`);

if (diamondOwner.toLowerCase() !== deployer.address.toLowerCase()) {
  throw new Error(`❌ Owner mismatch: expected ${deployer.address}, got ${diamondOwner}`);
} else {
  console.log("✅ Diamond owner matches deployer address. Deployment successful!");
}

  console.log(`\nDiamond owner is: ${diamondOwner}`);
  console.log(`Deployer address is: ${deployer.address}`);

  if (diamondOwner === deployer.address) {
    console.log("Diamond owner matches deployer address. Deployment successful!");
  } else {
    console.error("WARNING: Diamond owner does NOT match deployer address. Something might be wrong.");
  }
}

deployDiamond()
  .then(() => {
    console.log("\nDeployment process completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nDeployment failed with error:");
    console.error(error);
    process.exit(1);
  });