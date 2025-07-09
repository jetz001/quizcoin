# QuizCoin (QZC) Tokenomics และบทบาทของ Smart Contract

เอกสารนี้จะอธิบายโทเคโนมิคส์หลักของ QuizCoin (QZC) บทบาทของสัญญาอัจฉริยะ และกลไกเกมภายในระบบนิเวศเกมตอบคำถามแบบกระจายศูนย์

---

## 1. ภาพรวม Tokenomics ของ QuizCoin (QZC)

### 1.1 อุปทานสูงสุด (Max Supply): ไม่จำกัด (Unlimited)
* QZC มีอุปทานรวม **ไม่จำกัด**
* **กลไกการสร้าง:** เหรียญ QuizCoin จะถูก "Mint" (สร้างขึ้นใหม่) โดยเฉพาะเมื่อผู้เล่นตอบคำถามในเกม QuizGame ได้ถูกต้องเป็นครั้งแรกในแต่ละบล็อก (ไม่ว่าจะเล่นในโหมด Solo หรือ Pool)

### 1.2 การแจกจ่ายเริ่มต้น (Initial Distribution): ไม่มี (None)
* จะ **ไม่มีการ Mint เหรียญล่วงหน้า, การแจกจ่ายเริ่มต้น หรือการทำ Airdrop** ของเหรียญ QZC
* ณ เวลาที่ deploy สัญญา QuizCoin อุปทานรวมของเหรียญจะเริ่มต้นที่ศูนย์
* อุปทานของเหรียญจะเริ่มหมุนเวียนในระบบนิเวศก็ต่อเมื่อผู้เล่นเริ่มได้รับรางวัลจากการตอบคำถามได้อย่างถูกต้องเท่านั้น

### 1.3 คลังสมบัติ / กองทุนระบบนิเวศ (Treasury / Ecosystem Fund)
ความยั่งยืนและการพัฒนาของโปรเจกต์ได้รับการสนับสนุนจากคลังสมบัติโดยเฉพาะ ซึ่งบริหารจัดการโดย Diamond Contract

* **1.3.1 แหล่งที่มาของเงินทุน:**
    * **ค่าธรรมเนียมรางวัล 0.5%:** เมื่อมีผู้เล่นตอบคำถามถูก (ไม่ว่าจะเป็นโหมด Solo หรือ Pool) รางวัลรวมที่คำนวณได้ 0.5% จะถูก Mint และส่งตรงไปยัง **Diamond Contract** ซึ่งทำหน้าที่เป็นคลังสมบัติหลักของโปรเจกต์
    * **ค่าธรรมเนียมการซื้อ Hint:** เหรียญ QuizCoin ที่ผู้เล่นใช้ในการซื้อ Hint (คำใบ้) จะถูกโอน **โดยตรง** จากกระเป๋าเงินของผู้เล่นไปยัง **Diamond Contract (คลังสมบัติ)**
* **1.3.2 วัตถุประสงค์การใช้งาน:**
    * ครอบคลุมค่าใช้จ่ายในการดำเนินงาน เช่น ค่าเช่าโดเมน
    * ค่าใช้จ่ายในการพัฒนา (Development Costs)
    * ค่าใช้จ่ายอื่นๆ ที่เกี่ยวข้องกับการบำรุงรักษาและพัฒนาระบบนิเวศของ QuizCoin

---

## 2. กลไกเกมและฟีเจอร์

### 2.1 โหมดการเล่นเกม (Game Modes)
เกม QuizCoin มี 2 โหมดหลัก โดยมีกลไกรางวัลและการเล่นที่แตกต่างกัน:

* **2.1.1 โหมด Solo (ระดับ 1-99):**
    * **ผู้ชนะ:** ผู้เล่นคนแรกที่ตอบคำถามถูกต้องในบล็อกนั้นๆ จะได้รับรางวัลเต็มจำนวนของระดับคำถามนั้น (หลังหักค่าธรรมเนียม Treasury 0.5%)
    * **สถานะคำถาม:** เมื่อมีผู้ชนะในโหมด Solo คำถามนั้นจะถูกปิดทันที และไม่มีผู้เล่นอื่นสามารถตอบได้อีกในบล็อกนั้น
* **2.1.2 โหมด Pool (ระดับ 1-99):**
    * **ช่วงเวลาตอบ:** เมื่อมีผู้เล่นคนแรกตอบคำถามถูกต้องในโหมด Pool ระบบจะเริ่มนับเวลาถอยหลัง 3 นาที (ช่วงเวลา Pool) เพื่อให้ผู้เล่นคนอื่นมีโอกาสเข้าร่วมตอบคำถาม
    * **การแจกจ่ายรางวัล:** หลังสิ้นสุดช่วงเวลา Pool (3 นาที) รางวัลรวมของคำถามนั้น (หลังหักค่าธรรมเนียม Treasury 0.5%) จะถูกแบ่งเท่าๆ กันระหว่างผู้เล่นทุกคนที่ตอบถูกต้องภายในช่วงเวลานั้น
* **2.1.3 คำถามระดับ 100 (ระดับพิเศษ):**
    * **ความถี่:** มีเพียง 1 คำถามต่อวัน
    * **รางวัล:** ผู้ตอบถูก (ไม่ว่าจะ Solo หรือ Pool) จะได้รับรางวัลคงที่ 10,000 QZC **โดยไม่มีการ Halving**
    * **รูปแบบคำตอบ:** เป็นช่องข้อความ (textbox) สำหรับใส่ตัวเลขทศนิยม 2 ตำแหน่ง โดยมีการปัดขึ้นเมื่อทศนิยมตำแหน่งที่สามเป็น 0.005 (เช่น 0.005 ปัดขึ้นเป็น 0.01)

### 2.2 กลไกรางวัลและการตอบคำถาม

* **รางวัลสำหรับระดับ 1-99:** ผู้เล่นจะได้รับรางวัลระหว่าง 1-5,000 QZC ขึ้นอยู่กับระดับความยากของคำถาม
* **กลไก Halving:** รางวัลสำหรับคำถามระดับ 1-99 จะถูกลดลงครึ่งหนึ่ง ("Halving") ทุก 4 ปี เพื่อควบคุมอุปทานและสร้างความยั่งยืนในระยะยาว
* **ความถี่ในการตอบ:**
    * **1 การตอบต่อ Wallet ต่อคำถาม:** แต่ละ Wallet สามารถตอบคำถามได้เพียง 1 ครั้งต่อคำถามนั้นๆ ในแต่ละบล็อก (หรือวัน)
    * **ตอบซ้ำได้ในวันถัดไป:** ผู้เล่นสามารถตอบคำถามเดิมได้อีกครั้งในวันถัดไป หากคำถามนั้นยังไม่ถูกปิด
* **การเลือกโหมด:** แต่ละ Wallet สามารถเลือกเล่นได้เพียง 1 โหมด (Solo หรือ Pool) ต่อวัน และจะสามารถเลือกโหมดใหม่ได้ในวันถัดไป
* **การอ้างอิงบล็อก:**
    * **ความเร็วบล็อก:** อ้างอิงความเร็วบล็อกจาก Binance Smart Chain (BSC) ซึ่งประมาณ 3 บล็อกต่อวินาที
    * **ระยะเวลาคำถาม (ระดับ 1-99):** คำถาม 1 คำถาม จะมีระยะเวลา 60 บล็อก
    * **ระยะเวลาคำถาม (ระดับ 100):** คำถามระดับ 100 จะมีระยะเวลา 28,800 บล็อก

### 2.3 ระบบ Hint (คำใบ้)
* ผู้เล่นสามารถซื้อ Hint (คำใบ้) เพื่อช่วยในการตอบคำถามได้
* ค่าใช้จ่ายในการซื้อ Hint จะถูกโอนเป็นเหรียญ QZC โดยตรงเข้าสู่ Treasury ของ Diamond Contract

### 2.4 การสร้างคำถามและ Question Bank
* คำถามจะถูกสร้างขึ้นโดย **ปัญญาประดิษฐ์ (AI)** และคำตอบที่ถูกต้องจะถูก **Hash** ไว้
* **2.4.1 Question Bank (คลังคำถาม):** มี Question Bank สำรองไว้สำหรับเก็บคำถามในกรณีที่มีเหตุขัดข้องหรือไม่สามารถเชื่อมต่อกับ AI ได้ตามปกติ
    * สำหรับคำถามระดับ 1-99: เก็บคำถามล่วงหน้าไว้ 20 ปี หรือประมาณ 3,504,000 คำถาม
    * สำหรับคำถามระดับ 100: เก็บคำถามล่วงหน้าไว้ 7,300 คำถาม
* **2.4.2 หมวดหมู่คำถาม:** คำถามทั้งหมดจะเป็นเฉพาะหมวด **วิทยาศาสตร์** และ **คณิตศาสตร์** เท่านั้น
* คำถามที่เก็บใน Question Bank จะถูก Hash ทั้งคำถาม ตัวเลือก และคำตอบไว้ เพื่อความโปร่งใสและยุติธรรม

---

## 3. กลไกและบทบาทของ Smart Contracts (ตามโครงสร้างปัจจุบัน)

### 3.1 `QuizCoin.sol` (ERC-20 Token)
* เป็นสัญญา ERC-20 มาตรฐานสำหรับ QuizCoin (QZC)
* **ไม่มีการ Mint เหรียญเริ่มต้น** ใน Constructor (Total Supply เริ่มต้นเป็น 0)
* ใช้ `AccessControl` ของ OpenZeppelin เพื่อจัดการ Role
* มี `MINTER_ROLE` ที่อนุญาตให้เฉพาะบทบาทนี้สามารถเรียกฟังก์ชัน `mint()` เพื่อสร้างเหรียญใหม่ได้
* มีฟังก์ชัน `MINTER_ROLE()` เพื่อให้สัญญาอื่นสามารถอ้างอิง Role Hash ได้

### 3.2 `PoolManager.sol`
ทำหน้าที่เป็นศูนย์กลางในการจัดการการ Mint และการโอน QuizCoin

* `withdrawForUser(address _user, uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ **Mint เหรียญใหม่** จำนวน `_amount` และส่งให้ `_user` โดยตรงเมื่อผู้เล่นตอบถูก
* `mintAndTransferToTreasury(uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ **Mint เหรียญใหม่** จำนวน `_amount` และส่งไปยัง Diamond Contract Address (ซึ่งทำหน้าที่เป็น Treasury)
* `deposit(uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อรับค่าธรรมเนียม `buyHint` (QuizCoin ที่ผู้เล่นจ่าย) ซึ่ง Diamond จะโอนมาให้ PoolManager และ PoolManager จะเก็บไว้
    * **แก้ไขเพิ่มเติม:** ค่า `buyHint` ควรถูกโอนจากผู้เล่นเข้าสู่ Diamond Contract โดยตรง ดังนั้น `deposit` ใน `PoolManager` อาจจะไม่มีความจำเป็นสำหรับค่า Hint นี้แล้ว แต่ถ้ามี Admin ต้องการเติมเงินเข้า `PoolManager` เพื่อจุดประสงค์อื่นก็ยังคงใช้ได้
* `setQuizGameDiamondAddress(address _newQuizGameDiamondAddress)`: ถูกเพิ่มเข้ามาเพื่อให้ PoolManager รู้ว่าใครคือ Diamond Contract ที่ได้รับอนุญาตให้เรียกฟังก์ชัน Mint/Withdraw ได้
* **การมอบ `MINTER_ROLE`:** `PoolManager` จะได้รับ `MINTER_ROLE` บนสัญญา QuizCoin ในระหว่างการ Initialize ของ `QuizGameDiamond`

### 3.3 `QuizGameDiamond.sol` (Diamond Proxy)
เป็นสัญญาหลักที่ผู้ใช้จะโต้ตอบด้วย (เป็น Proxy)

* ใช้ `UUPSUpgradeable` และ `AccessControlUpgradeable`
* ใน `initialize()`:
    * มอบ `DEFAULT_ADMIN_ROLE` ให้กับผู้ที่ Deploy
    * **สำคัญ:** จะทำการ `grantRole(QuizCoin.MINTER_ROLE(), PoolManager Address)` ให้ `PoolManager` มีสิทธิ์ Mint เหรียญ QuizCoin
    * จะเรียก `PoolManager.setQuizGameDiamondAddress(address(this))` เพื่อให้ `PoolManager` รู้จัก Diamond Contract
* **บทบาทของ Treasury:** เป็นที่อยู่ของ Treasury (ค่าธรรมเนียม `buyHint` และ 0.5% จะถูกส่งมาที่นี่)

### 3.4 `LibAppStorage.sol` (Library)
* จัดการ `AppStorage` ซึ่งเป็นที่เก็บ State Variables ทั้งหมดของ QuizGame ที่ Facets ทุกตัวจะเข้าถึงร่วมกัน
* มี `TREASURY_FEE_PERCENTAGE` (กำหนดเป็น 50 สำหรับ 0.5%)
* มีฟังก์ชัน `_calculateCurrentReward()` ที่คำนวณรางวัลหลังจาก Halving

### 3.5 `QuizGameModeFacet.sol`
จัดการ Logic การสร้างคำถาม (`createQuestion`) และการส่งคำตอบ (`submitAnswer`)

* **3.5.1 ใน `submitAnswer` (Solo Mode):**
    * คำนวณ `totalReward`
    * คำนวณ `treasuryFee = totalReward * 0.5%`
    * เรียก `ds.poolManager.mintAndTransferToTreasury(treasuryFee)` (Mint ให้ Treasury)
    * เรียก `ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver)` (Mint ที่เหลือให้ผู้เล่น)
* **3.5.2 ใน `buyHint()`:**
    * ผู้เล่นจะต้อง `approve` QuizCoin ให้กับ Diamond Contract Address ก่อน
    * ค่า `HINT_COST_AMOUNT` จะถูก `transferFrom` จากผู้เล่นไปยัง Diamond Contract (`address(this)`) โดยตรง ซึ่งหมายความว่าค่า Hint จะเข้าสู่ Treasury ทันที

### 3.6 `QuizGameRewardFacet.sol`
จัดการ Logic การแจกจ่ายรางวัลสำหรับ Pool Mode (`distributeRewards`)

* **3.6.1 ใน `distributeRewards`:**
    * คำนวณ `totalFinalReward`
    * คำนวณ `treasuryFee = totalFinalReward * 0.5%`
    * เรียก `ds.poolManager.mintAndTransferToTreasury(treasuryFee)` (Mint ให้ Treasury)
    * คำนวณ `rewardPerSolver` จากรางวัลที่เหลือ
    * เรียก `ds.poolManager.withdrawForUser(solver, rewardPerSolver)` (Mint ที่เหลือให้ผู้เล่นใน Pool)

### 3.7 สรุปการทำงานของ Treasury Fund จาก Tokenomics:
* **การซื้อ Hint:** QuizCoin ที่ใช้ซื้อ Hint จะถูกโอนโดยตรงเข้าสู่ Diamond Contract (ซึ่งทำหน้าที่เป็น Treasury)
    * *อ้างอิง:* `contracts\facets\QuizGameModeFacet.sol::buyHint`
* **ค่าธรรมเนียม 0.5% จากรางวัล:** เมื่อรางวัลถูกคำนวณแล้ว (ทั้ง Solo และ Pool) 0.5% ของรางวัลนั้นจะถูก Mint โดย `PoolManager` และโอนเข้า Diamond Contract (Treasury)
    * *อ้างอิง:* `contracts\facets\QuizGameModeFacet.sol::submitAnswer`
    * *อ้างอิง:* `contracts\facets\QuizGameRewardFacet.sol::distributeRewards`

ภาพรวม Tokenomics ของ QuizCoin (QZC)
1.อุปทานสูงสุด (Max Supply): ไม่จำกัด (Unlimited)

2.กลไกการสร้าง: QuizCoin จะถูก "Mint" (สร้างขึ้นใหม่) เมื่อมีผู้เล่นตอบคำถามในเกม QuizGame ได้ถูกต้องเป็นครั้งแรกในแต่ละบล็อก (ไม่ว่าจะอยู่ในโหมด Solo หรือ Pool)

3.การแจกจ่ายเริ่มต้น (Initial Distribution):ไม่มี (None)

จะไม่มีการ Mint หรือแจกจ่าย QuizCoin ออกไปให้กับทีม, นักลงทุน, ชุมชน, หรือ Airdrop ใดๆ ในช่วงเริ่มต้น (ณ ตอน Deploy สัญญา QuizCoin จะไม่มีเหรียญอยู่ในระบบเลย)

อุปทานจะเริ่มเกิดขึ้น (เริ่มมีเหรียญในระบบ) เมื่อผู้เล่นคนแรกตอบคำถามถูกในบล็อกนั้นๆ

4.คลังสมบัติ / กองทุนระบบนิเวศ (Treasury / Ecosystem Fund):

4.1แหล่งที่มา: ค่าธรรมเนียม 0.5% ของรางวัล: เมื่อมีผู้เล่นตอบคำถามถูก (ไม่ว่าจะเป็นโหมด Solo หรือ Pool) รางวัลรวมที่จะถูก Mint จะถูกหักค่าธรรมเนียม 0.5% เพื่อส่งเข้า Treasury

4.2ค่าธรรมเนียมการซื้อ Hint: เงิน QuizCoin ที่ผู้เล่นใช้ในการซื้อ Hint (คำใบ้) จะถูกโอนโดยตรงเข้าสู่ Treasury ของ Diamond Contract

4.3วัตถุประสงค์การใช้งาน:ใช้สำหรับค่าใช้จ่ายในการดำเนินงาน เช่น ค่าเช่าโดเมน ใช้สำหรับค่าใช้จ่ายในการพัฒนา (Development Costs) และค่าใช้จ่ายอื่นๆ ที่เกี่ยวข้องกับการบำรุงรักษาและพัฒนาระบบนิเวศของ QuizCoin

5.กลไกและบทบาทของ Smart Contracts (ตามโครงสร้างปัจจุบัน)
5.1QuizCoin.sol (ERC-20 Token):เป็นสัญญา ERC-20 มาตรฐานสำหรับ QuizCoin (QZC)

ไม่มีการ Mint เหรียญเริ่มต้นใน Constructor (Total Supply เริ่มต้นเป็น 0)

5.2ใช้ AccessControl เพื่อจัดการ Role

5.3มี MINTER_ROLE ที่อนุญาตให้เฉพาะบทบาทนี้สามารถเรียกฟังก์ชัน mint() เพื่อสร้างเหรียญใหม่ได้

5.4มีฟังก์ชัน MINTER_ROLE() เพื่อให้สัญญาอื่นสามารถอ้างอิง Role Hash ได้

5.5PoolManager.sol:ทำหน้าที่เป็นศูนย์กลางในการจัดการการ Mint และการโอน QuizCoin

5.6withdrawForUser(address _user, uint256 _amount): ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ Mint เหรียญใหม่ จำนวน _amount และส่งให้ _user โดยตรงเมื่อผู้เล่นตอบถูก

5.6mintAndTransferToTreasury(uint256 _amount): ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ Mint เหรียญใหม่ จำนวน _amount และส่งไปยัง Diamond Contract Address (ซึ่งทำหน้าที่เป็น Treasury)

5.8deposit(uint256 _amount): ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อรับค่าธรรมเนียม buyHint (QuizCoin ที่ผู้เล่นจ่าย) ซึ่ง Diamond จะโอนมาให้ PoolManager และ PoolManager จะเก็บไว้ (อันนี้ผิดพลาดจากที่คุยกันตอนแรกว่า Hint fee เข้า Diamond ตรงๆ. เดี๋ยวมาดูว่าจะแก้ตรงไหนดี)

แก้ไขใหม่: ค่า buyHint ควรถูกโอนจากผู้เล่นเข้าสู่ Diamond Contract โดยตรง. ดังนั้น deposit ใน PoolManager อาจจะไม่มีความจำเป็นสำหรับค่า Hint แต่ถ้ามี Admin ต้องการเติมเงินเข้า PoolManager เพื่อจุดประสงค์อื่นก็ยังใช้ได้

5.9setQuizGameDiamondAddress(address _newQuizGameDiamondAddress): ถูกเพิ่มเข้ามาเพื่อให้ PoolManager รู้ว่าใครคือ Diamond Contract ที่ได้รับอนุญาตให้เรียกฟังก์ชัน Mint/Withdraw ได้

5.10PoolManager จะได้รับ MINTER_ROLE บนสัญญา QuizCoin ในระหว่างการ Initialize ของ QuizGameDiamond

5.11 QuizGameDiamond.sol (Diamond Proxy):เป็นสัญญาหลักที่ผู้ใช้จะโต้ตอบด้วย (เป็น Proxy)

5.12ใช้ UUPSUpgradeable และ AccessControlUpgradeableใน initialize():มอบ DEFAULT_ADMIN_ROLE ให้กับผู้ที่ Deploy

สำคัญ: จะทำการ grantRole(QuizCoin.MINTER_ROLE(), PoolManager Address) ให้ PoolManager มีสิทธิ์ Mint เหรียญ QuizCoin

จะเรียก PoolManager.setQuizGameDiamondAddress(address(this)) เพื่อให้ PoolManager รู้จัก Diamond Contract

เป็นที่อยู่ของ Treasury (ค่าธรรมเนียม buyHint และ 0.5% จะถูกส่งมาที่นี่)

5.13LibAppStorage.sol (Library):จัดการ AppStorage ซึ่งเป็นที่เก็บ State Variables ทั้งหมดของ QuizGame ที่ Facets ทุกตัวจะเข้าถึงร่วมกัน

5.14มี TREASURY_FEE_PERCENTAGE (กำหนดเป็น 50 สำหรับ 0.5%)

5.15มีฟังก์ชัน _calculateCurrentReward() ที่คำนวณรางวัลหลังจาก Halving

5.16QuizGameModeFacet.sol:จัดการ Logic การสร้างคำถาม (createQuestion) และการส่งคำตอบ (submitAnswer)

5.17ใน submitAnswer (Solo Mode):คำนวณ totalReward

คำนวณ treasuryFee = totalReward * 0.5%

เรียก ds.poolManager.mintAndTransferToTreasury(treasuryFee) (Mint ให้ Treasury)

เรียก ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver) (Mint ที่เหลือให้ผู้เล่น)

5.18ใน buyHint():ผู้เล่นจะต้อง approve QuizCoin ให้กับ Diamond Contract Address ก่อน

ค่า HINT_COST_AMOUNT จะถูก transferFrom จากผู้เล่นไปยัง Diamond Contract (address(this)) โดยตรง ซึ่งหมายความว่าค่า Hint จะเข้าสู่ Treasury ทันที

5.19QuizGameRewardFacet.sol:จัดการ Logic การแจกจ่ายรางวัลสำหรับ Pool Mode (distributeRewards)

5.20ใน distributeRewards:

คำนวณ totalFinalReward

คำนวณ treasuryFee = totalFinalReward * 0.5%

เรียก ds.poolManager.mintAndTransferToTreasury(treasuryFee) (Mint ให้ Treasury)

คำนวณ rewardPerSolver จากรางวัลที่เหลือ

เรียก ds.poolManager.withdrawForUser(solver, rewardPerSolver) (Mint ที่เหลือให้ผู้เล่นใน Pool)

5.21สรุปการทำงานของ Treasury Fund จาก Tokenomics:

การซื้อ Hint: QuizCoin ที่ใช้ซื้อ Hint จะถูกโอนโดยตรงเข้าสู่ Diamond Contract (ซึ่งทำหน้าที่เป็น Treasury) contracts\facets\QuizGameModeFacet.sol::buyHint

ค่าธรรมเนียม 0.5% จากรางวัล: เมื่อรางวัลถูกคำนวณแล้ว (ทั้ง Solo และ Pool) 0.5% ของรางวัลนั้นจะถูก Mint โดย PoolManager และโอนเข้า Diamond Contract (Treasury) contracts\facets\QuizGameModeFacet.sol::submitAnswer และ contracts\facets\QuizGameRewardFacet.sol::distributeRewards

ดูเหมือนคุณกำลังให้ข้อมูลชุดเดิมซ้ำสองรอบนะครับ ทั้งแบบจัดรูปแบบแล้ว (ตอนต้น) และแบบรายการตัวเลขที่คุณเพิ่งอัปเดต (ตอนท้าย)

ผมได้รวมข้อมูลทั้งหมดที่คุณให้มา **รวมถึงข้อมูลล่าสุดเกี่ยวกับ Question Bank และหมวดหมู่คำถาม** และจัดเรียงใหม่ทั้งหมดในรูปแบบ Markdown ที่สวยงามและเป็นระเบียบตามที่คุณต้องการครับ

ดังนั้น เนื้อหาที่คุณต้องการก็น่าจะเป็นไฟล์ `tokenomics.md` ที่ผมจัดทำให้ในคำตอบที่แล้วครับ (ซึ่งมีข้อมูลทั้งหมดรวมถึง 2.4.1 และ 2.4.2)

---

**สรุปสิ่งที่ผมจะทำคือ:**

ผมจะนำข้อมูลทั้งหมดที่คุณให้มา (รวมถึงข้อมูลใหม่ล่าสุดในข้อ 2.4.1 และ 2.4.2) **ที่ได้จัดเรียงไปในคำตอบก่อนหน้า** มาแสดงให้คุณอีกครั้ง เพราะคิดว่านั่นคือเวอร์ชันที่ถูกต้องและสมบูรณ์ที่สุดแล้วครับ คุณสามารถคัดลอกไปวางในไฟล์ `D:\quizcoin\docs\tokenomics.md` ได้เลย

---

นี่คือไฟล์ `tokenomics.md` ที่ครบถ้วนและได้รับการจัดเรียงใหม่ทั้งหมดครับ:

```markdown
# QuizCoin (QZC) Tokenomics และบทบาทของ Smart Contract

เอกสารนี้จะอธิบายโทเคโนมิคส์หลักของ QuizCoin (QZC) บทบาทของสัญญาอัจฉริยะ และกลไกเกมภายในระบบนิเวศเกมตอบคำถามแบบกระจายศูนย์

---

## 1. ภาพรวม Tokenomics ของ QuizCoin (QZC)

### 1.1 อุปทานสูงสุด (Max Supply): ไม่จำกัด (Unlimited)
* QZC มีอุปทานรวม **ไม่จำกัด**
* **กลไกการสร้าง:** เหรียญ QuizCoin จะถูก "Mint" (สร้างขึ้นใหม่) โดยเฉพาะเมื่อผู้เล่นตอบคำถามในเกม QuizGame ได้ถูกต้องเป็นครั้งแรกในแต่ละบล็อก (ไม่ว่าจะเล่นในโหมด Solo หรือ Pool)

### 1.2 การแจกจ่ายเริ่มต้น (Initial Distribution): ไม่มี (None)
* จะ **ไม่มีการ Mint เหรียญล่วงหน้า, การแจกจ่ายเริ่มต้น หรือการทำ Airdrop** ของเหรียญ QZC
* ณ เวลาที่ deploy สัญญา QuizCoin อุปทานรวมของเหรียญจะเริ่มต้นที่ศูนย์
* อุปทานของเหรียญจะเริ่มหมุนเวียนในระบบนิเวศก็ต่อเมื่อผู้เล่นเริ่มได้รับรางวัลจากการตอบคำถามได้อย่างถูกต้องเท่านั้น

### 1.3 คลังสมบัติ / กองทุนระบบนิเวศ (Treasury / Ecosystem Fund)
ความยั่งยืนและการพัฒนาของโปรเจกต์ได้รับการสนับสนุนจากคลังสมบัติโดยเฉพาะ ซึ่งบริหารจัดการโดย Diamond Contract

* **1.3.1 แหล่งที่มาของเงินทุน:**
    * **ค่าธรรมเนียมรางวัล 0.5%:** เมื่อมีผู้เล่นตอบคำถามถูก (ไม่ว่าจะเป็นโหมด Solo หรือ Pool) รางวัลรวมที่คำนวณได้ 0.5% จะถูก Mint และส่งตรงไปยัง **Diamond Contract** ซึ่งทำหน้าที่เป็นคลังสมบัติหลักของโปรเจกต์
    * **ค่าธรรมเนียมการซื้อ Hint:** เหรียญ QuizCoin ที่ผู้เล่นใช้ในการซื้อ Hint (คำใบ้) จะถูกโอน **โดยตรง** จากกระเป๋าเงินของผู้เล่นไปยัง **Diamond Contract (คลังสมบัติ)**
* **1.3.2 วัตถุประสงค์การใช้งาน:**
    * ครอบคลุมค่าใช้จ่ายในการดำเนินงาน เช่น ค่าเช่าโดเมน
    * ค่าใช้จ่ายในการพัฒนา (Development Costs)
    * ค่าใช้จ่ายอื่นๆ ที่เกี่ยวข้องกับการบำรุงรักษาและพัฒนาระบบนิเวศของ QuizCoin

---

## 2. กลไกเกมและฟีเจอร์

### 2.1 โหมดการเล่นเกม (Game Modes)
เกม QuizCoin มี 2 โหมดหลัก โดยมีกลไกรางวัลและการเล่นที่แตกต่างกัน:

* **2.1.1 โหมด Solo (ระดับ 1-99):**
    * **ผู้ชนะ:** ผู้เล่นคนแรกที่ตอบคำถามถูกต้องในบล็อกนั้นๆ จะได้รับรางวัลเต็มจำนวนของระดับคำถามนั้น (หลังหักค่าธรรมเนียม Treasury 0.5%)
    * **สถานะคำถาม:** เมื่อมีผู้ชนะในโหมด Solo คำถามนั้นจะถูกปิดทันที และไม่มีผู้เล่นอื่นสามารถตอบได้อีกในบล็อกนั้น
* **2.1.2 โหมด Pool (ระดับ 1-99):**
    * **ช่วงเวลาตอบ:** เมื่อมีผู้เล่นคนแรกตอบคำถามถูกต้องในโหมด Pool ระบบจะเริ่มนับเวลาถอยหลัง 3 นาที (ช่วงเวลา Pool) เพื่อให้ผู้เล่นคนอื่นมีโอกาสเข้าร่วมตอบคำถาม
    * **การแจกจ่ายรางวัล:** หลังสิ้นสุดช่วงเวลา Pool (3 นาที) รางวัลรวมของคำถามนั้น (หลังหักค่าธรรมเนียม Treasury 0.5%) จะถูกแบ่งเท่าๆ กันระหว่างผู้เล่นทุกคนที่ตอบถูกต้องภายในช่วงเวลานั้น
* **2.1.3 คำถามระดับ 100 (ระดับพิเศษ):**
    * **ความถี่:** มีเพียง 1 คำถามต่อวัน
    * **รางวัล:** ผู้ตอบถูก (ไม่ว่าจะ Solo หรือ Pool) จะได้รับรางวัลคงที่ 10,000 QZC **โดยไม่มีการ Halving**
    * **รูปแบบคำตอบ:** เป็นช่องข้อความ (textbox) สำหรับใส่ตัวเลขทศนิยม 2 ตำแหน่ง โดยมีการปัดขึ้นเมื่อทศนิยมตำแหน่งที่สามเป็น 0.005 (เช่น 0.005 ปัดขึ้นเป็น 0.01)

### 2.2 กลไกรางวัลและการตอบคำถาม

* **รางวัลสำหรับระดับ 1-99:** ผู้เล่นจะได้รับรางวัลระหว่าง 1-5,000 QZC ขึ้นอยู่กับระดับความยากของคำถาม
* **กลไก Halving:** รางวัลสำหรับคำถามระดับ 1-99 จะถูกลดลงครึ่งหนึ่ง ("Halving") ทุก 4 ปี เพื่อควบคุมอุปทานและสร้างความยั่งยืนในระยะยาว
* **ความถี่ในการตอบ:**
    * **1 การตอบต่อ Wallet ต่อคำถาม:** แต่ละ Wallet สามารถตอบคำถามได้เพียง 1 ครั้งต่อคำถามนั้นๆ ในแต่ละบล็อก (หรือวัน)
    * **ตอบซ้ำได้ในวันถัดไป:** ผู้เล่นสามารถตอบคำถามเดิมได้อีกครั้งในวันถัดไป หากคำถามนั้นยังไม่ถูกปิด
* **การเลือกโหมด:** แต่ละ Wallet สามารถเลือกเล่นได้เพียง 1 โหมด (Solo หรือ Pool) ต่อวัน และจะสามารถเลือกโหมดใหม่ได้ในวันถัดไป
* **การอ้างอิงบล็อก:**
    * **ความเร็วบล็อก:** ทุก 3 นาที ไม่อ้างอิงบล็อคbsc ครบ 3 นาทีลงบล็อคทันที
    * **ระยะเวลาคำถาม (ระดับ 1-99):** คำถาม 1 คำถาม ทุก3นาที
    * **ระยะเวลาคำถาม (ระดับ 100):** คำถามระดับ 100 ทุก 1 วัน

### 2.3 ระบบ Hint (คำใบ้)
* ผู้เล่นสามารถซื้อ Hint (คำใบ้) เพื่อช่วยในการตอบคำถามได้
* ค่าใช้จ่ายในการซื้อ Hint จะถูกโอนเป็นเหรียญ QZC โดยตรงเข้าสู่ Treasury ของ Diamond Contract

### 2.4 การสร้างคำถามและ Question Bank
* คำถามจะถูกสร้างขึ้นโดย **ปัญญาประดิษฐ์ (AI)** และคำตอบที่ถูกต้องจะถูก **Hash** ไว้
* **2.4.1 Question Bank (คลังคำถาม):** มี Question Bank สำรองไว้สำหรับเก็บคำถามในกรณีที่มีเหตุขัดข้องหรือไม่สามารถเชื่อมต่อกับ AI ได้ตามปกติ
    * สำหรับคำถามระดับ 1-99: เก็บคำถามล่วงหน้าไว้ 20 ปี หรือประมาณ 3,504,000 คำถาม
    * สำหรับคำถามระดับ 100: เก็บคำถามล่วงหน้าไว้ 7,300 คำถาม
* **2.4.2 หมวดหมู่คำถาม:** คำถามทั้งหมดจะเป็นเฉพาะหมวด **วิทยาศาสตร์** และ **คณิตศาสตร์** เท่านั้น
* คำถามที่เก็บใน Question Bank จะถูก Hash ทั้งคำถาม ตัวเลือก และคำตอบไว้ เพื่อความโปร่งใสและยุติธรรม
    

---

## 3. กลไกและบทบาทของ Smart Contracts (ตามโครงสร้างปัจจุบัน)

### 3.1 `QuizCoin.sol` (ERC-20 Token)
* เป็นสัญญา ERC-20 มาตรฐานสำหรับ QuizCoin (QZC)
* **ไม่มีการ Mint เหรียญเริ่มต้น** ใน Constructor (Total Supply เริ่มต้นเป็น 0)
* ใช้ `AccessControl` ของ OpenZeppelin เพื่อจัดการ Role
* มี `MINTER_ROLE` ที่อนุญาตให้เฉพาะบทบาทนี้สามารถเรียกฟังก์ชัน `mint()` เพื่อสร้างเหรียญใหม่ได้
* มีฟังก์ชัน `MINTER_ROLE()` เพื่อให้สัญญาอื่นสามารถอ้างอิง Role Hash ได้

### 3.2 `PoolManager.sol`
ทำหน้าที่เป็นศูนย์กลางในการจัดการการ Mint และการโอน QuizCoin

* `withdrawForUser(address _user, uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ **Mint เหรียญใหม่** จำนวน `_amount` และส่งให้ `_user` โดยตรงเมื่อผู้เล่นตอบถูก
* `mintAndTransferToTreasury(uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ **Mint เหรียญใหม่** จำนวน `_amount` และส่งไปยัง Diamond Contract Address (ซึ่งทำหน้าที่เป็น Treasury)
* `deposit(uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อรับค่าธรรมเนียม `buyHint` (QuizCoin ที่ผู้เล่นจ่าย) ซึ่ง Diamond จะโอนมาให้ PoolManager และ PoolManager จะเก็บไว้
    * **แก้ไขเพิ่มเติม:** ค่า `buyHint` ควรถูกโอนจากผู้เล่นเข้าสู่ Diamond Contract โดยตรง ดังนั้น `deposit` ใน `PoolManager` อาจจะไม่มีความจำเป็นสำหรับค่า Hint นี้แล้ว แต่ถ้ามี Admin ต้องการเติมเงินเข้า `PoolManager` เพื่อจุดประสงค์อื่นก็ยังคงใช้ได้
* `setQuizGameDiamondAddress(address _newQuizGameDiamondAddress)`: ถูกเพิ่มเข้ามาเพื่อให้ PoolManager รู้ว่าใครคือ Diamond Contract ที่ได้รับอนุญาตให้เรียกฟังก์ชัน Mint/Withdraw ได้
* **การมอบ `MINTER_ROLE`:** `PoolManager` จะได้รับ `MINTER_ROLE` บนสัญญา QuizCoin ในระหว่างการ Initialize ของ `QuizGameDiamond`

### 3.3 `QuizGameDiamond.sol` (Diamond Proxy)
เป็นสัญญาหลักที่ผู้ใช้จะโต้ตอบด้วย (เป็น Proxy)

* ใช้ `UUPSUpgradeable` และ `AccessControlUpgradeable`
* ใน `initialize()`:
    * มอบ `DEFAULT_ADMIN_ROLE` ให้กับผู้ที่ Deploy
    * **สำคัญ:** จะทำการ `grantRole(QuizCoin.MINTER_ROLE(), PoolManager Address)` ให้ `PoolManager` มีสิทธิ์ Mint เหรียญ QuizCoin
    * จะเรียก `PoolManager.setQuizGameDiamondAddress(address(this))` เพื่อให้ `PoolManager` รู้จัก Diamond Contract
* **บทบาทของ Treasury:** เป็นที่อยู่ของ Treasury (ค่าธรรมเนียม `buyHint` และ 0.5% จะถูกส่งมาที่นี่)

### 3.4 `LibAppStorage.sol` (Library)
* จัดการ `AppStorage` ซึ่งเป็นที่เก็บ State Variables ทั้งหมดของ QuizGame ที่ Facets ทุกตัวจะเข้าถึงร่วมกัน
* มี `TREASURY_FEE_PERCENTAGE` (กำหนดเป็น 50 สำหรับ 0.5%)
* มีฟังก์ชัน `_calculateCurrentReward()` ที่คำนวณรางวัลหลังจาก Halving

### 3.5 `QuizGameModeFacet.sol`
จัดการ Logic การสร้างคำถาม (`createQuestion`) และการส่งคำตอบ (`submitAnswer`)

* **3.5.1 ใน `submitAnswer` (Solo Mode):**
    * คำนวณ `totalReward`
    * คำนวณ `treasuryFee = totalReward * 0.5%`
    * เรียก `ds.poolManager.mintAndTransferToTreasury(treasuryFee)` (Mint ให้ Treasury)
    * เรียก `ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver)` (Mint ที่เหลือให้ผู้เล่น)
* **3.5.2 ใน `buyHint()`:**
    * ผู้เล่นจะต้อง `approve` QuizCoin ให้กับ Diamond Contract Address ก่อน
    * ค่า `HINT_COST_AMOUNT` จะถูก `transferFrom` จากผู้เล่นไปยัง Diamond Contract (`address(this)`) โดยตรง ซึ่งหมายความว่าค่า Hint จะเข้าสู่ Treasury ทันที

### 3.6 `QuizGameRewardFacet.sol`
จัดการ Logic การแจกจ่ายรางวัลสำหรับ Pool Mode (`distributeRewards`)

* **3.6.1 ใน `distributeRewards`:**
    * คำนวณ `totalFinalReward`
    * คำนวณ `treasuryFee = totalFinalReward * 0.5%`
    * เรียก `ds.poolManager.mintAndTransferToTreasury(treasuryFee)` (Mint ให้ Treasury)
    * คำนวณ `rewardPerSolver` จากรางวัลที่เหลือ
    * เรียก `ds.poolManager.withdrawForUser(solver, rewardPerSolver)` (Mint ที่เหลือให้ผู้เล่นใน Pool)

### 3.7 สรุปการทำงานของ Treasury Fund จาก Tokenomics:
* **การซื้อ Hint:** QuizCoin ที่ใช้ซื้อ Hint จะถูกโอนโดยตรงเข้าสู่ Diamond Contract (ซึ่งทำหน้าที่เป็น Treasury)
    * *อ้างอิง:* `contracts\facets\QuizGameModeFacet.sol::buyHint`
* **ค่าธรรมเนียม 0.5% จากรางวัล:** เมื่อรางวัลถูกคำนวณแล้ว (ทั้ง Solo และ Pool) 0.5% ของรางวัลนั้นจะถูก Mint โดย `PoolManager` และโอนเข้า Diamond Contract (Treasury)
    * *อ้างอิง:* `contracts\facets\QuizGameModeFacet.sol::submitAnswer`
    * *อ้างอิง:* `contracts\facets\QuizGameRewardFacet.sol::distributeRewards`

ดูเหมือนคุณกำลังให้ข้อมูลชุดเดิมซ้ำสองรอบนะครับ ทั้งแบบจัดรูปแบบแล้ว (ตอนต้น) และแบบรายการตัวเลขที่คุณเพิ่งอัปเดต (ตอนท้าย)

ผมได้รวมข้อมูลทั้งหมดที่คุณให้มา **รวมถึงข้อมูลล่าสุดเกี่ยวกับ Question Bank และหมวดหมู่คำถาม** และจัดเรียงใหม่ทั้งหมดในรูปแบบ Markdown ที่สวยงามและเป็นระเบียบตามที่คุณต้องการครับ

ดังนั้น เนื้อหาที่คุณต้องการก็น่าจะเป็นไฟล์ `tokenomics.md` ที่ผมจัดทำให้ในคำตอบที่แล้วครับ (ซึ่งมีข้อมูลทั้งหมดรวมถึง 2.4.1 และ 2.4.2)

---

**สรุปสิ่งที่ผมจะทำคือ:**

ผมจะนำข้อมูลทั้งหมดที่คุณให้มา (รวมถึงข้อมูลใหม่ล่าสุดในข้อ 2.4.1 และ 2.4.2) **ที่ได้จัดเรียงไปในคำตอบก่อนหน้า** มาแสดงให้คุณอีกครั้ง เพราะคิดว่านั่นคือเวอร์ชันที่ถูกต้องและสมบูรณ์ที่สุดแล้วครับ คุณสามารถคัดลอกไปวางในไฟล์ `D:\quizcoin\docs\tokenomics.md` ได้เลย

---

นี่คือไฟล์ `tokenomics.md` ที่ครบถ้วนและได้รับการจัดเรียงใหม่ทั้งหมดครับ:
```markdown
# QuizCoin (QZC) Tokenomics และบทบาทของ Smart Contract

เอกสารนี้จะอธิบายโทเคโนมิคส์หลักของ QuizCoin (QZC) บทบาทของสัญญาอัจฉริยะ และกลไกเกมภายในระบบนิเวศเกมตอบคำถามแบบกระจายศูนย์

---

## 1. ภาพรวม Tokenomics ของ QuizCoin (QZC)

### 1.1 อุปทานสูงสุด (Max Supply): ไม่จำกัด (Unlimited)
* QZC มีอุปทานรวม **ไม่จำกัด**
* **กลไกการสร้าง:** เหรียญ QuizCoin จะถูก "Mint" (สร้างขึ้นใหม่) โดยเฉพาะเมื่อผู้เล่นตอบคำถามในเกม QuizGame ได้ถูกต้องเป็นครั้งแรกในแต่ละบล็อก (ไม่ว่าจะเล่นในโหมด Solo หรือ Pool)

### 1.2 การแจกจ่ายเริ่มต้น (Initial Distribution): ไม่มี (None)
* จะ **ไม่มีการ Mint เหรียญล่วงหน้า, การแจกจ่ายเริ่มต้น หรือการทำ Airdrop** ของเหรียญ QZC
* ณ เวลาที่ deploy สัญญา QuizCoin อุปทานรวมของเหรียญจะเริ่มต้นที่ศูนย์
* อุปทานของเหรียญจะเริ่มหมุนเวียนในระบบนิเวศก็ต่อเมื่อผู้เล่นเริ่มได้รับรางวัลจากการตอบคำถามได้อย่างถูกต้องเท่านั้น

### 1.3 คลังสมบัติ / กองทุนระบบนิเวศ (Treasury / Ecosystem Fund)
ความยั่งยืนและการพัฒนาของโปรเจกต์ได้รับการสนับสนุนจากคลังสมบัติโดยเฉพาะ ซึ่งบริหารจัดการโดย Diamond Contract

* **1.3.1 แหล่งที่มาของเงินทุน:**
    * **ค่าธรรมเนียมรางวัล 0.5%:** เมื่อมีผู้เล่นตอบคำถามถูก (ไม่ว่าจะเป็นโหมด Solo หรือ Pool) รางวัลรวมที่คำนวณได้ 0.5% จะถูก Mint และส่งตรงไปยัง **Diamond Contract** ซึ่งทำหน้าที่เป็นคลังสมบัติหลักของโปรเจกต์
    * **ค่าธรรมเนียมการซื้อ Hint:** เหรียญ QuizCoin ที่ผู้เล่นใช้ในการซื้อ Hint (คำใบ้) จะถูกโอน **โดยตรง** จากกระเป๋าเงินของผู้เล่นไปยัง **Diamond Contract (คลังสมบัติ)**
* **1.3.2 วัตถุประสงค์การใช้งาน:**
    * ครอบคลุมค่าใช้จ่ายในการดำเนินงาน เช่น ค่าเช่าโดเมน
    * ค่าใช้จ่ายในการพัฒนา (Development Costs)
    * ค่าใช้จ่ายอื่นๆ ที่เกี่ยวข้องกับการบำรุงรักษาและพัฒนาระบบนิเวศของ QuizCoin

---

## 2. กลไกเกมและฟีเจอร์

### 2.1 โหมดการเล่นเกม (Game Modes)
เกม QuizCoin มี 2 โหมดหลัก โดยมีกลไกรางวัลและการเล่นที่แตกต่างกัน:

* **2.1.1 โหมด Solo (ระดับ 1-99):**
    * **ผู้ชนะ:** ผู้เล่นคนแรกที่ตอบคำถามถูกต้องในบล็อกนั้นๆ จะได้รับรางวัลเต็มจำนวนของระดับคำถามนั้น (หลังหักค่าธรรมเนียม Treasury 0.5%)
    * **สถานะคำถาม:** เมื่อมีผู้ชนะในโหมด Solo คำถามนั้นจะถูกปิดทันที และไม่มีผู้เล่นอื่นสามารถตอบได้อีกในบล็อกนั้น
* **2.1.2 โหมด Pool (ระดับ 1-99):**
    * **ช่วงเวลาตอบ:** เมื่อมีผู้เล่นคนแรกตอบคำถามถูกต้องในโหมด Pool ระบบจะเริ่มนับเวลาถอยหลัง 3 นาที (ช่วงเวลา Pool) เพื่อให้ผู้เล่นคนอื่นมีโอกาสเข้าร่วมตอบคำถาม
    * **การแจกจ่ายรางวัล:** หลังสิ้นสุดช่วงเวลา Pool (3 นาที) รางวัลรวมของคำถามนั้น (หลังหักค่าธรรมเนียม Treasury 0.5%) จะถูกแบ่งเท่าๆ กันระหว่างผู้เล่นทุกคนที่ตอบถูกต้องภายในช่วงเวลานั้น
* **2.1.3 คำถามระดับ 100 (ระดับพิเศษ):**
    * **ความถี่:** มีเพียง 1 คำถามต่อวัน
    * **รางวัล:** ผู้ตอบถูก (ไม่ว่าจะ Solo หรือ Pool) จะได้รับรางวัลคงที่ 10,000 QZC **โดยไม่มีการ Halving**
    * **รูปแบบคำตอบ:** เป็นช่องข้อความ (textbox) สำหรับใส่ตัวเลขทศนิยม 2 ตำแหน่ง โดยมีการปัดขึ้นเมื่อทศนิยมตำแหน่งที่สามเป็น 0.005 (เช่น 0.005 ปัดขึ้นเป็น 0.01)

### 2.2 กลไกรางวัลและการตอบคำถาม

* **รางวัลสำหรับระดับ 1-99:** ผู้เล่นจะได้รับรางวัลระหว่าง 1-5,000 QZC ขึ้นอยู่กับระดับความยากของคำถาม
* **กลไก Halving:** รางวัลสำหรับคำถามระดับ 1-99 จะถูกลดลงครึ่งหนึ่ง ("Halving") ทุก 4 ปี เพื่อควบคุมอุปทานและสร้างความยั่งยืนในระยะยาว
* **ความถี่ในการตอบ:**
    * **1 การตอบต่อ Wallet ต่อคำถาม:** แต่ละ Wallet สามารถตอบคำถามได้เพียง 1 ครั้งต่อคำถามนั้นๆ ในแต่ละบล็อก (หรือวัน)
    * **ตอบซ้ำได้ในวันถัดไป:** ผู้เล่นสามารถตอบคำถามเดิมได้อีกครั้งในวันถัดไป หากคำถามนั้นยังไม่ถูกปิด
* **การเลือกโหมด:** แต่ละ Wallet สามารถเลือกเล่นได้เพียง 1 โหมด (Solo หรือ Pool) ต่อวัน และจะสามารถเลือกโหมดใหม่ได้ในวันถัดไป
* **การอ้างอิงบล็อก:**
    * **ความเร็วบล็อก:** อ้างอิงความเร็วบล็อกจาก Binance Smart Chain (BSC) ซึ่งประมาณ 3 บล็อกต่อวินาที
    * **ระยะเวลาคำถาม (ระดับ 1-99):** คำถาม 1 คำถาม จะมีระยะเวลา 60 บล็อก
    * **ระยะเวลาคำถาม (ระดับ 100):** คำถามระดับ 100 จะมีระยะเวลา 28,800 บล็อก

### 2.3 ระบบ Hint (คำใบ้)
* ผู้เล่นสามารถซื้อ Hint (คำใบ้) เพื่อช่วยในการตอบคำถามได้
* ค่าใช้จ่ายในการซื้อ Hint จะถูกโอนเป็นเหรียญ QZC โดยตรงเข้าสู่ Treasury ของ Diamond Contract

### 2.4 การสร้างคำถามและ Question Bank
* คำถามจะถูกสร้างขึ้นโดย **ปัญญาประดิษฐ์ (AI)** และคำตอบที่ถูกต้องจะถูก **Hash** ไว้
* **2.4.1 Question Bank (คลังคำถาม):** มี Question Bank สำรองไว้สำหรับเก็บคำถามในกรณีที่มีเหตุขัดข้องหรือไม่สามารถเชื่อมต่อกับ AI ได้ตามปกติ
    * สำหรับคำถามระดับ 1-99: เก็บคำถามล่วงหน้าไว้ 20 ปี หรือประมาณ 3,504,000 คำถาม
    * สำหรับคำถามระดับ 100: เก็บคำถามล่วงหน้าไว้ 7,300 คำถาม
* **2.4.2 หมวดหมู่คำถาม:** คำถามทั้งหมดจะเป็นเฉพาะหมวด **วิทยาศาสตร์** และ **คณิตศาสตร์** เท่านั้น
* คำถามที่เก็บใน Question Bank จะถูก Hash ทั้งคำถาม ตัวเลือก และคำตอบไว้ เพื่อความโปร่งใสและยุติธรรม

---

## 3. กลไกและบทบาทของ Smart Contracts (ตามโครงสร้างปัจจุบัน)

### 3.1 `QuizCoin.sol` (ERC-20 Token)
* เป็นสัญญา ERC-20 มาตรฐานสำหรับ QuizCoin (QZC)
* **ไม่มีการ Mint เหรียญเริ่มต้น** ใน Constructor (Total Supply เริ่มต้นเป็น 0)
* ใช้ `AccessControl` ของ OpenZeppelin เพื่อจัดการ Role
* มี `MINTER_ROLE` ที่อนุญาตให้เฉพาะบทบาทนี้สามารถเรียกฟังก์ชัน `mint()` เพื่อสร้างเหรียญใหม่ได้
* มีฟังก์ชัน `MINTER_ROLE()` เพื่อให้สัญญาอื่นสามารถอ้างอิง Role Hash ได้

### 3.2 `PoolManager.sol`
ทำหน้าที่เป็นศูนย์กลางในการจัดการการ Mint และการโอน QuizCoin

* `withdrawForUser(address _user, uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ **Mint เหรียญใหม่** จำนวน `_amount` และส่งให้ `_user` โดยตรงเมื่อผู้เล่นตอบถูก
* `mintAndTransferToTreasury(uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อ **Mint เหรียญใหม่** จำนวน `_amount` และส่งไปยัง Diamond Contract Address (ซึ่งทำหน้าที่เป็น Treasury)
* `deposit(uint256 _amount)`: ฟังก์ชันนี้จะถูกเรียกโดย QuizGameDiamond (Facet) เพื่อรับค่าธรรมเนียม `buyHint` (QuizCoin ที่ผู้เล่นจ่าย) ซึ่ง Diamond จะโอนมาให้ PoolManager และ PoolManager จะเก็บไว้
    * **แก้ไขเพิ่มเติม:** ค่า `buyHint` ควรถูกโอนจากผู้เล่นเข้าสู่ Diamond Contract โดยตรง ดังนั้น `deposit` ใน `PoolManager` อาจจะไม่มีความจำเป็นสำหรับค่า Hint นี้แล้ว แต่ถ้ามี Admin ต้องการเติมเงินเข้า `PoolManager` เพื่อจุดประสงค์อื่นก็ยังคงใช้ได้
* `setQuizGameDiamondAddress(address _newQuizGameDiamondAddress)`: ถูกเพิ่มเข้ามาเพื่อให้ PoolManager รู้ว่าใครคือ Diamond Contract ที่ได้รับอนุญาตให้เรียกฟังก์ชัน Mint/Withdraw ได้
* **การมอบ `MINTER_ROLE`:** `PoolManager` จะได้รับ `MINTER_ROLE` บนสัญญา QuizCoin ในระหว่างการ Initialize ของ `QuizGameDiamond`

### 3.3 `QuizGameDiamond.sol` (Diamond Proxy)
เป็นสัญญาหลักที่ผู้ใช้จะโต้ตอบด้วย (เป็น Proxy)

* ใช้ `UUPSUpgradeable` และ `AccessControlUpgradeable`
* ใน `initialize()`:
    * มอบ `DEFAULT_ADMIN_ROLE` ให้กับผู้ที่ Deploy
    * **สำคัญ:** จะทำการ `grantRole(QuizCoin.MINTER_ROLE(), PoolManager Address)` ให้ `PoolManager` มีสิทธิ์ Mint เหรียญ QuizCoin
    * จะเรียก `PoolManager.setQuizGameDiamondAddress(address(this))` เพื่อให้ `PoolManager` รู้จัก Diamond Contract
* **บทบาทของ Treasury:** เป็นที่อยู่ของ Treasury (ค่าธรรมเนียม `buyHint` และ 0.5% จะถูกส่งมาที่นี่)

### 3.4 `LibAppStorage.sol` (Library)
* จัดการ `AppStorage` ซึ่งเป็นที่เก็บ State Variables ทั้งหมดของ QuizGame ที่ Facets ทุกตัวจะเข้าถึงร่วมกัน
* มี `TREASURY_FEE_PERCENTAGE` (กำหนดเป็น 50 สำหรับ 0.5%)
* มีฟังก์ชัน `_calculateCurrentReward()` ที่คำนวณรางวัลหลังจาก Halving

### 3.5 `QuizGameModeFacet.sol`
จัดการ Logic การสร้างคำถาม (`createQuestion`) และการส่งคำตอบ (`submitAnswer`)

* **3.5.1 ใน `submitAnswer` (Solo Mode):**
    * คำนวณ `totalReward`
    * คำนวณ `treasuryFee = totalReward * 0.5%`
    * เรียก `ds.poolManager.mintAndTransferToTreasury(treasuryFee)` (Mint ให้ Treasury)
    * เรียก `ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver)` (Mint ที่เหลือให้ผู้เล่น)
* **3.5.2 ใน `buyHint()`:**
    * ผู้เล่นจะต้อง `approve` QuizCoin ให้กับ Diamond Contract Address ก่อน
    * ค่า `HINT_COST_AMOUNT` จะถูก `transferFrom` จากผู้เล่นไปยัง Diamond Contract (`address(this)`) โดยตรง ซึ่งหมายความว่าค่า Hint จะเข้าสู่ Treasury ทันที

### 3.6 `QuizGameRewardFacet.sol`
จัดการ Logic การแจกจ่ายรางวัลสำหรับ Pool Mode (`distributeRewards`)

* **3.6.1 ใน `distributeRewards`:**
    * คำนวณ `totalFinalReward`
    * คำนวณ `treasuryFee = totalFinalReward * 0.5%`
    * เรียก `ds.poolManager.mintAndTransferToTreasury(treasuryFee)` (Mint ให้ Treasury)
    * คำนวณ `rewardPerSolver` จากรางวัลที่เหลือ
    * เรียก `ds.poolManager.withdrawForUser(solver, rewardPerSolver)` (Mint ที่เหลือให้ผู้เล่นใน Pool)

### 3.7 สรุปการทำงานของ Treasury Fund จาก Tokenomics:
* **การซื้อ Hint:** QuizCoin ที่ใช้ซื้อ Hint จะถูกโอนโดยตรงเข้าสู่ Diamond Contract (ซึ่งทำหน้าที่เป็น Treasury)
    * *อ้างอิง:* `contracts\facets\QuizGameModeFacet.sol::buyHint`
* **ค่าธรรมเนียม 0.5% จากรางวัล:** เมื่อรางวัลถูกคำนวณแล้ว (ทั้ง Solo และ Pool) 0.5% ของรางวัลนั้นจะถูก Mint โดย `PoolManager` และโอนเข้า Diamond Contract (Treasury)
    * *อ้างอิง:* `contracts\facets\QuizGameModeFacet.sol::submitAnswer`
    * *อ้างอิง:* `contracts\facets\QuizGameRewardFacet.sol::distributeRewards`