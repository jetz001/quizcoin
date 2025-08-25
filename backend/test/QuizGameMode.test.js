// test/QuizGameMode.test.js (ตัวอย่างบางส่วน)
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QuizGameModeFacet - Solo Mode", function () {
    let quizCoin, poolManager, quizGameDiamond;
    let admin, minter, player1, player2, rewardDistributor;
    let quizGameModeFacet, quizGameRewardFacet;
    let adminRole, minterRole, rewardDistributorRole;

    beforeEach(async function () {
        [admin, minter, player1, player2, rewardDistributor] = await ethers.getSigners();

        // Deploy QuizCoin
        const QuizCoin = await ethers.getContractFactory("QuizCoin");
        quizCoin = await QuizCoin.deploy();
        await quizCoin.waitForDeployment();

        // Deploy PoolManager
        const PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy(quizCoin.target);
        await poolManager.waitForDeployment();

        // Deploy QuizGameDiamond and facets (Simplified for example)
        const Diamond = await ethers.getContractFactory("QuizGameDiamond");
        quizGameDiamond = await Diamond.deploy();
        await quizGameDiamond.waitForDeployment();

        // Deploy Facets
        const QuizGameBaseFacet = await ethers.getContractFactory("QuizGameBaseFacet");
        const baseFacet = await QuizGameBaseFacet.deploy();
        await baseFacet.waitForDeployment();

        const QuizGameModeFacet = await ethers.getContractFactory("QuizGameModeFacet");
        quizGameModeFacet = await QuizGameModeFacet.deploy();
        await quizGameModeFacet.waitForDeployment();

        const QuizGameRewardFacet = await ethers.getContractFactory("QuizGameRewardFacet");
        quizGameRewardFacet = await QuizGameRewardFacet.deploy();
        await quizGameRewardFacet.waitForDeployment();

        // Mock DiamondCut (In a real scenario, you'd use a DiamondCutFacet)
        // For testing, we can often directly interact with the facet interfaces attached to the diamond.
        // For example, if QuizGameDiamond is the proxy, you'd attach interfaces to it.
        // For simplicity here, we'll assume direct interaction for roles setup.

        // Initialize QuizGameDiamond and Facets
        // This part is crucial and needs to be done correctly based on your diamond setup
        // Usually, initialize is called on the proxy through a facet
        const QuizGameDiamondInitializer = new ethers.Contract(quizGameDiamond.target, quizGameDiamond.interface, admin);
        await QuizGameDiamondInitializer.initialize(admin.address, poolManager.target, quizCoin.target);

        // Grant MINTER_ROLE to PoolManager on QuizCoin
        await quizCoin.connect(admin).grantRole(await quizCoin.MINTER_ROLE(), poolManager.target);

        // Get role hashes
        adminRole = await quizGameDiamond.connect(admin).DEFAULT_ADMIN_ROLE();
        rewardDistributorRole = await quizGameDiamond.connect(admin).REWARD_DISTRIBUTOR_ROLE();

        // Grant REWARD_DISTRIBUTOR_ROLE to rewardDistributor
        await quizGameDiamond.connect(admin).grantRole(rewardDistributorRole, rewardDistributor.address);

        // Access facets via diamond proxy for testing
        quizGameModeFacet = new ethers.Contract(quizGameDiamond.target, quizGameModeFacet.interface, admin);
        quizGameRewardFacet = new ethers.Contract(quizGameDiamond.target, quizGameRewardFacet.interface, admin);
    });

    it("should allow a player to submit a correct answer in Solo mode and receive reward", async function () {
        // Hash a dummy answer
        const correctAnswer = ethers.keccak256(ethers.toUtf8Bytes("correctAnswer"));
        const hint = ethers.keccak256(ethers.toUtf8Bytes("hint"));

        // Create a question (Level 50, Solo Mode)
        await quizGameModeFacet.connect(admin).createQuestion(
            correctAnswer,
            hint,
            50, // difficultyLevel
            0,  // LibAppStorage.QuestionMode.Solo
            0   // LibAppStorage.QuestionCategory.None
        );

        const questionId = 1; // Assuming it's the first question created

        // Get initial balance of player1
        const initialPlayerBalance = await quizCoin.balanceOf(player1.address);

        // Player1 submits correct answer
        await quizGameModeFacet.connect(player1).submitAnswer(questionId, correctAnswer);

        // Check final balance of player1
        // You'll need to fetch the calculated reward from the contract or recalculate it in the test
        // For simplicity, let's assume a fixed expected reward for this test (you'd calculate it accurately)
        const expectedRewardAmount = ethers.parseEther("2525.252525252525252525"); // Example: (5000 * 50 / 99) * (1 - 0.005)
        expect(await quizCoin.balanceOf(player1.address)).to.be.closeTo(initialPlayerBalance + expectedRewardAmount, 1);

        // Verify treasury balance (fee)
        const expectedFee = ethers.parseEther("12.757575757575757575"); // Example: (5000 * 50 / 99) * 0.005
        expect(await quizCoin.balanceOf(quizGameDiamond.target)).to.be.closeTo(expectedFee, 1);

        // Verify question is closed
        const questionData = await quizGameModeFacet.questions(questionId); // Need a getter for questions
        expect(questionData.isClosed).to.be.true;
        expect(questionData.firstSolverAddress).to.equal(player1.address);
    });

    // Add more test cases for Pool Mode, buyHint, distributeRewards, role checks, error cases, etc.
});