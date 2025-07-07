// test/QuizGameAccessAndAnswer.js
const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("QuizGame Extended Tests", function () {
    let QuizCoin, QuizGame, PoolManager;
    let quizCoin, quizGame, poolManager;
    let deployer, player1, player2;

    let MINTER_ROLE_BYTES, BURNER_ROLE_BYTES, GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES;

    const MINT_AMOUNT_PLAYER1 = ethers.parseUnits("1050", 18);

    before(async function () {
        [deployer, player1, player2] = await ethers.getSigners();

        // --- DEPLOY CONTRACTS ---

        // 1. Deploy QuizCoin: Constructor takes no arguments (name and symbol are hardcoded in contract)
        QuizCoin = await ethers.getContractFactory("QuizCoin");
        quizCoin = await QuizCoin.deploy();
        await quizCoin.waitForDeployment();

        // 2. Deploy PoolManager: Constructor takes one argument: _quizCoinAddress
        PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy(quizCoin.target);
        await poolManager.waitForDeployment();

        // 3. Deploy QuizGame: Constructor takes one argument: _quizCoinAddress (which is the QuizCoin contract address)
        QuizGame = await ethers.getContractFactory("QuizGame");
        quizGame = await QuizGame.deploy(quizCoin.target);
        await quizGame.waitForDeployment();

        // --- SETUP ROLES AND ADDRESSES ---

        // Get Role Bytes (from deployed contracts)
        MINTER_ROLE_BYTES = await quizCoin.MINTER_ROLE();
        BURNER_ROLE_BYTES = await quizCoin.BURNER_ROLE();
        GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES = await poolManager.GAME_ADMIN_ROLE_IN_POOL_MANAGER();

        // Grant roles to QuizGame contract (which acts as minter/burner/game admin)
        await quizCoin.grantRole(MINTER_ROLE_BYTES, quizGame.target);
        await quizCoin.grantRole(BURNER_ROLE_BYTES, quizGame.target);
        await poolManager.grantRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES, quizGame.target);

        // Set PoolManager address in QuizGame
        await quizGame.connect(deployer).setPoolManagerAddress(poolManager.target);

        // Set Developer Fund addresses in both QuizGame and PoolManager
        await poolManager.connect(deployer).setDeveloperFundAddress(deployer.address);
        await quizGame.connect(deployer).setDeveloperFundAddress(deployer.address);


        // --- PREPARE PLAYER BALANCES ---

        // Mint QZC for Player 1 (deployer has MINTER_ROLE)
        await quizCoin.connect(deployer).mint(player1.address, MINT_AMOUNT_PLAYER1);
        
        // Player 1 approves PoolManager to spend QZC
        await quizCoin.connect(player1).approve(poolManager.target, MINT_AMOUNT_PLAYER1);

        // Player 1 deposits into PoolManager's pool
        await poolManager.connect(player1).deposit(ethers.parseUnits("1000", 18));
    });

    describe("QuizGame Answer Submission", function () {
        let questionId;
        const correctAnswer = "42";
        const hint = "The answer to life, the universe, and everything.";
        const difficulty = 50;
        const hintCost = ethers.parseUnits("5", 18);

        beforeEach(async function () {
            const answerHash = ethers.id(correctAnswer);
            const hintHash = ethers.id(hint);
            const createQTx = await quizGame.connect(deployer).createQuestion(answerHash, hintHash, difficulty, hintCost);
            await createQTx.wait();
            questionId = (await quizGame.nextQuestionId()) - 1n;
        });

        it("Should revert if player submits an incorrect answer", async function () {
            const incorrectAnswer = "Wrong Answer";
            await expect(quizGame.connect(player1).submitAnswer(questionId, incorrectAnswer))
                .to.be.revertedWith("QuizGame: Incorrect answer");
        });

        it("Should revert if player tries to get hint for an invalid question ID", async function () {
            const invalidQuestionId = questionId + 100n;
            await expect(quizGame.connect(player1).getHint(invalidQuestionId))
                .to.be.revertedWith("QuizGame: Question does not exist");
        });

        it("Should revert if player tries to submit answer for an invalid question ID", async function () {
            const invalidQuestionId = questionId + 100n;
            await expect(quizGame.connect(player1).submitAnswer(invalidQuestionId, correctAnswer))
                .to.be.revertedWith("QuizGame: Question does not exist");
        });

        it("Should revert if player tries to get hint for a question they've already gotten a hint for", async function () {
            await quizGame.connect(player1).getHint(questionId);
            // ตรวจสอบ revert ด้วยข้อความที่กำหนดในสัญญา QuizGame.sol
            await expect(quizGame.connect(player1).getHint(questionId))
                .to.be.revertedWith("QuizGame: Hint already obtained for this question");
        });

        it("Should revert if player tries to submit answer to an already solved question", async function () {
            await quizGame.connect(player1).submitAnswer(questionId, correctAnswer);
            await expect(quizGame.connect(player2).submitAnswer(questionId, correctAnswer))
                .to.be.revertedWith("QuizGame: Question already solved");
        });
    });

    describe("Access Control Tests", function () {
        it("Should prevent non-deployer from setting PoolManager address in QuizGame", async function () {
            // แก้ไข: ใช้ revertedWithCustomError สำหรับ OpenZeppelin AccessControl (ไม่ใช่ Ownable)
            // เนื่องจาก QuizGame ใช้ AccessControl โดยตรง ไม่ได้สืบทอดจาก Ownable
            await expect(quizGame.connect(player1).setPoolManagerAddress(player2.address))
                .to.be.revertedWithCustomError(quizGame, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-deployer from setting Developer Fund address in PoolManager", async function () {
            // แก้ไข: ใช้ revertedWithCustomError สำหรับ OpenZeppelin AccessControl (ไม่ใช่ Ownable)
            // เนื่องจาก PoolManager ใช้ AccessControl โดยตรง ไม่ได้สืบทอดจาก Ownable
            await expect(poolManager.connect(player1).setDeveloperFundAddress(player2.address))
                .to.be.revertedWithCustomError(poolManager, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-MINTER_ROLE from minting QuizCoin", async function () {
            const mintAmount = ethers.parseUnits("100", 18);
            await expect(quizCoin.connect(player1).mint(player2.address, mintAmount))
                .to.be.revertedWithCustomError(quizCoin, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-BURNER_ROLE from burning QuizCoin", async function () {
            await quizCoin.connect(deployer).mint(player2.address, ethers.parseUnits("100", 18));
            await expect(quizCoin.connect(player2).burn(player2.address, ethers.parseUnits("10", 18)))
                .to.be.revertedWithCustomError(quizCoin, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-GAME_ADMIN_ROLE_IN_POOL_MANAGER from calling withdrawForHint in PoolManager", async function () {
            const amount = ethers.parseUnits("10", 18);
            await expect(poolManager.connect(player1).withdrawForHint(player1.address, amount))
                .to.be.revertedWithCustomError(poolManager, "AccessControlUnauthorizedAccount");
        });

        // Test case นี้ถูกลบออก เพราะ PoolManager.sol ไม่มีฟังก์ชัน withdrawForRewardFee
        // it("Should prevent non-GAME_ADMIN_ROLE_IN_POOL_MANAGER from calling withdrawForRewardFee in PoolManager", async function () {
        //     const amount = ethers.parseUnits("1", 18);
        //     await expect(poolManager.connect(player1).withdrawForRewardFee(player1.address, amount))
        //         .to.be.revertedWithCustomError(poolManager, "AccessControlUnauthorizedAccount");
        // });

        it("Should prevent non-DEFAULT_ADMIN_ROLE from creating questions in QuizGame", async function () {
            const answerHash = ethers.id("test");
            const hintHash = ethers.id("hint");
            const difficulty = 10;
            const hintCost = ethers.parseUnits("1", 18);

            await expect(quizGame.connect(player1).createQuestion(answerHash, hintHash, difficulty, hintCost))
                .to.be.revertedWithCustomError(quizGame, "AccessControlUnauthorizedAccount");
        });
    });
});