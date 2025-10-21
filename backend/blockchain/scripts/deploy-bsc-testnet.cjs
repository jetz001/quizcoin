const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Deploying QuizCoin to BSC Testnet...");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`กำลัง deploy สัญญาด้วย account: ${deployer.address}`);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(balance)} BNB`);
  
  if (balance < hre.ethers.parseEther("0.1")) {
    console.log("⚠️  Warning: Low BNB balance. You may need more BNB for gas fees.");
    console.log("🔗 Get testnet BNB from: https://testnet.binance.org/faucet-smart");
  }

  console.log("\n--- กำลัง deploy สัญญา Facet ทั้งหมด ---");

  // Deploy all facets
  const DiamondCutFacet = await hre.ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();
  console.log(`DiamondCutFacet deploy ไปที่: ${diamondCutFacet.target}`);

  const DiamondLoupeFacet = await hre.ethers.getContractFactory("DiamondLoupeFacet");
  const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
  await diamondLoupeFacet.waitForDeployment();
  console.log(`DiamondLoupeFacet deploy ไปที่: ${diamondLoupeFacet.target}`);

  const OwnershipFacet = await hre.ethers.getContractFactory("OwnershipFacet");
  const ownershipFacet = await OwnershipFacet.deploy();
  await ownershipFacet.waitForDeployment();
  console.log(`OwnershipFacet deploy ไปที่: ${ownershipFacet.target}`);

  const QuizGameBaseFacet = await hre.ethers.getContractFactory("QuizGameBaseFacet");
  const quizGameBaseFacet = await QuizGameBaseFacet.deploy();
  await quizGameBaseFacet.waitForDeployment();
  console.log(`QuizGameBaseFacet deploy ไปที่: ${quizGameBaseFacet.target}`);

  const QuizGameModeFacet = await hre.ethers.getContractFactory("QuizGameModeFacet");
  const quizGameModeFacet = await QuizGameModeFacet.deploy();
  await quizGameModeFacet.waitForDeployment();
  console.log(`QuizGameModeFacet deploy ไปที่: ${quizGameModeFacet.target}`);

  const QuizGameRewardFacet = await hre.ethers.getContractFactory("QuizGameRewardFacet");
  const quizGameRewardFacet = await QuizGameRewardFacet.deploy();
  await quizGameRewardFacet.waitForDeployment();
  console.log(`QuizGameRewardFacet deploy ไปที่: ${quizGameRewardFacet.target}`);

  const QuizParticipationFacet = await hre.ethers.getContractFactory("QuizParticipationFacet");
  const quizParticipationFacet = await QuizParticipationFacet.deploy();
  await quizParticipationFacet.waitForDeployment();
  console.log(`QuizParticipationFacet deploy ไปที่: ${quizParticipationFacet.target}`);

  const QuizCreationFacet = await hre.ethers.getContractFactory("QuizCreationFacet");
  const quizCreationFacet = await QuizCreationFacet.deploy();
  await quizCreationFacet.waitForDeployment();
  console.log(`QuizCreationFacet deploy ไปที่: ${quizCreationFacet.target}`);

  const MerkleFacet = await hre.ethers.getContractFactory("MerkleFacet");
  const merkleFacet = await MerkleFacet.deploy();
  await merkleFacet.waitForDeployment();
  console.log(`MerkleFacet deploy ไปที่: ${merkleFacet.target}`);

  // Check for duplicate selectors
  const facets = [
    { name: "DiamondCutFacet", contract: diamondCutFacet },
    { name: "DiamondLoupeFacet", contract: diamondLoupeFacet },
    { name: "OwnershipFacet", contract: ownershipFacet },
    { name: "QuizGameBaseFacet", contract: quizGameBaseFacet },
    { name: "QuizGameModeFacet", contract: quizGameModeFacet },
    { name: "QuizGameRewardFacet", contract: quizGameRewardFacet },
    { name: "QuizParticipationFacet", contract: quizParticipationFacet },
    { name: "QuizCreationFacet", contract: quizCreationFacet },
    { name: "MerkleFacet", contract: merkleFacet }
  ];

  console.log("\n--- กำลัง deploy QuizCoin และ PoolManager ---");

  // Deploy QuizCoin
  const QuizCoin = await hre.ethers.getContractFactory("QuizCoin");
  const quizCoin = await QuizCoin.deploy();
  await quizCoin.waitForDeployment();
  console.log(`QuizCoin deploy ไปที่: ${quizCoin.target}`);

  // Deploy PoolManager
  const PoolManager = await hre.ethers.getContractFactory("PoolManager");
  const poolManager = await PoolManager.deploy();
  await poolManager.waitForDeployment();
  console.log(`PoolManager deploy ไปที่: ${poolManager.target}`);

  console.log("\n--- กำลัง deploy สัญญา QuizGameDiamond Proxy หลัก ---");

  // Deploy Diamond
  const Diamond = await hre.ethers.getContractFactory("Diamond");
  const diamond = await Diamond.deploy(deployer.address, diamondCutFacet.target);
  await diamond.waitForDeployment();
  console.log(`QuizGameDiamond Contract deploy ไปที่: ${diamond.target}`);
  console.log("✅ Diamond Proxy deploy สำเร็จแล้ว");

  // Prepare facet cuts for diamondCut
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
  const facetCuts = [];
  
  // Add other facets (skip DiamondCutFacet as it's already added in constructor)
  const facetsToAdd = [
    { contract: diamondLoupeFacet, name: "DiamondLoupeFacet" },
    { contract: ownershipFacet, name: "OwnershipFacet" },
    { contract: quizGameBaseFacet, name: "QuizGameBaseFacet" },
    { contract: quizGameModeFacet, name: "QuizGameModeFacet" },
    { contract: quizGameRewardFacet, name: "QuizGameRewardFacet" },
    { contract: quizParticipationFacet, name: "QuizParticipationFacet" },
    { contract: quizCreationFacet, name: "QuizCreationFacet" },
    { contract: merkleFacet, name: "MerkleFacet" }
  ];

  for (const facet of facetsToAdd) {
    const selectors = await getSelectors(facet.contract);
    facetCuts.push({
      facetAddress: facet.contract.target,
      action: FacetCutAction.Add,
      functionSelectors: selectors
    });
  }

  console.log("\n--- กำลังเรียก diamondCut() เพื่อเพิ่ม Facet ที่เหลือทั้งหมด ---");
  
  const diamondCutFacetContract = await hre.ethers.getContractAt("DiamondCutFacet", diamond.target);
  const tx = await diamondCutFacetContract.diamondCut(facetCuts, hre.ethers.ZeroAddress, "0x");
  await tx.wait();
  console.log(`diamondCut() tx ถูกส่งแล้ว: ${tx.hash}`);
  console.log("✅ Facet ที่เหลือทั้งหมดถูกเพิ่มเข้าสู่ Diamond สำเร็จ!");

  console.log("\n--- กำลัง Initialize สัญญาและกำหนด Role เพิ่มเติม ---");

  // Initialize contracts
  const ownershipFacetContract = await hre.ethers.getContractAt("OwnershipFacet", diamond.target);
  console.log("OwnershipFacet: กำลังเรียก init(deployer.address)...");
  const initTx = await ownershipFacetContract.init(deployer.address);
  await initTx.wait();
  console.log("✅ init(deployer.address) ถูกเรียกและสำเร็จแล้ว!");

  const quizGameBaseFacetContract = await hre.ethers.getContractAt("QuizGameBaseFacet", diamond.target);
  console.log("QuizGameBaseFacet: กำลังเรียก initializeQuizGame()...");
  const initQuizTx = await quizGameBaseFacetContract.initializeQuizGame();
  await initQuizTx.wait();
  console.log("✅ initializeQuizGame() ถูกเรียกและสำเร็จแล้ว!");

  // Set PoolManager address in AppStorage
  const setPoolManagerTx = await quizGameBaseFacetContract.setPoolManagerAddress(poolManager.target);
  await setPoolManagerTx.wait();
  console.log("ตั้งค่า PoolManager address ใน AppStorage แล้ว");

  // Set QuizCoin address in AppStorage
  const setQuizCoinTx = await quizGameBaseFacetContract.setQuizCoinAddress(quizCoin.target);
  await setQuizCoinTx.wait();
  console.log("ตั้งค่า QuizCoin address ใน AppStorage แล้ว");

  // Grant MINTER_ROLE to PoolManager on QuizCoin
  const MINTER_ROLE = await quizCoin.MINTER_ROLE();
  const grantRoleTx = await quizCoin.grantRole(MINTER_ROLE, poolManager.target);
  await grantRoleTx.wait();
  console.log("มอบ MINTER_ROLE ให้กับ PoolManager บน QuizCoin แล้ว");

  // Set QuizGameDiamond as game contract in PoolManager
  const setGameContractTx = await poolManager.setGameContract(diamond.target);
  await setGameContractTx.wait();
  console.log("ตั้งค่า QuizGameDiamond เป็นสัญญาเกมใน PoolManager แล้ว");

  // Verify ownership
  const owner = await ownershipFacetContract.owner();
  console.log(`\nเจ้าของ Diamond คือ: ${owner}`);
  console.log(`ที่อยู่ของผู้ deploy คือ: ${deployer.address}`);
  
  if (owner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("✅ เจ้าของ Diamond ตรงกับที่อยู่ของผู้ deploy แล้ว การ deploy สำเร็จ!");
  } else {
    console.log("❌ เจ้าของ Diamond ไม่ตรงกับที่อยู่ของผู้ deploy!");
  }

  // Save contract addresses
  const addresses = {
    QuizGameDiamond: diamond.target,
    QuizCoin: quizCoin.target,
    PoolManager: poolManager.target,
    DiamondCutFacet: diamondCutFacet.target,
    DiamondLoupeFacet: diamondLoupeFacet.target,
    OwnershipFacet: ownershipFacet.target,
    QuizGameBaseFacet: quizGameBaseFacet.target,
    QuizGameModeFacet: quizGameModeFacet.target,
    QuizGameRewardFacet: quizGameRewardFacet.target,
    QuizParticipationFacet: quizParticipationFacet.target,
    QuizCreationFacet: quizCreationFacet.target,
    MerkleFacet: merkleFacet.target
  };

  // Copy ABIs to frontend
  console.log("\n--- กำลังคัดลอก ABI ไปยัง Frontend ---");
  const abiDir = path.join(__dirname, '../../frontend/src/abi');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const contractNames = [
    'DiamondCutFacet', 'DiamondLoupeFacet', 'OwnershipFacet',
    'QuizGameBaseFacet', 'QuizGameModeFacet', 'QuizGameRewardFacet',
    'QuizParticipationFacet', 'QuizCreationFacet', 'MerkleFacet',
    'Diamond', 'QuizCoin', 'QuizGameDiamond'
  ];

  for (const contractName of contractNames) {
    const artifactPath = path.join(__dirname, `../artifacts/contracts/${getContractPath(contractName)}.sol/${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      const abiPath = path.join(abiDir, `${contractName}.json`);
      fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
      console.log(`คัดลอก ABI: ${contractName}.json ไปที่ ${abiPath}`);
    }
  }

  // Update addresses files
  const frontendAddressesPath = path.join(__dirname, '../../frontend/src/config/addresses.json');
  fs.writeFileSync(frontendAddressesPath, JSON.stringify(addresses, null, 2));
  console.log(`✅ Frontend addresses updated: ${frontendAddressesPath}`);

  const backendAddressesPath = path.join(__dirname, '../contractAddresses.json');
  fs.writeFileSync(backendAddressesPath, JSON.stringify(addresses, null, 2));
  console.log(`✅ Backend addresses updated: ${backendAddressesPath}`);

  // Update .env file
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    const contractAddressRegex = /^CONTRACT_ADDRESS=.*$/m;
    const newContractAddress = `CONTRACT_ADDRESS=${diamond.target}`;
    
    if (contractAddressRegex.test(envContent)) {
      envContent = envContent.replace(contractAddressRegex, newContractAddress);
    } else {
      envContent += `\n${newContractAddress}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env with new CONTRACT_ADDRESS');
  }

  console.log("\n🎉 BSC Testnet Deployment สำเร็จสมบูรณ์!");
  console.log("\n📋 Contract Addresses:");
  console.log(`🎮 QuizGameDiamond: ${diamond.target}`);
  console.log(`🪙 QuizCoin: ${quizCoin.target}`);
  console.log(`🏊 PoolManager: ${poolManager.target}`);
  console.log("\n🔗 Add QuizCoin to MetaMask:");
  console.log(`Token Address: ${quizCoin.target}`);
  console.log(`Symbol: QZC`);
  console.log(`Decimals: 18`);
  console.log("\n🌐 BSC Testnet Explorer:");
  console.log(`https://testnet.bscscan.com/address/${diamond.target}`);
}

// Helper functions
async function getSelectors(contract) {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc, val) => {
    if (val !== 'init(bytes)') {
      acc.push(contract.interface.getFunction(val).selector);
    }
    return acc;
  }, []);
  return selectors;
}

function getContractPath(contractName) {
  const pathMap = {
    'DiamondCutFacet': 'facets/DiamondCutFacet',
    'DiamondLoupeFacet': 'facets/DiamondLoupeFacet',
    'OwnershipFacet': 'facets/OwnershipFacet',
    'QuizGameBaseFacet': 'facets/QuizGameBaseFacet',
    'QuizGameModeFacet': 'facets/QuizGameModeFacet',
    'QuizGameRewardFacet': 'facets/QuizGameRewardFacet',
    'QuizParticipationFacet': 'facets/QuizParticipationFacet',
    'QuizCreationFacet': 'facets/QuizCreationFacet',
    'MerkleFacet': 'facets/MerkleFacet',
    'Diamond': 'Diamond',
    'QuizCoin': 'QuizCoin',
    'QuizGameDiamond': 'Diamond'
  };
  return pathMap[contractName] || contractName;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
