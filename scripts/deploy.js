// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
    console.log("Deployment script started!");

    let deployer;
    try {
        [deployer] = await ethers.getSigners();
        console.log("Deploying contracts with the account:", deployer.address);
    } catch (error) {
        console.error("Error getting signers or initial setup:", error.message);
        process.exit(1);
    }

    let quizCoinAddress;
    let quizCoin;
    try {
        console.log("Attempting to deploy QuizCoin...");
        const QuizCoinFactory = await ethers.getContractFactory("QuizCoin");
        quizCoin = await QuizCoinFactory.deploy();
        await quizCoin.waitForDeployment();
        quizCoinAddress = await quizCoin.getAddress();
        console.log("QuizCoin deployed to:", quizCoinAddress);
    } catch (error) {
        console.error("Error deploying QuizCoin:", error.message);
        process.exit(1);
    }

    let quizGameAddress;
    let quizGame;
    try {
        console.log("Attempting to deploy QuizGame...");
        const QuizGameFactory = await ethers.getContractFactory("QuizGame");
        quizGame = await QuizGameFactory.deploy(quizCoinAddress);
        await quizGame.waitForDeployment();
        quizGameAddress = await quizGame.getAddress();
        console.log("QuizGame deployed to:", quizGameAddress);
    } catch (error) {
        console.error("Error deploying QuizGame:", error.message);
        process.exit(1);
    }

    let poolManagerAddress;
    let poolManager;
    try {
        console.log("Attempting to deploy PoolManager...");
        const PoolManagerFactory = await ethers.getContractFactory("PoolManager");
        // แก้ไขตรงนี้: ส่ง quizGameAddress เข้าไปใน constructor ของ PoolManager ด้วย
        poolManager = await PoolManagerFactory.deploy(quizCoinAddress, quizGameAddress);
        await poolManager.waitForDeployment();
        poolManagerAddress = await poolManager.getAddress();
        console.log("PoolManager deployed to:", poolManagerAddress);
    } catch (error) {
        console.error("Error deploying PoolManager:", error.message);
        process.exit(1);
    }

    // --- ตั้งค่า Access Control Roles ---

    try {
        // รับ Role Hashes จาก QuizCoin
        const MINTER_ROLE = await quizCoin.MINTER_ROLE();
        const BURNER_ROLE = await quizCoin.BURNER_ROLE();

        // 1. ให้ QuizGame มี MINTER_ROLE และ BURNER_ROLE ใน QuizCoin
        console.log("Granting MINTER_ROLE to QuizGame in QuizCoin...");
        await quizCoin.connect(deployer).grantRole(MINTER_ROLE, quizGameAddress);
        console.log("MINTER_ROLE granted to QuizGame.");

        console.log("Granting BURNER_ROLE to QuizGame in QuizCoin...");
        await quizCoin.connect(deployer).grantRole(BURNER_ROLE, quizGameAddress);
        console.log("BURNER_ROLE granted to QuizGame.");

        // 2. ให้ PoolManager มี MINTER_ROLE และ BURNER_ROLE ใน QuizCoin
        console.log("Granting MINTER_ROLE to PoolManager in QuizCoin...");
        await quizCoin.connect(deployer).grantRole(MINTER_ROLE, poolManagerAddress);
        console.log("MINTER_ROLE granted to PoolManager.");

        console.log("Granting BURNER_ROLE to PoolManager in QuizCoin...");
        await quizCoin.connect(deployer).grantRole(BURNER_ROLE, poolManagerAddress);
        console.log("BURNER_ROLE granted to PoolManager.");

        // รับ Role Hash จาก QuizGame
        const GAME_ADMIN_ROLE = await quizGame.GAME_ADMIN_ROLE();

        // 3. ให้ PoolManager มี GAME_ADMIN_ROLE ใน QuizGame
        console.log("Granting GAME_ADMIN_ROLE to PoolManager in QuizGame...");
        await quizGame.connect(deployer).grantRole(GAME_ADMIN_ROLE, poolManagerAddress);
        console.log("GAME_ADMIN_ROLE granted to PoolManager.");

        // รับ Role Hash จาก PoolManager
        const POOL_ADMIN_ROLE = await poolManager.POOL_ADMIN_ROLE();

        // 4. ให้ QuizGame มี POOL_ADMIN_ROLE ใน PoolManager
        console.log("Granting POOL_ADMIN_ROLE to QuizGame in PoolManager...");
        await poolManager.connect(deployer).grantRole(POOL_ADMIN_ROLE, quizGameAddress);
        console.log("POOL_ADMIN_ROLE granted to QuizGame.");


    } catch (error) {
        console.error("Error granting roles:", error.message);
        process.exit(1);
    }

    // ส่วนนี้ถูกลบออกไป เพราะเราตั้งค่า QuizGame address ใน PoolManager ตั้งแต่ constructor แล้ว
    /*
    try {
        console.log("Setting QuizGame address in PoolManager...");
        await poolManager.connect(deployer).setQuizGameAddress(quizGameAddress);
        console.log("QuizGame address set in PoolManager.");
    } catch (error) {
        console.error("Error setting QuizGame address in PoolManager:", error.message);
        process.exit(1);
    }
    */
    
    console.log("Deployment and role setup complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Unhandled error during deployment:", error);
        process.exit(1);
    });