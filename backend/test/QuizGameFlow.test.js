const { expect } = require("chai");
const { ethers } = require("hardhat");

// ฟังก์ชันนี้จะดึง selector ของฟังก์ชันจาก interface ของสัญญา
// ซึ่งสำคัญมากสำหรับรูปแบบ Hardhat Diamond เพื่อระบุฟังก์ชัน
// ที่จะเพิ่ม แทนที่ หรือลบออกจาก diamond ได้อย่างถูกต้อง
function getSelectors(contract) {
  // ตรวจสอบให้แน่ใจว่าอ็อบเจกต์สัญญาและ interface ของมันถูกต้อง
  if (!contract || !contract.interface) {
    throw new Error("Invalid contract object or interface provided to getSelectors.");
  }

  // ลด fragments ของสัญญาให้เป็นอาร์เรย์ของ function selectors
  // fragment แสดงถึงส่วนหนึ่งของ ABI ของสัญญา เช่น ฟังก์ชัน, เหตุการณ์ หรือข้อผิดพลาด
  const selectors = contract.interface.fragments.reduce((acc, val) => {
    // รวมเฉพาะ fragments ที่เป็นประเภท 'function' เท่านั้น
    if (val.type === 'function') {
      // เพิ่ม selector ของฟังก์ชัน (การแสดง bytes4 ของ signature) ลงใน accumulator
      acc.push(val.selector);
    }
    return acc;
  }, []); // เริ่มต้น accumulator ด้วยอาร์เรย์ว่าง
  return selectors;
}

// ฟังก์ชันยูทิลิตี้นี้ใช้สำหรับลบ selectors ที่เฉพาะเจาะจงออกจากรายการ selectors ที่กำหนด
// มีประโยชน์เมื่อคุณต้องการยกเว้นฟังก์ชันมาตรฐานบางอย่าง (เช่น `supportsInterface`)
// จาก selectors ของ facet ก่อนที่จะทำการ diamond cut.
function removeSelectors(allSelectors, selectorsToRemove) {
  // สร้าง Set เพื่อการค้นหาที่รวดเร็ว
  const toRemoveSet = new Set(selectorsToRemove);
  // กรอง selectors ที่อยู่ใน toRemoveSet ออก
  return allSelectors.filter((selector) => !toRemoveSet.has(selector));
}

// Helper function to hash a string to bytes32
function hashString(str) {
  return ethers.keccak256(ethers.toUtf8Bytes(str));
}

describe("QuizGameFlow - Core Mechanics", function () {
  // ประกาศตัวแปรสัญญาเพื่อเก็บ instance ที่ถูก deploy แล้ว
  let quizCoin;
  let poolManager;
  let quizGameDiamond;
  let diamondCutFacet;
  let diamondLoupeFacet;
  let ownershipFacet;
  let quizGameBaseFacet;
  let quizGameModeFacet;
  let quizGameRewardFacet;

  // ประกาศตัวแตร signer เพื่อแสดงบทบาทที่แตกต่างกันในการทดสอบ
  let owner;
  let admin;
  let player1;
  let player2;
  let player3; // เพิ่ม player3 สำหรับ Pool Mode
  let addrs; // สำหรับ signers เพิ่มเติมที่ไม่ได้ระบุชื่ออย่างชัดเจน

  // กำหนด FacetCutAction enum เพื่อความชัดเจนในการดำเนินการ diamondCut
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  // กำหนด enum values สำหรับ QuestionMode และ QuestionCategory จาก LibAppStorage
  // (สมมติว่า Solo = 0, Pool = 1, Tournament = 2, General = 0, Math = 1, etc.)
  const QuestionMode = { Solo: 0, Pool: 1, Tournament: 2 };
  const QuestionCategory = { General: 0, Math: 1, Science: 2, History: 3, Sports: 4 };

  // hook นี้จะทำงานหนึ่งครั้งก่อนการทดสอบทั้งหมดในบล็อก describe นี้
  // ใช้สำหรับ deploy สัญญาและทำการตั้งค่าเริ่มต้น
  before(async function () {
    // รับ signers จาก ethers provider ของ Hardhat
    [owner, admin, player1, player2, player3, ...addrs] = await ethers.getSigners(); // เพิ่ม player3

    console.log("--- Deploying Contracts ---");

    // Deploy สัญญา QuizCoin
    const QuizCoin = await ethers.getContractFactory("QuizCoin");
    quizCoin = await QuizCoin.deploy();
    await quizCoin.waitForDeployment(); // รอให้ transaction การ deploy ถูกขุด
    console.log(`QuizCoin deployed to: ${quizCoin.target}`);

    // Deploy สัญญา PoolManager โดยส่งที่อยู่ของ QuizCoin ไปยัง constructor
    const PoolManager = await ethers.getContractFactory("PoolManager");
    poolManager = await PoolManager.deploy(quizCoin.target);
    await poolManager.waitForDeployment();
    console.log(`PoolManager deployed to: ${poolManager.target}`);

    // Deploy Facets ทั้งหมด
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
    diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.waitForDeployment();
    console.log(`DiamondCutFacet deployed to: ${diamondCutFacet.target}`);

    const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet");
    diamondLoupeFacet = await DiamondLoupeFacet.deploy();
    await diamondLoupeFacet.waitForDeployment();
    console.log(`DiamondLoupeFacet deployed to: ${diamondLoupeFacet.target}`);

    const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet");
    ownershipFacet = await OwnershipFacet.deploy();
    await ownershipFacet.waitForDeployment();
    console.log(`OwnershipFacet deployed to: ${ownershipFacet.target}`);

    const QuizGameBaseFacet = await ethers.getContractFactory("QuizGameBaseFacet");
    quizGameBaseFacet = await QuizGameBaseFacet.deploy();
    await quizGameBaseFacet.waitForDeployment();
    console.log(`QuizGameBaseFacet deployed to: ${quizGameBaseFacet.target}`);

    const QuizGameModeFacet = await ethers.getContractFactory("QuizGameModeFacet");
    quizGameModeFacet = await QuizGameModeFacet.deploy();
    await quizGameModeFacet.waitForDeployment();
    console.log(`QuizGameModeFacet deployed to: ${quizGameModeFacet.target}`);

    const QuizGameRewardFacet = await ethers.getContractFactory("QuizGameRewardFacet");
    quizGameRewardFacet = await QuizGameRewardFacet.deploy();
    await quizGameRewardFacet.waitForDeployment();
    console.log(`QuizGameRewardFacet deployed to: ${quizGameRewardFacet.target}`);

    // Deploy สัญญา QuizGameDiamond โดยไม่มี arguments ใน constructor
    // เนื่องจาก constructor ใน QuizGameDiamond.sol ไม่มี arguments
    const QuizGameDiamond = await ethers.getContractFactory("QuizGameDiamond");
    quizGameDiamond = await QuizGameDiamond.deploy(); // ไม่มี arguments
    await quizGameDiamond.waitForDeployment();
    console.log(`QuizGameDiamond deployed to: ${quizGameDiamond.target}`);

    console.log("\n--- Performing Diamond Cut & Initialization ---");

    // Get selectors for the initial facets
    const diamondCutSelectors = getSelectors(diamondCutFacet);
    const diamondLoupeSelectors = getSelectors(diamondLoupeFacet);
    const ownershipSelectors = getSelectors(ownershipFacet);

    // Combine all selectors from the initial facets into a single set
    // This set represents all selectors that are ALREADY part of the diamond after initialization
    const initialDiamondSelectors = new Set([
      ...diamondCutSelectors,
      ...diamondLoupeSelectors,
      ...ownershipSelectors
    ]);

    // Prepare Facet Addresses and Selectors for the initial cut (no filtering needed here)
    const initialFacetAddresses = [
      diamondCutFacet.target,
      diamondLoupeFacet.target,
      ownershipFacet.target
    ];

    const initialFacetSelectors = [
      diamondCutSelectors,
      diamondLoupeSelectors,
      ownershipSelectors
    ];

    // Call initialize on QuizGameDiamond
    await quizGameDiamond.initialize(
      admin.address, // _initialAdmin (จะเป็น contract owner ของ Diamond)
      initialFacetAddresses,
      initialFacetSelectors
    );

    // ตอนนี้ DiamondCutFacet ถูกเพิ่มแล้ว และ admin คือเจ้าของ Diamond
    // เราจึงต้องสร้าง instance ของ IDiamondCut ที่เชื่อมต่อกับ admin
    const diamondCut = await ethers.getContractAt("IDiamondCut", quizGameDiamond.target, admin); // เชื่อมต่อกับ admin
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", quizGameDiamond.target);
    // ใช้ชื่อเต็มสำหรับ IOwnership เพื่อหลีกเลี่ยงข้อผิดพลาด HH701
    // Note: IOwnership may not have grantRole. We need AccessControlUpgradeable ABI.
    // เราจะใช้ AccessControlUpgradeable โดยตรงบน Diamond Proxy เพื่อเรียก grantRole
    const ownership = await ethers.getContractAt("contracts/facets/QuizCreationFacet.sol:IOwnership", quizGameDiamond.target);


    // ดำเนินการเพิ่ม facets อื่นๆ ที่เหลือ (โดย admin)
    // QuizGameBaseFacet
    let tx = await diamondCut.diamondCut( // เรียกโดย admin
      [{
        facetAddress: quizGameBaseFacet.target,
        action: FacetCutAction.Add,
        // กรอง selectors ที่ซ้ำกับ initialDiamondSelectors ออกไป
        functionSelectors: removeSelectors(getSelectors(quizGameBaseFacet), Array.from(initialDiamondSelectors)) 
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // QuizGameModeFacet
    tx = await diamondCut.diamondCut( // เรียกโดย admin
      [{
        facetAddress: quizGameModeFacet.target,
        action: FacetCutAction.Add,
        // กรอง selectors ที่ซ้ำกับ initialDiamondSelectors ออกไป
        functionSelectors: removeSelectors(getSelectors(quizGameModeFacet), Array.from(initialDiamondSelectors))
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // QuizGameRewardFacet
    tx = await diamondCut.diamondCut( // เรียกโดย admin
      [{
        facetAddress: quizGameRewardFacet.target,
        action: FacetCutAction.Add,
        // กรอง selectors ที่ซ้ำกับ initialDiamondSelectors ออกไป
        functionSelectors: removeSelectors(getSelectors(quizGameRewardFacet), Array.from(initialDiamondSelectors))
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // ตรวจสอบว่า facets ทั้งหมดถูกเพิ่มไปยัง diamond แล้ว
    // เราคาดว่าจะมี 6 facets: DiamondCut, DiamondLoupe, Ownership, Base, Mode, Reward.
    expect(await diamondLoupe.facetAddresses()).to.have.lengthOf(6);

    // *** สำคัญ: เรียก initializeQuizGame() บน QuizGameBaseFacet ผ่าน Diamond Proxy ***
    // ต้องทำหลังจากที่ QuizGameBaseFacet ถูกเพิ่มเข้าไปใน Diamond แล้ว
    const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target, admin);
    await quizGameBase.initializeQuizGame();
    console.log("QuizGameBaseFacet: initializeQuizGame() called.");

    // *** เพิ่ม: ตั้งค่า PoolManager และ QuizCoin address ใน AppStorage ผ่าน QuizGameBaseFacet ***
    await quizGameBase.connect(admin).setPoolManagerAddress(poolManager.target);
    await quizGameBase.connect(admin).setQuizCoinAddress(quizCoin.target);
    console.log("PoolManager and QuizCoin addresses set in AppStorage.");

    // *** ตรวจสอบว่า PoolManager และ QuizCoin address ถูกตั้งค่าอย่างถูกต้องใน AppStorage ***
    // ต้องสร้าง instance ของ QuizGameBaseFacet ที่เชื่อมต่อกับ Diamond Proxy อีกครั้ง
    // เพื่อให้แน่ใจว่า ABI ที่ใช้มี getters ที่เพิ่มเข้ามา
    const quizGameBaseWithGetters = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target); // ไม่ต้องเชื่อมต่อกับ admin เพราะเป็น view function
    expect(await quizGameBaseWithGetters.getPoolManagerAddress()).to.equal(poolManager.target);
    expect(await quizGameBaseWithGetters.getQuizCoinAddress()).to.equal(quizCoin.target);
    console.log("Verified PoolManager and QuizCoin addresses in AppStorage.");

    // *** logic การตั้งค่า PoolManager และ QuizCoin ทำโดย owner (deployer) ***
    // มอบ MINTER_ROLE ให้กับ PoolManager สำหรับ QuizCoin
    // ซึ่งอนุญาตให้ PoolManager สร้างโทเค็น QuizCoin ใหม่ได้
    const MINTER_ROLE = await quizCoin.MINTER_ROLE();
    await quizCoin.connect(owner).grantRole(MINTER_ROLE, poolManager.target); // เรียกโดย owner

    // ตั้งค่า QuizGameDiamond เป็นสัญญาเกมใน PoolManager
    // ซึ่งเชื่อมโยง PoolManager กับ QuizGameDiamond สำหรับการแจกจ่ายรางวัล
    await poolManager.connect(owner).setQuizGameDiamondAddress(quizGameDiamond.target);

    // *** แก้ไข: มอบ REWARD_DISTRIBUTOR_ROLE ให้กับ admin โดยใช้ AccessControlUpgradeable ABI ***
    const REWARD_DISTRIBUTOR_ROLE = await quizGameBaseWithGetters.REWARD_DISTRIBUTOR_ROLE(); // ใช้ instance ที่มี getters
    // สร้าง instance ของ AccessControlUpgradeable ที่เชื่อมต่อกับ Diamond proxy
    const accessControl = await ethers.getContractAt("AccessControlUpgradeable", quizGameDiamond.target, admin);
    await accessControl.grantRole(REWARD_DISTRIBUTOR_ROLE, admin.address);
    console.log("Admin granted REWARD_DISTRIBUTOR_ROLE.");
  });

  // ใช้ snapshotId เพื่อรีเซ็ต state ระหว่าง describe blocks หลัก
  let snapshotId;

  beforeEach(async function() {
    // ก่อนแต่ละ describe block หลัก (Solo Mode, Pool Mode) ให้สร้าง snapshot
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async function() {
    // หลังจากแต่ละ describe block หลัก ให้ย้อนกลับไปที่ snapshot
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  // บล็อก Describe สำหรับการทดสอบ Solo Mode
  describe("Solo Mode", function () {
    let questionId; // ประกาศ questionId ที่นี่เพื่อให้เข้าถึงได้ทั่วทั้ง describe block

    // beforeEach hook จะทำงานก่อนแต่ละ 'it' test case ใน block นี้
    beforeEach(async function() {
      // ตรวจสอบว่า snapshotId ถูกตั้งค่าแล้ว (มาจาก beforeEach ของ describe หลัก)
      if (!snapshotId) {
        throw new Error("Snapshot not created. Ensure beforeEach hook for main describe block is working.");
      }
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target, admin); // เชื่อมต่อ admin เพื่อสร้างคำถาม
      // const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target); // ไม่ได้ใช้ในการสร้างคำถาม

      // กำหนดรายละเอียดคำถาม
      const questionText = "What is 2 + 2?";
      const options = ["3", "4", "5", "6"];
      const correctAnswerIndex = 1; // Index สำหรับ "4"
      const correctAnswer = options[correctAnswerIndex]; // "4"
      const hintText = "It's an even number.";
      const difficultyLevel = 50; // กำหนดระดับความยาก

      // Hash คำตอบและคำใบ้
      const correctAnswerHash = hashString(correctAnswer);
      const hintHash = hashString(hintText);

      // แอดมินสร้างคำถาม solo
      const tx = await quizGameMode.createQuestion( // เรียกโดย admin ที่เชื่อมต่อไว้แล้ว
        correctAnswerHash,
        hintHash,
        difficultyLevel,
        QuestionMode.Solo,
        QuestionCategory.General
      );
      const receipt = await tx.wait();
      // ดึง questionId จาก event
      const event = receipt.logs.find(log => quizGameMode.interface.parseLog(log)?.name === "QuestionCreated");
      questionId = event.args[0]; // กำหนด questionId ให้กับตัวแปรที่ประกาศไว้ด้านบน
    });


    // กรณีทดสอบ: แอดมินสามารถสร้างคำถามในโหมด Solo และผู้เล่นสามารถแก้ไขได้ถูกต้อง
    it("should allow admin to create a Solo mode question and player to solve it", async function () {
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
      const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target);

      // กำหนดรายละเอียดคำถาม (ใช้ค่าเดียวกับ beforeEach เพื่อความสอดคล้อง)
      const difficultyLevel = 50;
      const correctAnswer = "4";
      const submittedAnswerHash = hashString(correctAnswer);

      // Player 1 ส่งคำตอบที่ถูกต้องและคาดว่าจะมีการปล่อยอีเวนต์ AnswerSubmitted
      await expect(quizGameMode.connect(player1).submitAnswer(questionId, submittedAnswerHash))
        .to.emit(quizGameMode, "AnswerSubmitted")
        .withArgs(questionId, player1.address, submittedAnswerHash);

      // ตรวจสอบยอดคงเหลือของ player1 หลังจากแก้ไขคำถาม
      const baseReward99 = await quizGameBase.getBaseRewardForLevel99();
      const treasuryFeePercentage = await quizGameBase.getTreasuryFeePercentage();

      const expectedReward = (baseReward99 * BigInt(difficultyLevel)) / 99n;
      const treasuryFee = (expectedReward * treasuryFeePercentage) / 10000n;
      const rewardAfterFee = expectedReward - treasuryFee;

      expect(await quizCoin.balanceOf(player1.address)).to.equal(rewardAfterFee);
    });

    // กรณีทดสอบ: ผู้เล่นพยายามแก้ไขคำถาม solo ด้วยคำตอบที่ไม่ถูกต้อง
    it("should not allow player to solve a solo question with incorrect answer", async function () {
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
      
      const incorrectAnswer = "3"; // คำตอบที่ไม่ถูกต้อง
      const incorrectAnswerHash = hashString(incorrectAnswer);

      // Player 2 พยายามแก้ไขคำถามด้วยคำตอบที่ไม่ถูกต้อง
      // คาดว่า transaction จะถูก revert พร้อมข้อความแสดงข้อผิดพลาด "Quiz: Incorrect answer."
      await expect(quizGameMode.connect(player2).submitAnswer(questionId, incorrectAnswerHash))
        .to.be.revertedWith("Quiz: Incorrect answer.");

      // Player 2 ไม่ควรได้รับรางวัลใดๆ ดังนั้นยอดคงเหลือของพวกเขาควรยังคงเป็น 0
      expect(await quizCoin.balanceOf(player2.address)).to.equal(0n);
    });

    // กรณีทดสอบ: คำถามไม่สามารถแก้ไขได้หลายครั้งโดยผู้เล่นคนเดียวกัน
    it("should not allow a question to be solved multiple times by the same player", async function () {
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
      const correctAnswer = "4"; // คำตอบที่ถูกต้อง
      const correctAnswerHash = hashString(correctAnswer);
      
      // ให้ player1 ตอบถูกก่อน เพื่อปิดคำถาม
      await quizGameMode.connect(player1).submitAnswer(questionId, correctAnswerHash);

      // จากนั้น player1 พยายามตอบอีกครั้ง
      await expect(quizGameMode.connect(player1).submitAnswer(questionId, correctAnswerHash))
        .to.be.revertedWith("Quiz: Question is already closed.");
    });

    // กรณีทดสอบ: เฉพาะแอดมินเท่านั้นที่ควรจะสามารถสร้างคำถาม solo ได้
    it("should not allow non-admin to create a solo question", async function () {
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target); // ใช้ QuizGameModeFacet สำหรับการสร้างคำถาม
      
      // กำหนดรายละเอียดคำถามใหม่สำหรับ test นี้
      const newQuestionCorrectAnswerHash = hashString("New Answer");
      const newQuestionHintHash = hashString("New Hint");
      const newQuestionDifficulty = 10;

      // Player 1 (ซึ่งไม่ใช่แอดมิน) พยายามสร้างคำถาม solo
      // คาดว่า transaction จะถูก revert พร้อมข้อความแสดงข้อผิดพลาด "AccessControl: Caller is not a game admin"
      await expect(quizGameMode.connect(player1).createQuestion(
        newQuestionCorrectAnswerHash,
        newQuestionHintHash,
        newQuestionDifficulty,
        QuestionMode.Solo,
        QuestionCategory.General
      )).to.be.revertedWith("AccessControl: Caller is not a game admin");
    });
  });

  // บล็อก Describe สำหรับการทดสอบ Pool Mode
  describe("Pool Mode", function () {
    let poolQuestionId;
    const poolDifficultyLevel = 60; // ระดับความยากสำหรับคำถาม Pool

    beforeEach(async function() {
      // ตรวจสอบว่า snapshotId ถูกตั้งค่าแล้ว (มาจาก beforeEach ของ describe หลัก)
      if (!snapshotId) {
        throw new Error("Snapshot not created. Ensure beforeEach hook for main describe block is working.");
      }
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target, admin); // เชื่อมต่อ admin เพื่อสร้างคำถาม
      
      const questionText = "What is the capital of France?";
      const options = ["Berlin", "Paris", "Rome", "Madrid"];
      const correctAnswerIndex = 1; // Index สำหรับ "Paris"
      const correctAnswer = options[correctAnswerIndex];
      const hintText = "It's known for the Eiffel Tower.";

      const correctAnswerHash = hashString(correctAnswer);
      const hintHash = hashString(hintText);

      // แอดมินสร้างคำถาม Pool
      const tx = await quizGameMode.createQuestion( // เรียกโดย admin ที่เชื่อมต่อไว้แล้ว
        correctAnswerHash,
        hintHash,
        poolDifficultyLevel,
        QuestionMode.Pool, // โหมด Pool
        QuestionCategory.General
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => quizGameMode.interface.parseLog(log)?.name === "QuestionCreated");
      poolQuestionId = event.args[0]; // กำหนด poolQuestionId
    });

    it("should allow multiple players to solve a Pool question within the reward window and distribute rewards", async function () {
        const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
        const quizGameReward = await ethers.getContractAt("QuizGameRewardFacet", quizGameDiamond.target);
        const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target);
        const correctAnswer = "Paris";
        const submittedAnswerHash = hashString(correctAnswer);

        // ยอดคงเหลือเริ่มต้นของผู้เล่น
        const initialBalancePlayer1 = await quizCoin.balanceOf(player1.address);
        const initialBalancePlayer2 = await quizCoin.balanceOf(player2.address);
        const initialBalancePlayer3 = await quizCoin.balanceOf(player3.address);

        // Player 1 ตอบถูก
        await expect(quizGameMode.connect(player1).submitAnswer(poolQuestionId, submittedAnswerHash))
            .to.emit(quizGameMode, "AnswerSubmitted")
            .withArgs(poolQuestionId, player1.address, submittedAnswerHash)
            .to.emit(quizGameMode, "QuestionRewardWindowStarted"); // คาดว่า event นี้จะถูกปล่อยออกมาเมื่อผู้เล่นคนแรกตอบถูก

        // Player 2 ตอบถูก (ภายใน window)
        await expect(quizGameMode.connect(player2).submitAnswer(poolQuestionId, submittedAnswerHash))
            .to.emit(quizGameMode, "AnswerSubmitted")
            .withArgs(poolQuestionId, player2.address, submittedAnswerHash);

        // Player 3 ตอบถูก (ภายใน window)
        await expect(quizGameMode.connect(player3).submitAnswer(poolQuestionId, submittedAnswerHash))
            .to.emit(quizGameMode, "AnswerSubmitted")
            .withArgs(poolQuestionId, player3.address, submittedAnswerHash);

        // เลื่อนเวลาให้พ้น Pool Reward Window
        const poolRewardWindowDuration = await quizGameBase.getPoolRewardWindowDuration();
        await ethers.provider.send("evm_increaseTime", [Number(poolRewardWindowDuration) + 1]); // เพิ่มเวลาให้เกิน window
        await ethers.provider.send("evm_mine"); // ขุดบล็อกใหม่

        // คำนวณรางวัลที่คาดหวังต่อผู้เล่นให้ตรงกับ Logic ของสัญญา
        const baseReward99 = await quizGameBase.getBaseRewardForLevel99();
        const treasuryFeePercentage = await quizGameBase.getTreasuryFeePercentage();
        const totalCalculatedReward = (baseReward99 * BigInt(poolDifficultyLevel)) / 99n;
        const treasuryFee = (totalCalculatedReward * treasuryFeePercentage) / 10000n;
        const rewardForPoolSolvers = totalCalculatedReward - treasuryFee;
        const expectedRewardPerSolver = rewardForPoolSolvers / 3n; // มี 3 ผู้เล่น

        // แอดมินแจกจ่ายรางวัล
        await expect(quizGameReward.connect(admin).distributeRewards(poolQuestionId))
            .to.emit(quizGameReward, "RewardDistributed")
            .withArgs(poolQuestionId, player1.address, expectedRewardPerSolver) // ใช้ค่าที่คำนวณใหม่
            .to.emit(quizGameReward, "RewardDistributed")
            .withArgs(poolQuestionId, player2.address, expectedRewardPerSolver) // ใช้ค่าที่คำนวณใหม่
            .to.emit(quizGameReward, "RewardDistributed")
            .withArgs(poolQuestionId, player3.address, expectedRewardPerSolver) // ใช้ค่าที่คำนวณใหม่
            .to.emit(quizGameReward, "QuestionClosed");

        // ตรวจสอบยอดคงเหลือของผู้เล่นแต่ละคน
        expect(await quizCoin.balanceOf(player1.address)).to.equal(initialBalancePlayer1 + expectedRewardPerSolver);
        expect(await quizCoin.balanceOf(player2.address)).to.equal(initialBalancePlayer2 + expectedRewardPerSolver);
        expect(await quizCoin.balanceOf(player3.address)).to.equal(initialBalancePlayer3 + expectedRewardPerSolver);

        // ตรวจสอบว่าคำถามถูกปิดแล้ว
        const question = await quizGameBase.getQuestion(poolQuestionId); 
        expect(question.isClosed).to.be.true;
    });

    it("should not allow a player to submit an answer after the reward window closes", async function () {
        const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
        const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target);
        const correctAnswer = "Paris";
        const submittedAnswerHash = hashString(correctAnswer);

        // Player 1 ตอบถูกเพื่อเริ่ม window
        await quizGameMode.connect(player1).submitAnswer(poolQuestionId, submittedAnswerHash);

        // เลื่อนเวลาให้พ้น Pool Reward Window
        const poolRewardWindowDuration = await quizGameBase.getPoolRewardWindowDuration();
        await ethers.provider.send("evm_increaseTime", [Number(poolRewardWindowDuration) + 1]);
        await ethers.provider.send("evm_mine");

        // Player 2 พยายามตอบหลังจาก window ปิด
        await expect(quizGameMode.connect(player2).submitAnswer(poolQuestionId, submittedAnswerHash))
            .to.be.revertedWith("Quiz: Pool reward window is closed or Level 100 question expired."); // ข้อความ revert จาก QuizGameModeFacet
    });

    it("should not allow reward distribution before the pool window closes", async function () {
        const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
        const quizGameReward = await ethers.getContractAt("QuizGameRewardFacet", quizGameDiamond.target);
        const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target); // เพิ่มการเรียกใช้ quizGameBase
        const correctAnswer = "Paris";
        const submittedAnswerHash = hashString(correctAnswer);

        // Player 1 ตอบถูกเพื่อเริ่ม window
        await quizGameMode.connect(player1).submitAnswer(poolQuestionId, submittedAnswerHash);

        // แอดมินพยายามแจกจ่ายรางวัลก่อน window ปิด
        await expect(quizGameReward.connect(admin).distributeRewards(poolQuestionId))
            .to.be.revertedWith("Quiz: Pool window is not over yet."); // ข้อความ revert จาก QuizGameRewardFacet
    });

    it("should not allow non-distributor to distribute rewards", async function () {
        const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
        const quizGameReward = await ethers.getContractAt("QuizGameRewardFacet", quizGameDiamond.target);
        const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target); // เพิ่มการเรียกใช้ quizGameBase
        const correctAnswer = "Paris";
        const submittedAnswerHash = hashString(correctAnswer);

        // Player 1 ตอบถูกเพื่อเริ่ม window
        await quizGameMode.connect(player1).submitAnswer(poolQuestionId, submittedAnswerHash);

        // เลื่อนเวลาให้พ้น Pool Reward Window
        const poolRewardWindowDuration = await quizGameBase.getPoolRewardWindowDuration();
        await ethers.provider.send("evm_increaseTime", [Number(poolRewardWindowDuration) + 1]);
        await ethers.provider.send("evm_mine");

        // Player 1 (ซึ่งไม่ใช่ REWARD_DISTRIBUTOR_ROLE) พยายามแจกจ่ายรางวัล
        await expect(quizGameReward.connect(player1).distributeRewards(poolQuestionId))
            .to.be.revertedWith("AccessControl: Caller is not a reward distributor");
    });

    it("should not allow reward distribution for a Solo mode question", async function () {
        const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
        const quizGameReward = await ethers.getContractAt("QuizGameRewardFacet", quizGameDiamond.target);
        const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target); // เพิ่มการเรียกใช้ quizGameBase
        const soloQuestionCorrectAnswer = "4";
        const soloQuestionCorrectAnswerHash = hashString(soloQuestionCorrectAnswer);
        const soloDifficultyLevel = 50;

        // สร้างคำถาม Solo Mode
        const tx = await quizGameMode.connect(admin).createQuestion(
            soloQuestionCorrectAnswerHash,
            hashString("hint"),
            soloDifficultyLevel,
            QuestionMode.Solo,
            QuestionCategory.General
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => quizGameMode.interface.parseLog(log)?.name === "QuestionCreated");
        const soloQuestionId = event.args[0];

        // Player 1 ตอบถูกสำหรับคำถาม Solo
        await quizGameMode.connect(player1).submitAnswer(soloQuestionId, soloQuestionCorrectAnswerHash);

        // พยายามแจกจ่ายรางวัลสำหรับคำถาม Solo Mode
        await expect(quizGameReward.connect(admin).distributeRewards(soloQuestionId))
            .to.be.revertedWith("Quiz: Question is already closed."); // *** แก้ไขข้อความ revert ที่คาดหวัง ***
    });

    it("should not allow reward distribution for a Pool question with no correct solvers", async function () {
        const quizGameReward = await ethers.getContractAt("QuizGameRewardFacet", quizGameDiamond.target);
        const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target);
        
        // เลื่อนเวลาให้พ้น Pool Reward Window (โดยไม่มีใครตอบถูก)
        const poolRewardWindowDuration = await quizGameBase.getPoolRewardWindowDuration();
        await ethers.provider.send("evm_increaseTime", [Number(poolRewardWindowDuration) + 1]);
        await ethers.provider.send("evm_mine");

        // แอดมินพยายามแจกจ่ายรางวัล
        await expect(quizGameReward.connect(admin).distributeRewards(poolQuestionId))
            .to.be.revertedWith("Quiz: No one answered correctly in Pool mode window.");
    });
  });

  // คุณสามารถเพิ่มบล็อก describe เพิ่มเติมได้ที่นี่สำหรับโหมดเกมอื่นๆ (เช่น "Battle Mode", "Tournament Mode")
  // และฟังก์ชันการทำงานอื่นๆ เมื่อโปรเจกต์ของคุณขยายตัว
});
