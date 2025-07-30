    // frontend/src/config/addresses.js

    // ที่อยู่ของ QuizGameDiamond ที่ Deploy แล้ว
    // คุณจะต้องแทนที่ '0xYourDeployedDiamondAddressHere' ด้วยที่อยู่จริง
    // ที่ได้จากการ Deploy Script ของคุณบน Testnet/Mainnet
    // หรือดึงจาก Environment Variable หากคุณตั้งค่าไว้ใน .env ของ Frontend
    export const DIAMOND_ADDRESS = import.meta.env.VITE_DIAMOND_ADDRESS || "0xYourDeployedDiamondAddressHere";

    // ที่อยู่ของ QuizCoin ที่ Deploy แล้ว (ถ้าคุณต้องการอ้างอิงโดยตรง)
    // หากคุณตั้งค่า QuizCoin address ใน QuizGameBaseFacet แล้ว คุณอาจไม่จำเป็นต้องใช้ตัวแปรนี้โดยตรง
    export const QUIZ_COIN_ADDRESS = import.meta.env.VITE_QUIZ_COIN_ADDRESS || "0xYourDeployedQuizCoinAddressHere";

    // Enum values (ต้องตรงกับ LibAppStorage.sol)
    export const QuestionMode = { Solo: 0, Pool: 1 };
    export const QuestionCategory = { General: 0, Math: 1, Science: 2, History: 3, Sports: 4 };
    