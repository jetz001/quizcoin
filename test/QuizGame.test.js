const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("QuizGame Contract", function () {
    let QuizCoin, QuizGame, PoolManager;
    let quizCoin, quizGame, poolManager;
    let deployer, creator, player1, player2, rewardDistributor, anotherAccount;

    // Constants for testing
    // ใช้ ethers.parseUnits เพื่อแปลงค่าให้เป็น wei (18 decimal places)
    const ONE_QZC = ethers.parseUnits("1", 18);
    const TEN_QZC = ethers.parseUnits("10", 18);
    const FIFTY_QZC = ethers.parseUnits("50", 18);
    const ONE_HUNDRED_QZC = ethers.parseUnits("100", 18);
    const FIVE_THOUSAND_QZC = ethers.parseUnits("5000", 18);
    const TEN_THOUSAND_QZC = ethers.parseUnits("10000", 18);

    // Question details (example values)
    // ใช้ ethers.keccak256 เพื่อสร้าง hash ของคำตอบ/hint
    const CORRECT_ANSWER_HASH_1 = ethers.keccak256(ethers.toUtf8Bytes("answer123"));
    const HINT_HASH_1 = ethers.keccak256(ethers.toUtf8Bytes("hintForAnswer123"));
    const DIFFICULTY_LEVEL_1 = 50; // Difficulty for testing base reward
    const INCORRECT_ANSWER_HASH = ethers.keccak256(ethers.toUtf8Bytes("wrongAnswer"));

    const CORRECT_ANSWER_HASH_2 = ethers.keccak256(ethers.toUtf8Bytes("anotherAnswer"));
    const HINT_HASH_2 = ethers.keccak256(ethers.toUtf8Bytes("hintForAnotherAnswer"));
    const DIFFICULTY_LEVEL_2 = 100; // Difficulty for max reward

    // beforeEach hook จะรันก่อนแต่ละ Test Case เพื่อให้มั่นใจว่าทุก Test เริ่มต้นจากสถานะที่สะอาด
    beforeEach(async function () {
        // ดึง Signers (บัญชี) สำหรับการจำลองผู้ใช้งาน
        [deployer, creator, player1, player2, rewardDistributor, anotherAccount] = await ethers.getSigners();

        // --- Deploy QuizCoin Contract (Upgradeable) ---
        QuizCoin = await ethers.getContractFactory("QuizCoin");
        quizCoin = await upgrades.deployProxy(QuizCoin, [deployer.address], {
            initializer: "initialize",
            kind: "uups", // กำหนดชนิดของ Proxy เป็น UUPS
        });
        await quizCoin.waitForDeployment(); // รอให้สัญญาถูก Deploy เสร็จสมบูรณ์

        // --- Deploy PoolManager Contract (Upgradeable) ---
        // ส่ง ethers.ZeroAddress เป็น QuizGame address ชั่วคราวในตอนแรก เพื่อแก้ปัญหา Circular Dependency
        PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await upgrades.deployProxy(PoolManager, [quizCoin.target, deployer.address, ethers.ZeroAddress], {
            initializer: "initialize",
            kind: "uups",
        });
        await poolManager.waitForDeployment();

        // --- Deploy QuizGame Contract (Upgradeable) ---
        // ใช้ timestamp ปัจจุบันของบล็อกเป็น GAME_START_TIMESTAMP
        const currentBlock = await ethers.provider.getBlock("latest");
        const gameStartTimestamp = BigInt(currentBlock.timestamp);

        quizGame = await upgrades.deployProxy(QuizGame, [
            quizCoin.target, // ส่ง address ของ QuizCoin
            poolManager.target, // ส่ง address ของ PoolManager ที่ Deploy แล้ว
            deployer.address,   // _defaultAdmin
            gameStartTimestamp, // _gameStartTimestamp
        ], {
            initializer: "initialize",
            kind: "uups",
        });
        await quizGame.waitForDeployment();

        // --- ตั้งค่าความสัมพันธ์และ Roles ระหว่าง Contracts ---

        // 1. ตั้งค่า QuizGame address ที่ถูกต้องใน PoolManager (แก้ไข Circular Dependency)
        // ต้อง Re-initialize PoolManager ใหม่ใน Hardhat Network เพื่อตั้งค่า QuizGame address ที่ถูกต้อง
        // ในสภาพแวดล้อมจริง เราจะใช้ฟังก์ชัน setter แทน initialize อีกครั้ง
        await poolManager.connect(deployer).initialize(quizCoin.target, deployer.address, quizGame.target);

        // 2. มอบบทบาท MINTER_ROLE ให้ QuizGame ใน QuizCoin (เพื่อให้ QuizGame สร้างรางวัลได้)
        const MINTER_ROLE = await quizCoin.MINTER_ROLE(); // ดึงค่า bytes32 ของ MINTER_ROLE จากสัญญา
        await quizCoin.connect(deployer).grantRole(MINTER_ROLE, quizGame.target);

        // 3. มอบบทบาท BURNER_ROLE ให้ QuizGame ใน QuizCoin (ถ้า QuizGame จำเป็นต้องเผาโทเคน)
        const BURNER_ROLE = await quizCoin.BURNER_ROLE();
        await quizCoin.connect(deployer).grantRole(BURNER_ROLE, quizGame.target);

        // 4. มอบบทบาท GAME_ADMIN_ROLE_IN_POOL_MANAGER ให้ QuizGame ใน PoolManager (เพื่อให้ QuizGame ถอนรางวัลจาก Pool ได้)
        const GAME_ADMIN_ROLE_IN_POOL_MANAGER = await poolManager.GAME_ADMIN_ROLE_IN_POOL_MANAGER();
        await poolManager.connect(deployer).grantRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER, quizGame.target);

        // 5. ตั้งค่า Developer Fund Address ใน PoolManager
        await poolManager.connect(deployer).setDeveloperFundAddress(deployer.address);

        // 6. มอบบทบาท REWARD_DISTRIBUTOR_ROLE ให้กับบัญชี rewardDistributor ใน QuizGame
        const REWARD_DISTRIBUTOR_ROLE = await quizGame.REWARD_DISTRIBUTOR_ROLE();
        await quizGame.connect(deployer).grantRole(REWARD_DISTRIBUTOR_ROLE, rewardDistributor.address);

        // --- Mint QZC Tokens สำหรับการทดสอบ ---
        // Mint QZC ให้กับผู้เล่น (player1, player2) และ PoolManager
        await quizCoin.connect(deployer).mint(player1.address, ONE_HUNDRED_QZC);
        await quizCoin.connect(deployer).mint(player2.address, ONE_HUNDRED_QZC);
        await quizCoin.connect(deployer).mint(poolManager.target, TEN_THOUSAND_QZC); // Mint ให้ PoolManager พอสำหรับจ่ายรางวัล

        // --- Approve QZC สำหรับการซื้อ Hint ---
        // ผู้เล่นต้อง Approve ให้ QuizGame สามารถใช้ QZC ของตนได้ (สำหรับการซื้อ Hint)
        await quizCoin.connect(player1).approve(quizGame.target, ONE_HUNDRED_QZC);
        await quizCoin.connect(player2).approve(quizGame.target, ONE_HUNDRED_QZC);
    });

    // Deployment & Initialization Tests
    describe("Deployment & Initialization", function () {
        it("Should set the correct QuizCoin, PoolManager and initial state variables", async function () {
            expect(await quizGame.quizCoin()).to.equal(quizCoin.target);
            expect(await quizGame.poolManager()).to.equal(poolManager.target);
            expect(await quizGame.nextQuestionId()).to.equal(1);
            expect(await quizGame.GAME_START_TIMESTAMP()).to.not.equal(0);
        });

        it("Should assign DEFAULT_ADMIN_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await quizGame.DEFAULT_ADMIN_ROLE();
            expect(await quizGame.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
        });

        it("Should assign REWARD_DISTRIBUTOR_ROLE to specified account", async function () {
            const REWARD_DISTRIBUTOR_ROLE = await quizGame.REWARD_DISTRIBUTOR_ROLE();
            expect(await quizGame.hasRole(REWARD_DISTRIBUTOR_ROLE, rewardDistributor.address)).to.be.true;
        });

        it("PoolManager should have correct QuizCoin and QuizGame addresses", async function () {
            expect(await poolManager.quizCoin()).to.equal(quizCoin.target);
            expect(await poolManager.quizGameAddress()).to.equal(quizGame.target);
        });

        it("QuizGame should have MINTER_ROLE and BURNER_ROLE on QuizCoin", async function () {
            const MINTER_ROLE = await quizCoin.MINTER_ROLE();
            const BURNER_ROLE = await quizCoin.BURNER_ROLE();
            expect(await quizCoin.hasRole(MINTER_ROLE, quizGame.target)).to.be.true;
            expect(await quizCoin.hasRole(BURNER_ROLE, quizGame.target)).to.be.true;
        });

        it("QuizGame should have GAME_ADMIN_ROLE_IN_POOL_MANAGER on PoolManager", async function () {
            const GAME_ADMIN_ROLE_IN_POOL_MANAGER = await poolManager.GAME_ADMIN_ROLE_IN_POOL_MANAGER();
            expect(await poolManager.hasRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER, quizGame.target)).to.be.true;
        });
    });

    // Question Creation Tests
    describe("Question Creation", function () {
        it("Should allow a question to be created by any address", async function () {
            // คาดหวังว่าจะมีการ emit Event "QuestionCreated" พร้อมค่าที่ถูกต้อง
            await expect(quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_1, HINT_HASH_1, DIFFICULTY_LEVEL_1))
                .to.emit(quizGame, "QuestionCreated")
                .withArgs(1, creator.address, DIFFICULTY_LEVEL_1, FIVE_THOUSAND_QZC.mul(DIFFICULTY_LEVEL_1).div(99)); // ตรวจสอบการคำนวณรางวัล
            
            // ตรวจสอบสถานะของคำถามที่ถูกสร้างขึ้น
            const question = await quizGame.questions(1);
            expect(question.correctAnswerHash).to.equal(CORRECT_ANSWER_HASH_1);
            expect(question.hintHash).to.equal(HINT_HASH_1);
            expect(question.difficultyLevel).to.equal(DIFFICULTY_LEVEL_1);
            expect(question.questionCreator).to.equal(creator.address);
            expect(question.isClosed).to.be.false;
            expect(question.answerWindowStartTime).to.equal(0);
        });

        it("Should create questions with correct reward for difficulty 100", async function () {
            await expect(quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_2, HINT_HASH_2, DIFFICULTY_LEVEL_2))
                .to.emit(quizGame, "QuestionCreated")
                .withArgs(1, creator.address, DIFFICULTY_LEVEL_2, TEN_THOUSAND_QZC);

            const question = await quizGame.questions(1);
            expect(question.rewardAmount).to.equal(TEN_THOUSAND_QZC);
        });

        it("Should revert if difficulty level is invalid", async function () {
            await expect(quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_1, HINT_HASH_1, 0))
                .to.be.revertedWith("Quiz: Invalid difficulty level (1-100).");
            await expect(quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_1, HINT_HASH_1, 101))
                .to.be.revertedWith("Quiz: Invalid difficulty level (1-100).");
        });
    });

    // Answer Submission Tests
    describe("Answer Submission", function () {
        // สร้างคำถามก่อนเริ่มแต่ละ Test Case ในบล็อกนี้
        beforeEach(async function () {
            await quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_1, HINT_HASH_1, DIFFICULTY_LEVEL_1);
        });

        it("Should allow a player to submit a correct answer and start the window", async function () {
            const initialBalancePlayer1 = await quizCoin.balanceOf(player1.address);
            expect(initialBalancePlayer1).to.equal(ONE_HUNDRED_QZC);

            // คาดหวังการ emit Event "AnswerSubmitted" และ "QuestionRewardWindowStarted"
            await expect(quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1))
                .to.emit(quizGame, "AnswerSubmitted")
                .withArgs(1, player1.address, CORRECT_ANSWER_HASH_1)
                .and.to.emit(quizGame, "QuestionRewardWindowStarted");

            const question = await quizGame.questions(1);
            expect(question.answerWindowStartTime).to.not.equal(0);
            expect(question.correctAnswersInWindow.length).to.equal(1);
            expect(question.correctAnswersInWindow[0]).to.equal(player1.address);
            // ตรวจสอบ getter function getHasAnsweredInWindow
            expect(await quizGame.getHasAnsweredInWindow(1, player1.address)).to.be.true;
        });

        it("Should allow multiple players to submit correct answers within the window", async function () {
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1);
            
            // จำลองการเพิ่มเวลาเพื่อให้อยู่ภายใน Answer Window
            await ethers.provider.send("evm_increaseTime", [60]); // เพิ่มเวลาไป 60 วินาที
            await ethers.provider.send("evm_mine"); // ขุดบล็อกใหม่เพื่อยืนยันเวลา

            await expect(quizGame.connect(player2).submitAnswer(1, CORRECT_ANSWER_HASH_1))
                .to.emit(quizGame, "AnswerSubmitted")
                .withArgs(1, player2.address, CORRECT_ANSWER_HASH_1);

            const question = await quizGame.questions(1);
            expect(question.correctAnswersInWindow.length).to.equal(2);
            expect(question.correctAnswersInWindow[1]).to.equal(player2.address);
            expect(await quizGame.getHasAnsweredInWindow(1, player2.address)).to.be.true;
        });

        it("Should revert if answer is incorrect", async function () {
            await expect(quizGame.connect(player1).submitAnswer(1, INCORRECT_ANSWER_HASH))
                .to.be.revertedWith("Quiz: Incorrect answer.");
        });

        it("Should revert if question does not exist", async function () {
            await expect(quizGame.connect(player1).submitAnswer(99, CORRECT_ANSWER_HASH_1))
                .to.be.revertedWith("Quiz: Question does not exist.");
        });

        it("Should revert if question is closed", async function () {
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1);
            // จำลองการปิดคำถาม (เช่น หลังจากมีการกระจายรางวัลไปแล้ว)
            await ethers.provider.send("evm_increaseTime", [3 * 60 + 1]); // ผ่าน Answer Window
            await ethers.provider.send("evm_mine");
            await quizGame.connect(rewardDistributor).distributeRewards(1); // กระจายรางวัลและปิดคำถาม

            await expect(quizGame.connect(player2).submitAnswer(1, CORRECT_ANSWER_HASH_1))
                .to.be.revertedWith("Quiz: Question is already closed.");
        });

        it("Should revert if player already answered correctly in this window", async function () {
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1);
            await expect(quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1))
                .to.be.revertedWith("Quiz: You have already submitted a correct answer in this round.");
        });

        it("Should revert if answer window has closed", async function () {
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1);
            await ethers.provider.send("evm_increaseTime", [3 * 60 + 1]); // ผ่าน Answer Window (3 นาที + 1 วินาที)
            await ethers.provider.send("evm_mine");

            await expect(quizGame.connect(player2).submitAnswer(1, CORRECT_ANSWER_HASH_1))
                .to.be.revertedWith("Quiz: Answer window has closed for this question.");
        });
    });

    // Hint Purchase Tests
    describe("Hint Purchase", function () {
        beforeEach(async function () {
            await quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_1, HINT_HASH_1, DIFFICULTY_LEVEL_1);
        });

        it("Should allow a player to purchase a hint by paying QZC", async function () {
            const initialPlayer1Balance = await quizCoin.balanceOf(player1.address);
            const initialPoolManagerBalance = await quizCoin.balanceOf(poolManager.target);

            // คาดหวังการ emit Event "HintPurchased" พร้อมค่าที่ถูกต้อง
            await expect(quizGame.connect(player1).purchaseHint(1))
                .to.emit(quizGame, "HintPurchased")
                .withArgs(1, player1.address, TEN_QZC); // HINT_COST_AMOUNT คือ 10 QZC

            // ตรวจสอบยอดคงเหลือของ QZC หลังจากการซื้อ
            expect(await quizCoin.balanceOf(player1.address)).to.equal(initialPlayer1Balance.sub(TEN_QZC));
            expect(await quizCoin.balanceOf(poolManager.target)).to.equal(initialPoolManagerBalance.add(TEN_QZC));
        });

        it("Should revert if player does not have enough QZC", async function () {
            // ลด QZC ของ player1 ให้เหลือน้อยกว่า 10 QZC
            await quizCoin.connect(player1).transfer(anotherAccount.address, ONE_HUNDRED_QZC.sub(TEN_QZC).add(ONE_QZC));
            await expect(quizGame.connect(player1).purchaseHint(1))
                .to.be.revertedWith("Quiz: QZC transfer failed for hint purchase.");
        });

        it("Should revert if player has not approved QuizGame to spend QZC", async function () {
            // ยกเลิกการ Approve ของ player2
            await quizCoin.connect(player2).approve(quizGame.target, 0); 
            await expect(quizGame.connect(player2).purchaseHint(1))
                .to.be.revertedWith("Quiz: QZC transfer failed for hint purchase.");
        });

        it("Should allow getting the hint after purchasing", async function () {
            await quizGame.connect(player1).purchaseHint(1);
            const hint = await quizGame.connect(player1).getHint(1);
            expect(hint).to.equal(HINT_HASH_1);
        });

        it("Should revert if getting hint for non-existent question", async function () {
            await expect(quizGame.connect(player1).getHint(99))
                .to.be.revertedWith("Quiz: Question does not exist.");
        });
    });

    // Reward Distribution Tests
    describe("Reward Distribution", function () {
        let questionRewardAmount;

        beforeEach(async function () {
            await quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_1, HINT_HASH_1, DIFFICULTY_LEVEL_1);
            const question = await quizGame.questions(1);
            questionRewardAmount = question.rewardAmount; // ดึงจำนวนรางวัลของคำถาม

            // player1 ส่งคำตอบที่ถูกต้อง
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1);
            
            // จำลองการเพิ่มเวลาให้เลย Answer Window ไปแล้ว
            await ethers.provider.send("evm_increaseTime", [3 * 60 + 1]); // 3 นาที + 1 วินาที
            await ethers.provider.send("evm_mine"); // ขุดบล็อกใหม่
        });

        it("Should allow REWARD_DISTRIBUTOR_ROLE to distribute rewards to one correct answerer", async function () {
            const initialPlayer1Balance = await quizCoin.balanceOf(player1.address);
            const initialPoolManagerBalance = await quizCoin.balanceOf(poolManager.target);

            await expect(quizGame.connect(rewardDistributor).distributeRewards(1))
                .to.emit(quizGame, "RewardDistributed")
                .withArgs(1, player1.address, questionRewardAmount) // ผู้รับคนเดียว ได้รับรางวัลเต็ม
                .and.to.emit(quizGame, "QuestionClosed"); // คำถามควรจะถูกปิด

            // ตรวจสอบยอดคงเหลือของ player1 และ PoolManager
            expect(await quizCoin.balanceOf(player1.address)).to.equal(initialPlayer1Balance.add(questionRewardAmount));
            expect(await quizCoin.balanceOf(poolManager.target)).to.equal(initialPoolManagerBalance.sub(questionRewardAmount));

            const question = await quizGame.questions(1);
            expect(question.isClosed).to.be.true;
            // Array ของ correctAnswersInWindow ควรจะถูกล้างหลังจากกระจายรางวัล
            expect((await quizGame.getQuestionDetails(1)).numCorrectAnswerers).to.equal(0);
        });

        it("Should distribute rewards evenly among multiple correct answerers", async function () {
            // player2 ส่งคำตอบที่ถูกต้องภายใน Answer Window (ต้องย้อนเวลาเพื่อให้ submit ได้ทัน)
            await ethers.provider.send("evm_increaseTime", [-3 * 60]); // ย้อนเวลากลับไป
            await ethers.provider.send("evm_mine");
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1); // submit อีกครั้งเพื่อให้ window เริ่มใหม่
            await quizGame.connect(player2).submitAnswer(1, CORRECT_ANSWER_HASH_1);

            // เลื่อนเวลาไปข้างหน้าอีกครั้งให้พ้น Answer Window
            await ethers.provider.send("evm_increaseTime", [3 * 60 + 1]);
            await ethers.provider.send("evm_mine");

            const initialPlayer1Balance = await quizCoin.balanceOf(player1.address);
            const initialPlayer2Balance = await quizCoin.balanceOf(player2.address);
            const initialPoolManagerBalance = await quizCoin.balanceOf(poolManager.target);

            const rewardPerPerson = questionRewardAmount / BigInt(2); // มี 2 คนตอบถูก

            await expect(quizGame.connect(rewardDistributor).distributeRewards(1))
                .to.emit(quizGame, "RewardDistributed")
                .withArgs(1, player1.address, rewardPerPerson)
                .and.to.emit(quizGame, "RewardDistributed")
                .withArgs(1, player2.address, rewardPerPerson)
                .and.to.emit(quizGame, "QuestionClosed");

            expect(await quizCoin.balanceOf(player1.address)).to.equal(initialPlayer1Balance.add(rewardPerPerson));
            expect(await quizCoin.balanceOf(player2.address)).to.equal(initialPlayer2Balance.add(rewardPerPerson));
            expect(await quizCoin.balanceOf(poolManager.target)).to.equal(initialPoolManagerBalance.sub(questionRewardAmount));
        });

        it("Should revert if called by non-REWARD_DISTRIBUTOR_ROLE", async function () {
            await expect(quizGame.connect(player1).distributeRewards(1))
                .to.be.revertedWith(/AccessControl: account .* is missing role .*/); // ตรวจสอบข้อความ error ของ OpenZeppelin AccessControl
        });

        it("Should revert if answer window is not over yet", async function () {
            await ethers.provider.send("evm_increaseTime", [-3 * 60]); // ย้อนเวลากลับไปอยู่ใน window
            await ethers.provider.send("evm_mine");
            await expect(quizGame.connect(rewardDistributor).distributeRewards(1))
                .to.be.revertedWith("Quiz: Reward distribution window is not over yet.");
        });

        it("Should revert if no one answered correctly", async function () {
            // สร้างคำถามใหม่ที่ไม่มีใครตอบถูก
            await quizGame.connect(deployer).createQuestion(CORRECT_ANSWER_HASH_2, HINT_HASH_2, 50);
            await ethers.provider.send("evm_increaseTime", [3 * 60 + 1]);
            await ethers.provider.send("evm_mine");

            await expect(quizGame.connect(rewardDistributor).distributeRewards(2)) // ใช้ question ID 2
                .to.be.revertedWith("Quiz: No correct answers found in the window.");
        });

        it("Should revert if question is already closed", async function () {
            await quizGame.connect(rewardDistributor).distributeRewards(1); // กระจายรางวัลครั้งแรก
            await expect(quizGame.connect(rewardDistributor).distributeRewards(1))
                .to.be.revertedWith("Quiz: Rewards already distributed or question closed.");
        });

        it("Should revert if insufficient pool balance", async function () {
            // ถอนเงินออกจาก Pool Manager ทั้งหมด เพื่อให้ยอดคงเหลือไม่พอจ่ายรางวัล
            const currentPoolBalance = await quizCoin.balanceOf(poolManager.target);
            await poolManager.connect(deployer).withdrawToDeveloperFund(currentPoolBalance);

            await expect(quizGame.connect(rewardDistributor).distributeRewards(1))
                .to.be.revertedWith("Quiz: Insufficient pool balance for rewards.");
        });
    });

    // Halving Logic Test (แนะนำ)
    // ทดสอบกลไก Halving ของรางวัล
    describe("Halving Mechanism", function () {
        it("Reward should be halved after one HALVING_PERIOD", async function () {
            // เนื่องจาก beforeEach จะสร้างคำถามแรกเสมอ เราจะใช้คำถามที่ 1 เป็นฐาน
            // และคำถามที่ 2 เพื่อทดสอบ Halving
            
            // ให้มั่นใจว่ามีคำถามที่ 1 ถูกสร้างแล้วจาก beforeEach
            const initialQuestion = await quizGame.questions(1);
            const initialReward = initialQuestion.rewardAmount; 
            
            // เลื่อนเวลาไป 1 HALVING_PERIOD + 1 วินาที
            const HALVING_PERIOD = await quizGame.HALVING_PERIOD();
            await ethers.provider.send("evm_increaseTime", [Number(HALVING_PERIOD) + 1]);
            await ethers.provider.send("evm_mine");

            // สร้างคำถามใหม่ (ID 2) ด้วย difficulty เดิม
            await quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_2, HINT_HASH_2, DIFFICULTY_LEVEL_1);
            const newQuestion = await quizGame.questions(2);
            const newReward = newQuestion.rewardAmount;

            // รางวัลของคำถามใหม่ควรจะเป็นครึ่งหนึ่งของรางวัลตั้งต้น
            expect(newReward).to.equal(initialReward.div(2));
        });

        it("Reward should be quartered after two HALVING_PERIODs", async function () {
            const initialQuestion = await quizGame.questions(1);
            const initialReward = initialQuestion.rewardAmount;
            
            // เลื่อนเวลาไป 2 HALVING_PERIODs + 1 วินาที
            const HALVING_PERIOD = await quizGame.HALVING_PERIOD();
            await ethers.provider.send("evm_increaseTime", [Number(HALVING_PERIOD) * 2 + 1]);
            await ethers.provider.send("evm_mine");

            // สร้างคำถามใหม่ (ID 2) ด้วย difficulty เดิม
            await quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_2, HINT_HASH_2, DIFFICULTY_LEVEL_1);
            const newQuestion = await quizGame.questions(2);
            const newReward = newQuestion.rewardAmount;

            // รางวัลของคำถามใหม่ควรจะเป็นหนึ่งในสี่ของรางวัลตั้งต้น
            expect(newReward).to.equal(initialReward.div(4));
        });
    });

    // Getter Functions Tests
    // ทดสอบฟังก์ชัน Getter ต่างๆ เพื่อให้มั่นใจว่าดึงข้อมูลได้ถูกต้อง
    describe("Getter Functions", function () {
        beforeEach(async function () {
            await quizGame.connect(creator).createQuestion(CORRECT_ANSWER_HASH_1, HINT_HASH_1, DIFFICULTY_LEVEL_1);
        });

        it("Should return correct question details before any answer", async function () {
            const details = await quizGame.getQuestionDetails(1);
            expect(details.correctAnswerHash).to.equal(CORRECT_ANSWER_HASH_1);
            expect(details.hintHash).to.equal(HINT_HASH_1);
            expect(details.difficultyLevel).to.equal(DIFFICULTY_LEVEL_1);
            expect(details.questionCreator).to.equal(creator.address);
            expect(details.isClosed).to.be.false;
            expect(details.answerWindowStartTime).to.equal(0);
            expect(details.numCorrectAnswerers).to.equal(0);
            expect(details.isRewardWindowActive).to.be.false;
            expect(details.rewardWindowEndTime).to.equal(0);
        });

        it("Should return correct question details during answer window", async function () {
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1);
            const details = await quizGame.getQuestionDetails(1);
            expect(details.numCorrectAnswerers).to.equal(1);
            expect(details.answerWindowStartTime).to.not.equal(0);
            expect(details.isRewardWindowActive).to.be.true; // ควรจะ active
            expect(details.rewardWindowEndTime).to.equal(details.answerWindowStartTime + await quizGame.ANSWER_WINDOW_DURATION());
        });

        it("Should return correct question details after answer window and closed", async function () {
            await quizGame.connect(player1).submitAnswer(1, CORRECT_ANSWER_HASH_1);
            await ethers.provider.send("evm_increaseTime", [3 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            await quizGame.connect(rewardDistributor).distributeRewards(1);

            const details = await quizGame.getQuestionDetails(1);
            expect(details.isClosed).to.be.true;
            expect(details.numCorrectAnswerers).to.equal(0); // ควรรีเซ็ตหลังจากกระจายรางวัล
            expect(details.isRewardWindowActive).to.be.false; // ไม่ควร active แล้ว
        });
    });
});