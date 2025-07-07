// ... โค้ดส่วนบนสุดของไฟล์เหมือนเดิม ...
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Quiz Game Live Test", function () {
    it("Should deploy and test quiz game functionality with current parameters", async function () {
        // --- อัปเดต ADDRESSES เหล่านี้ด้วยค่าใหม่ที่คุณเพิ่งได้มา ---
        const quizCoinAddress = "0xbd166434e81bE7C212006cD7198C5309CA255737"; // ใช้ Address ใหม่นี้
        const quizGameAddress = "0x539eb8aBef083123cAD8785664d1D62A63Dcc128"; // ใช้ Address ใหม่นี้
        const poolManagerAddress = "0x7A070Cad68a1D64174C58b9Abb63010e015D2bbC"; // ใช้ Address ใหม่นี้
        // -----------------------------------------------------

        const [deployer, player1, player2] = await ethers.getSigners();
        const QuizCoin = await ethers.getContractFactory("QuizCoin");
        const QuizGame = await ethers.getContractFactory("QuizGame");
        const PoolManager = await ethers.getContractFactory("PoolManager");

        const quizCoin = await QuizCoin.attach(quizCoinAddress);
        const quizGame = await QuizGame.attach(quizGameAddress);
        const poolManager = await PoolManager.attach(poolManagerAddress);

        console.log("Contracts loaded:");
        console.log("QuizCoin at:", quizCoin.address);
        console.log("QuizGame at:", quizGame.address);
        console.log("PoolManager at:", poolManager.address);

        // --- ตรวจสอบสถานะก่อนสร้างคำถาม (รางวัลควรจะเริ่มต้นที่ 2500 QZC สำหรับ Difficulty 1) ---
        const blocksPerHalving = await quizGame.BLOCKS_PER_HALVING_PERIOD();
        console.log("BLOCKS_PER_HALVING_PERIOD:", blocksPerHalving.toString());

        const currentBlock = await ethers.provider.getBlockNumber();
        console.log("Current block number:", currentBlock);

        // *** แก้ไข 2 บรรทัดนี้: เพิ่ม ethers.BigNumber.from() ***
        const rewardForDiff1Check = ethers.BigNumber.from(await quizGame.calculateReward(1));
        const initialBaseRewardCheck = ethers.BigNumber.from(await quizGame.INITIAL_BASE_REWARD_LEVEL_1_99());
        // *** สิ้นสุดการแก้ไข ***

        console.log("Reward for Diff 1 (calculated by contract):", rewardForDiff1Check.toString());
        console.log("Initial Base Reward (from contract constant):", initialBaseRewardCheck.toString());

        if (rewardForDiff1Check.eq(initialBaseRewardCheck.div(2))) {
            console.log("Base Reward has been halved once (as expected due to high block number).");
        } else if (rewardForDiff1Check.eq(initialBaseRewardCheck)) {
            console.log("Base Reward is still at initial value (halving periods is 0).");
        } else {
            console.log("Base Reward has been halved multiple times or unexpected value.");
        }

        const initialBaseReward = await quizGame.INITIAL_BASE_REWARD_LEVEL_1_99();
        console.log("INITIAL_BASE_REWARD_LEVEL_1_99:", initialBaseReward.toString());

        const minReward = await quizGame.MIN_REWARD_LEVEL_1_99();
        console.log("MIN_REWARD_LEVEL_1_99:", minReward.toString());

        const calculatedRewardForDiff1 = await quizGame.calculateReward(1);
        console.log("Calculated Reward for Difficulty 1:", calculatedRewardForDiff1.toString());

        const calculatedRewardForDiff99 = await quizGame.calculateReward(99);
        console.log("Calculated Reward for Difficulty 99:", calculatedRewardForDiff99.toString());

        const calculatedRewardForDiff100 = await quizGame.calculateReward(100);
        console.log("Calculated Reward for Difficulty 100:", calculatedRewardForDiff100.toString());


        // --- สร้างคำถามใหม่ (Difficulty 10) ---
        const questionText = "What is 2+2?";
        const correctAnswer = "4";
        const correctAnswerHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(correctAnswer));
        const difficulty = 10;
        const hintText = "It's a small, even number.";
        const hintTextHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hintText));
        const hintCost = ethers.utils.parseEther("100");

        let tx = await quizGame.createQuestion(correctAnswerHash, difficulty, hintTextHash, hintCost);
        let receipt = await tx.wait();
        const questionCreatedEvent = receipt.events?.filter((x) => x.event === "QuestionCreated")[0];
        const questionId = questionCreatedEvent.args.questionId;
        console.log("Question created with ID:", questionId.toString());

        // --- ให้ player1 ลองตอบคำถาม ---
        console.log("Player 1 submitting answer...");
        await quizGame.connect(player1).submitAnswer(questionId, correctAnswerHash);
        console.log("Player 1 submitted answer successfully.");

        // --- ตรวจสอบยอดคงเหลือของ player1 ---
        const player1Balance = await quizCoin.balanceOf(player1.address);
        console.log("Player 1 balance after solving (wei):", player1Balance.toString());
        console.log("Player 1 balance after solving (QZC):", ethers.utils.formatEther(player1Balance));

        // --- ตรวจสอบสถานะคำถาม ---
        const question = await quizGame.questions(questionId);
        console.log("Question solved status:", question.isSolved);
        console.log("Question solver:", question.solverAddress);
        console.log("Reward minted for question:", ethers.utils.formatEther(question.rewardMinted));

        // --- ลองคำนวณรางวัลอีกครั้งเพื่อยืนยันว่าตรงกับที่ Mint ได้ ---
        const expectedReward = await quizGame.calculateReward(difficulty);
        console.log("Expected reward from calculateReward function:", ethers.utils.formatEther(expectedReward));
    });
});