Phase 1: แกนหลักของเกม (Core Game Logic)
ใน Phase นี้ เป้าหมายคือทำให้ Smart Contract Core Logic ของเกมทำงานได้อย่างสมบูรณ์แบบบน Testnet เพื่อให้มั่นใจว่ากลไกการให้รางวัลและค่าธรรมเนียมเป็นไปตาม Tokenomics

1.1 การทดสอบและปรับแต่งฟังก์ชัน createQuestion, submitAnswer, buyHint และ distributeRewards
คุณจะต้องสร้าง ชุด Test Cases ที่ครอบคลุมสถานการณ์ต่างๆ เพื่อยืนยันความถูกต้องของแต่ละฟังก์ชันครับ ผมแนะนำให้ใช้ Hardhat/Foundry สำหรับการเขียน Unit/Integration Tests.

Test Case ที่สำคัญ:

createQuestion:

สร้างคำถาม Solo Mode (Level 1-99, Level 100).

สร้างคำถาม Pool Mode (Level 1-99, Level 100).

ทดสอบการสร้างคำถามโดยผู้ที่ไม่ใช่ Admin.

ตรวจสอบค่า baseRewardAmount ที่คำนวณได้ถูกต้องตาม difficultyLevel.

submitAnswer (Solo Mode):

ผู้เล่นตอบถูกครั้งแรก: ตรวจสอบว่าได้รับรางวัลถูกต้อง, Treasury ได้รับค่าธรรมเนียม, คำถามถูกปิด.

ผู้เล่นคนเดิมตอบคำถามซ้ำในวันเดียวกัน (ควรล้มเหลว).

ผู้เล่นคนเดิมตอบคำถามอื่นในวันเดียวกันแต่คนละโหมด (ควรล้มเหลว).

ผู้เล่นอื่นพยายามตอบคำถาม Solo ที่ถูกแก้ไปแล้ว (ควรล้มเหลว).

ทดสอบคำถาม Level 100 ที่หมดอายุ (ควรล้มเหลว).

submitAnswer (Pool Mode):

ผู้เล่นคนแรกตอบถูก: ตรวจสอบว่า firstCorrectAnswerTime ถูกตั้งค่า และ QuestionRewardWindowStarted Event ถูก Emit.

ผู้เล่นคนอื่นๆ ตอบถูกภายในหน้าต่างเวลา: ตรวจสอบว่าถูกเพิ่มเข้า poolCorrectSolvers และไม่ซ้ำซ้อน.

ผู้เล่นตอบถูกหลังจากหน้าต่างเวลาปิด (ควรล้มเหลว).

ผู้เล่นคนเดิมตอบคำถามซ้ำในวันเดียวกัน (ควรล้มเหลว).

ผู้เล่นคนเดิมตอบคำถามอื่นในวันเดียวกันแต่คนละโหมด (ควรล้มเหลว).

ทดสอบคำถาม Level 100 ที่หมดอายุ (ควรล้มเหลว).

buyHint:

ผู้เล่นซื้อ Hint: ตรวจสอบว่า QuizCoin ถูก transferFrom จากผู้เล่นไปยัง Diamond Contract (Treasury) และ Event ถูก Emit.

ยอดเงินไม่พอ (ควรล้มเหลว).

ซื้อ Hint ให้คำถามที่ปิดแล้ว หรือหมดอายุ (ควรล้มเหลว).

distributeRewards (Pool Mode):

เรียกโดย REWARD_DISTRIBUTOR_ROLE เท่านั้น.

เรียกก่อนหน้าต่างเวลาปิด (ควรล้มเหลว).

เรียกหลังหน้าต่างเวลาปิด: ตรวจสอบว่ารางวัลถูกแบ่งเท่ากัน, Treasury ได้รับค่าธรรมเนียม, และทุกคนได้รับ Mint ที่ถูกต้อง, คำถามถูกปิด.

ไม่มีใครตอบถูก (ควรล้มเหลว).

คำถาม Level 100 ที่หมดอายุ (ควรล้มเหลว).

Halving Mechanism:

จำลองเวลาให้ผ่านไปหลายๆ Halving Period เพื่อยืนยันว่า _calculateCurrentReward ลดลงอย่างถูกต้องและไม่ต่ำกว่า MIN_REWARD_AFTER_HALVING.

1.2 พัฒนาระบบ Oracle / Off-Chain Automation สำหรับ distributeRewards
เนื่องจาก Smart Contract ไม่สามารถเรียกตัวเองได้ และไม่สามารถตรวจสอบเวลาด้วยความแม่นยำสูงและทริกเกอร์ฟังก์ชันอัตโนมัติได้ จึงต้องมีระบบภายนอกมาช่วย

ทางเลือกที่แนะนำ:

Node.js/Python Script (Simple & Cost-Effective):

เขียนสคริปต์ที่รันบนเซิร์ฟเวอร์ของคุณ.

Logic:

วนลูปตรวจสอบคำถาม Pool Mode ที่ firstCorrectAnswerTime ถูกตั้งค่าแล้ว.

คำนวณว่า block.timestamp ปัจจุบันผ่าน question.firstCorrectAnswerTime + POOL_REWARD_WINDOW_DURATION_SECONDS หรือ + LEVEL_100_QUESTION_VALIDITY_SECONDS (สำหรับ Level 100) ไปแล้วหรือไม่.

หากถึงเวลา, เรียกฟังก์ชัน distributeRewards(questionId) บน Diamond Contract.

สคริปต์นี้จะต้องมี Account ที่มี REWARD_DISTRIBUTOR_ROLE และมี ETH/MATIC/BNB (Gas) เพียงพอสำหรับส่ง Transaction.

ข้อดี: ควบคุมได้เต็มที่, ประหยัดค่าใช้จ่าย.

ข้อเสีย: ต้องดูแล Server เอง, อาจมีความล่าช้าหาก Server มีปัญหาหรือ Network Congestion.

Chainlink Keepers (Robust & Decentralized):

เหมาะสำหรับ Production Environment ที่ต้องการความน่าเชื่อถือสูง.

Logic:

สร้าง Upkeep Function บน Chainlink Keepers ที่จะตรวจสอบเงื่อนไข (เช่น block.timestamp >= question.firstCorrectAnswerTime + duration).

เมื่อเงื่อนไขเป็นจริง Chainlink Keeper จะส่ง Transaction เพื่อเรียก distributeRewards(questionId) ให้คุณ.

ข้อดี: Decentralized, เชื่อถือได้สูง, ไม่ต้องดูแล Server เอง.

ข้อเสีย: มีค่าใช้จ่าย (Paying in LINK Token), อาจจะซับซ้อนกว่าในการตั้งค่าเริ่มต้น.

สิ่งที่ต้องทำ:

เลือกแพลตฟอร์ม: เริ่มต้นด้วย Node.js/Python Script เพื่อความรวดเร็วในการพัฒนาและทดสอบ.

สร้าง Wallet: เตรียม Wallet ที่จะถือ REWARD_DISTRIBUTOR_ROLE สำหรับสคริปต์นี้.

ทดสอบการทำงานอัตโนมัติ: Deploy สัญญาบน Testnet และรันสคริปต์/ตั้งค่า Keeper เพื่อยืนยันว่ารางวัลถูกแจกจ่ายอัตโนมัติเมื่อถึงเวลา.

1.3 สร้างอินเทอร์เฟซผู้ใช้ (Basic UI/CLI) สำหรับการทดสอบ
การมีวิธีโต้ตอบกับสัญญาจะช่วยให้คุณและทีมสามารถทดสอบและ Debug ได้ง่ายขึ้นมาก

แนวทาง:

Hardhat Console / Scripts: ใช้ npx hardhat console หรือเขียน scripts ใน Hardhat เพื่อเรียกฟังก์ชันต่างๆ. นี่เป็นวิธีที่รวดเร็วที่สุดสำหรับการทดสอบเริ่มต้น.

Simple Web UI (Frontend Framework): หากคุณคุ้นเคยกับ React/Vue/Angular, สร้างหน้าเว็บง่ายๆ ที่ใช้ Ethers.js/Web3.js เพื่อเชื่อมต่อกับ Metamask และเรียกใช้ฟังก์ชันบน Smart Contract.

หน้าจอสำหรับ Admin: createQuestion, setPoolManagerAddress, setQuizCoinAddress, grantRole (ถ้าจำเป็น).

หน้าจอสำหรับผู้เล่น: submitAnswer, buyHint.

หน้าจอสำหรับ REWARD_DISTRIBUTOR: ปุ่ม distributeRewards (สำหรับ Manual Test ก่อน Automation).

CLI Tool: พัฒนา CLI Tool แบบง่ายๆ ที่รับ Command arguments เพื่อโต้ตอบกับสัญญา.

สิ่งที่ต้องทำ:

เลือกเครื่องมือที่คุณคุ้นเคย (แนะนำ Hardhat Scripts/Console ก่อน).

สร้างฟังก์ชันโต้ตอบสำหรับทุกฟังก์ชันหลักที่ระบุใน Phase 1.1.

