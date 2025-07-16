// scripts/distributeRewards.js
require('dotenv').config();
const { ethers } = require("ethers");
const path = require('path');
const fs = require('fs');

async function main() {
    // กำหนดค่าจาก .env
    const privateKey = process.env.REWARD_DISTRIBUTOR_PRIVATE_KEY;
    const rpcUrl = process.env.SEPOLIA_RPC_URL; // ใช้ SEPOLIA_RPC_URL ที่กำหนดไว้ใน .env
    const diamondAddress = process.env.DIAMOND_ADDRESS; // ที่อยู่ของ QuizGameDiamond ที่ Deploy แล้ว

    if (!privateKey || !rpcUrl || !diamondAddress) {
        console.error("Please set REWARD_DISTRIBUTOR_PRIVATE_KEY, SEPOLIA_RPC_URL, and DIAMOND_ADDRESS in your .env file.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`Automation wallet connected: ${wallet.address}`);

    // โหลด ABI ของ Facet ที่จำเป็น
    const QuizGameBaseFacetABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/facets/QuizGameBaseFacet.sol/QuizGameBaseFacet.json'), 'utf8')).abi;
    const QuizGameModeFacetABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/facets/QuizGameModeFacet.sol/QuizGameModeFacet.json'), 'utf8')).abi;
    const QuizGameRewardFacetABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/facets/QuizGameRewardFacet.sol/QuizGameRewardFacet.json'), 'utf8')).abi;

    // สร้าง Contract Instances ที่ชี้ไปที่ Diamond Address
    const quizGameBaseFacet = new ethers.Contract(diamondAddress, QuizGameBaseFacetABI, wallet);
    const quizGameModeFacet = new ethers.Contract(diamondAddress, QuizGameModeFacetABI, wallet);
    const quizGameRewardFacet = new ethers.Contract(diamondAddress, QuizGameRewardFacetABI, wallet);

    console.log("Checking for pool questions to distribute rewards...");

    // *** ส่วนนี้คือหัวใจสำคัญ: คุณจะต้องหาวิธีดึง Question IDs ที่เป็น Pool Mode และรอการแจกรางวัล ***
    // ในเบื้องต้น เราอาจจะวนลูปจาก ID ที่ทราบ หรือต้องมีฟังก์ชันใน Diamond ที่ช่วยลิสต์
    // เช่น: เพิ่มฟังก์ชัน getNextQuestionId() ใน QuizGameBaseFacet เพื่อให้รู้ว่ามีคำถามกี่ข้อแล้ว
    // หรือ ใช้ Indexer / Subgraph เพื่อดึง Event QuestionCreated และติดตามสถานะ

    // สำหรับการทดสอบเบื้องต้น เราจะใช้การวนลูปจาก 1 ถึง nextQuestionId (ซึ่งต้องมี getter)
    let totalQuestions = 0;
    try {
        // Assume you add a getter in QuizGameBaseFacet for nextQuestionId
        totalQuestions = await quizGameBaseFacet.nextQuestionId(); // Need to add this getter
    } catch (error) {
        console.warn("Could not fetch totalQuestions from QuizGameBaseFacet. Assuming a small range for testing.");
        totalQuestions = 10; // Fallback for initial testing
    }

    const poolWindowDuration = await quizGameBaseFacet.getPoolRewardWindowDuration();
    const level100ValiditySeconds = await quizGameBaseFacet.getLevel100QuestionValiditySeconds();

    for (let questionId = 1; questionId < totalQuestions; questionId++) { // Loop through potential question IDs
        try {
            const question = await quizGameModeFacet.questions(questionId);
            
            // Skip if question doesn't exist, is closed, or not a Pool mode question, or no first solver
            if (question.correctAnswerHash === ethers.ZeroHash || 
                question.isClosed || 
                question.mode !== 1 /* LibAppStorage.QuestionMode.Pool */ ||
                question.firstCorrectAnswerTime === 0) 
            {
                continue; // Skip irrelevant questions
            }

            let requiredTimePassed;
            if (question.difficultyLevel === 100) {
                requiredTimePassed = level100ValiditySeconds;
            } else {
                requiredTimePassed = poolWindowDuration;
            }

            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime >= question.firstCorrectAnswerTime + requiredTimePassed) {
                console.log(`Attempting to distribute rewards for Question ID: ${questionId}`);
                const tx = await quizGameRewardFacet.distributeRewards(questionId);
                await tx.wait();
                console.log(`Rewards distributed for Question ID: ${questionId}. Tx Hash: ${tx.hash}`);
            } else {
                console.log(`Question ID: ${questionId} - Pool window not over yet. Time remaining: ${question.firstCorrectAnswerTime + requiredTimePassed - currentTime} seconds.`);
            }
        } catch (error) {
            // Filter out common reverts that are part of expected flow (e.g., already closed, not over yet)
            if (error.message.includes("Quiz: Pool window is not over yet.") ||
                error.message.includes("Quiz: Question is already closed.") ||
                error.message.includes("Quiz: Level 100 Pool question has expired")) 
            {
                // console.log(`Skipping Question ID: ${questionId} due to known condition: ${error.message.split("Reason: ")[1] || error.message}`);
                continue; // Don't log as error, just skip
            } else {
                console.error(`Error processing Question ID ${questionId}:`, error.message);
            }
        }
    }
    console.log("Automation run complete.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});