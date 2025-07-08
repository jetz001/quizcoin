// scripts/deploy_upgradeable.js
const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // --- 1. Deploy QuizCoin ---
    console.log("\n--- Deploying QuizCoin ---");
    // ใช้ชื่อสัญญาตามที่ประกาศใน contracts/QuizCoin.sol คือ "QuizCoin"
    const QuizCoin = await ethers.getContractFactory("QuizCoin");
    const quizCoin = await upgrades.deployProxy(QuizCoin, [deployer.address], { // initialize(address _defaultAdmin)
        initializer: "initialize",
        kind: "uups", // QuizCoin ของคุณยังคงเป็น UUPSUpgradeable
    });
    await quizCoin.waitForDeployment();
    const quizCoinAddress = await quizCoin.getAddress();
    console.log("QuizCoin deployed to:", quizCoinAddress);

    // --- 2. Deploy PoolManager ---
    console.log("\n--- Deploying PoolManager ---");
    // ใช้ชื่อสัญญาตามที่ประกาศใน contracts/PoolManager.sol คือ "PoolManager"
    const PoolManager = await ethers.getContractFactory("PoolManager");
    const poolManager = await upgrades.deployProxy(
        PoolManager,
        [
            quizCoinAddress,    // _quizCoinAddress
            deployer.address,   // _initialOwner (deployer ได้ POOL_MANAGER_ROLE และ Ownable)
            deployer.address    // _defaultAdmin
        ],
        {
            initializer: "initialize",
            kind: "uups", // PoolManager ของคุณยังคงเป็น UUPSUpgradeable
        }
    );
    await poolManager.waitForDeployment();
    const poolManagerAddress = await poolManager.getAddress();
    console.log("PoolManager deployed to:", poolManagerAddress);

    // --- 3. Deploy QuizGame ---
    console.log("\n--- Deploying QuizGame ---");
    // ใช้ชื่อสัญญาตามที่ประกาศใน contracts/QuizGame.sol คือ "QuizGame"
    const QuizGame = await ethers.getContractFactory("QuizGame"); // <-- ใช้ชื่อ "QuizGame"
    const quizGame = await upgrades.deployProxy(
        QuizGame,
        [
            quizCoinAddress,    // _quizCoinAddress
            poolManagerAddress, // _poolManagerAddress (ตอนนี้เป็น address payable ใน QuizGame.sol)
            deployer.address    // _defaultAdmin
        ],
        {
            initializer: "initialize",
            // ไม่ต้องระบุ 'kind' สำหรับ QuizGame เพราะเราลบ UUPSUpgradeable ออกจากสัญญาแล้ว
            // Hardhat จะใช้ Transparent Proxy เป็นค่าเริ่มต้นถ้าไม่ระบุ 'kind'
        }
    );
    await quizGame.waitForDeployment();
    const quizGameAddress = await quizGame.getAddress();
    console.log("QuizGame deployed to:", quizGameAddress);

    // --- 4. Setting up roles and correct addresses ---
    console.log("\n--- Setting up roles and correct addresses ---");

    // QuizCoin: Grant MINTER_ROLE to QuizGame
    const MINTER_ROLE_QUIZCOIN = await quizCoin.MINTER_ROLE();
    console.log(`Granting MINTER_ROLE (${MINTER_ROLE_QUIZCOIN}) to QuizGame (${quizGameAddress}) in QuizCoin contract...`);
    // เนื่องจาก deployer มี DEFAULT_ADMIN_ROLE ใน QuizCoin, สามารถ grant Role ได้
    const txGrantMinter = await quizCoin.grantRole(MINTER_ROLE_QUIZCOIN, quizGameAddress);
    await txGrantMinter.wait();
    console.log("MINTER_ROLE granted to QuizGame.");

    // Mint initial supply directly to deployer (who still has MINTER_ROLE here from initialize)
    const initialTestSupply = ethers.parseEther("2000"); // 2000 QZC for testing
    console.log(`Minting ${ethers.formatEther(initialTestSupply)} QZC to deployer (${deployer.address}) for initial setup...`);
    // deployer มี MINTER_ROLE ตอน initialize
    const txMintDeployer = await quizCoin.mint(deployer.address, initialTestSupply);
    await txMintDeployer.wait();
    console.log("Initial QZC minted to deployer.");

    // Revoke MINTER_ROLE from deployer (after initial minting)
    console.log(`Revoking MINTER_ROLE (${MINTER_ROLE_QUIZCOIN}) from deployer (${deployer.address}) in QuizCoin contract...`);
    // deployer มี DEFAULT_ADMIN_ROLE ซึ่งสามารถ revoke Role ได้
    const txRevokeMinter = await quizCoin.revokeRole(MINTER_ROLE_QUIZCOIN, deployer.address);
    await txRevokeMinter.wait();
    console.log("MINTER_ROLE revoked from deployer.");

    // Transfer some QZC to PoolManager for initial testing (e.g., purchasing hints)
    const initialPoolSupply = ethers.parseEther("1000"); // 1000 QZC
    console.log(`Transferring ${ethers.formatEther(initialPoolSupply)} QZC to PoolManager (${poolManagerAddress}) for initial supply...`);
    // Deployer needs to approve PoolManager to spend tokens from deployer
    const txApprove = await quizCoin.connect(deployer).approve(poolManagerAddress, initialPoolSupply);
    await txApprove.wait();
    // Then, deployer deposits into PoolManager
    const txDeposit = await poolManager.connect(deployer).deposit(initialPoolSupply);
    await txDeposit.wait();
    console.log("Initial QZC transferred to PoolManager.");

    // PoolManager: Set i_quizGameAddress in PoolManager to QuizGame's address
    console.log(`Setting i_quizGameAddress in PoolManager (${poolManagerAddress}) to QuizGame's address (${quizGameAddress})...`);
    // PoolManager ใช้ OwnableUpgradeable ดังนั้น Owner (deployer) สามารถเรียก setQuizGameAddress ได้
    const txSetQuizGame = await poolManager.setQuizGameAddress(quizGameAddress);
    await txSetQuizGame.wait();
    console.log("i_quizGameAddress in PoolManager set to QuizGame's address.");

    // PoolManager: Grant POOL_MANAGER_ROLE to QuizGame and revoke from deployer
    const POOL_MANAGER_ROLE_POOLMANAGER = await poolManager.POOL_MANAGER_ROLE();
    console.log(`Granting POOL_MANAGER_ROLE (${POOL_MANAGER_ROLE_POOLMANAGER}) to QuizGame (${quizGameAddress}) in PoolManager contract...`);
    // deployer มี DEFAULT_ADMIN_ROLE ใน PoolManager ซึ่งสามารถ grant Role ได้
    const txGrantPoolManager = await poolManager.grantRole(POOL_MANAGER_ROLE_POOLMANAGER, quizGameAddress);
    await txGrantPoolManager.wait();
    console.log("POOL_MANAGER_ROLE granted to QuizGame.");

    console.log(`Revoking POOL_MANAGER_ROLE (${POOL_MANAGER_ROLE_POOLMANAGER}) from deployer (${deployer.address}) in PoolManager contract...`);
    // deployer มี DEFAULT_ADMIN_ROLE ใน PoolManager ซึ่งสามารถ revoke Role ได้
    const txRevokePoolManager = await poolManager.revokeRole(POOL_MANAGER_ROLE_POOLMANAGER, deployer.address);
    await txRevokePoolManager.wait();
    console.log("POOL_MANAGER_ROLE revoked from deployer.");

    console.log("\nDeployment and setup complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});