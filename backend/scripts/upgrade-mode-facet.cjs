const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🔄 Upgrading QuizGameModeFacet on BSC Testnet...");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Upgrading with account: ${deployer.address}`);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(balance)} BNB`);

  // Load contract addresses
  const addressesPath = path.join(__dirname, '../contractAddresses.json');
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  
  console.log(`🎮 Diamond Contract: ${addresses.QuizGameDiamond}`);

  // Deploy new QuizGameModeFacet
  console.log("\n--- Deploying New QuizGameModeFacet ---");
  const QuizGameModeFacet = await hre.ethers.getContractFactory("QuizGameModeFacet");
  const newModeFacet = await QuizGameModeFacet.deploy();
  await newModeFacet.waitForDeployment();
  console.log(`✅ New QuizGameModeFacet deployed: ${newModeFacet.target}`);

  // Get selectors for the new facet - use ABI directly
  const artifactPath = path.join(__dirname, '../artifacts/contracts/facets/QuizGameModeFacet.sol/QuizGameModeFacet.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  const newSelectors = [];
  for (const func of artifact.abi) {
    if (func.type === 'function' && func.name !== 'init') {
      const signature = `${func.name}(${func.inputs.map(input => input.type).join(',')})`;
      const selector = hre.ethers.id(signature).slice(0, 10);
      newSelectors.push(selector);
    }
  }
  console.log(`📋 New facet selectors: ${newSelectors.length} functions`);

  // Connect to Diamond
  const diamondCutFacet = await hre.ethers.getContractAt("DiamondCutFacet", addresses.QuizGameDiamond);
  
  // Prepare facet cut for replacement
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
  const facetCuts = [{
    facetAddress: newModeFacet.target,
    action: FacetCutAction.Replace,
    functionSelectors: newSelectors
  }];

  console.log("\n--- Executing Diamond Cut (Replace) ---");
  const tx = await diamondCutFacet.diamondCut(facetCuts, hre.ethers.ZeroAddress, "0x");
  console.log(`📤 Transaction sent: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed: Block ${receipt.blockNumber}`);
  console.log(`⛽ Gas used: ${receipt.gasUsed}`);

  // Update addresses file
  addresses.QuizGameModeFacet = newModeFacet.target;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  
  // Update frontend addresses
  const frontendAddressesPath = path.join(__dirname, '../../frontend/src/config/addresses.json');
  fs.writeFileSync(frontendAddressesPath, JSON.stringify(addresses, null, 2));

  // Copy updated ABI to frontend
  console.log("\n--- Copying Updated ABI to Frontend ---");
  const abiDir = path.join(__dirname, '../../frontend/src/abi');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  // Copy QuizGameModeFacet ABI
  const modeFacetArtifactPath = path.join(__dirname, '../artifacts/contracts/facets/QuizGameModeFacet.sol/QuizGameModeFacet.json');
  if (fs.existsSync(modeFacetArtifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(modeFacetArtifactPath, 'utf8'));
    const abiPath = path.join(abiDir, 'QuizGameModeFacet.json');
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`✅ Updated ABI: QuizGameModeFacet.json -> ${abiPath}`);
  } else {
    console.log(`⚠️ ABI file not found: ${modeFacetArtifactPath}`);
  }

  console.log("\n🎉 QuizGameModeFacet Upgrade Complete!");
  console.log("🚪 Daily limits removed - leaf-level doors only!");
  console.log("🌳 True concurrent multi-user gameplay enabled!");
  console.log("\n📋 Updated Addresses:");
  console.log(`🎮 QuizGameDiamond: ${addresses.QuizGameDiamond}`);
  console.log(`🔄 New QuizGameModeFacet: ${newModeFacet.target}`);
  console.log("\n🔗 BSC Testnet Explorer:");
  console.log(`https://testnet.bscscan.com/tx/${tx.hash}`);
}

// Helper function to get selectors
function getSelectors(contract) {
  console.log(`🔍 Contract interface:`, contract.interface);
  console.log(`🔍 Functions:`, contract.interface.functions);
  
  if (!contract.interface || !contract.interface.functions) {
    throw new Error('Contract interface or functions not available');
  }
  
  const signatures = Object.keys(contract.interface.functions);
  console.log(`🔍 Function signatures:`, signatures);
  
  const selectors = signatures.reduce((acc, val) => {
    if (val !== 'init(bytes)') {
      const func = contract.interface.getFunction(val);
      acc.push(func.selector);
    }
    return acc;
  }, []);
  return selectors;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
