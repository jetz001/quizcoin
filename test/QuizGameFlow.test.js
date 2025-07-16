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
function removeSelectors(selectors, selectorsToRemove) {
  // กรอง selectors ที่อยู่ในอาร์เรย์ `selectorsToRemove` ออก
  return selectors.filter((selector) => !selectorsToRemove.includes(selector));
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

  // ประกาศตัวแปร signer เพื่อแสดงบทบาทที่แตกต่างกันในการทดสอบ
  let owner;
  let admin;
  let player1;
  let player2;
  let addrs; // สำหรับ signers เพิ่มเติมที่ไม่ได้ระบุชื่ออย่างชัดเจน

  // กำหนด FacetCutAction enum เพื่อความชัดเจนในการดำเนินการ diamondCut
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  // hook นี้จะทำงานหนึ่งครั้งก่อนการทดสอบทั้งหมดในบล็อก describe นี้
  // ใช้สำหรับ deploy สัญญาและทำการตั้งค่าเริ่มต้น
  before(async function () {
    // รับ signers จาก ethers provider ของ Hardhat
    [owner, admin, player1, player2, ...addrs] = await ethers.getSigners();

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

    // Deploy DiamondCutFacet ก่อน เพื่อให้ที่อยู่ของมันพร้อมใช้งานสำหรับ QuizGameDiamond
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
    diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.waitForDeployment();
    console.log(`DiamondCutFacet deployed to: ${diamondCutFacet.target}`);

    // Deploy สัญญา QuizGameDiamond โดยไม่มี arguments ใน constructor
    // นี่คือการแก้ไขปัญหา "invalid overrides parameter"
    const QuizGameDiamond = await ethers.getContractFactory("QuizGameDiamond");
    quizGameDiamond = await QuizGameDiamond.deploy(); // แก้ไขตรงนี้: ไม่มี arguments
    await quizGameDiamond.waitForDeployment();
    console.log(`QuizGameDiamond deployed to: ${quizGameDiamond.target}`);

    // Deploy สัญญา facet ที่เหลือ
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

    console.log("\n--- Performing Diamond Cut & Initialization ---");

    // รับ instance ของสัญญาสำหรับ interfaces ของ diamond
    // instance เหล่านี้จะถูกใช้เพื่อโต้ตอบกับ diamond proxy
    const diamondCut = await ethers.getContractAt("IDiamondCut", quizGameDiamond.target);
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", quizGameDiamond.target);
    // แก้ไขตรงนี้: ใช้ชื่อเต็มสำหรับ IOwnership
    const ownership = await ethers.getContractAt("contracts/facets/QuizCreationFacet.sol:IOwnership", quizGameDiamond.target);

    let tx; // ประกาศ tx ที่นี่เพื่อใช้ซ้ำ

    // เพิ่ม DiamondCutFacet เป็น facet แรกให้กับ diamond
    // นี่คือขั้นตอนสำคัญที่ทำให้ diamond มีความสามารถในการอัปเกรด
    tx = await diamondCut.diamondCut(
      [{
        facetAddress: diamondCutFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(diamondCutFacet)
      }],
      ethers.ZeroAddress, // ไม่มีฟังก์ชันเริ่มต้นที่จะเรียก
      "0x" // ไม่มีข้อมูลเริ่มต้น
    );
    await tx.wait(); // รอให้ transaction ถูกขุด

    // DiamondLoupeFacet
    tx = await diamondCut.diamondCut(
      [{
        facetAddress: diamondLoupeFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(diamondLoupeFacet)
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // OwnershipFacet
    tx = await diamondCut.diamondCut(
      [{
        facetAddress: ownershipFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(ownershipFacet)
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // QuizGameBaseFacet
    tx = await diamondCut.diamondCut(
      [{
        facetAddress: quizGameBaseFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(quizGameBaseFacet)
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // QuizGameModeFacet
    tx = await diamondCut.diamondCut(
      [{
        facetAddress: quizGameModeFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(quizGameModeFacet)
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // QuizGameRewardFacet
    tx = await diamondCut.diamondCut(
      [{
        facetAddress: quizGameRewardFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(quizGameRewardFacet)
      }],
      ethers.ZeroAddress, "0x"
    );
    await tx.wait();

    // ตรวจสอบว่า facets ทั้งหมดถูกเพิ่มไปยัง diamond แล้ว
    // เราคาดว่าจะมี 6 facets: DiamondCut, DiamondLoupe, Ownership, Base, Mode, Reward.
    expect(await diamondLoupe.facetAddresses()).to.have.lengthOf(6);

    // กำหนดค่าเริ่มต้นให้กับ QuizGameDiamond ด้วยที่อยู่ของ admin
    // ซึ่งจะเรียกฟังก์ชัน `initialize` บน QuizGameBaseFacet ผ่าน diamond proxy
    const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target);
    await quizGameBase.initialize(admin.address);

    // มอบ MINTER_ROLE ให้กับ PoolManager สำหรับ QuizCoin
    // ซึ่งอนุญาตให้ PoolManager สร้างโทเค็น QuizCoin ใหม่ได้
    const MINTER_ROLE = await quizCoin.MINTER_ROLE();
    await quizCoin.grantRole(MINTER_ROLE, poolManager.target);

    // ตั้งค่า QuizGameDiamond เป็นสัญญาเกมใน PoolManager
    // ซึ่งเชื่อมโยง PoolManager กับ QuizGameDiamond สำหรับการแจกจ่ายรางวัล
    await poolManager.setGameContract(quizGameDiamond.target);
  });

  // บล็อก Describe สำหรับการทดสอบ Solo Mode
  describe("Solo Mode", function () {
    // กรณีทดสอบ: แอดมินสามารถสร้างคำถามในโหมด Solo และผู้เล่นสามารถแก้ไขได้ถูกต้อง
    it("should allow admin to create a Solo mode question and player to solve it", async function () {
      // รับ instance ของสัญญาสำหรับ facets ที่เฉพาะเจาะจงผ่าน diamond proxy
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
      const quizGameReward = await ethers.getContractAt("QuizGameRewardFacet", quizGameDiamond.target);
      const quizGameBase = await ethers.getContractAt("QuizGameBaseFacet", quizGameDiamond.target);

      // กำหนดรายละเอียดคำถาม
      const questionText = "What is 2 + 2?";
      const options = ["3", "4", "5", "6"];
      const correctAnswerIndex = 1; // Index สำหรับ "4"
      const rewardAmount = ethers.parseEther("10"); // 10 โทเค็น QuizCoin

      // แอดมินสร้างคำถาม solo และคาดว่าจะมีการปล่อยอีเวนต์ SoloQuestionCreated
      await expect(quizGameMode.connect(admin).createSoloQuestion(
        questionText,
        options,
        correctAnswerIndex,
        rewardAmount
      )).to.emit(quizGameMode, "SoloQuestionCreated")
        .withArgs(0, questionText, options, correctAnswerIndex, rewardAmount); // ID คำถามคือ 0 สำหรับคำถามแรก

      const questionId = 0;

      // Mint โทเค็น QuizCoin บางส่วนสำหรับ player1 เพื่อจำลองว่าพวกเขามีเงินทุน
      // เพื่อเข้าร่วมหรือรับรางวัล
      await quizCoin.mint(player1.address, rewardAmount);

      // Player 1 อนุมัติให้ PoolManager ใช้โทเค็น QuizCoin ของพวกเขา
      // สิ่งนี้จำเป็นหากตรรกะของเกมเกี่ยวข้องกับผู้เล่นที่ stake โทเค็นหรือ
      // หาก PoolManager จำเป็นต้องโอนโทเค็นในนามของพวกเขา
      await quizCoin.connect(player1).approve(poolManager.target, rewardAmount);

      // Player 1 แก้ไขคำถามได้อย่างถูกต้องและคาดว่าจะมีการปล่อยอีเวนต์ SoloQuestionSolved
      await expect(quizGameMode.connect(player1).solveSoloQuestion(questionId, correctAnswerIndex))
        .to.emit(quizGameMode, "SoloQuestionSolved")
        .withArgs(questionId, player1.address, true); // `true` บ่งบอกถึงคำตอบที่ถูกต้อง

      // ตรวจสอบยอดคงเหลือของ player1 หลังจากแก้ไขคำถาม
      // สมมติว่ารางวัลถูกโอนจาก PoolManager ไปยังผู้เล่น
      // ยอดคงเหลือของผู้เล่นควรเท่ากับจำนวนรางวัล (หากเริ่มต้นด้วย 0)
      // หรือยอดคงเหลือเริ่มต้นบวกกับจำนวนรางวัล
      // สำหรับการทดสอบนี้ เรา mint จำนวนรางวัลที่แน่นอน ดังนั้นยอดคงเหลือของพวกเขาควรเป็นจำนวนนั้น
      expect(await quizCoin.balanceOf(player1.address)).to.equal(rewardAmount);
    });

    // กรณีทดสอบ: ผู้เล่นพยายามแก้ไขคำถาม solo ด้วยคำตอบที่ไม่ถูกต้อง
    it("should not allow player to solve a solo question with incorrect answer", async function () {
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
      const questionId = 0; // อ้างอิงคำถามเดียวกันที่สร้างขึ้นในการทดสอบก่อนหน้า

      const incorrectAnswerIndex = 0; // Index สำหรับ "3"

      // Player 2 พยายามแก้ไขคำถามด้วยคำตอบที่ไม่ถูกต้อง
      // คาดว่าจะมีการปล่อยอีเวนต์ SoloQuestionSolved โดยมี `false` สำหรับความถูกต้อง
      await expect(quizGameMode.connect(player2).solveSoloQuestion(questionId, incorrectAnswerIndex))
        .to.emit(quizGameMode, "SoloQuestionSolved")
        .withArgs(questionId, player2.address, false);

      // Player 2 ไม่ควรได้รับรางวัลใดๆ ดังนั้นยอดคงเหลือของพวกเขาควรยังคงเป็น 0
      expect(await quizCoin.balanceOf(player2.address)).to.equal(0);
    });

    // กรณีทดสอบ: คำถามไม่สามารถแก้ไขได้หลายครั้งโดยผู้เล่นคนเดียวกัน
    it("should not allow a question to be solved multiple times by the same player", async function () {
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
      const questionId = 0;
      const correctAnswerIndex = 1;

      // Player 1 ได้แก้ไขคำถามนี้ไปแล้วในกรณีทดสอบแรก
      // คาดว่า transaction จะถูก revert พร้อมข้อความแสดงข้อผิดพลาดที่เฉพาะเจาะจง
      await expect(quizGameMode.connect(player1).solveSoloQuestion(questionId, correctAnswerIndex))
        .to.be.revertedWith("QuizGameModeFacet: Question already solved by player");
    });

    // กรณีทดสอบ: เฉพาะแอดมินเท่านั้นที่ควรจะสามารถสร้างคำถาม solo ได้
    it("should not allow non-admin to create a solo question", async function () {
      const quizGameMode = await ethers.getContractAt("QuizGameModeFacet", quizGameDiamond.target);
      const questionText = "Who is the president of USA?";
      const options = ["A", "B", "C", "D"];
      const correctAnswerIndex = 0;
      const rewardAmount = ethers.parseEther("5");

      // Player 1 (ซึ่งไม่ใช่แอดมิน) พยายามสร้างคำถาม solo
      // คาดว่า transaction จะถูก revert พร้อมข้อผิดพลาด "Ownable: caller is not the owner"
      // โดยสมมติว่าบทบาท admin ถูกจัดการโดยรูปแบบ Ownable ภายใน diamond
      await expect(quizGameMode.connect(player1).createSoloQuestion(
        questionText,
        options,
        correctAnswerIndex,
        rewardAmount
      )).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // คุณสามารถเพิ่มบล็อก describe เพิ่มเติมได้ที่นี่สำหรับโหมดเกมอื่นๆ (เช่น "Battle Mode", "Tournament Mode")
  // และฟังก์ชันการทำงานอื่นๆ เมื่อโปรเจกต์ของคุณขยายตัว
});
