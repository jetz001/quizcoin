// scripts/deploy.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Deployment script started!");

    const [deployer, player1, player2] = await ethers.getSigners();
    console.log(`Deploying contracts with the account: ${deployer.address}`);
    console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);

    // --- 1. Deploy QuizCoin (Upgradeable) ---
    console.log("\nDeploying QuizCoin (Upgradeable Proxy)...");
    const QuizCoin = await ethers.getContractFactory("QuizCoin");
    const quizCoin = await upgrades.deployProxy(QuizCoin, [deployer.address], {
        initializer: "initialize",
        kind: "uups",
    });
    await quizCoin.waitForDeployment();
    const quizCoinAddress = quizCoin.target;
    console.log(`QuizCoin deployed to: ${quizCoinAddress}`);

    // --- 2. Deploy QuizGame (Upgradeable) ---
    console.log("\nDeploying QuizGame (Upgradeable Proxy)...");
    const QuizGame = await ethers.getContractFactory("QuizGame");
    const currentBlock = await ethers.provider.getBlock("latest");
    const gameStartTimestamp = BigInt(currentBlock.timestamp);

    const quizGame = await upgrades.deployProxy(QuizGame, [
        quizCoinAddress,
        ethers.ZeroAddress, // Placeholder: PoolManager address จะถูกตั้งค่าทีหลัง
        deployer.address,
        gameStartTimestamp
    ], {
        initializer: "initialize",
        kind: "uups",
    });
    await quizGame.waitForDeployment();
    const quizGameAddress = quizGame.target;
    console.log(`QuizGame deployed to: ${quizGameAddress}`);

    // --- 3. Deploy PoolManager (Upgradeable) ---
    console.log("\nDeploying PoolManager (Upgradeable Proxy)...");
    const PoolManager = await ethers.getContractFactory("PoolManager");
    const poolManager = await upgrades.deployProxy(PoolManager, [
        quizCoinAddress,
        deployer.address,
        quizGameAddress
    ], {
        initializer: "initialize",
        kind: "uups",
    });
    await poolManager.waitForDeployment();
    const poolManagerAddress = poolManager.target;
    console.log(`PoolManager deployed to: ${poolManagerAddress}`);

    // --- 4. ตั้งค่า Roles และการเชื่อมโยงที่เหลือ ---
    console.log("\n--- Setting up contract relationships and roles ---");

    // 4.1. ตั้งค่า PoolManager address ใน QuizGame (แก้ไข Circular Dependency)
    console.log(`Setting PoolManager address (${poolManagerAddress}) in QuizGame...`);
    const setPoolManagerTx = await quizGame.connect(deployer).setPoolManagerAddress(poolManagerAddress);
    await setPoolManagerTx.wait();
    console.log("PoolManager address set in QuizGame successfully.");

    // 4.2. Grant MINTER_ROLE ให้กับ QuizGame ใน QuizCoin
    console.log("Granting MINTER_ROLE to QuizGame in QuizCoin...");
    const MINTER_ROLE_BYTES = await quizCoin.MINTER_ROLE();
    const grantMinterTx = await quizCoin.connect(deployer).grantRole(MINTER_ROLE_BYTES, quizGameAddress);
    await grantMinterTx.wait();
    console.log("MINTER_ROLE granted to QuizGame in QuizCoin successfully.");

    // 4.3. Grant BURNER_ROLE ให้กับ QuizGame ใน QuizCoin
    console.log("Granting BURNER_ROLE to QuizGame in QuizCoin...");
    const BURNER_ROLE_BYTES = await quizCoin.BURNER_ROLE();
    const grantBurnerTx = await quizCoin.connect(deployer).grantRole(BURNER_ROLE_BYTES, quizGameAddress);
    await grantBurnerTx.wait();
    console.log("BURNER_ROLE granted to QuizGame in QuizCoin successfully.");

    // 4.4. Grant GAME_ADMIN_ROLE_IN_POOL_MANAGER ให้กับ QuizGame ใน PoolManager
    console.log("Granting GAME_ADMIN_ROLE_IN_POOL_MANAGER to QuizGame in PoolManager...");
    const GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES = await poolManager.GAME_ADMIN_ROLE_IN_POOL_MANAGER(); // <--- ตอนนี้ PoolManager มีแล้ว
    const grantGameAdminToPoolManagerTx = await poolManager.connect(deployer).grantRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES, quizGameAddress);
    await grantGameAdminToPoolManagerTx.wait();
    console.log("GAME_ADMIN_ROLE_IN_POOL_MANAGER granted to QuizGame in PoolManager successfully.");

    // 4.5. ตั้งค่า Developer Fund Address ใน PoolManager
    console.log(`Setting Developer Fund Address (${deployer.address}) in PoolManager...`);
    const setPoolDevFundTx = await poolManager.connect(deployer).setDeveloperFundAddress(deployer.address);
    await setPoolDevFundTx.wait();
    console.log("Developer Fund Address set in PoolManager successfully.");

    // 4.6. Grant REWARD_DISTRIBUTOR_ROLE ให้กับบัญชีที่ต้องการ (เช่น player1) บน QuizGame
    console.log("\nGranting REWARD_DISTRIBUTOR_ROLE to player1 on QuizGame...");
    const REWARD_DISTRIBUTOR_ROLE_QUIZGAME = await quizGame.REWARD_DISTRIBUTOR_ROLE();
    const txGrantRewardRole = await quizGame.connect(deployer).grantRole(REWARD_DISTRIBUTOR_ROLE_QUIZGAME, player1.address);
    await txGrantRewardRole.wait();
    console.log(`REWARD_DISTRIBUTOR_ROLE granted to player1 (${player1.address}) on QuizGame.`);


    console.log("\n--- Deployment and Setup Complete! ---");
    console.log(`QuizCoin Proxy Address:      ${quizCoinAddress}`);
    console.log(`QuizGame Proxy Address:      ${quizGameAddress}`);
    console.log(`PoolManager Proxy Address: ${poolManagerAddress}`);
    console.log(`Reward Distributor Account: ${player1.address}`);
    console.log("-----------------------------------");

    // --- Save contract addresses to a file ---
    const addresses = {
        QuizCoin: quizCoinAddress,
        QuizGame: quizGameAddress,
        PoolManager: poolManagerAddress
    };
    
    const outputPath = "./contractAddresses.json";
    fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
    console.log(`\nContract addresses saved to ${outputPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });