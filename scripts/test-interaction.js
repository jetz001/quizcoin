require('dotenv').config();

async function main() {
    // บรรทัดที่ 1: กำหนด Address ของสัญญา QuizCoin (ใช้ Address ล่าสุดที่คุณ Deploy ได้)
    const quizCoinAddress = "0xbd166434e81bE7C212006cD71968C5309CA255737";

    // บรรทัดที่ 2: กำหนด Address ของสัญญา QuizGame (ใช้ Address ล่าสุดที่คุณ Deploy ได้)
    const quizGameAddress = "0x539eb8aBef083123cAD8785664d1D62A63Dcc128";

    // บรรทัดที่ 3: กำหนด Address ของสัญญา PoolManager (ใช้ Address ล่าสุดที่คุณ Deploy ได้)
    const poolManagerAddress = "0x7A070Cad68a1D64174C58b9Abb63010e015D2bbC";

    // บรรทัดที่ 4: ดึง Signers (บัญชีผู้ใช้) จาก Hardhat Environment และดึง BigNumber Class ออกมาโดยตรง
    const [deployer, player1, player2] = await ethers.getSigners();
    const BigNumber = ethers.BigNumber; // <-- บรรทัดนี้ควรอยู่ตรงนี้

    // บรรทัดที่ 5: โหลด Contract Factory สำหรับ QuizCoin
    const QuizCoin = await ethers.getContractFactory("QuizCoin");

    // บรรทัดที่ 6: โหลด Contract Factory สำหรับ QuizGame
    const QuizGame = await ethers.getContractFactory("QuizGame");

    // บรรทัดที่ 7: โหลด Contract Factory สำหรับ PoolManager
    const PoolManager = await ethers.getContractFactory("PoolManager");

    // บรรทัดที่ 8: Attach สัญญา QuizCoin เข้ากับ Address จริงบน Testnet
    const quizCoin = await QuizCoin.attach(quizCoinAddress);

    // บรรทัดที่ 9: Attach สัญญา QuizGame เข้ากับ Address จริงบน Testnet
    const quizGame = await QuizGame.attach(quizGameAddress);

    // บรรทัดที่ 10: Attach สัญญา PoolManager เข้ากับ Address จริงบน Testnet
    const poolManager = await PoolManager.attach(poolManagerAddress);

    // บรรทัดที่ 11: แสดงข้อความบ่งบอกว่าโหลดสัญญาแล้ว
    console.log("Contracts loaded:");

    // บรรทัดที่ 12: แสดง Address ของ QuizCoin ที่โหลดมา
    console.log("QuizCoin at:", quizCoin.address);

    // บรรทัดที่ 13: แสดง Address ของ QuizGame ที่โหลดมา
    console.log("QuizGame at:", quizGame.address);

    // บรรทัดที่ 14: แสดง Address ของ PoolManager ที่โหลดมา
    console.log("PoolManager at:", poolManager.address);

    // บรรทัดที่ 15: เรียกดูค่า BLOCKS_PER_HALVING_PERIOD จากสัญญา QuizGame
    const blocksPerHalving = await quizGame.BLOCKS_PER_HALVING_PERIOD();

    // บรรทัดที่ 16: แสดงค่า BLOCKS_PER_HALVING_PERIOD
    console.log("BLOCKS_PER_HALVING_PERIOD:", blocksPerHalving.toString());

    // บรรทัดที่ 17: ดึง Current Block Number จาก Provider
    const currentBlock = await ethers.provider.getBlockNumber();

    // บรรทัดที่ 18: แสดง Current Block Number
    console.log("Current block number:", currentBlock);

    // บรรทัดที่ 19: เรียก calculateReward สำหรับ Difficulty 1 และแปลงเป็น BigNumber
    const rewardForDiff1Check = BigNumber.from(await quizGame.calculateReward(1));

    // บรรทัดที่ 20: เรียกค่าคงที่ INITIAL_BASE_REWARD_LEVEL_1_99 และแปลงเป็น BigNumber
    const initialBaseRewardCheck = BigNumber.from(await quizGame.INITIAL_BASE_REWARD_LEVEL_1_99());

    // บรรทัดที่ 21: แสดง Reward for Diff 1 ที่คำนวณโดยสัญญา
    console.log("Reward for Diff 1 (calculated by contract):", rewardForDiff1Check.toString());

    // บรรทัดที่ 22: แสดง Initial Base Reward จากค่าคงที่ในสัญญา
    console.log("Initial Base Reward (from contract constant):", initialBaseRewardCheck.toString());

    // บรรทัดที่ 23: เริ่มต้นเงื่อนไข if เพื่อตรวจสอบการ Halving ของรางวัล
    if (rewardForDiff1Check.eq(initialBaseRewardCheck.div(BigNumber.from(2)))) {
        // บรรทัดที่ 24: (ถ้าเงื่อนไขเป็นจริง) แสดงข้อความว่ารางวัลถูก Halved แล้ว
        console.log("Base Reward has been halved once (as expected due to high block number).");
    } else if (rewardForDiff1Check.eq(initialBaseRewardCheck)) {
        // บรรทัดที่ 26: (ถ้าเงื่อนไข else if เป็นจริง) แสดงข้อความว่ารางวัลยังเป็นค่าเริ่มต้น
        console.log("Base Reward is still at initial value (halving periods is 0).");
    } else {
        // บรรทัดที่ 28: (ถ้าเงื่อนไข else เป็นจริง) แสดงข้อความว่ารางวัลถูก Halved หลายครั้ง หรือเป็นค่าผิดปกติ
        console.log("Base Reward has been halved multiple times or unexpected value.");
    }

    // บรรทัดที่ 30: เรียกค่าคงที่ INITIAL_BASE_REWARD_LEVEL_1_99 อีกครั้งเพื่อแสดง
    const initialBaseReward = await quizGame.INITIAL_BASE_REWARD_LEVEL_1_99();

    // บรรทัดที่ 31: แสดงค่า INITIAL_BASE_REWARD_LEVEL_1_99
    console.log("INITIAL_BASE_REWARD_LEVEL_1_99:", initialBaseReward.toString());

    // บรรทัดที่ 32: เรียกค่าคงที่ MIN_REWARD_LEVEL_1_99
    const minReward = await quizGame.MIN_REWARD_LEVEL_1_99();

    // บรรทัดที่ 33: แสดงค่า MIN_REWARD_LEVEL_1_99
    console.log("MIN_REWARD_LEVEL_1_99:", minReward.toString());

    // บรรทัดที่ 34: คำนวณรางวัลสำหรับ Difficulty 1
    const calculatedRewardForDiff1 = await quizGame.calculateReward(1);

    // บรรทัดที่ 35: แสดงค่า Calculated Reward สำหรับ Difficulty 1
    console.log("Calculated Reward for Difficulty 1:", calculatedRewardForDiff1.toString());

    // บรรทัดที่ 36: คำนวณรางวัลสำหรับ Difficulty 99
    const calculatedRewardForDiff99 = await quizGame.calculateReward(99);

    // บรรทัดที่ 37: แสดงค่า Calculated Reward สำหรับ Difficulty 99
    console.log("Calculated Reward for Difficulty 99:", calculatedRewardForDiff99.toString());

    // บรรทัดที่ 38: คำนวณรางวัลสำหรับ Difficulty 100
    const calculatedRewardForDiff100 = await quizGame.calculateReward(100);

    // บรรทัดที่ 39: แสดงค่า Calculated Reward สำหรับ Difficulty 100
    console.log("Calculated Reward for Difficulty 100:", calculatedRewardForDiff100.toString());

    // บรรทัดที่ 40: กำหนดข้อความคำถาม
    const questionText = "What is 2+2?";

    // บรรทัดที่ 41: กำหนดคำตอบที่ถูกต้อง
    const correctAnswer = "4";

    // บรรทัดที่ 42: สร้าง Hash ของคำตอบที่ถูกต้อง
    const correctAnswerHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(correctAnswer));

    // บรรทัดที่ 43: กำหนดระดับความยาก
    const difficulty = 10;

    // บรรทัดที่ 44: กำหนดข้อความ Hint
    const hintText = "It's a small, even number.";

    // บรรทัดที่ 45: สร้าง Hash ของ Hint
    const hintTextHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hintText));

    // บรรทัดที่ 46: กำหนดค่าใช้จ่ายสำหรับ Hint
    const hintCost = ethers.utils.parseEther("100");

    // บรรทัดที่ 47: ส่ง Transaction เพื่อสร้างคำถามใหม่
    let tx = await quizGame.createQuestion(correctAnswerHash, difficulty, hintTextHash, hintCost);

    // บรรทัดที่ 48: รอ Transaction ให้เสร็จสมบูรณ์
    let receipt = await tx.wait();

    // บรรทัดที่ 49: กรองหา Event "QuestionCreated" จาก Transaction Receipt
    const questionCreatedEvent = receipt.events?.filter((x) => x.event === "QuestionCreated")[0];

    // บรรทัดที่ 50: ดึง questionId จาก Event ที่ได้
    const questionId = questionCreatedEvent.args.questionId;

    // บรรทัดที่ 51: แสดง Question ID ที่สร้างขึ้นมา
    console.log("Question created with ID:", questionId.toString());

    // บรรทัดที่ 52: แสดงข้อความบ่งบอกว่า Player 1 กำลังส่งคำตอบ
    console.log("Player 1 submitting answer...");

    // บรรทัดที่ 53: ให้ Player 1 ส่งคำตอบสำหรับคำถามที่สร้างขึ้น
    await quizGame.connect(player1).submitAnswer(questionId, correctAnswerHash);

    // บรรทัดที่ 54: แสดงข้อความยืนยันว่า Player 1 ส่งคำตอบสำเร็จ
    console.log("Player 1 submitted answer successfully.");

    // บรรทัดที่ 55: ตรวจสอบยอดคงเหลือของ Player 1 ในสัญญา QuizCoin
    const player1Balance = await quizCoin.balanceOf(player1.address);

    // บรรทัดที่ 56: แสดงยอดคงเหลือของ Player 1 ในหน่วย wei
    console.log("Player 1 balance after solving (wei):", player1Balance.toString());

    // บรรทัดที่ 57: แสดงยอดคงเหลือของ Player 1 ในหน่วย QZC (แปลงจาก wei)
    console.log("Player 1 balance after solving (QZC):", ethers.utils.formatEther(player1Balance));

    // บรรทัดที่ 58: ดึงข้อมูลคำถามจากสัญญาโดยใช้ questionId
    const question = await quizGame.questions(questionId);

    // บรรทัดที่ 59: แสดงสถานะว่าคำถามถูกแก้แล้วหรือไม่ (true/false)
    console.log("Question solved status:", question.isSolved);

    // บรรทัดที่ 60: แสดง Address ของผู้ที่แก้คำถามได้
    console.log("Question solver:", question.solverAddress);

    // บรรทัดที่ 61: แสดงจำนวนรางวัลที่ถูก Mint สำหรับคำถามนี้ (ในหน่วย QZC)
    console.log("Reward minted for question:", ethers.utils.formatEther(question.rewardMinted));

    // บรรทัดที่ 62: ลองคำนวณรางวัลอีกครั้งด้วยฟังก์ชัน calculateReward เพื่อยืนยันว่าตรงกับที่ Mint ได้
    const expectedReward = await quizGame.calculateReward(difficulty);

    // บรรทัดที่ 63: แสดงรางวัลที่คาดหวังจากฟังก์ชัน calculateReward
    console.log("Expected reward from calculateReward function:", ethers.utils.formatEther(expectedReward));

} // <-- ปิด async function main

// นี่คือส่วนที่เรียกใช้ main function และจัดการ Error
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });