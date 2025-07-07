QuizCoin Smart Contracts
QuizCoin เป็นชุดของ Smart Contracts ที่สร้างขึ้นด้วย Hardhat เพื่อขับเคลื่อนแพลตฟอร์มเกมตอบคำถามบนบล็อกเชน ผู้เล่นสามารถตอบคำถามเพื่อรับรางวัลโทเค็น QuizCoin (QZC) ได้

🚀 คุณสมบัติหลัก
QuizCoin (QZC) Token: โทเค็น ERC-20 มาตรฐานที่ใช้เป็นรางวัลในเกม

Upgradeable Contracts: สัญญาทั้งหมดถูกออกแบบมาให้สามารถอัปเกรดได้โดยใช้ OpenZeppelin UUPS proxy เพื่อความยืดหยุ่นในการพัฒนาและบำรุงรักษา

Role-Based Access Control: ใช้ OpenZeppelin AccessControl เพื่อจัดการสิทธิ์ต่างๆ เช่น ใครสามารถสร้างคำถาม หรือใครสามารถ Mint โทเค็นได้

Pool Management: สัญญา PoolManager จัดการการจัดเก็บ QuizCoin สำหรับรางวัลและค่าใช้จ่ายของเกม

Quiz Game Logic: สัญญา QuizGame ควบคุมตรรกะหลักของเกม รวมถึงการสร้างคำถาม การส่งคำตอบ และการจ่ายรางวัล

🛠️ เทคโนโลยีที่ใช้
Solidity: ภาษาที่ใช้เขียน Smart Contracts

Hardhat: Development Environment สำหรับ Ethereum Smart Contracts

Ethers.js: ไลบรารีสำหรับโต้ตอบกับ Ethereum Blockchain ใน JavaScript

OpenZeppelin Contracts: ไลบรารี Smart Contracts ที่ปลอดภัยและผ่านการตรวจสอบแล้ว สำหรับคุณสมบัติที่อัปเกรดได้, ERC-20, และ Access Control

⚙️ การติดตั้งและใช้งาน (Development)
ทำตามขั้นตอนเหล่านี้เพื่อตั้งค่าและทดสอบโปรเจกต์บนเครื่องของคุณ:

ข้อกำหนดเบื้องต้น
Node.js (v18 หรือสูงกว่า)

npm หรือ Yarn

1. โคลน Repository
Bash

git clone https://github.com/jetz001/quizcoin.git
cd quizcoin
2. ติดตั้ง Dependencies
Bash

npm install
# หรือ
yarn install
3. ตั้งค่า Environment Variables
สร้างไฟล์ .env ที่ root ของโปรเจกต์ และเพิ่มตัวแปรสภาพแวดล้อมที่จำเป็น (หากมี) เช่น Private Key หรือ API Keys สำหรับ Testnet/Mainnet (สำหรับ Local Development อาจไม่จำเป็นต้องมี)

# ตัวอย่าง:
# PRIVATE_KEY="your_private_key_here"
# ALCHEMY_API_KEY="your_alchemy_api_key_here"
4. คอมไพล์ Smart Contracts
Bash

npx hardhat compile
5. รัน Hardhat Network (ใน Terminal แยกต่างหาก)
เปิด Terminal ตัวแรกของคุณไว้ แล้วรันคำสั่งนี้เพื่อเริ่ม Hardhat Network ที่รันค้างอยู่:

Bash

npx hardhat node
อย่าปิด Terminal นี้ ปล่อยให้มันรันอยู่เบื้องหลัง

6. Deploy สัญญา (ใน Terminal ใหม่)
เปิด Terminal ตัวที่สอง แล้วรันคำสั่งนี้เพื่อ Deploy สัญญาไปยัง Hardhat Network ที่กำลังทำงานอยู่:

Bash

npx hardhat run scripts/deploy_upgradeable.js --network localhost
คุณจะเห็น Address ของสัญญาที่ถูก Deploy ออกมา จด Address เหล่านี้ไว้

7. โต้ตอบกับสัญญาใน Hardhat Console
ใน Terminal ตัวที่สอง (หลังจาก Deploy สัญญาเสร็จ) เข้าสู่ Hardhat Console เพื่อทดสอบสัญญา:

Bash

npx hardhat console --network localhost
จากนั้น คุณสามารถรันโค้ด JavaScript เพื่อโต้ตอบกับสัญญาได้ เช่น:

JavaScript

// ดึงบัญชีแรก (deployer)
const [deployer] = await ethers.getSigners();
console.log("Using deployer account:", deployer.address);

// แนบสัญญา QuizGame และ QuizCoin ด้วย Address ที่คุณได้จากการ Deploy ล่าสุด
// *** แทนที่ด้วย Address จริงของคุณ ***
const QuizGameFactory = await ethers.getContractFactory("QuizGame");
const quizGame = QuizGameFactory.attach("YOUR_QUIZGAME_ADDRESS_HERE"); 

const QuizCoinFactory = await ethers.getContractFactory("QuizCoin");
const quizCoin = QuizCoinFactory.attach("YOUR_QUIZCOIN_ADDRESS_HERE"); 

console.log("Contracts attached successfully!");

// ตัวอย่าง: สร้างคำถาม
const actualAnswer = "hello";
const answerHash = ethers.keccak256(ethers.toUtf8Bytes(actualAnswer));
const hintHash = ethers.keccak256(ethers.toUtf8Bytes("world"));
const difficulty = 1; 

const tx = await quizGame.createQuestion(answerHash, hintHash, difficulty);
await tx.wait(); 
const questionId = (await quizGame.nextQuestionId()) - 1n; 
console.log(`Question created with ID: ${questionId}`);

// ตัวอย่าง: ตอบคำถาม
const submitTx = await quizGame.submitAnswer(questionId, answerHash);
await submitTx.wait(); 
console.log("Answer submitted successfully!");

// ตัวอย่าง: ตรวจสอบยอด QuizCoin ของผู้ตอบ
const deployerBalance = await quizCoin.balanceOf(deployer.address);
console.log(`Deployer's QuizCoin balance: ${ethers.formatEther(deployerBalance)} QZC`);
🧪 การรัน Automated Tests
โปรเจกต์นี้มี Test Script เพื่อยืนยันการทำงานของสัญญา คุณสามารถรัน Test ได้โดยใช้คำสั่ง:

Bash

npx hardhat test