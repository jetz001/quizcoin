ภาพรวม Tokenomics ของ QuizCoin (QZC)
อุปทานสูงสุด (Max Supply):

ไม่จำกัด (Unlimited)

กลไกการสร้าง: QuizCoin จะถูก "Mint" (สร้างขึ้นใหม่) เมื่อมีผู้เล่นตอบคำถามในเกม QuizGame ได้ถูกต้องเป็นครั้งแรกในแต่ละบล็อก (ไม่ว่าจะอยู่ในโหมด Solo หรือ Pool)

การแจกจ่ายเริ่มต้น (Initial Distribution):

ไม่มี (None)

จะไม่มีการ Mint หรือแจกจ่าย QuizCoin ออกไปให้กับทีม, นักลงทุน, ชุมชน, หรือ Airdrop ใดๆ ในช่วงเริ่มต้น (ณ ตอน Deploy สัญญา QuizCoin จะไม่มีเหรียญอยู่ในระบบเลย)

อุปทานจะเริ่มเกิดขึ้น (เริ่มมีเหรียญในระบบ) เมื่อผู้เล่นคนแรกตอบคำถามถูกในบล็อกนั้นๆ

คลังสมบัติ / กองทุนระบบนิเวศ (Treasury / Ecosystem Fund):

แหล่งที่มา:

ค่าธรรมเนียม 0.5% ของรางวัล: เมื่อมีผู้เล่นตอบคำถามถูก (ไม่ว่าจะเป็นโหมด Solo หรือ Pool) รางวัลรวมที่จะถูก Mint จะถูกหักค่าธรรมเนียม 0.5% เพื่อส่งเข้า Treasury

ค่าธรรมเนียมการซื้อ Hint: เงิน QuizCoin ที่ผู้เล่นใช้ในการซื้อ Hint (คำใบ้) จะถูกโอนโดยตรงเข้าสู่ Treasury ของ Diamond Contract

วัตถุประสงค์การใช้งาน:

ใช้สำหรับค่าใช้จ่ายในการดำเนินงาน เช่น ค่าเช่าโดเมน

ใช้สำหรับค่าใช้จ่ายในการพัฒนา (Development Costs)

และค่าใช้จ่ายอื่นๆ ที่เกี่ยวข้องกับการบำรุงรักษาและพัฒนาระบบนิเวศของ QuizCoin

กลไกและบทบาทของ Smart Contracts (ตามโครงสร้างปัจจุบัน)
QuizCoin.sol (ERC-20 Token):

เป็นสัญญา ERC-20 มาตรฐานสำหรับ QuizCoin (QZC)

ไม่มีการ Mint เหรียญเริ่มต้นใน Constructor (Total Supply เริ่มต้นเป็น 0)

ใช้ AccessControl เพื่อจัดการ Role

มี MINTER_ROLE ที่อนุญาตให้เฉพาะบทบาทนี้สามารถเรียกฟังก์ชัน mint() เพื่อสร้างเหรียญใหม่ได้

มีฟังก์ชัน MINTER_ROLE() เพื่อให้สัญญาอื่นสามารถอ้างอิง Role Hash ได้

PoolManager.sol:

ทำหน้าที่เป็นศูนย์กลางในการจัดการการ Mint และการโอน QuizCoin

withdrawForUser(address _user, uint256 _amount): ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ Mint เหรียญใหม่ จำนวน _amount และส่งให้ _user โดยตรงเมื่อผู้เล่นตอบถูก

mintAndTransferToTreasury(uint256 _amount): ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ Mint เหรียญใหม่ จำนวน _amount และส่งไปยัง Diamond Contract Address (ซึ่งทำหน้าที่เป็น Treasury)

deposit(uint256 _amount): ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อรับค่าธรรมเนียม buyHint (QuizCoin ที่ผู้เล่นจ่าย) ซึ่ง Diamond จะโอนมาให้ PoolManager และ PoolManager จะเก็บไว้ (อันนี้ผิดพลาดจากที่คุยกันตอนแรกว่า Hint fee เข้า Diamond ตรงๆ. เดี๋ยวมาดูว่าจะแก้ตรงไหนดี)

แก้ไขใหม่: ค่า buyHint ควรถูกโอนจากผู้เล่นเข้าสู่ Diamond Contract โดยตรง. ดังนั้น deposit ใน PoolManager อาจจะไม่มีความจำเป็นสำหรับค่า Hint แต่ถ้ามี Admin ต้องการเติมเงินเข้า PoolManager เพื่อจุดประสงค์อื่นก็ยังใช้ได้

setQuizGameDiamondAddress(address _newQuizGameDiamondAddress): ถูกเพิ่มเข้ามาเพื่อให้ PoolManager รู้ว่าใครคือ Diamond Contract ที่ได้รับอนุญาตให้เรียกฟังก์ชัน Mint/Withdraw ได้

PoolManager จะได้รับ MINTER_ROLE บนสัญญา QuizCoin ในระหว่างการ Initialize ของ QuizGameDiamond

QuizGameDiamond.sol (Diamond Proxy):

เป็นสัญญาหลักที่ผู้ใช้จะโต้ตอบด้วย (เป็น Proxy)

ใช้ UUPSUpgradeable และ AccessControlUpgradeable

ใน initialize():

มอบ DEFAULT_ADMIN_ROLE ให้กับผู้ที่ Deploy

สำคัญ: จะทำการ grantRole(QuizCoin.MINTER_ROLE(), PoolManager Address) ให้ PoolManager มีสิทธิ์ Mint เหรียญ QuizCoin

จะเรียก PoolManager.setQuizGameDiamondAddress(address(this)) เพื่อให้ PoolManager รู้จัก Diamond Contract

เป็นที่อยู่ของ Treasury (ค่าธรรมเนียม buyHint และ 0.5% จะถูกส่งมาที่นี่)

LibAppStorage.sol (Library):

จัดการ AppStorage ซึ่งเป็นที่เก็บ State Variables ทั้งหมดของ QuizGame ที่ Facets ทุกตัวจะเข้าถึงร่วมกัน

มี TREASURY_FEE_PERCENTAGE (กำหนดเป็น 50 สำหรับ 0.5%)

มีฟังก์ชัน _calculateCurrentReward() ที่คำนวณรางวัลหลังจาก Halving

QuizGameModeFacet.sol:

จัดการ Logic การสร้างคำถาม (createQuestion) และการส่งคำตอบ (submitAnswer)

ใน submitAnswer (Solo Mode):

คำนวณ totalReward

คำนวณ treasuryFee = totalReward * 0.5%

เรียก ds.poolManager.mintAndTransferToTreasury(treasuryFee) (Mint ให้ Treasury)

เรียก ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver) (Mint ที่เหลือให้ผู้เล่น)

ใน buyHint():

ผู้เล่นจะต้อง approve QuizCoin ให้กับ Diamond Contract Address ก่อน

ค่า HINT_COST_AMOUNT จะถูก transferFrom จากผู้เล่นไปยัง Diamond Contract (address(this)) โดยตรง ซึ่งหมายความว่าค่า Hint จะเข้าสู่ Treasury ทันที

QuizGameRewardFacet.sol:

จัดการ Logic การแจกจ่ายรางวัลสำหรับ Pool Mode (distributeRewards)

ใน distributeRewards:

คำนวณ totalFinalReward

คำนวณ treasuryFee = totalFinalReward * 0.5%

เรียก ds.poolManager.mintAndTransferToTreasury(treasuryFee) (Mint ให้ Treasury)

คำนวณ rewardPerSolver จากรางวัลที่เหลือ

เรียก ds.poolManager.withdrawForUser(solver, rewardPerSolver) (Mint ที่เหลือให้ผู้เล่นใน Pool)

สรุปการทำงานของ Treasury Fund จาก Tokenomics:

การซื้อ Hint: QuizCoin ที่ใช้ซื้อ Hint จะถูกโอนโดยตรงเข้าสู่ Diamond Contract (ซึ่งทำหน้าที่เป็น Treasury) contracts\facets\QuizGameModeFacet.sol::buyHint

ค่าธรรมเนียม 0.5% จากรางวัล: เมื่อรางวัลถูกคำนวณแล้ว (ทั้ง Solo และ Pool) 0.5% ของรางวัลนั้นจะถูก Mint โดย PoolManager และโอนเข้า Diamond Contract (Treasury) contracts\facets\QuizGameModeFacet.sol::submitAnswer และ contracts\facets\QuizGameRewardFacet.sol::distributeRewards

