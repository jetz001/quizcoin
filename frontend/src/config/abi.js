// frontend/src/config/abi.js

// นำเข้า ABI JSON จากโฟลเดอร์ artifacts ของ Hardhat backend
// โปรดตรวจสอบ Path ให้ถูกต้องตามโครงสร้างโฟลเดอร์ของคุณ
// Path นี้สมมติว่า abi.js อยู่ที่ 'frontend/src/config/'
// และ artifacts อยู่ที่ 'backend/artifacts/'
import QUIZ_GAME_MODE_ABI_JSON from '../../backend/artifacts/contracts/facets/QuizGameModeFacet.sol/QuizGameModeFacet.json';
import QUIZ_GAME_BASE_ABI_JSON from '../../backend/artifacts/contracts/facets/QuizGameBaseFacet.sol/QuizGameBaseFacet.json';
import QUIZ_GAME_REWARD_ABI_JSON from '../../backend/artifacts/contracts/facets/QuizGameRewardFacet.sol/QuizGameRewardFacet.json';
import QUIZ_COIN_ABI_JSON from '../../backend/artifacts/contracts/QuizCoin.sol/QuizCoin.json';
import ACCESS_CONTROL_ABI_JSON from '../../backend/node_modules/@openzeppelin/contracts-upgradeable/build/contracts/AccessControlUpgradeable.json';


// Export เฉพาะส่วน 'abi' ของแต่ละ JSON
export const QUIZ_GAME_MODE_ABI = QUIZ_GAME_MODE_ABI_JSON.abi;
export const QUIZ_GAME_BASE_ABI = QUIZ_GAME_BASE_ABI_JSON.abi;
export const QUIZ_GAME_REWARD_ABI = QUIZ_GAME_REWARD_ABI_JSON.abi;
export const QUIZ_COIN_ABI = QUIZ_COIN_ABI_JSON.abi;
export const ACCESS_CONTROL_ABI = ACCESS_CONTROL_ABI_JSON.abi;
