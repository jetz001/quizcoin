const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("QuizGame Contract", function () {
    let QuizCoin;
    let quizCoin;
    let PoolManager;
    let poolManager;
    let QuizGame;
    let quizGame;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let addrs;
    let REWARD_DISTRIBUTOR_ROLE;
    let GAME_ADMIN_ROLE_IN_POOL_MANAGER; // Role QuizGame has in PoolManager
    let MINTER_ROLE_IN_QUIZCOIN;
    let BURNER_ROLE_IN_QUIZCOIN;

    // Hashes for testing
    const CORRECT_ANSWER_HASH = ethers.keccak256(ethers.toUtf8Bytes("correct_answer"));
    const WRONG_ANSWER_HASH = ethers.keccak256(ethers.toUtf8Bytes("wrong_answer"));
    const HINT_HASH = ethers.keccak256(ethers.toUtf8Bytes("hint_text"));
    const DIFFICULTY_LEVEL_50 = 50;
    const DIFFICULTY_LEVEL_100 = 100;

    // Constants for time manipulation
    const ONE_DAY = 24 * 60 * 60;
    const ONE_WEEK = 7 * ONE_DAY;
    const FOUR_YEARS = 4 * 365 * 24 * 60 * 60; // Approximate, ignoring leap years for simplicity in test
    const BLOCK_DURATION_SECONDS = 180; // 3 minutes

    // Helper for calculating QZC amounts
    const parseQZC = (amount) => ethers.parseUnits(amount.toString(), 18);

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

        // Deploy QuizCoin
        QuizCoin = await ethers.getContractFactory("QuizCoin");
        quizCoin = await upgrades.deployProxy(QuizCoin, [], { kind: "uups" });
        await quizCoin.waitForDeployment();

        // Deploy PoolManager
        PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await upgrades.deployProxy(PoolManager, [await quizCoin.getAddress()], { kind: "uups" });
        await poolManager.waitForDeployment();

        // Deploy QuizGame
        QuizGame = await ethers.getContractFactory("QuizGame");
        quizGame = await upgrades.deployProxy(
            QuizGame,
            [await quizCoin.getAddress(), await poolManager.getAddress(), owner.address, await time.latest()], // Pass current timestamp as GAME_START_TIMESTAMP
            { kind: "uups" }
        );
        await quizGame.waitForDeployment();

        // Get roles from contracts
        REWARD_DISTRIBUTOR_ROLE = await quizGame.REWARD_DISTRIBUTOR_ROLE();
        GAME_ADMIN_ROLE_IN_POOL_MANAGER = await poolManager.GAME_ADMIN_ROLE();
        MINTER_ROLE_IN_QUIZCOIN = await quizCoin.MINTER_ROLE();
        BURNER_ROLE_IN_QUIZCOIN = await quizCoin.BURNER_ROLE();

        // Grant necessary roles
        await quizCoin.grantRole(MINTER_ROLE_IN_QUIZCOIN, await poolManager.getAddress());
        await quizCoin.grantRole(BURNER_ROLE_IN_QUIZCOIN, await poolManager.getAddress());
        await poolManager.grantRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER, await quizGame.getAddress());

        // Mint some initial QuizCoin for users to purchase hints and for initial pool balance
        await quizCoin.mint(owner.address, parseQZC(100000));
        await quizCoin.mint(addr1.address, parseQZC(100000));
        await quizCoin.mint(addr2.address, parseQZC(100000));
        await quizCoin.mint(addr3.address, parseQZC(100000));

        // Owner/Admin needs to approve PoolManager to spend QZC for hint costs (if PoolManager pulls)
        // Or if hint cost goes directly to QuizGame, QuizGame needs to transfer it to PoolManager
        // Based on current QuizGame code, hint cost directly goes to poolManager.
        // So users need to approve PoolManager.
        await quizCoin.connect(owner).approve(await poolManager.getAddress(), parseQZC(100000));
        await quizCoin.connect(addr1).approve(await poolManager.getAddress(), parseQZC(100000));
        await quizCoin.connect(addr2).approve(await poolManager.getAddress(), parseQZC(100000));
        await quizCoin.connect(addr3).approve(await poolManager.getAddress(), parseQZC(100000));
    });

    describe("Initialization and Basic Setup", function () {
        it("Should set the correct QuizCoin, PoolManager and initial state variables", async function () {
            expect(await quizGame.quizCoin()).to.equal(await quizCoin.getAddress());
            expect(await quizGame.poolManager()).to.equal(await poolManager.getAddress());
            expect(await quizGame.nextQuestionId()).to.equal(1);
            expect(await quizGame.hasRole(REWARD_DISTRIBUTOR_ROLE, owner.address)).to.be.true;
            expect(await quizGame.hasRole(await quizGame.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
        });

        it("Should allow changing PoolManager address by admin", async function () {
            const newPoolManager = addrs[0]; // Just a random address for testing
            await expect(quizGame.setPoolManagerAddress(newPoolManager.address))
                .to.emit(quizGame, "PoolManagerAddressUpdated")
                .withArgs(await poolManager.getAddress(), newPoolManager.address);
            expect(await quizGame.poolManager()).to.equal(newPoolManager.address);
        });

        it("Should not allow changing PoolManager address by non-admin", async function () {
            const newPoolManager = addrs[0];
            await expect(quizGame.connect(addr1).setPoolManagerAddress(newPoolManager.address))
                .to.be.revertedWith("AccessControl: Caller is not a game admin");
        });
    });

    describe("Question Creation", function () {
        it("Should allow admin to create a new Solo question", async function () {
            await expect(quizGame.createQuestion(
                CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 0 // 0 = Solo mode
            ))
                .to.emit(quizGame, "QuestionCreated")
                .withArgs(1, owner.address, DIFFICULTY_LEVEL_50, parseQZC((5000 * 50) / 99)); // Check calculated base reward
            
            const question = await quizGame.questions(1);
            expect(question.correctAnswerHash).to.equal(CORRECT_ANSWER_HASH);
            expect(question.difficultyLevel).to.equal(DIFFICULTY_LEVEL_50);
            expect(question.mode).to.equal(0); // Solo mode
            expect(question.isClosed).to.be.false;
            expect(question.firstSolverAddress).to.equal(ethers.ZeroAddress);
        });

        it("Should allow admin to create a new Pool question", async function () {
            await expect(quizGame.createQuestion(
                CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 1 // 1 = Pool mode
            ))
                .to.emit(quizGame, "QuestionCreated")
                .withArgs(1, owner.address, DIFFICULTY_LEVEL_50, parseQZC((5000 * 50) / 99));
            
            const question = await quizGame.questions(1);
            expect(question.mode).to.equal(1); // Pool mode
        });

        it("Should calculate level 100 reward correctly", async function () {
            await expect(quizGame.createQuestion(
                CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_100, 0 // Solo mode
            ))
                .to.emit(quizGame, "QuestionCreated")
                .withArgs(1, owner.address, DIFFICULTY_LEVEL_100, parseQZC(10000));
            
            const question = await quizGame.questions(1);
            expect(question.baseRewardAmount).to.equal(parseQZC(10000));
        });

        it("Should revert if difficulty level is invalid", async function () {
            await expect(quizGame.createQuestion(
                CORRECT_ANSWER_HASH, HINT_HASH, 0, 0
            )).to.be.revertedWith("Quiz: Difficulty level must be between 1 and 100");
            await expect(quizGame.createQuestion(
                CORRECT_ANSWER_HASH, HINT_HASH, 101, 0
            )).to.be.revertedWith("Quiz: Difficulty level must be between 1 and 100");
        });
    });

    describe("Hint Purchasing", function () {
        beforeEach(async function () {
            // Create a question first for hint purchasing
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 0); // Solo mode
        });

        it("Should allow a user to purchase a hint", async function () {
            const initialBalance = await quizCoin.balanceOf(addr1.address);
            const initialPoolBalance = await quizCoin.balanceOf(await poolManager.getAddress());
            const hintCost = await quizGame.HINT_COST_AMOUNT();

            await expect(poolManager.connect(addr1).purchaseHint(await quizGame.getAddress(), 1)) // Changed to poolManager.purchaseHint
                .to.emit(poolManager, "HintPurchased") // Event is now from PoolManager
                .withArgs(1, addr1.address, hintCost);

            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialBalance - hintCost);
            expect(await quizCoin.balanceOf(await poolManager.getAddress())).to.equal(initialPoolBalance + hintCost);
        });

        it("Should revert if user does not have enough QuizCoin for hint", async function () {
            await quizCoin.connect(addr1).transfer(owner.address, parseQZC(99999)); // Deplete addr1's balance
            await expect(poolManager.connect(addr1).purchaseHint(await quizGame.getAddress(), 1))
                .to.be.revertedWith("ERC20: transfer amount exceeds balance"); // Reverts from ERC20 transfer
        });

        it("Should revert if question does not exist for hint", async function () {
            await expect(poolManager.connect(addr1).purchaseHint(await quizGame.getAddress(), 99))
                .to.be.revertedWith("Quiz: Question does not exist or invalid question ID"); // Reverts from QuizGame's check
        });
    });

    // --- NEW TESTS FOR SOLO MODE ---
    describe("Solo Mode Logic", function () {
        let questionIdSolo;
        beforeEach(async function () {
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 0); // Solo mode
            questionIdSolo = 1;
        });

        it("Should allow the first correct solver to win and close the question immediately", async function () {
            const initialAddr1Balance = await quizCoin.balanceOf(addr1.address);
            const initialPoolBalance = await quizCoin.balanceOf(await poolManager.getAddress());
            const expectedReward = parseQZC((5000 * 50) / 99); // Base reward for difficulty 50

            await expect(quizGame.connect(addr1).submitAnswer(questionIdSolo, CORRECT_ANSWER_HASH))
                .to.emit(quizGame, "AnswerSubmitted").withArgs(questionIdSolo, addr1.address, CORRECT_ANSWER_HASH)
                .and.to.emit(quizGame, "RewardDistributed").withArgs(questionIdSolo, addr1.address, expectedReward)
                .and.to.emit(quizGame, "QuestionClosed").withArgs(questionIdSolo);

            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialAddr1Balance + expectedReward);
            expect(await quizCoin.balanceOf(await poolManager.getAddress())).to.equal(initialPoolBalance - expectedReward); // PoolManager balance should decrease
            
            const question = await quizGame.questions(questionIdSolo);
            expect(question.isClosed).to.be.true;
            expect(question.firstSolverAddress).to.equal(addr1.address);
        });

        it("Should revert if a second user tries to submit a correct answer in Solo mode", async function () {
            await quizGame.connect(addr1).submitAnswer(questionIdSolo, CORRECT_ANSWER_HASH); // addr1 solves it
            await expect(quizGame.connect(addr2).submitAnswer(questionIdSolo, CORRECT_ANSWER_HASH))
                .to.be.revertedWith("Quiz: Question is already closed."); // Or "Solo mode already solved." from older logic, but 'isClosed' check comes first now
        });

        it("Should apply halving for levels 1-99 in Solo mode", async function () {
            // Move time forward 4 years (1 halving cycle)
            await time.increase(FOUR_YEARS); 

            const expectedRewardAfterHalving = parseQZC(((5000 * 50) / 99) / 2); // Halved reward

            // Create new solo question at difficulty 50
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 0); 
            const newQuestionId = await quizGame.nextQuestionId() - 1; // Get ID of newly created question

            const initialAddr1Balance = await quizCoin.balanceOf(addr1.address);
            await quizGame.connect(addr1).submitAnswer(newQuestionId, CORRECT_ANSWER_HASH);
            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialAddr1Balance + expectedRewardAfterHalving);
        });

        it("Should cap reward at MIN_REWARD_AFTER_HALVING in Solo mode", async function () {
            // Move time forward enough for multiple halving cycles to reach minimum (e.g., 8 years = 2 cycles)
            await time.increase(FOUR_YEARS * 8); // 8 years for extreme case

            const minReward = await quizGame.MIN_REWARD_AFTER_HALVING();

            // Create new solo question at difficulty 50
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 0); 
            const newQuestionId = await quizGame.nextQuestionId() - 1; 

            const initialAddr1Balance = await quizCoin.balanceOf(addr1.address);
            await quizGame.connect(addr1).submitAnswer(newQuestionId, CORRECT_ANSWER_HASH);
            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialAddr1Balance + minReward);
        });

        it("Should NOT apply halving for level 100 in Solo mode", async function () {
            // Move time forward 4 years (1 halving cycle)
            await time.increase(FOUR_YEARS); 

            // Create new solo question at difficulty 100
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_100, 0); 
            const newQuestionId = await quizGame.nextQuestionId() - 1; 

            const initialAddr1Balance = await quizCoin.balanceOf(addr1.address);
            await quizGame.connect(addr1).submitAnswer(newQuestionId, CORRECT_ANSWER_HASH);
            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialAddr1Balance + parseQZC(10000)); // Still 10000 QZC
        });
    });

    // --- NEW TESTS FOR POOL MODE ---
    describe("Pool Mode Logic", function () {
        let questionIdPool;
        beforeEach(async function () {
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 1); // Pool mode
            questionIdPool = 1;
        });

        it("Should start the reward window when the first user submits a correct answer in Pool mode", async function () {
            const initialTimestamp = await time.latest();
            await expect(quizGame.connect(addr1).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH))
                .to.emit(quizGame, "QuestionRewardWindowStarted")
                .withArgs(questionIdPool, initialTimestamp); // Window starts at initialTimestamp

            const question = await quizGame.questions(questionIdPool);
            expect(question.firstCorrectAnswerTime).to.equal(initialTimestamp);
            expect(question.poolCorrectSolvers[0]).to.equal(addr1.address);
            expect(question.isClosed).to.be.false; // Not closed yet
        });

        it("Should allow multiple users to submit correct answers within the window", async function () {
            await quizGame.connect(addr1).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH); // Start window
            await time.increase(BLOCK_DURATION_SECONDS / 2); // Halfway through the window

            await quizGame.connect(addr2).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH);
            await quizGame.connect(addr3).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH);

            const question = await quizGame.questions(questionIdPool);
            expect(question.poolCorrectSolvers.length).to.equal(3);
            expect(question.poolCorrectSolvers).to.include(addr1.address);
            expect(question.poolCorrectSolvers).to.include(addr2.address);
            expect(question.poolCorrectSolvers).to.include(addr3.address);
        });

        it("Should not allow submissions after the Pool window has closed", async function () {
            await quizGame.connect(addr1).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH); // Start window
            await time.increase(BLOCK_DURATION_SECONDS + 1); // Move past the window duration

            await expect(quizGame.connect(addr2).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH))
                .to.be.revertedWith("Quiz: Pool reward window is closed.");
        });

        it("Should not allow reward distribution before the Pool window closes", async function () {
            await quizGame.connect(addr1).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH); // Start window
            await expect(quizGame.distributeRewards(questionIdPool))
                .to.be.revertedWith("Quiz: Pool window is not over yet.");
        });

        it("Should distribute rewards equally to all correct solvers after Pool window closes", async function () {
            const expectedTotalReward = parseQZC((5000 * 50) / 99);
            
            await quizGame.connect(addr1).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH); // Start window
            await quizGame.connect(addr2).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH);
            await quizGame.connect(addr3).submitAnswer(questionIdPool, CORRECT_ANSWER_HASH);

            const initialAddr1Balance = await quizCoin.balanceOf(addr1.address);
            const initialAddr2Balance = await quizCoin.balanceOf(addr2.address);
            const initialAddr3Balance = await quizCoin.balanceOf(addr3.address);
            const initialPoolBalance = await quizCoin.balanceOf(await poolManager.getAddress());

            await time.increase(BLOCK_DURATION_SECONDS + 1); // Move past the window duration

            await expect(quizGame.distributeRewards(questionIdPool))
                .to.emit(quizGame, "RewardDistributed")
                .withArgs(questionIdPool, addr1.address, expectedTotalReward / 3) // Check individual rewards
                .and.to.emit(quizGame, "RewardDistributed")
                .withArgs(questionIdPool, addr2.address, expectedTotalReward / 3)
                .and.to.emit(quizGame, "RewardDistributed")
                .withArgs(questionIdPool, addr3.address, expectedTotalReward / 3)
                .and.to.emit(quizGame, "QuestionClosed").withArgs(questionIdPool);

            expect(await quizCoin.balanceOf(addr1.address)).to.equal(initialAddr1Balance + (expectedTotalReward / 3));
            expect(await quizCoin.balanceOf(addr2.address)).to.equal(initialAddr2Balance + (expectedTotalReward / 3));
            expect(await quizCoin.balanceOf(addr3.address)).to.equal(initialAddr3Balance + (expectedTotalReward / 3));
            expect(await quizCoin.balanceOf(await poolManager.getAddress())).to.equal(initialPoolBalance - expectedTotalReward);
            
            const question = await quizGame.questions(questionIdPool);
            expect(question.isClosed).to.be.true;
            expect(question.poolCorrectSolvers.length).to.equal(0); // Should be cleared
        });

        // Add halving tests for Pool mode, similar to Solo mode
        it("Should apply halving for levels 1-99 in Pool mode", async function () {
            await quizGame.connect(owner).createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 1); // Pool mode
            const newQuestionId = await quizGame.nextQuestionId() - 1;

            // Move time forward 4 years (1 halving cycle)
            await time.increase(FOUR_YEARS); 

            const expectedTotalRewardAfterHalving = parseQZC(((5000 * 50) / 99) / 2); // Halved reward

            await quizGame.connect(addr1).submitAnswer(newQuestionId, CORRECT_ANSWER_HASH);
            await time.increase(BLOCK_DURATION_SECONDS + 1); 
            await quizGame.distributeRewards(newQuestionId);

            expect(await quizCoin.balanceOf(addr1.address)).to.equal(parseQZC(100000) + expectedTotalRewardAfterHalving); // Assuming addr1 started with 100k
        });

        it("Should cap reward at MIN_REWARD_AFTER_HALVING in Pool mode", async function () {
            await quizGame.connect(owner).createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 1); // Pool mode
            const newQuestionId = await quizGame.nextQuestionId() - 1;

            // Move time forward enough for multiple halving cycles to reach minimum
            await time.increase(FOUR_YEARS * 8); 

            const minReward = await quizGame.MIN_REWARD_AFTER_HALVING();

            await quizGame.connect(addr1).submitAnswer(newQuestionId, CORRECT_ANSWER_HASH);
            await time.increase(BLOCK_DURATION_SECONDS + 1); 
            await quizGame.distributeRewards(newQuestionId);

            expect(await quizCoin.balanceOf(addr1.address)).to.equal(parseQZC(100000) + minReward);
        });

        it("Should NOT apply halving for level 100 in Pool mode", async function () {
            await quizGame.connect(owner).createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_100, 1); // Pool mode
            const newQuestionId = await quizGame.nextQuestionId() - 1;

            // Move time forward 4 years (1 halving cycle)
            await time.increase(FOUR_YEARS); 

            const expectedReward = parseQZC(10000); // Still 10000 QZC

            await quizGame.connect(addr1).submitAnswer(newQuestionId, CORRECT_ANSWER_HASH);
            await time.increase(BLOCK_DURATION_SECONDS + 1); 
            await quizGame.distributeRewards(newQuestionId);

            expect(await quizCoin.balanceOf(addr1.address)).to.equal(parseQZC(100000) + expectedReward);
        });
    });

    // --- NEW TESTS FOR DAILY LIMITATIONS ---
    describe("Daily Submission Limitations", function () {
        let soloQuestionId;
        let poolQuestionId;
        beforeEach(async function () {
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 0); // Solo Q1
            soloQuestionId = await quizGame.nextQuestionId() - 1;
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 1); // Pool Q2
            poolQuestionId = await quizGame.nextQuestionId() - 1;
        });

        it("Should prevent answering the same question twice in the same day", async function () {
            await quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH); // addr1 answers solo Q1
            await expect(quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH))
                .to.be.revertedWith("Quiz: You can only answer this specific question once per day.");
        });

        it("Should allow answering the same question again on a new day", async function () {
            await quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH); // addr1 answers solo Q1
            
            await time.increase(ONE_DAY + 1); // Move to next day

            // Create a new solo question for the new day
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 0);
            const newSoloQuestionId = await quizGame.nextQuestionId() - 1;

            // Now addr1 should be able to answer the NEW solo question
            await expect(quizGame.connect(addr1).submitAnswer(newSoloQuestionId, CORRECT_ANSWER_HASH))
                .to.not.be.reverted;
        });

        it("Should prevent playing a different mode on the same day", async function () {
            await quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH); // addr1 chooses Solo mode for today
            await expect(quizGame.connect(addr1).submitAnswer(poolQuestionId, CORRECT_ANSWER_HASH))
                .to.be.revertedWith("Quiz: You have already chosen a different game mode for today.");
        });

        it("Should allow playing a different mode on a new day", async function () {
            await quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH); // addr1 chooses Solo mode for today
            
            await time.increase(ONE_DAY + 1); // Move to next day

            // Create new pool question for the new day
            await quizGame.createQuestion(CORRECT_ANSWER_HASH, HINT_HASH, DIFFICULTY_LEVEL_50, 1);
            const newPoolQuestionId = await quizGame.nextQuestionId() - 1;

            // Now addr1 should be able to answer the NEW pool question (choosing Pool mode for this new day)
            await expect(quizGame.connect(addr1).submitAnswer(newPoolQuestionId, CORRECT_ANSWER_HASH))
                .to.not.be.reverted;
        });

        it("Should allow different users to play different modes on the same day", async function () {
            await expect(quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH))
                .to.not.be.reverted; // addr1 plays Solo
            await expect(quizGame.connect(addr2).submitAnswer(poolQuestionId, CORRECT_ANSWER_HASH))
                .to.not.be.reverted; // addr2 plays Pool
        });

        it("Should prevent a user from answering any question after a day ends, if no new question is created for that new day", async function () {
            await quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH); // addr1 answers solo Q1
            
            await time.increase(ONE_DAY + 1); // Move to next day

            // Try to answer the same solo question (which is now closed) - should revert
            await expect(quizGame.connect(addr1).submitAnswer(soloQuestionId, CORRECT_ANSWER_HASH))
                .to.be.revertedWith("Quiz: Question is already closed.");
            
            // If there's another solo question still open from previous days (unlikely in real scenario but for test)
            // It would still be prevented by "Quiz: You can only answer this specific question once per day."
            // unless we create a new question on the new day.
            // This test covers that the "old" solo question remains closed.
        });
    });

    // Add more tests for error handling, edge cases (e.g., no one answers in pool, incorrect roles)
    // For example, what if poolCorrectSolvers array is empty when distributeRewards is called?
    // What if a user tries to purchase a hint for a non-existent question?
});