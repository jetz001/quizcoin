// scripts/test-interaction.js
const { ethers } = require("hardhat");
const fs = require("fs"); // Import Node.js filesystem module

async function main() {
    console.log("--- เริ่มต้นการทดสอบการทำงานของสัญญา QuizGame ---");

    // --- 1. อ่าน Contract Addresses จากไฟล์ ---
    let contractAddresses;
    try {
        const data = fs.readFileSync("./contractAddresses.json", "utf8");
        contractAddresses = JSON.parse(data);
    } catch (error) {
        console.error("ERROR: Could not read contractAddresses.json. Please run 'npx hardhat run scripts/deploy.js --network bsc-testnet' first.");
        process.exit(1);
    }

    const quizCoinAddress = contractAddresses.QuizCoin;
    const quizGameAddress = contractAddresses.QuizGame;
    const poolManagerAddress = contractAddresses.PoolManager;

    console.log("\n--- ตรวจสอบ Contract Addresses ที่อ่านได้ ---");
    console.log(`  QuizCoin Address: ${quizCoinAddress}`);
    console.log(`  QuizGame Address: ${quizGameAddress}`);
    console.log(`  PoolManager Address: ${poolManagerAddress}`);

    const [deployer, player1, player2] = await ethers.getSigners();

    console.log(`\nDeployer Address: ${deployer.address}`);
    console.log(`Player 1 Address: ${player1.address}`);
    console.log(`Player 2 Address: ${player2.address}`);

    // --- 2. เชื่อมต่อกับสัญญาที่ Deploy แล้ว ---
    console.log("\n--- กำลังเชื่อมต่อกับสัญญาที่ Deploy แล้ว ---");
    const quizCoin = await ethers.getContractAt("QuizCoin", quizCoinAddress);
    console.log(`  QuizCoin attached successfully to ${quizCoin.target}.`);
    
    const quizGame = await ethers.getContractAt("QuizGame", quizGameAddress);
    console.log(`  QuizGame attached successfully to ${quizGame.target}.`);

    const poolManager = await ethers.getContractAt("PoolManager", poolManagerAddress);
    console.log(`  PoolManager attached successfully to ${poolManager.target}.`);

    console.log("\nContracts loaded and attached successfully:");
    console.log(`  QuizCoin at: ${quizCoin.target}`);
    console.log(`  QuizGame at: ${quizGame.target}`);
    console.log(`  PoolManager at: ${poolManager.target}`);

    // ตรวจสอบ Role ของ Deployer
    const MINTER_ROLE_BYTES = await quizCoin.MINTER_ROLE();
    const BURNER_ROLE_BYTES = await quizCoin.BURNER_ROLE();
    const GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES = await poolManager.GAME_ADMIN_ROLE_IN_POOL_MANAGER();

    console.log("\n--- ตรวจสอบ Role ของสัญญาที่ถูก Grant ---");
    console.log(`  QuizGame has MINTER_ROLE in QuizCoin: ${await quizCoin.hasRole(MINTER_ROLE_BYTES, quizGame.target)}`);
    console.log(`  QuizGame has BURNER_ROLE in QuizCoin: ${await quizCoin.hasRole(BURNER_ROLE_BYTES, quizGame.target)}`);
    console.log(`  QuizGame has GAME_ADMIN_ROLE_IN_POOL_MANAGER in PoolManager: ${await poolManager.hasRole(GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES, quizGame.target)}`);

    // --- 3. ตรวจสอบการตั้งค่ารางวัล (Halving) ---
    console.log("\n--- ตรวจสอบการตั้งค่ารางวัล (Halving) ---");
    const blocksPerHalvingPeriod = await quizGame.BLOCKS_PER_HALVING_PERIOD();
    console.log(`BLOCKS_PER_HALVING_PERIOD: ${blocksPerHalvingPeriod}`);
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    console.log(`Current block number: ${currentBlockNumber}`);
    const initialBaseReward_1_99 = await quizGame.INITIAL_BASE_REWARD_LEVEL_1_99();
    console.log(`INITIAL_BASE_REWARD_LEVEL_1_99: ${ethers.formatUnits(initialBaseReward_1_99, 18)} QZC`);
    const minReward_1_99 = await quizGame.MIN_REWARD_LEVEL_1_99();
    console.log(`MIN_REWARD_LEVEL_1_99: ${ethers.formatUnits(minReward_1_99, 18)} QZC`);

    const rewardDiff1 = await quizGame.calculateReward(1);
    console.log(`Reward for Diff 1 (calculated by contract): ${ethers.formatUnits(rewardDiff1, 18)} QZC`);
    if (rewardDiff1 < initialBaseReward_1_99) {
        console.log("Base Reward has been halved multiple times or unexpected value.");
    }

    console.log("\n--- การคำนวณรางวัลสำหรับ Difficulty ต่างๆ ---");
    console.log(`Calculated Reward for Difficulty 1: ${ethers.formatUnits(await quizGame.calculateReward(1), 18)} QZC`);
    console.log(`Calculated Reward for Difficulty 10: ${ethers.formatUnits(await quizGame.calculateReward(10), 18)} QZC`);
    console.log(`Calculated Reward for Difficulty 99: ${ethers.formatUnits(await quizGame.calculateReward(99), 18)} QZC`);
    console.log(`Calculated Reward for Difficulty 100: ${ethers.formatUnits(await quizGame.calculateReward(100), 18)} QZC`);

    // --- 4. การทดสอบการสร้างคำถาม ---
    console.log("\n--- การสร้างคำถาม ---");
    let deployerEthBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
    console.log(`Deployer BNB Balance Before createQuestion: ${deployerEthBalance} BNB`);

    const answer1 = "4";
    const hint1 = "It's an even number.";
    const difficulty1 = 10;
    const hintCost1 = ethers.parseUnits("10", 18); // 10 QZC

    const answerHash1 = ethers.id(answer1); // สร้าง hash ของคำตอบ
    const hintHash1 = ethers.id(hint1);     // สร้าง hash ของคำใบ้

    console.log(`Creating question: "${answer1}" (Difficulty: ${difficulty1})`);
    console.log(`Correct Answer Hash: ${answerHash1}`);
    console.log(`Hint Cost: ${ethers.formatUnits(hintCost1, 18)} QZC`);

    try {
        const createQ1Tx = await quizGame.connect(deployer).createQuestion(
            answerHash1,
            hintHash1,
            difficulty1,
            hintCost1
        );
        await createQ1Tx.wait();
        console.log("Question 1 created successfully by Deployer.");
        const question1Id = (await quizGame.nextQuestionId()) - 1n; // ใช้ 1n สำหรับ BigInt
        console.log(`Question 1 ID: ${question1Id}`);

        // --- 5. การทดสอบการฝากเงินโดย Player 1 ---
        console.log("\n--- การทดสอบการฝากเงินโดย Player 1 ---");
        const depositAmount = ethers.parseUnits("1000", 18); // 1000 QZC
        console.log(`Player 1 attempting to deposit ${ethers.formatUnits(depositAmount, 18)} QZC.`);

        let player1QZCBalance = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance before mint (expected 0): ${ethers.formatUnits(player1QZCBalance, 18)} QZC`);

        const totalMintAmountForPlayer1 = depositAmount + ethers.parseUnits("50", 18); // 1000 + 50 = 1050 QZC
        console.log(`Deployer will mint ${ethers.formatUnits(totalMintAmountForPlayer1, 18)} QZC to Player 1.`);
        const mintTx1 = await quizCoin.connect(deployer).mint(player1.address, totalMintAmountForPlayer1);
        await mintTx1.wait();
        
        player1QZCBalance = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance after mint: ${ethers.formatUnits(player1QZCBalance, 18)} QZC (Expected: ${ethers.formatUnits(totalMintAmountForPlayer1, 18)})`);
        if (player1QZCBalance < totalMintAmountForPlayer1) { // ใช้ < แทน === เพราะอาจมี transaction อื่นๆ ที่เกิดขึ้น
            console.error("ERROR: Player 1 did not receive the expected QZC after minting.");
        }

        console.log(`Player 1 approving PoolManager to spend ${ethers.formatUnits(depositAmount, 18)} QZC...`);
        const approveTx1 = await quizCoin.connect(player1).approve(poolManager.target, depositAmount);
        await approveTx1.wait();
        console.log("Player 1 approved PoolManager to spend QZC successfully.");

        console.log(`Player 1 depositing ${ethers.formatUnits(depositAmount, 18)} QZC into PoolManager...`);
        const depositTx1 = await poolManager.connect(player1).deposit(depositAmount);
        await depositTx1.wait();
        console.log("Player 1 deposited QZC into PoolManager successfully.");

        let player1PoolBalance = await poolManager.poolBalances(player1.address);
        console.log(`Player 1 Pool Balance after deposit: ${ethers.formatUnits(player1PoolBalance, 18)} QZC (Expected: ${ethers.formatUnits(depositAmount, 18)})`);
        player1QZCBalance = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance after deposit: ${ethers.formatUnits(player1QZCBalance, 18)} QZC (Expected: ${ethers.formatUnits(totalMintAmountForPlayer1 - depositAmount, 18)})`);


        // --- 6. การทดสอบการขอคำใบ้โดย Player 1 (ควรสำเร็จ) ---
        console.log("\n--- การทดสอบการขอคำใบ้โดย Player 1 ---");
        player1PoolBalance = await poolManager.poolBalances(player1.address);
        console.log(`Player 1 Pool Balance before hint: ${ethers.formatUnits(player1PoolBalance, 18)} QZC`);
        let developerFundAddressFromQuizGame = await quizGame.developerFundAddress(); // ดึง developerFundAddress จาก QuizGame
        let developerFundAddressFromPoolManager = await poolManager.developerFundAddress(); // ดึง developerFundAddress จาก PoolManager
        
        // ตรวจสอบให้แน่ใจว่า developerFundAddress ใน QuizGame และ PoolManager เหมือนกัน
        if (developerFundAddressFromQuizGame !== developerFundAddressFromPoolManager) {
            console.warn("WARNING: Developer Fund Addresses in QuizGame and PoolManager are different!");
            // คุณอาจต้องใช้ setDeveloperFundAddress ใน poolManager เพื่อให้ตรงกัน
        }
        
        let developerFundBalanceBeforeHint = await quizCoin.balanceOf(developerFundAddressFromPoolManager); // ใช้ address จาก PoolManager
        console.log(`Developer Fund QZC Balance (from PoolManager's perspective) before hint: ${ethers.formatUnits(developerFundBalanceBeforeHint, 18)} QZC`);
        
        let poolManagerQZCBalanceBeforeHint = await quizCoin.balanceOf(poolManager.target);
        console.log(`PoolManager QZC Balance before hint: ${ethers.formatUnits(poolManagerQZCBalanceBeforeHint, 18)} QZC`);

        console.log(`Player 1 requesting hint for Question ID ${question1Id} with cost ${ethers.formatUnits(hintCost1, 18)} QZC...`);
        const getHintTx = await quizGame.connect(player1).getHint(question1Id);
        const hintReceipt = await getHintTx.wait();
        console.log("Player 1 requested hint successfully.");

        const hintEvent = hintReceipt.logs.find(log => quizGame.interface.parseLog(log)?.name === "HintRequested");
        if (hintEvent) {
            const parsedEvent = quizGame.interface.parseLog(hintEvent);
            console.log(`  HintRequested Event: Question ID ${parsedEvent.args.questionId}, Requester ${parsedEvent.args.requester}, Cost ${ethers.formatUnits(parsedEvent.args.hintCost, 18)} QZC`);
        } else {
            console.error("ERROR: HintRequested Event not found.");
        }
        
        player1PoolBalance = await poolManager.poolBalances(player1.address);
        console.log(`Player 1 Pool Balance after hint: ${ethers.formatUnits(player1PoolBalance, 18)} QZC (Expected: ${ethers.formatUnits(depositAmount - hintCost1, 18)})`);
        let developerFundBalanceAfterHint = await quizCoin.balanceOf(developerFundAddressFromPoolManager);
        console.log(`Developer Fund QZC Balance after hint: ${ethers.formatUnits(developerFundBalanceAfterHint, 18)} QZC (Expected increase by ${ethers.formatUnits(hintCost1, 18)})`);
        let poolManagerQZCBalanceAfterHint = await quizCoin.balanceOf(poolManager.target);
        console.log(`PoolManager QZC Balance after hint: ${ethers.formatUnits(poolManagerQZCBalanceAfterHint, 18)} QZC (Expected decrease by ${ethers.formatUnits(hintCost1, 18)})`);

        if (player1PoolBalance !== depositAmount - hintCost1) {
            console.error("ERROR: Player 1's pool balance did NOT update correctly after hint.");
        }
        if (developerFundBalanceAfterHint !== developerFundBalanceBeforeHint + hintCost1) {
             console.error("ERROR: Developer Fund QZC balance did NOT increase correctly after hint.");
        }
        if (poolManagerQZCBalanceAfterHint !== poolManagerQZCBalanceBeforeHint - hintCost1) {
             console.error("ERROR: PoolManager QZC balance did NOT decrease correctly after hint.");
        }


        // --- 7. การทดสอบการส่งคำตอบโดย Player 1 (ควรสำเร็จและได้รับรางวัล) ---
        console.log("\n--- การทดสอบการส่งคำตอบโดย Player 1 ---");
        const initialPlayer1QZCBalance = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance before solving: ${ethers.formatUnits(initialPlayer1QZCBalance, 18)} QZC`);
        let quizGameQZCBalanceBeforeSolve = await quizCoin.balanceOf(quizGame.target);
        console.log(`QuizGame QZC Balance before solving (should be 0): ${ethers.formatUnits(quizGameQZCBalanceBeforeSolve, 18)} QZC`);
        developerFundAddressFromQuizGame = await quizGame.developerFundAddress(); // ดึง developerFundAddress จาก QuizGame
        let developerFundBalanceBeforeSolve = await quizCoin.balanceOf(developerFundAddressFromQuizGame);
        console.log(`Developer Fund QZC Balance before solve fee: ${ethers.formatUnits(developerFundBalanceBeforeSolve, 18)} QZC`);

        console.log(`Player 1 submitting answer "${answer1}" for Question ID ${question1Id}...`);
        const submitAnswerTx = await quizGame.connect(player1).submitAnswer(question1Id, answer1);
        const answerReceipt = await submitAnswerTx.wait();
        console.log("Player 1 submitted answer successfully.");

        const solvedEvent = answerReceipt.logs.find(log => quizGame.interface.parseLog(log)?.name === "QuestionSolved");
        let expectedRewardAmount = 0n;
        let expectedFeeAmount = 0n;
        if (solvedEvent) {
            const parsedEvent = quizGame.interface.parseLog(solvedEvent);
            expectedRewardAmount = parsedEvent.args.rewardAmount;
            expectedFeeAmount = parsedEvent.args.feeAmount;
            console.log(`  QuestionSolved Event: ID ${parsedEvent.args.id}, Solver ${parsedEvent.args.solver}, Reward ${ethers.formatUnits(expectedRewardAmount, 18)} QZC, Fee ${ethers.formatUnits(expectedFeeAmount, 18)} QZC`);
        } else {
            console.error("ERROR: QuestionSolved Event not found.");
        }

        const rewardFeeTransferEvent = answerReceipt.logs.find(log => quizGame.interface.parseLog(log)?.name === "RewardFeeTransferred");
        if (rewardFeeTransferEvent) {
            const parsedEvent = quizGame.interface.parseLog(rewardFeeTransferEvent);
            console.log(`  RewardFeeTransferred Event: To ${parsedEvent.args.to}, Amount ${ethers.formatUnits(parsedEvent.args.amount, 18)} QZC`);
        } else {
             console.error("ERROR: RewardFeeTransferred Event not found.");
        }


        const finalPlayer1QZCBalance = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance after solving: ${ethers.formatUnits(finalPlayer1QZCBalance, 18)} QZC (Expected increase by ${ethers.formatUnits(expectedRewardAmount, 18)})`);
        console.log(`Player 1 received: ${ethers.formatUnits(finalPlayer1QZCBalance - initialPlayer1QZCBalance, 18)} QZC as reward.`);

        let developerFundBalanceAfterSolve = await quizCoin.balanceOf(developerFundAddressFromQuizGame);
        console.log(`Developer Fund QZC Balance after solve fee: ${ethers.formatUnits(developerFundBalanceAfterSolve, 18)} QZC (Expected increase by ${ethers.formatUnits(expectedFeeAmount, 18)})`);
        console.log(`Developer Fund received: ${ethers.formatUnits(developerFundBalanceAfterSolve - developerFundBalanceBeforeSolve, 18)} QZC from reward fee.`);

        if (finalPlayer1QZCBalance - initialPlayer1QZCBalance !== expectedRewardAmount) {
            console.error("ERROR: Player 1 did NOT receive the correct reward amount.");
        }
        if (developerFundBalanceAfterSolve - developerFundBalanceBeforeSolve !== expectedFeeAmount) {
            console.error("ERROR: Developer Fund did NOT receive the correct fee amount from reward fee.");
        }


        // --- 8. การทดสอบการถอนเงินโดย Player 1 ---
        console.log("\n--- การทดสอบการถอนเงินโดย Player 1 ---");
        player1PoolBalance = await poolManager.poolBalances(player1.address);
        console.log(`Player 1 Pool Balance before withdrawal: ${ethers.formatUnits(player1PoolBalance, 18)} QZC`);
        let player1QZCBalanceBeforeWithdrawal = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance before withdrawal from pool: ${ethers.formatUnits(player1QZCBalanceBeforeWithdrawal, 18)} QZC`);

        if (player1PoolBalance > 0n) {
            console.log(`Player 1 withdrawing ${ethers.formatUnits(player1PoolBalance, 18)} QZC from PoolManager.`);
            const withdrawTx = await poolManager.connect(player1).withdraw(player1PoolBalance);
            await withdrawTx.wait();
            console.log("Player 1 withdrew QZC from PoolManager successfully.");
            
            let finalPlayer1PoolBalance = await poolManager.poolBalances(player1.address); // ดึงอีกครั้ง
            console.log(`Player 1 Pool Balance after withdrawal: ${ethers.formatUnits(finalPlayer1PoolBalance, 18)} QZC (Expected 0)`);
            let player1QZCBalanceAfterWithdrawal = await quizCoin.balanceOf(player1.address);
            console.log(`Player 1 QZC Balance after withdrawal from pool: ${ethers.formatUnits(player1QZCBalanceAfterWithdrawal, 18)} QZC (Expected increase by ${ethers.formatUnits(player1PoolBalance, 18)})`);

            if (finalPlayer1PoolBalance !== 0n) {
                console.error("ERROR: Player 1's pool balance did NOT become zero after withdrawal.");
            }
            if (player1QZCBalanceAfterWithdrawal !== player1QZCBalanceBeforeWithdrawal + player1PoolBalance) {
                 console.error("ERROR: Player 1's QZC balance did NOT increase correctly after withdrawal.");
            }

        } else {
            console.log("Player 1 has no balance in PoolManager to withdraw.");
        }


        // --- 9. การทดสอบการสร้างคำถามโดย Player 2 (ไม่ควรสำเร็จ หากมีการจำกัด Role) ---
        console.log("\n--- การทดสอบการสร้างคำถามโดย Player 2 (ไม่ควรสำเร็จ) ---");
        try {
            const createQ2Tx = await quizGame.connect(player2).createQuestion(
                ethers.id("test_answer_2"),
                ethers.id("test_hint_2"),
                50,
                ethers.parseUnits("20", 18)
            );
            await createQ2Tx.wait();
            console.error("ข้อผิดพลาด: Player 2 สร้างคำถามได้สำเร็จ (ไม่ควรเกิดขึ้น หาก createQuestion ถูกจำกัด Role)");
        } catch (error) {
            if (error.message.includes("AccessControl:") || error.message.includes("revert")) {
                console.log("สำเร็จ: Player 2 ไม่สามารถสร้างคำถามได้ (เนื่องจากข้อผิดพลาด: Transaction reverted by AccessControl)");
            } else {
                console.error(`ข้อผิดพลาดที่ไม่คาดคิดในการสร้างคำถามโดย Player 2: ${error.message}`);
            }
        }

    } catch (error) {
        console.error("\n--- เกิดข้อผิดพลาดในการรันสคริปต์ ---");
        console.error(`Error Message: ${error.message}`);
        console.error(`Error Code: ${error.code || 'N/A'}`);
    } finally {
        console.log("\n--- สิ้นสุดการทดสอบการทำงานของสัญญา QuizGame ---");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });