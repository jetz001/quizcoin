// test/QuizGame.test.js
const { expect } = require("chai");
const { ethers, upgrades, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// กำหนดชุดการทดสอบสำหรับสัญญา QuizGame
describe("การทดสอบสัญญา QuizGame", function () {
    let QuizCoin;
    let quizCoin;
    let PoolManager;
    let poolManager;
    let QuizGame;
    let quizGame;
    let deployer; 
    let player1;  
    let player2;  
    let rewardDistributor; 
    let adminRole;
    let minterRole;
    let poolManagerRole;
    let REWARD_DISTRIBUTOR_ROLE_QUIZGAME;

    // กำหนดค่าเริ่มต้นสำหรับทดสอบ
    const INITIAL_SUPPLY_DEPLOYER = ethers.parseEther("2000000"); 
    const INITIAL_POOL_SUPPLY = ethers.parseEther("1000000");    
    
    let HINT_COST; 
    let BASE_REWARD_MULTIPLIER; 
    let MAX_REWARD_FOR_100_DIFFICULITY; 
    let ANSWER_WINDOW_DURATION; 
    let GAME_START_TIMESTAMP; 
    let HALVING_PERIOD; 
    const DIFFICULTY_DIVISOR = BigInt(99); 

    // Helper function to calculate hash
    function keccak256Hash(input) {
        return ethers.keccak256(ethers.toUtf8Bytes(input));
    }

    // ฟังก์ชันสำหรับตั้งค่าสภาพแวดล้อมการทดสอบทั้งหมด
    async function setupTestEnvironment() {
        [deployer, player1, player2, rewardDistributor] = await ethers.getSigners();

        // Get contract factories
        QuizCoin = await ethers.getContractFactory("QuizCoin");
        PoolManager = await ethers.getContractFactory("PoolManager");
        QuizGame = await ethers.getContractFactory("QuizGame");

        // Deploy QuizCoin
        quizCoin = await upgrades.deployProxy(QuizCoin, [deployer.address], {
            initializer: "initialize",
            kind: "uups",
        });
        await quizCoin.waitForDeployment();

        // Deploy PoolManager
        poolManager = await upgrades.deployProxy(
            PoolManager,
            [quizCoin.target, deployer.address, deployer.address], 
            {
                initializer: "initialize",
                kind: "uups",
            }
        );
        await poolManager.waitForDeployment();

        // ได้รับ block.timestamp ปัจจุบันสำหรับ GAME_START_TIMESTAMP
        const currentBlock = await ethers.provider.getBlock("latest");
        const initialGameStartTimestamp = BigInt(currentBlock.timestamp); 

        // Deploy QuizGame
        quizGame = await upgrades.deployProxy(
            QuizGame,
            [quizCoin.target, poolManager.target, deployer.address, initialGameStartTimestamp], 
            {
                initializer: "initialize",
            }
        );
        await quizGame.waitForDeployment();

        // Get roles bytes32
        adminRole = await quizCoin.DEFAULT_ADMIN_ROLE();
        minterRole = await quizCoin.MINTER_ROLE();
        poolManagerRole = await poolManager.POOL_MANAGER_ROLE();
        REWARD_DISTRIBUTOR_ROLE_QUIZGAME = await quizGame.REWARD_DISTRIBUTOR_ROLE(); 

        // ดึงค่าคงที่จากสัญญา QuizGame
        HINT_COST = await quizGame.HINT_COST_AMOUNT();
        BASE_REWARD_MULTIPLIER = await quizGame.BASE_REWARD_MULTIPLIER();
        MAX_REWARD_FOR_100_DIFFICULITY = await quizGame.MAX_REWARD_FOR_100_DIFFICULTY();
        ANSWER_WINDOW_DURATION = await quizGame.ANSWER_WINDOW_DURATION();
        GAME_START_TIMESTAMP = await quizGame.GAME_START_TIMESTAMP(); 
        HALVING_PERIOD = await quizGame.HALVING_PERIOD(); 

        // Setup roles and initial supply (as in deploy script)
        await quizCoin.connect(deployer).grantRole(minterRole, quizGame.target);
        await quizCoin.connect(deployer).mint(deployer.address, INITIAL_SUPPLY_DEPLOYER);
        await quizCoin.connect(deployer).revokeRole(minterRole, deployer.address);

        // โอนเหรียญ QZC บางส่วนไปยัง PoolManager
        await quizCoin.connect(deployer).approve(poolManager.target, INITIAL_POOL_SUPPLY);
        await poolManager.connect(deployer).deposit(INITIAL_POOL_SUPPLY);

        // ตั้งค่า QuizGame address ใน PoolManager (และจะ grant POOL_MANAGER_ROLE ให้ QuizGame ที่นี่)
        await poolManager.connect(deployer).setQuizGameAddress(quizGame.target);
        
        // ให้บัญชี rewardDistributor มีสิทธิ์ REWARD_DISTRIBUTOR_ROLE ใน QuizGame
        await quizGame.connect(deployer).grantRole(REWARD_DISTRIBUTOR_ROLE_QUIZGAME, rewardDistributor.address);

        // Mint QZC ให้ player1 และ player2 สำหรับการซื้อ Hint และอื่นๆ
        await quizCoin.connect(deployer).grantRole(minterRole, deployer.address); 
        await quizCoin.connect(deployer).mint(player1.address, ethers.parseEther("10000")); 
        await quizCoin.connect(deployer).mint(player2.address, ethers.parseEther("10000")); 
        await quizCoin.connect(deployer).revokeRole(minterRole, deployer.address); 
    }

    // `beforeEach` hook: ทำงานหนึ่งครั้งก่อนที่การทดสอบแต่ละครั้งใน describe block จะเริ่ม
    // ใช้สำหรับ deploy สัญญาและตั้งค่าเริ่มต้นที่จำเป็น และรีเซ็ต Hardhat Network
    beforeEach(async function () {
        await network.provider.send("hardhat_reset", []); 
        await setupTestEnvironment(); 
    });

    // กลุ่มการทดสอบ: สถานะเริ่มต้นและการ Deploy
    describe("สถานะเริ่มต้นและการ Deploy", function () {
        it("ควรอัปโหลดสัญญาได้ถูกต้องทั้งหมด", async function () {
            expect(quizCoin.target).to.not.equal(ethers.ZeroAddress);
            expect(poolManager.target).to.not.equal(ethers.ZeroAddress);
            expect(quizGame.target).to.not.equal(ethers.ZeroAddress);
        });

        it("QuizCoin ควรมีการเชื่อมโยงที่ถูกต้อง", async function () {
            expect(await quizCoin.hasRole(minterRole, quizGame.target)).to.be.true;
            expect(await quizCoin.balanceOf(deployer.address)).to.equal(INITIAL_SUPPLY_DEPLOYER - INITIAL_POOL_SUPPLY);
            expect(await quizCoin.balanceOf(poolManager.target)).to.equal(INITIAL_POOL_SUPPLY);
        });

        it("PoolManager ควรมีการเชื่อมโยงที่ถูกต้อง", async function () {
            expect(await poolManager.quizCoin()).to.equal(quizCoin.target);
            expect(await poolManager.i_quizGameAddress()).to.equal(quizGame.target);
            expect(await poolManager.hasRole(poolManagerRole, quizGame.target)).to.be.true;
        });

        it("QuizGame ควรมีการเชื่อมโยงและ Role ที่ถูกต้อง", async function () {
            expect(await quizGame.quizCoin()).to.equal(quizCoin.target);
            expect(await quizGame.poolManager()).to.equal(poolManager.target);
            expect(await quizGame.nextQuestionId()).to.equal(BigInt(1));
            expect(await quizGame.hasRole(REWARD_DISTRIBUTOR_ROLE_QUIZGAME, rewardDistributor.address)).to.be.true;
            expect(await quizGame.HINT_COST_AMOUNT()).to.equal(ethers.parseEther("10"));
            expect(await quizGame.BASE_REWARD_MULTIPLIER()).to.equal(ethers.parseEther("5000"));
            expect(await quizGame.MAX_REWARD_FOR_100_DIFFICULTY()).to.equal(ethers.parseEther("10000"));
        });
    });

    // กลุ่มการทดสอบ: การสร้างคำถาม
    describe("การสร้างคำถาม", function () {
        it("ควรอนุญาตให้ใครก็ได้สร้างคำถาม", async function () {
            const correctAnswerHash = keccak256Hash("คำตอบที่1");
            const hintHash = keccak256Hash("คำใบ้ที่1");
            const difficulty = 50;

            const expectedReward = (BASE_REWARD_MULTIPLIER * BigInt(difficulty)) / DIFFICULTY_DIVISOR;

            const nextIdBeforeCreate = await quizGame.nextQuestionId(); 

            await expect(quizGame.connect(player1).createQuestion(correctAnswerHash, hintHash, difficulty))
                .to.emit(quizGame, "QuestionCreated")
                .withArgs(nextIdBeforeCreate, player1.address, BigInt(difficulty), expectedReward); 

            const question = await quizGame.questions(nextIdBeforeCreate); 
            expect(question.correctAnswerHash).to.equal(correctAnswerHash);
            expect(question.hintHash).to.equal(hintHash);
            expect(question.difficultyLevel).to.equal(BigInt(difficulty));
            expect(question.questionCreator).to.equal(player1.address);
            expect(question.isClosed).to.be.false;
            const details = await quizGame.getQuestionDetails(nextIdBeforeCreate);
            expect(details.numCorrectAnswerers).to.equal(0);
            expect(await quizGame.nextQuestionId()).to.equal(nextIdBeforeCreate + BigInt(1));
        });

        it("ควรคำนวณจำนวนรางวัลสำหรับความยากระดับ 100 ได้อย่างถูกต้อง", async function () {
            const correctAnswerHash = keccak256Hash("คำตอบที่2");
            const hintHash = keccak256Hash("คำใบ้ที่2");
            const difficulty = 100;

            const expectedReward = MAX_REWARD_FOR_100_DIFFICULITY;

            const nextIdBeforeCreate = await quizGame.nextQuestionId();
            await quizGame.connect(player1).createQuestion(correctAnswerHash, hintHash, difficulty);
            const question = await quizGame.questions(nextIdBeforeCreate);
            expect(question.rewardAmount).to.equal(expectedReward);
        });

        it("ควร revert หากระดับความยากอยู่นอกช่วง", async function () {
            const correctAnswerHash = keccak256Hash("คำตอบที่3");
            const hintHash = keccak256Hash("คำใบ้ที่3");

            await expect(quizGame.connect(player1).createQuestion(correctAnswerHash, hintHash, BigInt(0)))
                .to.be.revertedWith("Quiz: Invalid difficulty level (1-100).");
            await expect(quizGame.connect(player1).createQuestion(correctAnswerHash, hintHash, BigInt(101)))
                .to.be.revertedWith("Quiz: Invalid difficulty level (1-100).");
        });
    });

    // กลุ่มการทดสอบ: การซื้อ Hint
    describe("การซื้อ Hint", function () {
        let questionId;
        let correctAnswerHash, hintHash, difficulty;

        beforeEach(async function () { 
            correctAnswerHash = keccak256Hash("hinttestanswer");
            hintHash = keccak256Hash("thisisatesthint");
            difficulty = 30;
            const tx = await quizGame.connect(deployer).createQuestion(correctAnswerHash, hintHash, difficulty);
            const receipt = await tx.wait();
            questionId = (await quizGame.nextQuestionId()) - BigInt(1); 
        });

        it("ควรอนุญาตให้ผู้เล่นซื้อ Hint และโอน QZC ไปยัง PoolManager", async function () {
            const player1InitialBalance = await quizCoin.balanceOf(player1.address);
            const poolManagerInitialBalance = await quizCoin.balanceOf(poolManager.target);

            await quizCoin.connect(player1).approve(quizGame.target, HINT_COST);

            await expect(quizGame.connect(player1).purchaseHint(questionId))
                .to.emit(quizGame, "HintPurchased")
                .withArgs(questionId, player1.address, HINT_COST);

            expect(await quizCoin.balanceOf(player1.address)).to.equal(player1InitialBalance - HINT_COST);
            expect(await quizCoin.balanceOf(poolManager.target)).to.equal(poolManagerInitialBalance + HINT_COST);
        });

        it("ควรอนุญาตให้ผู้เล่นดึง Hint ได้หลังจากซื้อไปแล้ว", async function () {
            expect(await quizGame.connect(player1).getHint(questionId)).to.equal(keccak256Hash("thisisatesthint"));
        });

        it("ควร revert หาก QZC transfer fails for hint purchase", async function () {
            await expect(quizGame.connect(player2).purchaseHint(questionId))
                .to.be.revertedWithCustomError(quizCoin, "ERC20InsufficientAllowance");
        });

        it("ควร revert หาก hint is purchased for non-existent question", async function () {
            await expect(quizGame.connect(player1).purchaseHint(BigInt(999))).to.be.revertedWith("Quiz: Question does not exist.");
        });
    });

    // กลุ่มการทดสอบ: การส่งคำตอบและการกระจายรางวัล
    describe("การส่งคำตอบและการกระจายรางวัล", function () {
        this.timeout(100000); 

        let questionId1; 
        let questionId2; 

        beforeEach(async function () { 
            await network.provider.send("hardhat_reset", []); 
            await setupTestEnvironment(); 

            // สร้างคำถาม 1: สำหรับผู้ตอบคนเดียว
            let correctAnswerHash1 = keccak256Hash("singleanswer");
            let hintHash1 = keccak256Hash("singlehint");
            let difficulty1 = 70;
            let tx1 = await quizGame.connect(deployer).createQuestion(correctAnswerHash1, hintHash1, difficulty1); 
            let receipt1 = await tx1.wait();
            questionId1 = (await quizGame.nextQuestionId()) - BigInt(1);

            // สร้างคำถาม 2: สำหรับผู้ตอบหลายคน
            let correctAnswerHash2 = keccak256Hash("multianswer");
            let hintHash2 = keccak256Hash("multihint");
            let difficulty2 = 60;
            let tx2 = await quizGame.connect(deployer).createQuestion(correctAnswerHash2, hintHash2, difficulty2); 
            let receipt2 = await tx2.wait();
            questionId2 = (await quizGame.nextQuestionId()) - BigInt(1);

            // *** เพิ่มตรงนี้สำหรับ Test Case: "Should revert if user already submitted correct answer in window" ***
            // ทำให้ player1 ตอบคำถาม questionId2 ไปแล้ว เพื่อให้การเรียกซ้ำ revert
            await quizGame.connect(player1).submitAnswer(questionId2, keccak256Hash("multianswer"));
        });

        it("ควรอนุญาตให้ผู้ตอบถูกคนแรกเริ่ม window การตอบ", async function () {
            // NOTE: questionId1 ถูกสร้างใน beforeEach แต่ยังไม่มีใครตอบ
            const tx = await quizGame.connect(player1).submitAnswer(questionId1, keccak256Hash("singleanswer"));
            const receipt = await tx.wait();
            const txTimestamp = BigInt((await ethers.provider.getBlock(receipt.blockNumber)).timestamp);

            await expect(tx)
                .to.emit(quizGame, "AnswerSubmitted")
                .withArgs(questionId1, player1.address, keccak256Hash("singleanswer"))
                .and.to.emit(quizGame, "QuestionRewardWindowStarted")
                .withArgs(questionId1, txTimestamp, txTimestamp + ANSWER_WINDOW_DURATION);

            const questionDetails = await quizGame.getQuestionDetails(questionId1);
            expect(questionDetails.answerWindowStartTime).to.be.above(BigInt(0));
            expect(questionDetails.numCorrectAnswerers).to.equal(BigInt(1)); 
            
            // แก้ไขตรงนี้: เรียกใช้ getter function ในสัญญา Solidity
            expect(await quizGame.getHasAnsweredInWindow(questionId1, player1.address)).to.be.true;
        });

        it("ควรอนุญาตให้ผู้ตอบถูกหลายคนตอบภายใน window เดียวกัน", async function () {
            // NOTE: player1 ได้ตอบ questionId2 ไปแล้วใน beforeEach ของกลุ่มนี้
            // ดังนั้น player2 เป็นคนถัดไปที่ตอบถูกใน window เดียวกัน
            await expect(quizGame.connect(player2).submitAnswer(questionId2, keccak256Hash("multianswer")))
                .to.emit(quizGame, "AnswerSubmitted")
                .withArgs(questionId2, player2.address, keccak256Hash("multianswer"));

            const questionDetails = await quizGame.getQuestionDetails(questionId2);
            expect(questionDetails.numCorrectAnswerers).to.equal(BigInt(2));
            
            // แก้ไขตรงนี้: เรียกใช้ getter function ในสัญญา Solidity
            expect(await quizGame.getHasAnsweredInWindow(questionId2, player1.address)).to.be.true;
            expect(await quizGame.getHasAnsweredInWindow(questionId2, player2.address)).to.be.true;
        });

        it("Should revert if incorrect answer is submitted", async function () {
            await expect(quizGame.connect(player1).submitAnswer(questionId1, keccak256Hash("wronganswer")))
                .to.be.revertedWith("Quiz: Incorrect answer.");
        });

        it("Should revert if question does not exist", async function () {
            await expect(quizGame.connect(player1).submitAnswer(BigInt(999), keccak256Hash("someanswer")))
                .to.be.revertedWith("Quiz: Question does not exist.");
        });

        it("Should revert if user already submitted correct answer in window", async function () {
            // เนื่องจาก beforeEach ได้ทำให้ player1 ตอบ questionId2 ไปแล้ว
            // การเรียก submitAnswer ซ้ำจาก player1 ควรจะ revert
            await expect(quizGame.connect(player1).submitAnswer(questionId2, keccak256Hash("multianswer")))
                .to.be.revertedWith("Quiz: You have already submitted a correct answer in this round.");
        });

        it("Should allow REWARD_DISTRIBUTOR_ROLE to distribute rewards after window closes (single answerer)", async function () {
            // สมมติว่า questionId1 มีคนตอบถูกเพียงคนเดียวจาก beforeEach แล้ว
            // ต้องทำให้ window ปิดก่อน
            const questionDetailsBeforeAnswer = await quizGame.getQuestionDetails(questionId1);
            const initialPlayer1Balance = await quizCoin.balanceOf(player1.address);
            const expectedReward = questionDetailsBeforeAnswer.rewardAmount;
            const initialPoolBalance = await quizCoin.balanceOf(poolManager.target);

            // ส่งคำตอบเพื่อเริ่ม window (ถ้ายังไม่ได้ทำใน beforeEach ของกลุ่มนี้)
            // สำหรับ test case นี้ จะต้องมั่นใจว่า player1 ได้ตอบแล้ว (ซึ่งจะเริ่ม window)
            // เราอาจต้องส่ง player1.submitAnswer(questionId1, keccak256Hash("singleanswer")); ที่นี่
            // แต่เนื่องจากคุณใช้ beforeEach ในกลุ่มหลัก และ beforeEach ในกลุ่มย่อยก็เรียก setupTestEnvironment
            // มันจะรีเซ็ตทุกอย่าง ดังนั้นต้องทำให้แน่ใจว่า player1 ได้ตอบคำถาม questionId1 ใน test case นี้เอง
            await quizGame.connect(player1).submitAnswer(questionId1, keccak256Hash("singleanswer")); // <-- เพิ่มตรงนี้

            // เลื่อนเวลาให้พ้น Answer Window สำหรับ questionId1
            const questionRaw = await quizGame.questions(questionId1);
            const timeToAdvance = (Number(questionRaw.answerWindowStartTime) + Number(ANSWER_WINDOW_DURATION)) - (await time.latest()) + 1;
            await time.increase(timeToAdvance); 
            await time.latest(); 

            await expect(quizGame.connect(rewardDistributor).distributeRewards(questionId1))
                .to.emit(quizGame, "RewardDistributed")
                .withArgs(questionId1, player1.address, expectedReward)
                .and.to.emit(quizGame, "QuestionClosed")
                .withArgs(questionId1);

            expect(await quizCoin.balanceOf(player1.address)).to.equal(initialPlayer1Balance + expectedReward);
            expect(await quizCoin.balanceOf(poolManager.target)).to.equal(initialPoolBalance - expectedReward); 
            expect((await quizGame.getQuestionDetails(questionId1)).isClosed).to.be.true; 
            expect((await quizGame.getQuestionDetails(questionId1)).numCorrectAnswerers).to.equal(BigInt(0)); 
        });

        it("Should allow REWARD_DISTRIBUTOR_ROLE to distribute rewards after window closes (multiple answerers)", async function () {
            // player1 ได้ตอบ questionId2 ไปแล้วใน beforeEach ของกลุ่มนี้
            // และ player2 ก็ได้ตอบไปแล้วใน test case "ควรอนุญาตให้ผู้ตอบถูกหลายคนตอบภายใน window เดียวกัน"
            // ดังนั้นตรงนี้ไม่ต้อง submitAnswer เพิ่มอีกแล้ว เพราะสถานะควรจะถูก reset จาก beforeEach
            // และ player1 ได้ตอบไปแล้วใน beforeEach ของกลุ่มนี้
            // และใน test case นี้เราต้องทำให้ player2 ตอบด้วยเพื่อทดสอบ multiple answerers
            await quizGame.connect(player2).submitAnswer(questionId2, keccak256Hash("multianswer")); // <-- เพิ่มตรงนี้

            const questionDetailsBeforeDistribution = await quizGame.getQuestionDetails(questionId2);
            const numCorrectAnswerers = questionDetailsBeforeDistribution.numCorrectAnswerers;
            
            const initialPlayer1Balance = await quizCoin.balanceOf(player1.address);
            const initialPlayer2Balance = await quizCoin.balanceOf(player2.address);
            const initialPoolBalance = await quizCoin.balanceOf(poolManager.target);
            const rewardPerPerson = questionDetailsBeforeDistribution.rewardAmount / numCorrectAnswerers; 

            // เลื่อนเวลาให้พ้น Answer Window สำหรับ questionId2
            const questionRaw = await quizGame.questions(questionId2);
            const timeToAdvance = (Number(questionRaw.answerWindowStartTime) + Number(ANSWER_WINDOW_DURATION)) - (await time.latest()) + 1;
            await time.increase(timeToAdvance); 
            await time.latest(); 

            await expect(quizGame.connect(rewardDistributor).distributeRewards(questionId2))
                .to.emit(quizGame, "RewardDistributed")
                .withArgs(questionId2, player1.address, rewardPerPerson)
                .and.to.emit(quizGame, "RewardDistributed")
                .withArgs(questionId2, player2.address, rewardPerPerson)
                .and.to.emit(quizGame, "QuestionClosed")
                .withArgs(questionId2);

            expect(await quizCoin.balanceOf(player1.address)).to.equal(initialPlayer1Balance + rewardPerPerson);
            expect(await quizCoin.balanceOf(player2.address)).to.equal(initialPlayer2Balance + rewardPerPerson);
            expect(await quizCoin.balanceOf(poolManager.target)).to.equal(initialPoolBalance - questionDetailsBeforeDistribution.rewardAmount); 
            expect((await quizGame.getQuestionDetails(questionId2)).isClosed).to.be.true;
            expect((await quizGame.getQuestionDetails(questionId2)).numCorrectAnswerers).to.equal(BigInt(0)); 
        });

        it("Should revert if rewards are distributed for an already closed question", async function () {
            // สร้างคำถามใหม่และกระจายรางวัลให้ปิด
            const newQuestionHash = keccak256Hash("closedtestanswer");
            const newHintHash = keccak256Hash("closedtesthint");
            const newDifficulty = 50;
            const tx = await quizGame.connect(deployer).createQuestion(newQuestionHash, newHintHash, newDifficulty); 
            const receipt = await tx.wait();
            const newQuestionId = (await quizGame.nextQuestionId()) - BigInt(1);

            await quizGame.connect(player1).submitAnswer(newQuestionId, newQuestionHash);
            const questionRaw = await quizGame.questions(newQuestionId);
            const timeToAdvance = (Number(questionRaw.answerWindowStartTime) + Number(ANSWER_WINDOW_DURATION)) - (await time.latest()) + 1;
            await time.increase(timeToAdvance);
            await time.latest();

            await quizGame.connect(rewardDistributor).distributeRewards(newQuestionId); 

            await expect(quizGame.connect(rewardDistributor).distributeRewards(newQuestionId))
                .to.be.revertedWith("Quiz: Rewards already distributed or question closed.");
        });

        it("Should revert if non-REWARD_DISTRIBUTOR_ROLE tries to distribute rewards", async function () {
            // สร้างคำถามใหม่สำหรับ test นี้
            const newQuestionHash = keccak256Hash("newtestanswer");
            const newHintHash = keccak256Hash("newtesthint");
            const newDifficulty = 50;
            const tx = await quizGame.connect(deployer).createQuestion(newQuestionHash, newHintHash, newDifficulty); 
            const receipt = await tx.wait();
            const newQuestionId = (await quizGame.nextQuestionId()) - BigInt(1);

            await quizGame.connect(player1).submitAnswer(newQuestionId, newQuestionHash);

            // เลื่อนเวลาให้พ้น Answer Window
            const questionRaw = await quizGame.questions(newQuestionId);
            const timeToAdvance = (Number(questionRaw.answerWindowStartTime) + Number(ANSWER_WINDOW_DURATION)) - (await time.latest()) + 1;
            await time.increase(timeToAdvance);
            await time.latest();

            await expect(quizGame.connect(player1).distributeRewards(newQuestionId))
                .to.be.revertedWithCustomError(quizGame, "AccessControlUnauthorizedAccount")
                .withArgs(player1.address, REWARD_DISTRIBUTOR_ROLE_QUIZGAME);
        });

        it("Should revert if reward distribution window is not over yet", async function () {
            // สร้างคำถามใหม่ แต่ยังไม่เลื่อนเวลา
            const anotherQuestionHash = keccak256Hash("anotheranswer");
            const anotherHintHash = keccak256Hash("anotherhint");
            const anotherDifficulty = 40;
            const tx = await quizGame.connect(deployer).createQuestion(anotherQuestionHash, anotherHintHash, anotherDifficulty); 
            const receipt = await tx.wait();
            const anotherQuestionId = (await quizGame.nextQuestionId()) - BigInt(1);
            await quizGame.connect(player1).submitAnswer(anotherQuestionId, anotherQuestionHash);

            await expect(quizGame.connect(rewardDistributor).distributeRewards(anotherQuestionId))
                .to.be.revertedWith("Quiz: Reward distribution window is not over yet.");
        });
    });

    // กลุ่มการทดสอบ: Halving และการคำนวณรางวัล
    describe("Halving และการคำนวณรางวัล", function () {
        this.timeout(100000); 

        it("ควรคำนวณปัจจัย Halving ตาม GAME_START_TIMESTAMP และ HALVING_PERIOD", async function () {
            
            let correctAnswerHash = keccak256Hash("halvingtest");
            let hintHash = keccak256Hash("halvinghint");
            let difficulty = 50;
            let expectedBaseRewardForDifficulty = (BASE_REWARD_MULTIPLIER * BigInt(difficulty)) / DIFFICULTY_DIVISOR;

            // Scenario 1: Immediately after deployment (halving factor 1)
            await quizGame.connect(deployer).createQuestion(correctAnswerHash, hintHash, difficulty);
            let questionId1 = (await quizGame.nextQuestionId()) - BigInt(1);
            let question1 = await quizGame.questions(questionId1);
            expect(question1.rewardAmount).to.equal(expectedBaseRewardForDifficulty); 

            // Scenario 2: After one halving period (factor 2)
            await time.increaseTo(GAME_START_TIMESTAMP + HALVING_PERIOD + BigInt(1)); // ตรวจสอบการใช้ BigInt
            await quizGame.connect(deployer).createQuestion(correctAnswerHash, hintHash, difficulty);
            let questionId2 = (await quizGame.nextQuestionId()) - BigInt(1);
            let question2 = await quizGame.questions(questionId2);
            expect(question2.rewardAmount).to.equal(expectedBaseRewardForDifficulty / BigInt(2)); 

            // Scenario 3: After two halving periods (factor 4)
            await time.increaseTo(GAME_START_TIMESTAMP + (BigInt(2) * HALVING_PERIOD) + BigInt(1)); // ตรวจสอบการใช้ BigInt
            await quizGame.connect(deployer).createQuestion(correctAnswerHash, hintHash, difficulty);
            let questionId3 = (await quizGame.nextQuestionId()) - BigInt(1);
            let question3 = await quizGame.questions(questionId3);
            expect(question3.rewardAmount).to.equal(expectedBaseRewardForDifficulty / BigInt(4)); 
        });
    });


    // กลุ่มการทดสอบ: ฟังก์ชัน getQuestionDetails
    describe("ฟังก์ชัน getQuestionDetails", function () {
        this.timeout(100000); 
        let questionIdForDetails;
        let qHash, hHash, qDifficulty, qRewardAmount;
        let qAnswerWindowStartTime; 

        beforeEach(async function() {
            // สร้างคำถามใหม่สำหรับการทดสอบ getQuestionDetails
            qHash = keccak256Hash("newquestionfordetails");
            hHash = keccak256Hash("newhintfordetails");
            qDifficulty = 50;
            const tx = await quizGame.connect(deployer).createQuestion(qHash, hHash, qDifficulty);
            const receipt = await tx.wait();
            questionIdForDetails = (await quizGame.nextQuestionId()) - BigInt(1);
            qRewardAmount = (await quizGame.questions(questionIdForDetails)).rewardAmount;

            // ทำให้คำถามนี้มีคนตอบถูกและปิด window เพื่อให้สถานะ "isClosed" เป็นจริง
            const submitTx = await quizGame.connect(player1).submitAnswer(questionIdForDetails, qHash);
            const submitReceipt = await submitTx.wait();
            qAnswerWindowStartTime = BigInt((await ethers.provider.getBlock(submitReceipt.blockNumber)).timestamp);

            // เลื่อนเวลาให้พ้น Answer Window
            const timeToAdvance = (Number(qAnswerWindowStartTime) + Number(ANSWER_WINDOW_DURATION)) - (await time.latest()) + 1;
            await time.increase(timeToAdvance);
            await time.latest();

            // กระจายรางวัลเพื่อปิดคำถาม
            await expect(quizGame.connect(rewardDistributor).distributeRewards(questionIdForDetails))
                .to.emit(quizGame, "RewardDistributed")
                .and.to.emit(quizGame, "QuestionClosed");
        });


        it("ควรส่งคืนรายละเอียดคำถามที่ถูกต้อง", async function () {
            const questionDetails = await quizGame.getQuestionDetails(questionIdForDetails);

            expect(questionDetails).to.be.an('array');
            expect(questionDetails.length).to.equal(10); 

            const [
                correctAnswerHash,
                hintHash,
                rewardAmount,
                difficultyLevel,
                questionCreator,
                isClosed,
                answerWindowStartTime,
                numCorrectAnswerers, 
                isRewardWindowActive,
                rewardWindowEndTime
            ] = questionDetails;

            expect(correctAnswerHash).to.equal(qHash);
            expect(hintHash).to.equal(hHash);
            expect(rewardAmount).to.equal(qRewardAmount); 
            expect(difficultyLevel).to.equal(BigInt(qDifficulty));
            expect(questionCreator).to.equal(deployer.address); 
            expect(isClosed).to.be.true; 
            expect(answerWindowStartTime).to.equal(qAnswerWindowStartTime); 
            expect(numCorrectAnswerers).to.equal(BigInt(0)); // <-- แก้ไข: ควรเป็น 0 หลัง delete ใน distributeRewards
            expect(isRewardWindowActive).to.be.false; 
            expect(rewardWindowEndTime).to.equal(qAnswerWindowStartTime + ANSWER_WINDOW_DURATION); 
        });

        it("ควร revert สำหรับคำถามที่ไม่มีอยู่", async function () {
            await expect(quizGame.getQuestionDetails(BigInt(999))).to.be.revertedWith("Quiz: Question does not exist.");
        });
    });
});