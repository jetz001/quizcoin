const { expect } = require("chai");
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy Facets
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
    const diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.waitForDeployment();
    console.log("DiamondCutFacet deployed to:", diamondCutFacet.target);

    const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet");
    const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
    await diamondLoupeFacet.waitForDeployment();
    console.log("DiamondLoupeFacet deployed to:", diamondLoupeFacet.target);

    const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet");
    const ownershipFacet = await OwnershipFacet.deploy();
    await ownershipFacet.waitForDeployment();
    console.log("OwnershipFacet deployed to:", ownershipFacet.target);

    const QuizCreationFacet = await ethers.getContractFactory("QuizCreationFacet");
    const quizCreationFacet = await QuizCreationFacet.deploy();
    await quizCreationFacet.waitForDeployment();
    console.log("QuizCreationFacet deployed to:", quizCreationFacet.target);

    // --- Deploy QuizParticipationFacet ใหม่ ---
    const QuizParticipationFacet = await ethers.getContractFactory("QuizParticipationFacet");
    const quizParticipationFacet = await QuizParticipationFacet.deploy();
    await quizParticipationFacet.waitForDeployment();
    console.log("QuizParticipationFacet deployed to:", quizParticipationFacet.target);


    // นำ Diamond Contract ที่ Deploy ไปแล้วมาใช้งาน
    // *** สำคัญ: ต้องแน่ใจว่า Address นี้คือ Diamond Contract ตัวเดิมของคุณ
    const diamondAddress = "0x1A63EE98CF346227E606BDB22f0A886088910100";
    const diamond = await ethers.getContractAt("IDiamondCut", diamondAddress);
    // เพิ่มการเข้าถึง DiamondLoupeFacet ผ่าน Diamond Proxy
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    console.log("Using existing Diamond at:", diamond.target);

    // เพิ่ม/อัปเดต Facets ใน Diamond
    console.log("Adding/Updating Facets to Diamond...");

    // Facet สำหรับ QuizCreation
    // ใช้ action: 0 (Add) สำหรับ Facet นี้ ถ้าไม่มีอยู่แล้ว
    const quizCreationCut = [
        {
            facetAddress: quizCreationFacet.target,
            action: 0, // Add (0)
            functionSelectors: [
                quizCreationFacet.interface.getFunction("createQuiz").selector,
                quizCreationFacet.interface.getFunction("addQuestion").selector,
                quizCreationFacet.interface.getFunction("activateQuiz").selector,
                quizCreationFacet.interface.getFunction("deactivateQuiz").selector,
                quizCreationFacet.interface.getFunction("getQuiz").selector,
                quizCreationFacet.interface.getFunction("getQuestion").selector,
                quizCreationFacet.interface.getFunction("getTotalQuizzes").selector
            ],
        },
    ];

    try {
        // เพิ่ม QuizCreationFacet (ถ้ายังไม่มี)
        const txCreation = await diamond.diamondCut(
            quizCreationCut,
            ethers.ZeroAddress,
            "0x"
        );
        await txCreation.wait();
        console.log("QuizCreationFacet added/updated to Diamond.");
    } catch (e) {
        if (e.message.includes("Cannot add function that already exists") || e.message.includes("Can't add function that already exists")) {
            console.log("QuizCreationFacet functions already exist. Skipping diamondCut for Creation Facet.");
        } else {
            throw e; // Rethrow other errors
        }
    }

    // --- อัปเดต QuizParticipationFacet: Remove เก่า, Add ใหม่ ---
    const quizParticipationSelectors = [
        quizParticipationFacet.interface.getFunction("joinQuiz").selector,
        quizParticipationFacet.interface.getFunction("submitAnswer").selector,
        quizParticipationFacet.interface.getFunction("getQuizParticipationStatus").selector,
        quizParticipationFacet.interface.getFunction("getPlayerScore").selector
    ];

    let currentQuizParticipationFacetAddress = ethers.ZeroAddress;
    try {
        // ตรวจสอบว่าฟังก์ชัน "submitAnswer" ชี้ไปที่ Facet Address ใดอยู่
        currentQuizParticipationFacetAddress = await diamondLoupe.facetAddress(quizParticipationFacet.interface.getFunction("submitAnswer").selector);
    } catch (e) {
        // อาจจะเกิด error ถ้าฟังก์ชันยังไม่มี
        console.log("submitAnswer function not found on Diamond, assuming fresh add.");
    }

    if (currentQuizParticipationFacetAddress != ethers.ZeroAddress && currentQuizParticipationFacetAddress != quizParticipationFacet.target) {
        console.log(`Found existing QuizParticipationFacet functions at ${currentQuizParticipationFacetAddress}. Removing old functions...`);
        // Remove ฟังก์ชันเก่าจาก Facet Address เดิม
        const removeCut = [{
            facetAddress: ethers.ZeroAddress, // Address เป็น 0x00...00 สำหรับการ Remove
            action: 2, // Remove (2)
            functionSelectors: quizParticipationSelectors,
        }];
        const txRemove = await diamond.diamondCut(removeCut, ethers.ZeroAddress, "0x");
        await txRemove.wait();
        console.log("Old QuizParticipationFacet functions removed.");
    }

    // Add ฟังก์ชันใหม่ด้วย Facet Address ที่ Deploy ล่าสุด
    console.log("Adding new QuizParticipationFacet functions to Diamond...");
    const addCut = [{
        facetAddress: quizParticipationFacet.target,
        action: 0, // Add (0)
        functionSelectors: quizParticipationSelectors,
    }];
    const txAdd = await diamond.diamondCut(addCut, ethers.ZeroAddress, "0x");
    await txAdd.wait();
    console.log("New QuizParticipationFacet functions added.");


    // --- การทดสอบ Facet ต่างๆ ผ่าน Diamond ---
    console.log("\n--- Testing QuizCreationFacet through Diamond ---");
    const QuizCreationFacetABI = (await ethers.getContractFactory("QuizCreationFacet")).interface;
    const quizDiamondCreator = new ethers.Contract(diamondAddress, QuizCreationFacetABI, deployer);

    // 1. สร้าง Quiz
    const quizName = "Advanced DApp Quiz V3"; // เปลี่ยนชื่อ Quiz เพื่อให้ไม่ซ้ำกัน
    const reward = ethers.parseEther("0.05");
    const maxParticipants = 50;
    console.log(`Creating quiz "${quizName}"...`);
    const createQuizTx = await quizDiamondCreator.createQuiz(quizName, reward, maxParticipants);
    const createQuizReceipt = await createQuizTx.wait();
    const quizCreatedEvent = createQuizReceipt.logs.find(log => log.fragment && log.fragment.name === "QuizCreated");
    const quizId = quizCreatedEvent.args.quizId;
    console.log(`Quiz created with ID: ${quizId}`);

    // 2. เพิ่มคำถาม
    console.log(`Adding questions to Quiz ID ${quizId}...`);
    const addQuestionTx1 = await quizDiamondCreator.addQuestion(quizId, "What is a blockchain?", ["A distributed ledger", "A centralized database", "A type of cryptocurrency"], 0);
    await addQuestionTx1.wait();
    const addQuestionTx2 = await quizDiamondCreator.addQuestion(quizId, "What is the native token of BSC?", ["ETH", "BNB", "ADA"], 1);
    await addQuestionTx2.wait();
    console.log("Questions added.");

    // 3. Activate Quiz
    console.log(`Activating Quiz ID ${quizId}...`);
    const activateQuizTx = await quizDiamondCreator.activateQuiz(quizId);
    await activateQuizTx.wait();
    console.log("Quiz activated.");

    // 4. Verify Quiz data
    const createdQuiz = await quizDiamondCreator.getQuiz(quizId);
    console.log("Retrieved Quiz Data:", createdQuiz);

    expect(createdQuiz.name).to.equal(quizName);
    expect(createdQuiz.creator).to.equal(deployer.address);
    expect(createdQuiz.totalQuestions).to.equal(2n);
    expect(createdQuiz.isActive).to.equal(true);

    const question1 = await quizDiamondCreator.getQuestion(quizId, 0);
    console.log("Question 1:", question1.questionText);
    expect(question1.questionText).to.equal("What is a blockchain?");

    const question2 = await quizDiamondCreator.getQuestion(quizId, 1);
    console.log("Question 2:", question2.questionText);
    expect(question2.questionText).to.equal("What is the native token of BSC?");

    console.log("QuizCreationFacet tests successful!");

    // --- Testing QuizParticipationFacet through Diamond ---
    console.log("\n--- Testing QuizParticipationFacet through Diamond ---");
    const QuizParticipationFacetABI = (await ethers.getContractFactory("QuizParticipationFacet")).interface;
    const quizDiamondPlayer = new ethers.Contract(diamondAddress, QuizParticipationFacetABI, deployer); // ใช้ deployer เป็นผู้เล่นคนแรก

    // 1. ผู้เล่นเข้าร่วม Quiz
    console.log(`Player ${deployer.address} joining Quiz ID ${quizId}...`);
    const joinTx = await quizDiamondPlayer.joinQuiz(quizId);
    await joinTx.wait();
    console.log("Player joined quiz.");

    // ตรวจสอบสถานะการเข้าร่วม
    let [hasJoined, playerScore, lastAnsweredIndex] = await quizDiamondPlayer.getQuizParticipationStatus(quizId, deployer.address);
    console.log(`Player Participation Status: Joined=${hasJoined}, Score=${ethers.formatEther(playerScore)} BNB, Last Answered=${lastAnsweredIndex}`);
    expect(hasJoined).to.be.true;
    expect(playerScore).to.equal(0n); // เริ่มต้นคะแนนเป็น 0
    expect(lastAnsweredIndex).to.equal(ethers.MaxUint256);

    // 2. ผู้เล่นส่งคำตอบ (คำถามที่ 0: What is a blockchain? Answer: 0 (A distributed ledger))
    console.log(`Player ${deployer.address} submitting answer for Question 0 (correct)...`);
    const submitAnswerTx1 = await quizDiamondPlayer.submitAnswer(quizId, 0, 0); // ตอบถูก
    await submitAnswerTx1.wait();
    console.log("Answer for Question 0 submitted.");

    // ตรวจสอบคะแนนหลังตอบคำถามแรก
    playerScore = await quizDiamondPlayer.getPlayerScore(quizId, deployer.address);
    console.log(`Player Score after Q0: ${ethers.formatEther(playerScore)} BNB`);
    expect(playerScore).to.equal(reward); // ควรได้คะแนนเท่ากับ rewardAmount

    // 3. ผู้เล่นส่งคำตอบ (คำถามที่ 1: What is the native token of BSC? Answer: 1 (BNB))
    console.log(`Player ${deployer.address} submitting answer for Question 1 (correct)...`);
    const submitAnswerTx2 = await quizDiamondPlayer.submitAnswer(quizId, 1, 1); // ตอบถูก
    const submitAnswerReceipt2 = await submitAnswerTx2.wait();
    console.log("Answer for Question 1 submitted.");

    // ตรวจสอบคะแนนหลังตอบคำถามที่สอง (และคาดหวัง event QuizCompleted)
    playerScore = await quizDiamondPlayer.getPlayerScore(quizId, deployer.address);
    console.log(`Player Score after Q1: ${ethers.formatEther(playerScore)} BNB`);
    expect(playerScore).to.equal(reward * 2n); // ควรได้คะแนนเป็นสองเท่าของ reward

    const quizCompletedEvent = submitAnswerReceipt2.logs.find(log => log.fragment && log.fragment.name === "QuizCompleted");
    expect(quizCompletedEvent).to.exist;
    expect(quizCompletedEvent.args.quizId).to.equal(quizId);
    expect(quizCompletedEvent.args.player).to.equal(deployer.address);
    expect(quizCompletedEvent.args.finalScore).to.equal(reward * 2n);

    console.log("QuizParticipationFacet tests successful!");
    console.log("\nAll facets deployed and integrated successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });