const { ethers, upgrades } = require("hardhat"); // นำเข้า 'upgrades' จาก hardhat

async function main() {
  const [deployer] = await ethers.getSigners(); // ดึงบัญชีที่ใช้ในการ Deploy
  console.log("Deploying contracts with the account:", deployer.address);

  // --- 1. Deploy QuizCoin (Upgradeable ERC20) ---
  const QuizCoin = await ethers.getContractFactory("QuizCoin");
  // ใช้ upgrades.deployProxy เพื่อ Deploy Proxy และ Implementation contract แรก
  // initialize() ของ QuizCoin ไม่มี parameters
  const quizCoin = await upgrades.deployProxy(QuizCoin, [], {
    kind: "uups", // ระบุชนิดของ Proxy เป็น UUPS (มาตรฐานใหม่ที่แนะนำ)
  });
  await quizCoin.waitForDeployment(); // รอจนกว่าธุรกรรม Deploy จะเสร็จสมบูรณ์
  const quizCoinAddress = await quizCoin.getAddress(); // ได้ที่อยู่ของ Proxy Contract
  console.log("QuizCoin deployed to:", quizCoinAddress);

  // --- 2. Deploy PoolManager (Upgradeable) ---
  const PoolManager = await ethers.getContractFactory("PoolManager");
  // initialize() ของ PoolManager ต้องการ _quizCoinAddress และ _quizGameAddress
  // ณ จุดนี้ เรายังไม่มี address ที่แน่นอนของ QuizGame จึงใช้ deployer.address เป็น placeholder ชั่วคราว
  // เราจะตั้งค่าให้ถูกต้องอีกครั้งหลังจาก Deploy QuizGame แล้ว
  const poolManager = await upgrades.deployProxy(PoolManager, [quizCoinAddress, deployer.address], {
    kind: "uups",
  });
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log("PoolManager deployed to:", poolManagerAddress);

  // --- 3. Deploy QuizGame (Upgradeable) ---
  const QuizGame = await ethers.getContractFactory("QuizGame");
  // initialize() ของ QuizGame ต้องการ _quizCoinAddress, _developerFundAddress, _poolManagerAddress
  const quizGame = await upgrades.deployProxy(QuizGame, [
    quizCoinAddress,
    deployer.address, // ให้ developerFundAddress เป็น deployer ชั่วคราว (สามารถเปลี่ยนทีหลังได้)
    poolManagerAddress,
  ], {
    kind: "uups",
  });
  await quizGame.waitForDeployment();
  const quizGameAddress = await quizGame.getAddress();
  console.log("QuizGame deployed to:", quizGameAddress);


  // --- 4. ตั้งค่าบทบาทและ Address ที่ถูกต้องหลังจากการ Deploy ทั้งหมด ---
  console.log("\nSetting up roles and correct addresses...");

  // --- การตั้งค่าสำหรับ QuizCoin ---
  // มอบ MINTER_ROLE ให้กับ QuizGame ในสัญญา QuizCoin
  // เนื่องจาก QuizGame จะเป็นผู้ Mint เหรียญรางวัล QZC ให้ผู้เล่น
  const MINTER_ROLE_QZC = await quizCoin.MINTER_ROLE();
  console.log(`Granting MINTER_ROLE (${MINTER_ROLE_QZC}) to QuizGame (${quizGameAddress}) in QuizCoin contract...`);
  await quizCoin.grantRole(MINTER_ROLE_QZC, quizGameAddress);
  console.log("MINTER_ROLE granted to QuizGame.");

  // เพิกถอน MINTER_ROLE จาก deployer ในสัญญา QuizCoin
  // (ไม่จำเป็นต้องให้ deployer เป็นผู้ Mint อีกต่อไป เพราะ QuizGame จะทำหน้าที่นี้)
  console.log(`Revoking MINTER_ROLE (${MINTER_ROLE_QZC}) from deployer (${deployer.address}) in QuizCoin contract...`);
  await quizCoin.revokeRole(MINTER_ROLE_QZC, deployer.address);
  console.log("MINTER_ROLE revoked from deployer.");

  // --- การตั้งค่าสำหรับ PoolManager ---
  // ตั้งค่า QuizGame Address ที่ถูกต้องใน PoolManager
  // เราใช้ deployer.address เป็น _quizGameAddress ชั่วคราวตอน deploy PoolManager
  // ตอนนี้เราจะตั้งค่าเป็น quizGameAddress ที่ถูกต้อง
  console.log(`Setting i_quizGameAddress in PoolManager (${poolManagerAddress}) to QuizGame's address (${quizGameAddress})...`);
  await poolManager.setQuizGameAddress(quizGameAddress); // เรียก setter function ที่เราเพิ่มเข้าไป
  console.log("i_quizGameAddress in PoolManager set to QuizGame's address.");

  // มอบ POOL_MANAGER_ROLE ให้กับ QuizGame ในสัญญา PoolManager
  // เพื่อให้ QuizGame สามารถเรียก `withdrawForUser` ได้
  const POOL_MANAGER_ROLE_PM = await poolManager.POOL_MANAGER_ROLE();
  console.log(`Granting POOL_MANAGER_ROLE (${POOL_MANAGER_ROLE_PM}) to QuizGame (${quizGameAddress}) in PoolManager contract...`);
  await poolManager.grantRole(POOL_MANAGER_ROLE_PM, quizGameAddress);
  console.log("POOL_MANAGER_ROLE granted to QuizGame.");

  // เพิกถอน POOL_MANAGER_ROLE จาก deployer ในสัญญา PoolManager
  // (ไม่จำเป็นต้องให้ deployer มี Role นี้อีกต่อไป เพราะ QuizGame จะทำหน้าที่นี้)
  console.log(`Revoking POOL_MANAGER_ROLE (${POOL_MANAGER_ROLE_PM}) from deployer (${deployer.address}) in PoolManager contract...`);
  await poolManager.revokeRole(POOL_MANAGER_ROLE_PM, deployer.address);
  console.log("POOL_MANAGER_ROLE revoked from deployer.");

  console.log("\nDeployment and setup complete!");

  // *** (Optional) บันทึก Address สัญญาลงไฟล์เพื่อใช้ในภายหลัง ***
  // คุณสามารถบันทึก address สัญญาลงในไฟล์ (เช่น contracts.json)
  // เพื่อให้ frontend หรือ script อื่นๆ สามารถอ่านไปใช้ได้
  // const fs = require('fs');
  // const contractAddresses = {
  //   QuizCoin: quizCoinAddress,
  //   PoolManager: poolManagerAddress,
  //   QuizGame: quizGameAddress
  // };
  // fs.writeFileSync('./contracts.json', JSON.stringify(contractAddresses, null, 2));
  // console.log("Contract addresses saved to contracts.json");
}

// จัดการข้อผิดพลาดที่อาจเกิดขึ้นระหว่างการ Deploy
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});