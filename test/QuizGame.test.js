const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QuizGame", function () {
    let QuizCoin;
    let quizCoin;
    let PoolManager;
    let poolManager;
    let QuizGame;
    let quizGame;
    let owner;
    let addr1;
    let addr2;

    const initialSupply = ethers.parseEther("1000000"); // Example initial supply if needed for QuizCoin's own tests
    const quizId = 1;
    const question = "What is the capital of France?";
    const options = ["Berlin", "Madrid", "Paris", "Rome"];
    const correctAnswerIndex = 2; // Paris
    const rewardAmount = ethers.parseEther("100");
    const entryFee = ethers.parseEther("0.1"); // 0.1 ETH/BNB

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy QuizCoin
        QuizCoin = await ethers.getContractFactory("QuizCoin");
        quizCoin = await QuizCoin.deploy();
        await quizCoin.waitForDeployment();

        // Deploy PoolManager
        PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy();
        await poolManager.waitForDeployment();

        // Deploy QuizGame, passing deployed QuizCoin and PoolManager addresses
        QuizGame = await ethers.getContractFactory("QuizGame");
        quizGame = await QuizGame.deploy(await quizCoin.getAddress(), await poolManager.getAddress());
        await quizGame.waitForDeployment();

        // Set QuizGame as the minter for QuizCoin
        await quizCoin.setMinter(await quizGame.getAddress());

        // Transfer PoolManager ownership to QuizGame
        await poolManager.transferOwnership(await quizGame.getAddress());
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await quizGame.owner()).to.equal(owner.address);
        });

        it("Should set the correct QuizCoin and PoolManager addresses", async function () {
            expect(await quizGame.quizCoin()).to.equal(await quizCoin.getAddress());
            expect(await quizGame.poolManager()).to.equal(await poolManager.getAddress());
        });

        it("Should set nextQuizId to 1", async function () {
            expect(await quizGame.nextQuizId()).to.equal(1);
        });
    });

    describe("Quiz Creation", function () {
        it("Should allow owner to create a quiz", async function () {
            await expect(quizGame.createQuiz(question, options, correctAnswerIndex, rewardAmount, entryFee))
                .to.emit(quizGame, "QuizCreated")
                .withArgs(quizId, question, rewardAmount, entryFee);

            const quiz = await quizGame.quizzes(quizId);
            expect(quiz.question).to.equal(question);
            expect(quiz.correctAnswerIndex).to.equal(correctAnswerIndex);
            expect(quiz.rewardAmount).to.equal(rewardAmount);
            expect(quiz.entryFee).to.equal(entryFee);
            expect(quiz.isActive).to.be.true;
        });

        it("Should increment nextQuizId after creating a quiz", async function () {
            await quizGame.createQuiz(question, options, correctAnswerIndex, rewardAmount, entryFee);
            expect(await quizGame.nextQuizId()).to.equal(quizId + 1);
        });

        it("Should not allow non-owner to create a quiz", async function () {
            await expect(
                quizGame.connect(addr1).createQuiz(question, options, correctAnswerIndex, rewardAmount, entryFee)
            ).to.be.revertedWithCustomError(quizGame, "OwnableUnauthorizedAccount");
        });

        it("Should revert if options length is less than 2", async function () {
            await expect(
                quizGame.createQuiz(question, ["Only one"], correctAnswerIndex, rewardAmount, entryFee)
            ).to.be.revertedWith("Quiz must have at least 2 options");
        });

        it("Should revert if correct answer index is out of bounds", async function () {
            await expect(
                quizGame.createQuiz(question, options, 99, rewardAmount, entryFee)
            ).to.be.revertedWith("Invalid correct answer index");
        });

        it("Should revert if reward amount is zero", async function () {
            await expect(
                quizGame.createQuiz(question, options, correctAnswerIndex, 0, entryFee)
            ).to.be.revertedWith("Reward must be greater than zero");
        });
    });

    describe("Answering Quizzes", function () {
        beforeEach(async function () {
            // Create a quiz before each answer test
            await quizGame.createQuiz(question, options, correctAnswerIndex, rewardAmount, entryFee);
        });

        it("Should allow a user to answer correctly and receive reward", async function () {
            // Get initial balance of addr1 for QZC
            const initialQZCBalance = await quizCoin.balanceOf(addr1.address);

            // Answer correctly
            await expect(quizGame.connect(addr1).answerQuiz(quizId, correctAnswerIndex, { value: entryFee }))
                .to.emit(quizGame, "QuizAnswered")
                .withArgs(quizId, addr1.address, true)
                .and.to.emit(quizCoin, "Transfer"); // ERC20 Transfer event

            // Check QZC balance
            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialQZCBalance + rewardAmount);

            // Check participation status
            expect(await quizGame.hasParticipated(quizId, addr1.address)).to.be.true;
            expect(await quizGame.hasAnswered(quizId, addr1.address)).to.be.true;
        });

        it("Should allow a user to answer incorrectly", async function () {
            const wrongAnswerIndex = 0; // Berlin
            const initialQZCBalance = await quizCoin.balanceOf(addr1.address);

            await expect(quizGame.connect(addr1).answerQuiz(quizId, wrongAnswerIndex, { value: entryFee }))
                .to.emit(quizGame, "QuizAnswered")
                .withArgs(quizId, addr1.address, false);

            // QZC balance should not change for incorrect answer
            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialQZCBalance);

            // Check participation status
            expect(await quizGame.hasParticipated(quizId, addr1.address)).to.be.true;
            expect(await quizGame.hasAnswered(quizId, addr1.address)).to.be.true;
        });

        it("Should revert if quiz is not active", async function () {
            await quizGame.deactivateQuiz(quizId); // Deactivate the quiz
            await expect(
                quizGame.connect(addr1).answerQuiz(quizId, correctAnswerIndex, { value: entryFee })
            ).to.be.revertedWith("Quiz is not active");
        });

        it("Should revert if user has already participated", async function () {
            await quizGame.connect(addr1).answerQuiz(quizId, correctAnswerIndex, { value: entryFee }); // First participation
            await expect(
                quizGame.connect(addr1).answerQuiz(quizId, correctAnswerIndex, { value: entryFee })
            ).to.be.revertedWith("You have already participated in this quiz");
        });

        it("Should revert if insufficient entry fee is provided", async function () {
            const insufficientFee = ethers.parseEther("0.05");
            await expect(
                quizGame.connect(addr1).answerQuiz(quizId, correctAnswerIndex, { value: insufficientFee })
            ).to.be.revertedWith("Insufficient entry fee");
        });

        it("Should deposit entry fee to PoolManager", async function () {
            const initialPoolBalance = await ethers.provider.getBalance(await poolManager.getAddress());
            await quizGame.connect(addr1).answerQuiz(quizId, correctAnswerIndex, { value: entryFee });
            expect(await ethers.provider.getBalance(await poolManager.getAddress())).to.equal(initialPoolBalance + entryFee);
        });

        it("Should handle free quizzes (zero entry fee)", async function () {
            const freeQuizId = 2;
            const freeEntryFee = 0; // Set entry fee to 0
            await quizGame.createQuiz("Free Question?", ["Yes", "No"], 0, rewardAmount, freeEntryFee);

            const initialQZCBalance = await quizCoin.balanceOf(addr1.address);

            await expect(quizGame.connect(addr1).answerQuiz(freeQuizId, 0, { value: 0 })) // Pass 0 value for free quiz
                .to.emit(quizGame, "QuizAnswered")
                .withArgs(freeQuizId, addr1.address, true);

            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialQZCBalance + rewardAmount);
        });
    });

    describe("Quiz Deactivation", function () {
        beforeEach(async function () {
            await quizGame.createQuiz(question, options, correctAnswerIndex, rewardAmount, entryFee);
        });

        it("Should allow owner to deactivate a quiz", async function () {
            await quizGame.deactivateQuiz(quizId);
            const quiz = await quizGame.quizzes(quizId);
            expect(quiz.isActive).to.be.false;
        });

        it("Should revert if non-owner tries to deactivate a quiz", async function () {
            await expect(quizGame.connect(addr1).deactivateQuiz(quizId))
                .to.be.revertedWithCustomError(quizGame, "OwnableUnauthorizedAccount");
        });

        it("Should revert if quiz is already inactive", async function () {
            await quizGame.deactivateQuiz(quizId);
            await expect(quizGame.deactivateQuiz(quizId)).to.be.revertedWith("Quiz is already inactive");
        });
    });

    describe("Withdrawal of Entry Fees", function () {
        beforeEach(async function () {
            await quizGame.createQuiz(question, options, correctAnswerIndex, rewardAmount, entryFee);
            // Have multiple participants deposit fees
            await quizGame.connect(addr1).answerQuiz(quizId, correctAnswerIndex, { value: entryFee });
            await quizGame.connect(addr2).answerQuiz(quizId, 0, { value: entryFee });
        });

        it("Should allow owner to withdraw entry fees from a quiz pool", async function () {
            const totalEntryFees = entryFee * 2n; // 2 participants
            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
            const initialPoolManagerBalance = await ethers.provider.getBalance(await poolManager.getAddress());

            // Withdraw from QuizGame (which calls PoolManager)
            await expect(quizGame.withdrawEntryFees(quizId, totalEntryFees, owner.address))
                .to.emit(poolManager, "QuizPoolWithdrawn")
                .withArgs(quizId, totalEntryFees, owner.address);

            // Check owner's balance (factoring in gas costs)
            // Use .changeEtherBalance to account for gas
            await expect(async () => await quizGame.withdrawEntryFees(quizId, totalEntryFees, owner.address))
                 .to.changeEtherBalance(owner, totalEntryFees);

            // Check pool manager's balance
            expect(await ethers.provider.getBalance(await poolManager.getAddress())).to.equal(initialPoolManagerBalance - totalEntryFees);
        });

        it("Should revert if non-owner tries to withdraw entry fees", async function () {
            await expect(quizGame.connect(addr1).withdrawEntryFees(quizId, entryFee, addr1.address))
                .to.be.revertedWithCustomError(quizGame, "OwnableUnauthorizedAccount");
        });

        it("Should revert if trying to withdraw more than available in the pool", async function () {
            const excessiveAmount = entryFee * 3n;
            await expect(quizGame.withdrawEntryFees(quizId, excessiveAmount, owner.address))
                .to.be.revertedWith("Insufficient funds in quiz pool");
        });
    });
});