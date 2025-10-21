const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

// USAGE: node scripts/upgrade-facet-template.cjs <FacetName>
// Example: node scripts/upgrade-facet-template.cjs QuizGameModeFacet

async function main() {
  const facetName = process.argv[2];
  if (!facetName) {
    console.error("❌ Please provide facet name as argument");
    console.error("Usage: node scripts/upgrade-facet-template.cjs <FacetName>");
    console.error("Example: node scripts/upgrade-facet-template.cjs QuizGameModeFacet");
    process.exit(1);
  }

  console.log(`🔄 Upgrading ${facetName} on BSC Testnet...`);
  
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

  // Deploy new facet
  console.log(`\n--- Deploying New ${facetName} ---`);
  const FacetFactory = await hre.ethers.getContractFactory(facetName);
  const newFacet = await FacetFactory.deploy();
  await newFacet.waitForDeployment();
  console.log(`✅ New ${facetName} deployed: ${newFacet.target}`);

  // Get selectors for the new facet - use ABI directly
  const artifactPath = path.join(__dirname, `../artifacts/contracts/facets/${facetName}.sol/${facetName}.json`);
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
    facetAddress: newFacet.target,
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
  addresses[facetName] = newFacet.target;
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

  // Copy facet ABI
  if (fs.existsSync(artifactPath)) {
    const abiPath = path.join(abiDir, `${facetName}.json`);
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`✅ Updated ABI: ${facetName}.json -> ${abiPath}`);
  } else {
    console.log(`⚠️ ABI file not found: ${artifactPath}`);
  }

  console.log(`\n🎉 ${facetName} Upgrade Complete!`);
  console.log("\n📋 Updated Addresses:");
  console.log(`🎮 QuizGameDiamond: ${addresses.QuizGameDiamond}`);
  console.log(`🔄 New ${facetName}: ${newFacet.target}`);
  console.log("\n🔗 BSC Testnet Explorer:");
  console.log(`https://testnet.bscscan.com/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
