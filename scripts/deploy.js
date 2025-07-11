const { ethers } = require("hardhat");
const { getSelectors, FacetCutAction } = require("./libraries/diamond.js");

// กำหนด gas limit เพื่อหลีกเลี่ยง Out of Gas บน Testnet/Mainnet
const gasLimit = 6000000; 

async function deployDiamond() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    console.log(`Deploying contracts with the account: ${deployer.address}`);

    // Deploy Facets ทั้งหมดก่อน เพื่อให้ตัวแปร ...Deployed พร้อมใช้งาน
    console.log("\n--- Deploying Facets ---");
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
    const DiamondCutFacetDeployed = await DiamondCutFacet.deploy({ gasLimit: gasLimit });
    await DiamondCutFacetDeployed.waitForDeployment();
    console.log(`DiamondCutFacet deployed to: ${DiamondCutFacetDeployed.target}`);

    const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet");
    const DiamondLoupeFacetDeployed = await DiamondLoupeFacet.deploy({ gasLimit: gasLimit });
    await DiamondLoupeFacetDeployed.waitForDeployment();
    console.log(`DiamondLoupeFacet deployed to: ${DiamondLoupeFacetDeployed.target}`);

    const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet");
    const OwnershipFacetDeployed = await OwnershipFacet.deploy({ gasLimit: gasLimit });
    await OwnershipFacetDeployed.waitForDeployment();
    console.log(`OwnershipFacet deployed to: ${OwnershipFacetDeployed.target}`);

    const QuizCreationFacet = await ethers.getContractFactory("QuizCreationFacet");
    const QuizCreationFacetDeployed = await QuizCreationFacet.deploy({ gasLimit: gasLimit });
    await QuizCreationFacetDeployed.waitForDeployment();
    console.log(`QuizCreationFacet deployed to: ${QuizCreationFacetDeployed.target}`);

    const QuizParticipationFacet = await ethers.getContractFactory("QuizParticipationFacet");
    const QuizParticipationFacetDeployed = await QuizParticipationFacet.deploy({ gasLimit: gasLimit });
    await QuizParticipationFacetDeployed.waitForDeployment();
    console.log(`QuizParticipationFacet deployed to: ${QuizParticipationFacetDeployed.target}`);

    // กำหนด Diamond Address (บังคับให้ Deploy Diamond Contract ใหม่ทุกครั้งเพื่อความง่ายในการทดสอบ)
    let currentDiamondAddress = ethers.ZeroAddress; 
    
    let diamond;
    let diamondLoupe;
    let diamondOwnership;

    // ถ้าเป็น Zero Address ให้ Deploy Diamond Contract ใหม่
    if (currentDiamondAddress === ethers.ZeroAddress) {
        console.log("\n--- Deploying new Diamond Contract ---");
        const Diamond = await ethers.getContractFactory("Diamond");
        const diamondDeployed = await Diamond.deploy(deployer.address, { gasLimit: gasLimit }); // ส่ง owner address ให้ constructor
        await diamondDeployed.waitForDeployment();
        currentDiamondAddress = diamondDeployed.target;
        console.log(`New Diamond Contract deployed to: ${currentDiamondAddress}`);

        // เชื่อมต่อกับ Diamond Contract ที่เพิ่ง Deploy ใหม่
        diamond = await ethers.getContractAt("IDiamondCut", currentDiamondAddress);
        diamondLoupe = await ethers.getContractAt("IDiamondLoupe", currentDiamondAddress); 
        diamondOwnership = await ethers.getContractAt("IERC173", currentDiamondAddress); 

        // --- เพิ่ม DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet เป็นครั้งแรก ---
        // ตอนนี้ตัวแปร ...Deployed พร้อมใช้งานแล้ว
        console.log("\n--- Performing Initial Diamond Cut for Core Facets ---");
        let initialDiamondCut = [];
        initialDiamondCut.push(
            {
                facetAddress: DiamondCutFacetDeployed.target,
                action: FacetCutAction.Add,
                functionSelectors: getSelectors(DiamondCutFacetDeployed)
            },
            {
                facetAddress: DiamondLoupeFacetDeployed.target,
                action: FacetCutAction.Add,
                functionSelectors: getSelectors(DiamondLoupeFacetDeployed)
            },
            {
                facetAddress: OwnershipFacetDeployed.target,
                action: FacetCutAction.Add,
                functionSelectors: getSelectors(OwnershipFacetDeployed)
            }
        );
        await (await diamond.diamondCut(initialDiamondCut, ethers.ZeroAddress, "0x", { gasLimit: gasLimit })).wait();
        console.log("Core Facets (DiamondCut, DiamondLoupe, Ownership) added to new Diamond.");

    } else {
        console.log(`\nUsing existing Diamond at: ${currentDiamondAddress}`);
        // ถ้าใช้ Diamond เดิม, เชื่อมต่อกับมัน
        diamond = await ethers.getContractAt("IDiamondCut", currentDiamondAddress);
        diamondLoupe = await ethers.getContractAt("IDiamondLoupe", currentDiamondAddress); 
        diamondOwnership = await ethers.getContractAt("IERC173", currentDiamondAddress); 
    }
    
    // --- Adding/Updating Facets to Diamond ---
    // ส่วนนี้จะจัดการกับ QuizCreationFacet และ QuizParticipationFacet
    // ซึ่ง DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet ได้ถูกเพิ่มไปแล้วใน initialDiamondCut ด้านบน
    console.log("\n--- Adding/Updating Quiz & Participation Facets to Diamond ---");
    let diamondCut = [];

    // --- จัดการ QuizCreationFacet ---
    const newCreationSelectors = getSelectors(QuizCreationFacetDeployed);
    let oldCreationSelectors = [];
    let currentCreationFacetAddress = ethers.ZeroAddress; 
    
    // พยายามดึงข้อมูลจาก DiamondLoupeFacade ก็ต่อเมื่อมันถูกติดตั้งแล้วเท่านั้น
    try {
        currentCreationFacetAddress = await diamondLoupe.facetAddress(newCreationSelectors[0]);
        // ถ้า Facet เดิมอยู่ที่ address เดียวกับที่ Deploy ใหม่ ให้ดึง selectors เดิมจาก address นั้น
        if (currentCreationFacetAddress === QuizCreationFacetDeployed.target) {
            oldCreationSelectors = await diamondLoupe.facetFunctionSelectors(QuizCreationFacetDeployed.target);
        } else if (currentCreationFacetAddress !== ethers.ZeroAddress) {
            // ถ้า selector นี้มีอยู่แล้ว แต่อยู่ที่ address อื่น (Facet เก่า)
            console.log(`QuizCreationFacet's first selector found at a different address: ${currentCreationFacetAddress}.`);
            oldCreationSelectors = await diamondLoupe.facetFunctionSelectors(currentCreationFacetAddress);
        }
    } catch (e) {
        console.log(`Note: Initial check for QuizCreationFacet might fail if this is a new Diamond or previous deployment was incomplete. Error: ${e.message}`);
    }
    
    // ตรวจสอบว่า Facet นี้ถูกติดตั้งและมีฟังก์ชันครบถ้วนแล้วหรือไม่ และ Facet Address ตรงกัน
    const isCreationFacetUpToDate = currentCreationFacetAddress === QuizCreationFacetDeployed.target &&
                                    oldCreationSelectors.length > 0 && 
                                    newCreationSelectors.every(selector => oldCreationSelectors.includes(selector)) &&
                                    oldCreationSelectors.every(selector => newCreationSelectors.includes(selector)); 

    if (isCreationFacetUpToDate) {
        console.log("QuizCreationFacet functions already exist and are up to date. Skipping diamondCut for Creation Facet.");
    } else {
        // ถ้ามีฟังก์ชันเก่าอยู่แล้ว ให้ลบออกก่อน
        if (oldCreationSelectors.length > 0 && currentCreationFacetAddress !== ethers.ZeroAddress) {
            console.log(`Found existing QuizCreationFacet functions at ${currentCreationFacetAddress}. Removing old functions...`);
            const selectorsToRemove = await diamondLoupe.facetFunctionSelectors(currentCreationFacetAddress);
            if (selectorsToRemove.length > 0) {
                 diamondCut.push({
                    facetAddress: ethers.ZeroAddress, // การ Remove ต้องใช้ address(0)
                    action: FacetCutAction.Remove,
                    functionSelectors: selectorsToRemove
                });
                await (await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x", { gasLimit: gasLimit })).wait();
                diamondCut = []; // รีเซ็ต diamondCut หลังจาก Remove
                console.log("Old QuizCreationFacet functions removed.");
            }
        }
        
        console.log("Adding new QuizCreationFacet functions to Diamond...");
        diamondCut.push({
            facetAddress: QuizCreationFacetDeployed.target,
            action: FacetCutAction.Add,
            functionSelectors: newCreationSelectors
        });
        await (await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x", { gasLimit: gasLimit })).wait();
        diamondCut = []; // รีเซ็ต
        console.log("New QuizCreationFacet functions added.");
    }

    // --- จัดการ QuizParticipationFacet ---
    const newParticipationSelectors = getSelectors(QuizParticipationFacetDeployed);
    let oldParticipationSelectors = [];
    let currentParticipationFacetAddress = ethers.ZeroAddress;

    try {
        currentParticipationFacetAddress = await diamondLoupe.facetAddress(newParticipationSelectors[0]);
        if (currentParticipationFacetAddress === QuizParticipationFacetDeployed.target) {
            oldParticipationSelectors = await diamondLoupe.facetFunctionSelectors(QuizParticipationFacetDeployed.target);
        } else if (currentParticipationFacetAddress !== ethers.ZeroAddress) {
            console.log(`QuizParticipationFacet's first selector found at a different address: ${currentParticipationFacetAddress}.`);
            oldParticipationSelectors = await diamondLoupe.facetFunctionSelectors(currentParticipationFacetAddress);
        }
    } catch (e) {
        console.log(`Note: Initial check for QuizParticipationFacet might fail if this is a new Diamond or previous deployment was incomplete. Error: ${e.message}`);
    }

    const isParticipationFacetUpToDate = currentParticipationFacetAddress === QuizParticipationFacetDeployed.target &&
                                         oldParticipationSelectors.length > 0 && 
                                         newParticipationSelectors.every(selector => oldParticipationSelectors.includes(selector)) &&
                                         oldParticipationSelectors.every(selector => newParticipationSelectors.includes(selector));

    if (isParticipationFacetUpToDate) {
        console.log("QuizParticipationFacet functions already exist and are up to date. Skipping diamondCut for Participation Facet.");
    } else {
        if (oldParticipationSelectors.length > 0 && currentParticipationFacetAddress !== ethers.ZeroAddress) {
            console.log(`Found existing QuizParticipationFacet functions. Removing old functions...`);
            const selectorsToRemove = await diamondLoupe.facetFunctionSelectors(currentParticipationFacetAddress);
            if (selectorsToRemove.length > 0) {
                diamondCut.push({
                    facetAddress: ethers.ZeroAddress,
                    action: FacetCutAction.Remove,
                    functionSelectors: selectorsToRemove
                });
                await (await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x", { gasLimit: gasLimit })).wait();
                diamondCut = []; // รีเซ็ต diamondCut หลังจาก Remove
                console.log("Old QuizParticipationFacet functions removed.");
            }
        }
        console.log("Adding new QuizParticipationFacet functions to Diamond...");
        diamondCut.push({
            facetAddress: QuizParticipationFacetDeployed.target,
            action: FacetCutAction.Add,
            functionSelectors: newParticipationSelectors
        });
        await (await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x", { gasLimit: gasLimit })).wait();
        console.log("New QuizParticipationFacet functions added.");
    }

    // ตรวจสอบ Ownership Facet เป็นตัวอย่าง
    const owner = await diamondOwnership.owner();
    console.log(`\nDiamond owner: ${owner}`);
    console.log(`Deployer address: ${deployer.address}`);
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log("Warning: Diamond owner is not the deployer. This might indicate an issue with initial setup.");
    }

    // เชื่อมต่อ Facet กับ Diamond เพื่อเรียกใช้ฟังก์ชัน
    const quizDiamondCreator = await ethers.getContractAt("QuizCreationFacet", currentDiamondAddress);
    const quizDiamondPlayer = await ethers.getContractAt("QuizParticipationFacet", currentDiamondAddress);

    // --- Testing QuizCreationFacet through Diamond ---
    console.log("\n--- Testing QuizCreationFacet through Diamond ---");
    const quizTitle = "Advanced DApp Quiz V10"; // เปลี่ยนชื่อ Quiz ทุกครั้งที่รัน เพื่อให้ได้ Quiz ID ใหม่
    const rewardAmount = ethers.parseUnits("0.05", "ether"); // 0.05 BNB per correct answer
    const maxParticipants = 50;

    console.log(`Creating quiz "${quizTitle}"...`);
    const createQuizTx = await quizDiamondCreator.createQuiz(quizTitle, rewardAmount, maxParticipants, { gasLimit: gasLimit });
    const createQuizReceipt = await createQuizTx.wait();
    
    // ค้นหาและแยก Event 'QuizCreated' ออกมา
    const quizCreatedEvent = createQuizReceipt.logs.find(log => {
        try {
            const parsed = quizDiamondCreator.interface.parseLog(log);
            return parsed && parsed.name === "QuizCreated";
        } catch (e) {
            return false; // ไม่ใช่ event ที่ต้องการ
        }
    });

    if (!quizCreatedEvent) {
        throw new Error("QuizCreated event not found in transaction receipt.");
    }
    const quizId = quizCreatedEvent.args.quizId;
    console.log(`Quiz created with ID: ${quizId}`);

    console.log(`Adding questions to Quiz ID ${quizId}...`);
    const questions = [
        {
            questionText: "What is a blockchain?",
            options: ["A decentralized ledger", "A type of cryptocurrency", "A mining rig", "A wallet"],
            correctAnswerIndex: 0 // ดัชนีคำตอบที่ถูกต้องสำหรับคำถามนี้
        },
        {
            questionText: "What is the native token of BSC?",
            options: ["ETH", "BNB", "ADA", "SOL"],
            correctAnswerIndex: 1 // ดัชนีคำตอบที่ถูกต้องสำหรับคำถามนี้
        }
    ];

    for (let i = 0; i < questions.length; i++) {
        await quizDiamondCreator.addQuestion(
            quizId,
            questions[i].questionText,
            questions[i].options,
            questions[i].correctAnswerIndex,
            { gasLimit: gasLimit }
        );
    }
    console.log("Questions added.");

    console.log(`Activating Quiz ID ${quizId}...`);
    await quizDiamondCreator.activateQuiz(quizId, { gasLimit: gasLimit });
    console.log("Quiz activated.");

    const retrievedQuizData = await quizDiamondCreator.getQuiz(quizId);
    console.log("Retrieved Quiz Data:", retrievedQuizData);

    const question1Data = await quizDiamondCreator.getQuestion(quizId, 0);
    console.log("Question 1:", question1Data.questionText);
    const question2Data = await quizDiamondCreator.getQuestion(quizId, 1);
    console.log("Question 2:", question2Data.questionText);

    console.log("QuizCreationFacet tests successful!");

    // --- Verifying Quiz Questions from Contract (Debugging Aid) ---
    console.log("\n--- Verifying Quiz Questions from Contract ---");
    const question0Contract = await quizDiamondCreator.getQuestion(quizId, 0);
    console.log(`Question 0 from Contract:`);
    console.log(`  Question Text: ${question0Contract.questionText}`);
    console.log(`  Options: ${question0Contract.options.join(', ')}`);
    console.log(`  Correct Answer Index: ${question0Contract.correctAnswerIndex}`);

    const question1Contract = await quizDiamondCreator.getQuestion(quizId, 1);
    console.log(`Question 1 from Contract:`);
    console.log(`  Question Text: ${question1Contract.questionText}`);
    console.log(`  Options: ${question1Contract.options.join(', ')}`);
    console.log(`  Correct Answer Index: ${question1Contract.correctAnswerIndex}`);
    console.log("--- End Verifying Quiz Questions ---\n");

    // --- Testing QuizParticipationFacet through Diamond ---
    console.log("\n--- Testing QuizParticipationFacet through Diamond ---");

    console.log(`Player ${deployer.address} joining Quiz ID ${quizId}...`);
    await quizDiamondPlayer.joinQuiz(quizId, { gasLimit: gasLimit });
    console.log("Player joined quiz.");

    let playerStatus = await quizDiamondPlayer.getQuizParticipationStatus(quizId, deployer.address);
    console.log(`Player Participation Status: Joined=${playerStatus.hasJoined}, Score=${ethers.formatEther(playerStatus.score)} BNB, Last Answered=${playerStatus.lastAnsweredQuestionIndex}`);

    // ส่งคำตอบสำหรับ Question 0 (ใช้ดัชนีคำตอบที่ถูกต้องจากสัญญา)
    const q0CorrectAnswerIndex = question0Contract.correctAnswerIndex; 
    console.log(`Player ${deployer.address} submitting answer for Question 0 (correct)...`);
    const submitQ0Tx = await quizDiamondPlayer.submitAnswer(quizId, 0, q0CorrectAnswerIndex, { gasLimit: gasLimit });
    await submitQ0Tx.wait();
    console.log("Answer for Question 0 submitted.");

    let playerScore = await quizDiamondPlayer.getPlayerScore(quizId, deployer.address);
    console.log(`Player Score after Q0: ${ethers.formatEther(playerScore)} BNB`);

    // ส่งคำตอบสำหรับ Question 1 (ใช้ดัชนีคำตอบที่ถูกต้องจากสัญญา)
    const q1CorrectAnswerIndex = question1Contract.correctAnswerIndex;
    console.log(`Player ${deployer.address} submitting answer for Question 1 (correct)...`);
    const submitQ1Tx = await quizDiamondPlayer.submitAnswer(quizId, 1, q1CorrectAnswerIndex, { gasLimit: gasLimit });
    await submitQ1Tx.wait();
    console.log("Answer for Question 1 submitted.");

    playerScore = await quizDiamondPlayer.getPlayerScore(quizId, deployer.address);
    console.log(`Player Score after Q1: ${ethers.formatEther(playerScore)} BNB`);

    // ตรวจสอบคะแนนสุดท้าย (ควรเป็น 0.1 BNB)
    const expectedFinalScore = ethers.parseUnits("0.1", "ether"); // 0.1 BNB
    console.log(`\nAsserting final score. Expected: ${ethers.formatEther(expectedFinalScore)} BNB, Actual: ${ethers.formatEther(playerScore)} BNB`);
    
    // ใช้ .eq() สำหรับเปรียบเทียบ BigNumber
    if (!playerScore.eq(expectedFinalScore)) {
        throw new Error(`AssertionError: expected ${expectedFinalScore.toString()} (0.1 BNB) to equal ${playerScore.toString()} (${ethers.formatEther(playerScore)} BNB).`);
    } else {
        console.log("Assertion successful: Final score is as expected!");
    }

    console.log("QuizParticipationFacet tests successful!");
}

deployDiamond()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });