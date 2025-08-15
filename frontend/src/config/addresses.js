// frontend/src/config/addresses.js

// นำเข้าที่อยู่สัญญาจากไฟล์ JSON ที่ Hardhat script สร้างขึ้น
import contractAddresses from './addresses.json'; // ไฟล์นี้จะถูกสร้างโดย Hardhat deploy script

// Export ที่อยู่สัญญา
export const DIAMOND_ADDRESS = contractAddresses.QuizGameDiamond;
export const QUIZ_COIN_ADDRESS = contractAddresses.QuizCoin;

// Enum values (ต้องตรงกับ LibAppStorage.sol)
export const QuestionMode = { Solo: 0, Pool: 1 };
export const QuestionCategory = { General: 0, Math: 1, Science: 2, History: 3, Sports: 4 };
