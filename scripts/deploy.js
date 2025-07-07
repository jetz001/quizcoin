// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs"); // Import Node.js filesystem module

async function main() {
    console.log("Deployment script started!");

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contracts with the account: ${deployer.address}`);

    // --- Deploy QuizCoin ---
    console.log("Attempting to deploy QuizCoin...");
    const QuizCoin = await ethers.getContractFactory("QuizCoin");
    const quizCoin = await QuizCoin.deploy();
    await quizCoin.waitForDeployment();
    console.log(`QuizCoin deployed to: ${quizCoin.target}`);

    // --- Deploy QuizGame ---
    console.log("Attempting to deploy QuizGame...");
    const QuizGame = await ethers.getContractFactory("QuizGame");
    const quizGame = await QuizGame.deploy(quizCoin.target);
    await quizGame.waitForDeployment();
    console.log(`QuizGame deployed to: ${quizGame.target}`);

    // --- Deploy PoolManager ---
    console.log("Attempting to deploy PoolManager...");
    const PoolManager = await ethers.getContractFactory("PoolManager");
    const poolManager = await PoolManager.deploy(quizCoin.target);
    await poolManager.waitForDeployment();
    console.log(`PoolManager deployed to: ${poolManager.target}`);

    // --- Set up roles and addresses ---
    console.log("\n--- Setting up contract relationships and roles ---");

    console.log(`Setting PoolManager address (${poolManager.target}) in QuizGame...`);
    const setPoolManagerTx = await quizGame.connect(deployer).setPoolManagerAddress(poolManager.target);
    await setPoolManagerTx.wait();
    console.log("PoolManager address set in QuizGame successfully.");

    console.log("Granting MINTER_ROLE to QuizGame in QuizCoin...");
    const MINTER_ROLE_BYTES = await quizCoin.MINTER_ROLE();
    const grantMinterTx = await quizCoin.connect(deployer).grantRole(MINTER_ROLE_BYTES, quizGame.target);
    await grantMinterTx.wait();
    console.log("MINTER_ROLE granted to QuizGame in QuizCoin successfully.");

    console.log("Granting BURNER_ROLE to QuizGame in QuizCoin...");
    const BURNER_ROLE_BYTES = await quizCoin.BURNER_ROLE();
    const grantBurnerTx = await quizCoin.connect(deployer).grantRole(BURNER_ROLE_BYTES, quizGame.target);
    await grantBurnerTx.wait();
    console.log("BURNER_ROLE granted to QuizGame in QuizCoin successfully.");

    console.log("Granting GAME_ADMIN_ROLE_IN_POOL_MANAGER to QuizGame in PoolManager...");
    const GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES = await poolManager.GAME_ADMIN_ROLE_IN_POOL_MANAGER();
    const grantGameAdminToPoolManagerTx = await poolManager.connect(deployer).grantRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES, quizGame.target);
    await grantGameAdminToPoolManagerTx.wait();
    console.log("GAME_ADMIN_ROLE_IN_POOL_MANAGER granted to QuizGame in PoolManager successfully.");

    console.log(`Setting Developer Fund Address (${deployer.address}) in PoolManager...`);
    const setPoolDevFundTx = await poolManager.connect(deployer).setDeveloperFundAddress(deployer.address);
    await setPoolDevFundTx.wait();
    console.log("Developer Fund Address set in PoolManager successfully.");


    console.log("\n--- Deployment and Setup Complete! ---");
    console.log(`QuizCoin Address:    ${quizCoin.target}`);
    console.log(`QuizGame Address:    ${quizGame.target}`);
    console.log(`PoolManager Address: ${poolManager.target}`);

    // --- NEW: Save contract addresses to a file ---
    const addresses = {
        QuizCoin: quizCoin.target,
        QuizGame: quizGame.target,
        PoolManager: poolManager.target
    };
    
    const outputPath = "./contractAddresses.json"; // Path to save the addresses
    fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2)); // Write to file with pretty print
    console.log(`\nContract addresses saved to ${outputPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });