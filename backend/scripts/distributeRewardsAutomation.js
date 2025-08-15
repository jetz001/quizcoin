// scripts/distributeRewardsAutomation.js (ตัวอย่างแนวคิด)
require('dotenv').config();
const { ethers } = require("ethers");
const path = require('path');
const fs = require('fs');

async function main() {
    const privateKey = process.env.REWARD_DISTRIBUTOR_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    // Load ABIs (make sure you have your compiled ABIs)
    const quizGameModeAbi = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/facets/QuizGameModeFacet.sol/QuizGameModeFacet.json'), 'utf8')).abi;
    const quizGameRewardAbi = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/facets/QuizGameRewardFacet.sol/QuizGameRewardFacet.json'), 'utf8')).abi;

    if (!privateKey || !rpcUrl || !diamondAddress) {
        console.error("Please set REWARD_DISTRIBUTOR_PRIVATE_KEY, RPC_URL, and DIAMOND_ADDRESS in your .env file.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`Automation wallet connected: ${wallet.address}`);

    // Get contracts (assuming Diamond acts as the proxy)
    const quizGameModeFacet = new ethers.Contract(diamondAddress, quizGameModeAbi, wallet);
    const quizGameRewardFacet = new ethers.Contract(diamondAddress, quizGameRewardAbi, wallet);

    // This is a placeholder. You'll need a way to get a list of question IDs
    // that are in Pool Mode and whose reward window has ended.
    // You might need to add a getter function to your diamond like `getPendingPoolQuestions()`
    // or query past events (QuestionRewardWindowStarted) and filter off-chain.
    let questionIdsToCheck = [1, 2, 3]; // Example: Replace with dynamic fetching

    console.log("Checking for pool questions to distribute rewards...");

    for (const questionId of questionIdsToCheck) {
        try {
            // Get question details (you might need a getter in your facet)
            // Assuming you'd have a public getter function for questions in QuizGameModeFacet
            const question = await quizGameModeFacet.questions(questionId); // Need to expose this getter!

            // Basic checks (more robust checks should be in the contract)
            if (question.mode === 1 /* Pool */ && !question.isClosed && question.firstCorrectAnswerTime !== 0) {
                const appStorage = await quizGameModeFacet.s(); // This won't work directly from JS, need specific getters or to get constants from contract
                // You'll need to fetch ds.POOL_REWARD_WINDOW_DURATION_SECONDS and ds.LEVEL_100_QUESTION_VALIDITY_SECONDS from the contract.
                // Add getter functions in QuizGameBaseFacet for these constants if they aren't directly accessible.
                const poolWindowDuration = await quizGameModeFacet.getPoolRewardWindowDuration(); // Example getter
                const level100ValiditySeconds = await quizGameModeFacet.getLevel100QuestionValiditySeconds(); // Example getter

                let requiredTimePassed;
                if (question.difficultyLevel === 100) {
                    requiredTimePassed = level100ValiditySeconds;
                } else {
                    requiredTimePassed = poolWindowDuration;
                }

                if (Date.now() / 1000 >= question.firstCorrectAnswerTime + requiredTimePassed) {
                    console.log(`Attempting to distribute rewards for Question ID: ${questionId}`);
                    const tx = await quizGameRewardFacet.distributeRewards(questionId);
                    await tx.wait();
                    console.log(`Rewards distributed for Question ID: ${questionId}. Tx Hash: ${tx.hash}`);
                } else {
                    console.log(`Question ID: ${questionId} - Pool window not over yet.`);
                }
            }
        } catch (error) {
            if (error.message.includes("Quiz: Pool window is not over yet.")) {
                console.log(`Question ID: ${questionId} - Pool window not over yet (handled revert).`);
            } else if (error.message.includes("Quiz: Question is already closed.")) {
                console.log(`Question ID: ${questionId} - Already closed (handled revert).`);
            } else if (error.message.includes("Quiz: Level 100 Pool question has expired")) {
                console.log(`Question ID: ${questionId} - Level 100 Pool question expired (handled revert).`);
            }
            else {
                console.error(`Error processing Question ID ${questionId}:`, error.message);
            }
        }
    }
    console.log("Automation run complete.");
}

// Add getter functions in QuizGameBaseFacet to expose constants needed by the script
// E.g., function getPoolRewardWindowDuration() public view returns (uint256) { return LibAppStorage.s().POOL_REWARD_WINDOW_DURATION_SECONDS; }

main().catch((error) => {
    console.error(error);
    process.exit(1);
});