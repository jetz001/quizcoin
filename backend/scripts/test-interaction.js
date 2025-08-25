// scripts/test-interaction.js
const { ethers } = require("hardhat");
const fs = require("fs");

// Helper function for delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // ตรวจสอบ Role ของ Deployer และสัญญา
    const MINTER_ROLE_BYTES = await quizCoin.MINTER_ROLE();
    const BURNER_ROLE_BYTES = await quizCoin.BURNER_ROLE();
    const GAME_ADMIN_ROLE_IN_POOL_MANAGER_BYTES = await poolManager.GAME_ADMIN_ROLE_IN_POOL_MANAGER();

    console.log("\n--- ตรวจสอบ Role ของสัญญาที่ถูก Grant ---");
    console.log(`  Deployer has MINTER_ROLE in QuizCoin: ${await quizCoin.hasRole(MINTER_ROLE_BYTES, deployer.address)}`);
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
        console.log("  Base Reward has been halved multiple times or unexpected value. (This is expected behavior if enough blocks have passed)");
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

    const answerHash1 = ethers.id(answer1);
    const hintHash1 = ethers.id(hint1);

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
        const question1Id = (await quizGame.nextQuestionId()) - 1n;
        console.log(`Question 1 ID: ${question1Id}`);

        // --- 5. การทดสอบการฝากเงินโดย Player 1 ---
        console.log("\n--- การทดสอบการฝากเงินโดย Player 1 ---");
        const depositAmount = ethers.parseUnits("1000", 18); // 1000 QZC
        console.log(`Player 1 attempting to deposit ${ethers.formatUnits(depositAmount, 18)} QZC.`);

        // ตรวจสอบ QZC balance ของ player1 ก่อน mint
        let player1QZCBalanceBeforeMint = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance BEFORE MINT (expected 0): ${ethers.formatUnits(player1QZCBalanceBeforeMint, 18)} QZC`);

        // Mint QZC ให้ player1 สำหรับการทดสอบ (Deployer ต้องมี MINTER_ROLE)
        const totalMintAmountForPlayer1 = depositAmount + ethers.parseUnits("50", 18); // 1000 + 50 = 1050 QZC
        console.log(`Deployer will mint ${ethers.formatUnits(totalMintAmountForPlayer1, 18)} QZC to Player 1.`);
        
        try {
            const mintTx1 = await quizCoin.connect(deployer).mint(player1.address, totalMintAmountForPlayer1);
            const mintReceipt = await mintTx1.wait();
            
            if (mintReceipt.status === 1) {
                console.log("Minting to Player 1 was successful (transaction status OK).");
            } else {
                console.error("ERROR: Minting to Player 1 transaction failed (status not OK). Review gas or chain config.");
            }
            // เพิ่มการตรวจสอบ event ถ้ามี
            const transferEvents = mintReceipt.logs.filter(log => quizCoin.interface.parseLog(log)?.name === "Transfer");
            if (transferEvents.length > 0) {
                console.log(`  Found ${transferEvents.length} Transfer event(s) during minting. Checking first event:`);
                const parsed = quizCoin.interface.parseLog(transferEvents[0]);
                console.log(`    Transfer Event: From ${parsed.args.from}, To ${parsed.args.to}, Amount ${ethers.formatUnits(parsed.args.value, 18)} QZC`);
            } else {
                console.log("  No Transfer events found during minting, which is unusual for a successful mint.");
            }
            // --- NEW: Delay after minting to allow node to sync ---
            console.log("Waiting for 5 seconds after minting for balance to update on chain...");
            await sleep(5000);

        } catch (error) {
            console.error(`CRITICAL ERROR during Player 1 minting: ${error.message}`);
            console.error(`Please check if deployer (${deployer.address}) has MINTER_ROLE in QuizCoin.`);
            process.exit(1);
        }
        
        let player1QZCBalanceAfterMint = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance AFTER MINT: ${ethers.formatUnits(player1QZCBalanceAfterMint, 18)} QZC (Expected: ${ethers.formatUnits(totalMintAmountForPlayer1, 18)})`);
        if (player1QZCBalanceAfterMint !== totalMintAmountForPlayer1) { // ใช้ !== เพื่อให้มัน Fail ถ้าไม่ตรงเป๊ะ
            console.error("ERROR: Player 1 did not receive the expected QZC after minting. Actual balance differs from expected.");
            console.error("  This is likely a node synchronization issue. Script will continue but subsequent checks might fail.");
        }


        // Player 1 อนุมัติ PoolManager ให้ใช้ QZC
        console.log(`\nPlayer 1 approving PoolManager to spend ${ethers.formatUnits(depositAmount, 18)} QZC...`);
        let allowanceBeforeApprove = await quizCoin.allowance(player1.address, poolManager.target);
        console.log(`  Allowance before approval: ${ethers.formatUnits(allowanceBeforeApprove, 18)} QZC`);

        try {
            const approveTx1 = await quizCoin.connect(player1).approve(poolManager.target, depositAmount);
            const approveReceipt = await approveTx1.wait();
            if (approveReceipt.status === 1) {
                console.log("Player 1 approved PoolManager to spend QZC successfully (transaction status OK).");
            } else {
                console.error("ERROR: Player 1 approval transaction failed (status not OK).");
            }
            // ตรวจสอบ Approval event
            const approvalEvents = approveReceipt.logs.filter(log => quizCoin.interface.parseLog(log)?.name === "Approval");
            if (approvalEvents.length > 0) {
                const parsed = quizCoin.interface.parseLog(approvalEvents[0]);
                console.log(`  Approval Event: Owner ${parsed.args.owner}, Spender ${parsed.args.spender}, Amount ${ethers.formatUnits(parsed.args.value, 18)} QZC`);
            } else {
                console.log("  No Approval event found after approval, which is unusual.");
            }
            // --- NEW: Delay after approval ---
            console.log("Waiting for 5 seconds after approval for allowance to update on chain...");
            await sleep(5000);
        } catch (error) {
            console.error(`CRITICAL ERROR during Player 1 approval: ${error.message}`);
            process.exit(1);
        }
        let allowanceAfterApprove = await quizCoin.allowance(player1.address, poolManager.target);
        console.log(`  Allowance after approval: ${ethers.formatUnits(allowanceAfterApprove, 18)} QZC (Expected: ${ethers.formatUnits(depositAmount, 18)})`);
        if (allowanceAfterApprove !== depositAmount) {
            console.error("ERROR: Allowance was not set correctly.");
            console.error("  This is likely a node synchronization issue. Script will continue but subsequent checks might fail.");
        }


        // Player 1 ฝาก QZC เข้า PoolManager
        console.log(`\nPlayer 1 depositing ${ethers.formatUnits(depositAmount, 18)} QZC into PoolManager...`);
        let player1QZCBalanceBeforeDeposit = await quizCoin.balanceOf(player1.address);
        let poolManagerQZCBalanceBeforeDeposit = await quizCoin.balanceOf(poolManager.target);
        let player1PoolBalanceBeforeDeposit = await poolManager.poolBalances(player1.address);
        console.log(`  Player 1 QZC Balance before deposit: ${ethers.formatUnits(player1QZCBalanceBeforeDeposit, 18)} QZC`);
        console.log(`  PoolManager QZC Balance before deposit: ${ethers.formatUnits(poolManagerQZCBalanceBeforeDeposit, 18)} QZC`);
        console.log(`  Player 1 Pool Balance before deposit: ${ethers.formatUnits(player1PoolBalanceBeforeDeposit, 18)} QZC`);

        try {
            const depositTx1 = await poolManager.connect(player1).deposit(depositAmount);
            const depositReceipt = await depositTx1.wait();
            if (depositReceipt.status === 1) {
                console.log("Player 1 deposited QZC into PoolManager successfully (transaction status OK).");
            } else {
                console.error("ERROR: Player 1 deposit transaction failed (status not OK). Review gas or chain config.");
            }
            const depositEvent = depositReceipt.logs.find(log => poolManager.interface.parseLog(log)?.name === "Deposited");
            if (depositEvent) {
                const parsedEvent = poolManager.interface.parseLog(depositEvent);
                console.log(`  Deposited Event: User ${parsedEvent.args.user}, Amount ${ethers.formatUnits(parsedEvent.args.amount, 18)} QZC`);
            } else {
                console.log("  No Deposited event found, which is unusual for a successful deposit.");
            }
            // --- NEW: Delay after deposit ---
            console.log("Waiting for 5 seconds after deposit for balances to update on chain...");
            await sleep(5000);

        } catch (error) {
            console.error(`CRITICAL ERROR during Player 1 deposit: ${error.message}`);
            // If the transaction reverted due to insufficient allowance/balance, it will be caught here.
            // Check if the error message indicates insufficient funds/allowance
            if (error.message.includes("ERC20: insufficient allowance") || error.message.includes("ERC20: transfer amount exceeds balance")) {
                console.error("  This deposit failed likely because Player 1 did not have enough QZC or the allowance was not set.");
                console.error("  Please ensure Player 1's QZC balance and allowance are correct before attempting deposit.");
            }
            process.exit(1); // Exit here since deposit failed, subsequent steps will also fail
        }

        let player1PoolBalanceAfterDeposit = await poolManager.poolBalances(player1.address);
        let player1QZCBalanceAfterDeposit = await quizCoin.balanceOf(player1.address);
        let poolManagerQZCBalanceAfterDeposit = await quizCoin.balanceOf(poolManager.target);
        
        console.log(`  Player 1 Pool Balance AFTER DEPOSIT: ${ethers.formatUnits(player1PoolBalanceAfterDeposit, 18)} QZC (Expected: ${ethers.formatUnits(player1PoolBalanceBeforeDeposit + depositAmount, 18)})`);
        console.log(`  Player 1 QZC Balance AFTER DEPOSIT: ${ethers.formatUnits(player1QZCBalanceAfterDeposit, 18)} QZC (Expected: ${ethers.formatUnits(player1QZCBalanceBeforeDeposit - depositAmount, 18)})`);
        console.log(`  PoolManager QZC Balance AFTER DEPOSIT: ${ethers.formatUnits(poolManagerQZCBalanceAfterDeposit, 18)} QZC (Expected: ${ethers.formatUnits(poolManagerQZCBalanceBeforeDeposit + depositAmount, 18)})`);

        if (player1PoolBalanceAfterDeposit !== player1PoolBalanceBeforeDeposit + depositAmount) {
            console.error("ERROR: Player 1's pool balance did NOT update correctly after deposit.");
        }
        if (player1QZCBalanceAfterDeposit !== player1QZCBalanceBeforeDeposit - depositAmount) {
             console.error("ERROR: Player 1's QZC balance did NOT decrease correctly after deposit. It might not have had enough balance to deposit.");
        }
        if (poolManagerQZCBalanceAfterDeposit !== poolManagerQZCBalanceBeforeDeposit + depositAmount) {
             console.error("ERROR: PoolManager's QZC balance did NOT increase correctly after deposit.");
        }


        // --- 6. การทดสอบการขอคำใบ้โดย Player 1 (ควรสำเร็จ) ---
        console.log("\n--- การทดสอบการขอคำใบ้โดย Player 1 ---");
        let player1PoolBalanceBeforeHint = await poolManager.poolBalances(player1.address);
        console.log(`Player 1 Pool Balance before hint: ${ethers.formatUnits(player1PoolBalanceBeforeHint, 18)} QZC`);
        let developerFundAddressFromQuizGame = await quizGame.developerFundAddress();
        let developerFundAddressFromPoolManager = await poolManager.developerFundAddress();
        
        if (developerFundAddressFromQuizGame !== developerFundAddressFromPoolManager) {
            console.warn("WARNING: Developer Fund Addresses in QuizGame and PoolManager are different! This might cause issues.");
            console.warn(`  QuizGame's Dev Fund: ${developerFundAddressFromQuizGame}`);
            console.warn(`  PoolManager's Dev Fund: ${developerFundAddressFromPoolManager}`);
        }
        
        let developerFundBalanceBeforeHint = await quizCoin.balanceOf(developerFundAddressFromPoolManager);
        console.log(`Developer Fund QZC Balance (from PoolManager's perspective) before hint: ${ethers.formatUnits(developerFundBalanceBeforeHint, 18)} QZC`);
        
        let poolManagerQZCBalanceBeforeHint = await quizCoin.balanceOf(poolManager.target);
        console.log(`PoolManager QZC Balance before hint: ${ethers.formatUnits(poolManagerQZCBalanceBeforeHint, 18)} QZC`);

        console.log(`Player 1 requesting hint for Question ID ${question1Id} with cost ${ethers.formatUnits(hintCost1, 18)} QZC...`);
        try {
            const getHintTx = await quizGame.connect(player1).getHint(question1Id);
            const hintReceipt = await getHintTx.wait();
            if (hintReceipt.status === 1) {
                console.log("Player 1 requested hint successfully (transaction status OK).");
            } else {
                console.error("ERROR: Player 1 hint request transaction failed (status not OK).");
            }

            const hintEvent = hintReceipt.logs.find(log => quizGame.interface.parseLog(log)?.name === "HintRequested");
            if (hintEvent) {
                const parsedEvent = quizGame.interface.parseLog(hintEvent);
                console.log(`  HintRequested Event: Question ID ${parsedEvent.args.questionId}, Requester ${parsedEvent.args.requester}, Cost ${ethers.formatUnits(parsedEvent.args.hintCost, 18)} QZC`);
            } else {
                console.log("  No HintRequested Event found. Hint cost might not have been withdrawn.");
            }
            // --- NEW: Delay after hint request ---
            console.log("Waiting for 5 seconds after hint request for balances to update on chain...");
            await sleep(5000);

        } catch (error) {
            console.error(`CRITICAL ERROR during Player 1 hint request: ${error.message}`);
            console.error(`  This usually means PoolManager.withdrawForHint reverted. Check player's pool balance or QuizGame's role in PoolManager.`);
            process.exit(1); // Exit here since hint request failed, subsequent steps will also fail
        }
        
        let player1PoolBalanceAfterHint = await poolManager.poolBalances(player1.address);
        console.log(`Player 1 Pool Balance after hint: ${ethers.formatUnits(player1PoolBalanceAfterHint, 18)} QZC (Expected: ${ethers.formatUnits(player1PoolBalanceBeforeHint - hintCost1, 18)})`);
        let developerFundBalanceAfterHint = await quizCoin.balanceOf(developerFundAddressFromPoolManager);
        console.log(`Developer Fund QZC Balance after hint: ${ethers.formatUnits(developerFundBalanceAfterHint, 18)} QZC (Expected increase by ${ethers.formatUnits(hintCost1, 18)})`);
        let poolManagerQZCBalanceAfterHint = await quizCoin.balanceOf(poolManager.target);
        console.log(`PoolManager QZC Balance after hint: ${ethers.formatUnits(poolManagerQZCBalanceAfterHint, 18)} QZC (Expected decrease by ${ethers.formatUnits(hintCost1, 18)})`);

        if (player1PoolBalanceAfterHint !== player1PoolBalanceBeforeHint - hintCost1) {
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
        developerFundAddressFromQuizGame = await quizGame.developerFundAddress();
        let developerFundBalanceBeforeSolve = await quizCoin.balanceOf(developerFundAddressFromQuizGame);
        console.log(`Developer Fund QZC Balance before solve fee: ${ethers.formatUnits(developerFundBalanceBeforeSolve, 18)} QZC`);

        // --- FIX: Declare expectedRewardAmount and expectedFeeAmount outside try block ---
        let expectedRewardAmount = 0n;
        let expectedFeeAmount = 0n;

        console.log(`Player 1 submitting answer "${answer1}" for Question ID ${question1Id}...`);
        try {
            const submitAnswerTx = await quizGame.connect(player1).submitAnswer(question1Id, answer1);
            const answerReceipt = await submitAnswerTx.wait();
            if (answerReceipt.status === 1) {
                console.log("Player 1 submitted answer successfully (transaction status OK).");
            } else {
                console.error("ERROR: Player 1 submit answer transaction failed (status not OK).");
            }

            const solvedEvent = answerReceipt.logs.find(log => quizGame.interface.parseLog(log)?.name === "QuestionSolved");
            if (solvedEvent) {
                const parsedEvent = quizGame.interface.parseLog(solvedEvent);
                expectedRewardAmount = parsedEvent.args.rewardAmount; // Assign value here
                expectedFeeAmount = parsedEvent.args.feeAmount;     // Assign value here
                console.log(`  QuestionSolved Event: ID ${parsedEvent.args.id}, Solver ${parsedEvent.args.solver}, Reward ${ethers.formatUnits(expectedRewardAmount, 18)} QZC, Fee ${ethers.formatUnits(expectedFeeAmount, 18)} QZC`);
            } else {
                console.error("ERROR: QuestionSolved Event not found. Reward might not have been minted.");
            }

            const rewardFeeTransferEvent = answerReceipt.logs.find(log => quizGame.interface.parseLog(log)?.name === "RewardFeeTransferred");
            if (rewardFeeTransferEvent) {
                const parsedEvent = quizGame.interface.parseLog(rewardFeeTransferEvent);
                console.log(`  RewardFeeTransferred Event: To ${parsedEvent.args.to}, Amount ${ethers.formatUnits(parsedEvent.args.amount, 18)} QZC`);
            } else {
                 console.error("ERROR: RewardFeeTransferred Event not found. Fee might not have been minted.");
            }
            // --- NEW: Delay after submitting answer ---
            console.log("Waiting for 5 seconds after submitting answer for balances to update on chain...");
            await sleep(5000);

        } catch (error) {
            console.error(`CRITICAL ERROR during Player 1 submit answer: ${error.message}`);
            process.exit(1);
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
        let player1PoolBalanceBeforeWithdrawal = await poolManager.poolBalances(player1.address);
        console.log(`Player 1 Pool Balance before withdrawal: ${ethers.formatUnits(player1PoolBalanceBeforeWithdrawal, 18)} QZC`);
        let player1QZCBalanceBeforeWithdrawal = await quizCoin.balanceOf(player1.address);
        console.log(`Player 1 QZC Balance before withdrawal from pool: ${ethers.formatUnits(player1QZCBalanceBeforeWithdrawal, 18)} QZC`);
        let poolManagerQZCBalanceBeforeWithdrawal = await quizCoin.balanceOf(poolManager.target);
        console.log(`PoolManager QZC Balance before withdrawal: ${ethers.formatUnits(poolManagerQZCBalanceBeforeWithdrawal, 18)} QZC`);


        if (player1PoolBalanceBeforeWithdrawal > 0n) {
            console.log(`Player 1 withdrawing ${ethers.formatUnits(player1PoolBalanceBeforeWithdrawal, 18)} QZC from PoolManager.`);
            try {
                const withdrawTx = await poolManager.connect(player1).withdraw(player1PoolBalanceBeforeWithdrawal);
                const withdrawReceipt = await withdrawTx.wait();
                if (withdrawReceipt.status === 1) {
                    console.log("Player 1 withdrew QZC from PoolManager successfully (transaction status OK).");
                } else {
                    console.error("ERROR: Player 1 withdrawal transaction failed (status not OK).");
                }
                const withdrawEvent = withdrawReceipt.logs.find(log => poolManager.interface.parseLog(log)?.name === "Withdrew");
                if (withdrawEvent) {
                    const parsedEvent = poolManager.interface.parseLog(withdrawEvent);
                    console.log(`  Withdrew Event: User ${parsedEvent.args.user}, Amount ${ethers.formatUnits(parsedEvent.args.amount, 18)} QZC`);
                } else {
                    console.log("  No Withdrew event found. Withdrawal might not have occurred.");
                }
                // --- NEW: Delay after withdrawal ---
                console.log("Waiting for 5 seconds after withdrawal for balances to update on chain...");
                await sleep(5000);

            } catch (error) {
                console.error(`CRITICAL ERROR during Player 1 withdrawal: ${error.message}`);
                console.error(`  This usually means PoolManager.withdraw reverted. Check PoolManager's QZC balance or player's pool balance.`);
                process.exit(1);
            }
            
            let finalPlayer1PoolBalance = await poolManager.poolBalances(player1.address);
            console.log(`Player 1 Pool Balance after withdrawal: ${ethers.formatUnits(finalPlayer1PoolBalance, 18)} QZC (Expected 0)`);
            let player1QZCBalanceAfterWithdrawal = await quizCoin.balanceOf(player1.address);
            console.log(`Player 1 QZC Balance after withdrawal from pool: ${ethers.formatUnits(player1QZCBalanceAfterWithdrawal, 18)} QZC (Expected increase by ${ethers.formatUnits(player1PoolBalanceBeforeWithdrawal, 18)})`);
            let poolManagerQZCBalanceAfterWithdrawal = await quizCoin.balanceOf(poolManager.target);
            console.log(`PoolManager QZC Balance after withdrawal: ${ethers.formatUnits(poolManagerQZCBalanceAfterWithdrawal, 18)} QZC (Expected decrease by ${ethers.formatUnits(player1PoolBalanceBeforeWithdrawal, 18)})`);


            if (finalPlayer1PoolBalance !== 0n) {
                console.error("ERROR: Player 1's pool balance did NOT become zero after withdrawal.");
            }
            if (player1QZCBalanceAfterWithdrawal !== player1QZCBalanceBeforeWithdrawal + player1PoolBalanceBeforeWithdrawal) {
                 console.error("ERROR: Player 1's QZC balance did NOT increase correctly after withdrawal.");
            }
            if (poolManagerQZCBalanceAfterWithdrawal !== poolManagerQZCBalanceBeforeWithdrawal - player1PoolBalanceBeforeWithdrawal) {
                 console.error("ERROR: PoolManager's QZC balance did NOT decrease correctly after withdrawal.");
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
            if (error.message.includes("AccessControl:") || error.message.includes("revert") || error.message.includes("Ownable:")) {
                console.log("สำเร็จ: Player 2 ไม่สามารถสร้างคำถามได้ (เนื่องจากข้อผิดพลาด: Transaction reverted by AccessControl)");
            } else {
                console.error(`ข้อผิดพลาดที่ไม่คาดคิดในการสร้างคำถามโดย Player 2: ${error.message}`);
            }
        }

    } catch (error) {
        console.error("\n--- เกิดข้อผิดพลาดร้ายแรงในการรันสคริปต์ ---");
        console.error(`Error Message: ${error.message}`);
        console.error(`Error Code: ${error.code || 'N/A'}`);
        // console.error("Full Error Object:", error); // Uncomment for more detailed error
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