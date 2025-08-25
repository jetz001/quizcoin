// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Set a gas limit for all deployment transactions to prevent out-of-gas errors
const deployGasLimit = 8000000;
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

/**
 * Helper function to get function selectors from a contract's interface.
 * @param {ethers.Contract} contract The deployed contract instance.
 * @returns {string[]} An array of function selectors (e.g., ["0x12345678"]).
 */
function getSelectors(contract) {
  const selectors = [];
  contract.interface.fragments.forEach(fragment => {
    if (fragment.type === 'function' && fragment.selector) {
      selectors.push(fragment.selector);
    }
  });
  return selectors;
}

async function deployDiamond() {
  // Get the deployer's account
  const [deployer] = await ethers.getSigners();
  console.log(`กำลัง deploy สัญญาด้วย account: ${deployer.address}`);

  // --- 1. Deploy all facets individually ---
  console.log("\n--- กำลัง deploy สัญญา Facet ทั้งหมด ---");
  const FacetFactories = {
    DiamondCutFacet: await ethers.getContractFactory("DiamondCutFacet"),
    DiamondLoupeFacet: await ethers.getContractFactory("DiamondLoupeFacet"),
    OwnershipFacet: await ethers.getContractFactory("OwnershipFacet"),
    QuizGameBaseFacet: await ethers.getContractFactory("QuizGameBaseFacet"),
    QuizGameModeFacet: await ethers.getContractFactory("QuizGameModeFacet"),
    QuizGameRewardFacet: await ethers.getContractFactory("QuizGameRewardFacet"),
    QuizParticipationFacet: await ethers.getContractFactory("QuizParticipationFacet"),
    QuizCreationFacet: await ethers.getContractFactory("QuizCreationFacet")
  };

  const facetCuts = [];
  const facetAddresses = {};
  const seenSelectors = new Set();
  const selectorMap = {}; // map selector => [facetNames]

  for (const name in FacetFactories) {
    const factory = FacetFactories[name];
    const contract = await factory.deploy({ gasLimit: deployGasLimit });
    await contract.deploymentTransaction().wait();
    const address = contract.target;
    console.log(`${name} deploy ไปที่: ${address}`);
    facetAddresses[name] = address;

    let selectors = getSelectors(contract);
    
    // Store all selectors for duplicate checking
    selectors.forEach(s => {
      selectorMap[s] = selectorMap[s] || [];
      selectorMap[s].push(name);
    });

    // Filter out selectors we've already seen to prevent duplicates in diamondCut()
    selectors = selectors.filter(s => !seenSelectors.has(s));

    if (selectors.length === 0) {
      console.log(`${name}: ไม่มี selector ใหม่ (ถูกข้าม)`);
      continue;
    }

    selectors.forEach(s => seenSelectors.add(s));

    facetCuts.push({
      facetAddress: address,
      action: FacetCutAction.Add,
      functionSelectors: selectors
    });
  }

  // Report any selectors that appeared in more than one facet
  let hasDup = false;
  for (const [sel, arr] of Object.entries(selectorMap)) {
    if (arr.length > 1) {
      hasDup = true;
      console.warn(`Duplicate selector ${sel} พบใน facets: ${arr.join(", ")}`);
    }
  }
  if (hasDup) {
    console.warn("มี selectors ที่ซ้ำกัน — โปรดตรวจสอบว่าเป็นสิ่งที่ตั้งใจไว้ (เช่น supportsInterface) หรือย้ายฟังก์ชันไป facet เดียวเท่านั้น");
  }

  // --- 2. Deploy QuizCoin and PoolManager ---
  console.log("\n--- กำลัง deploy QuizCoin และ PoolManager ---");
  const QuizCoinFactory = await ethers.getContractFactory("QuizCoin");
  const QuizCoinContract = await QuizCoinFactory.deploy({ gasLimit: deployGasLimit });
  await QuizCoinContract.deploymentTransaction().wait();
  const QuizCoinAddress = QuizCoinContract.target;
  console.log("QuizCoin deploy ไปที่:", QuizCoinAddress);

  const PoolManagerFactory = await ethers.getContractFactory("PoolManager");
  const PoolManagerContract = await PoolManagerFactory.deploy(QuizCoinAddress, { gasLimit: deployGasLimit });
  await PoolManagerContract.deploymentTransaction().wait();
  const PoolManagerAddress = PoolManagerContract.target;
  console.log("PoolManager deploy ไปที่:", PoolManagerAddress);

  // --- 3. Deploy the main QuizGameDiamond Proxy contract ---
  console.log("\n--- กำลัง deploy สัญญา QuizGameDiamond Proxy หลัก ---");
  // The Diamond constructor sets the initial owner and the DiamondCutFacet
  const DiamondFactory = await ethers.getContractFactory("Diamond");
  const DiamondContract = await DiamondFactory.deploy(
    deployer.address, // Set the deployer as the initial owner
    facetAddresses.DiamondCutFacet, // Provide the address of the DiamondCutFacet
    { gasLimit: deployGasLimit }
  );
  await DiamondContract.deploymentTransaction().wait();
  const QuizGameDiamondAddress = DiamondContract.target;
  console.log(`QuizGameDiamond Contract deploy ไปที่: ${QuizGameDiamondAddress}`);
  console.log("✅ Diamond Proxy deploy สำเร็จแล้ว");
  
  // --- 4. Add the remaining facets in a single transaction ---
  const diamondCutContract = await ethers.getContractAt("IDiamondCut", QuizGameDiamondAddress, deployer);

  // Filter out the DiamondCutFacet as it was added during the constructor call
  const remainingFacetCuts = facetCuts.filter(cut => cut.facetAddress !== facetAddresses.DiamondCutFacet);

  console.log("\n--- กำลังเรียก diamondCut() เพื่อเพิ่ม Facet ที่เหลือทั้งหมด ---");
  try {
    const tx = await diamondCutContract.diamondCut(
        remainingFacetCuts,
        ethers.ZeroAddress, // Do not call an initializer function during this step
        "0x", // No calldata for initialization
        { gasLimit: deployGasLimit }
    );
    console.log(`diamondCut() tx ถูกส่งแล้ว: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Facet ที่เหลือทั้งหมดถูกเพิ่มเข้าสู่ Diamond สำเร็จ!");
  } catch (error) {
    console.error("Deploy: เกิดข้อผิดพลาดขณะเรียก diamondCut():", error);
    throw error;
  }

  // --- 5. Post-deployment initialization (in separate transactions) ---
  console.log("\n--- กำลัง Initialize สัญญาและกำหนด Role เพิ่มเติม ---");
  
  // *** ขั้นตอนที่แก้ไข: เรียก initialize สองครั้งแยกกัน ***
  
  // ขั้นตอนที่ 5.1: เรียก init(owner) จาก OwnershipFacet เพื่อตั้งค่าเจ้าของ
  const ownershipFacetAsDiamond = await ethers.getContractAt("OwnershipFacet", QuizGameDiamondAddress, deployer);
  console.log("OwnershipFacet: กำลังเรียก init(deployer.address)...");
  try {
    const initOwnershipTx = await ownershipFacetAsDiamond.init(deployer.address, { gasLimit: deployGasLimit });
    await initOwnershipTx.wait();
    console.log("✅ init(deployer.address) ถูกเรียกและสำเร็จแล้ว!");
  } catch (error) {
    console.error("Deploy: เกิดข้อผิดพลาดขณะเรียก init() บน OwnershipFacet:", error);
    throw error;
  }

  // ขั้นตอนที่ 5.2: เรียก initializeQuizGame() จาก QuizGameBaseFacet เพื่อตั้งค่าเกม
  const quizGameBaseAsDiamond = await ethers.getContractAt("QuizGameBaseFacet", QuizGameDiamondAddress, deployer);
  console.log("QuizGameBaseFacet: กำลังเรียก initializeQuizGame()...");
  try {
    const initGameTx = await quizGameBaseAsDiamond.initializeQuizGame({ gasLimit: deployGasLimit });
    await initGameTx.wait();
    console.log("✅ initializeQuizGame() ถูกเรียกและสำเร็จแล้ว!");
  } catch (error) {
    console.error("Deploy: เกิดข้อผิดพลาดขณะเรียก initializeQuizGame():", error);
    throw error;
  }
  
  // Set other required addresses
  try {
    await quizGameBaseAsDiamond.setPoolManagerAddress(PoolManagerAddress, { gasLimit: deployGasLimit });
    console.log("ตั้งค่า PoolManager address ใน AppStorage แล้ว");
    await quizGameBaseAsDiamond.setQuizCoinAddress(QuizCoinAddress, { gasLimit: deployGasLimit });
    console.log("ตั้งค่า QuizCoin address ใน AppStorage แล้ว");
  } catch (error) {
    console.error("Deploy: เกิดข้อผิดพลาดขณะตั้งค่า PoolManager/QuizCoin addresses:", error);
    throw error;
  }

  // Grant MINTER_ROLE to PoolManager
  try {
    const QuizCoinContractWithSigner = QuizCoinContract.connect(deployer);
    const MINTER_ROLE = await QuizCoinContractWithSigner.MINTER_ROLE();
    await QuizCoinContractWithSigner.grantRole(MINTER_ROLE, PoolManagerAddress, { gasLimit: deployGasLimit });
    console.log("มอบ MINTER_ROLE ให้กับ PoolManager บน QuizCoin แล้ว");
  } catch (error) {
    console.error("Deploy: เกิดข้อผิดพลาดขณะมอบ MINTER_ROLE:", error);
    throw error;
  }

  // Set QuizGameDiamond address in PoolManager
  try {
    const PoolManagerContractWithSigner = PoolManagerContract.connect(deployer);
    await PoolManagerContractWithSigner.setQuizGameDiamondAddress(QuizGameDiamondAddress, { gasLimit: deployGasLimit });
    console.log("ตั้งค่า QuizGameDiamond เป็นสัญญาเกมใน PoolManager แล้ว");
  } catch (error) {
    console.error("Deploy: เกิดข้อผิดพลาดขณะตั้งค่า QuizGameDiamond ใน PoolManager:", error);
    throw error;
  }

  // Final owner verification
  const ownerFacet = await ethers.getContractAt("OwnershipFacet", QuizGameDiamondAddress);
  const diamondOwner = await ownerFacet.owner();

  console.log(`\nเจ้าของ Diamond คือ: ${diamondOwner}`);
  console.log(`ที่อยู่ของผู้ deploy คือ: ${deployer.address}`);

  if (diamondOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`❌ เจ้าของไม่ตรงกัน: คาดหวัง ${deployer.address}, แต่ได้ ${diamondOwner}`);
  } else {
    console.log("✅ เจ้าของ Diamond ตรงกับที่อยู่ของผู้ deploy แล้ว การ deploy สำเร็จ!");
  }

  // --- 6. Logic for copying ABIs to the frontend and saving contract addresses ---
  const frontendAbiDir = path.join(__dirname, '..', '..', 'frontend', 'src', 'abi');
  const backendArtifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');

  if (!fs.existsSync(frontendAbiDir)) {
    fs.mkdirSync(frontendAbiDir, { recursive: true });
  }

  const abisToCopy = [
    { src: path.join(backendArtifactsDir, 'facets', 'DiamondCutFacet.sol', 'DiamondCutFacet.json'), dest: 'DiamondCutFacet.json' },
    { src: path.join(backendArtifactsDir, 'facets', 'DiamondLoupeFacet.sol', 'DiamondLoupeFacet.json'), dest: 'DiamondLoupeFacet.json' },
    { src: path.join(backendArtifactsDir, 'facets', 'OwnershipFacet.sol', 'OwnershipFacet.json'), dest: 'OwnershipFacet.json' },
    { src: path.join(backendArtifactsDir, 'facets', 'QuizGameBaseFacet.sol', 'QuizGameBaseFacet.json'), dest: 'QuizGameBaseFacet.json' },
    { src: path.join(backendArtifactsDir, 'facets', 'QuizGameModeFacet.sol', 'QuizGameModeFacet.json'), dest: 'QuizGameModeFacet.json' },
    { src: path.join(backendArtifactsDir, 'facets', 'QuizGameRewardFacet.sol', 'QuizGameRewardFacet.json'), dest: 'QuizGameRewardFacet.json' },
    { src: path.join(backendArtifactsDir, 'facets', 'QuizParticipationFacet.sol', 'QuizParticipationFacet.json'), dest: 'QuizParticipationFacet.json' },
    { src: path.join(backendArtifactsDir, 'facets', 'QuizCreationFacet.sol', 'QuizCreationFacet.json'), dest: 'QuizCreationFacet.json' },
    { src: path.join(backendArtifactsDir, 'QuizCoin.sol', 'QuizCoin.json'), dest: 'QuizCoin.json' },
    { src: path.join(backendArtifactsDir, 'QuizGameDiamond.sol', 'QuizGameDiamond.json'), dest: 'QuizGameDiamond.json' },
  ];

  for (const abiInfo of abisToCopy) {
    const srcPath = abiInfo.src;
    const destPath = path.join(frontendAbiDir, abiInfo.dest);
    try {
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`คัดลอก ABI: ${abiInfo.dest} ไปที่ ${frontendAbiDir}`);
      } else {
        console.error(`ไฟล์ ABI ไม่พบ: ${srcPath}`);
      }
    } catch (error) {
      console.error(`เกิดข้อผิดพลาดในการคัดลอก ${abiInfo.dest}:`, error.message);
    }
  }

  const addresses = {
    QuizGameDiamond: QuizGameDiamondAddress,
    QuizCoin: QuizCoinAddress,
    PoolManager: PoolManagerAddress,
    ...facetAddresses
  };
  const addressesPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'config', 'addresses.json');
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`ที่อยู่สัญญาถูกบันทึกไว้ที่ ${addressesPath}`);
}

deployDiamond()
  .then(() => {
    console.log("\nขั้นตอนการ Deploy สำเร็จสมบูรณ์");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nการ Deploy ล้มเหลวพร้อมข้อผิดพลาด:");
    console.error(error);
    process.exit(1);
  });
