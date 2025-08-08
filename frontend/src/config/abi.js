// frontend/src/config/abi.js

// นำเข้า ABI JSON จากโฟลเดอร์ public/abi/
// Path นี้สมมติว่า abi.js อยู่ที่ 'frontend/src/config/'
// และไฟล์ ABI ถูกคัดลอกไปที่ 'frontend/public/abi/'
import QUIZ_GAME_MODE_ABI_JSON from '../../public/abi/QuizGameModeFacet.json';
import QUIZ_GAME_BASE_ABI_JSON from '../../public/abi/QuizGameBaseFacet.json';
import QUIZ_GAME_REWARD_ABI_JSON from '../../public/abi/QuizGameRewardFacet.json';
import QUIZ_COIN_ABI_JSON from '../../public/abi/QuizCoin.json';
import ACCESS_CONTROL_ABI_JSON from '../../public/abi/AccessControlUpgradeable.json';


// Export เฉพาะส่วน 'abi' ของแต่ละ JSON
export const QUIZ_GAME_MODE_ABI = QUIZ_GAME_MODE_ABI_JSON.abi;
export const QUIZ_GAME_BASE_ABI = QUIZ_GAME_BASE_ABI_JSON.abi;
export const QUIZ_GAME_REWARD_ABI = QUIZ_GAME_REWARD_ABI_JSON.abi;
export const QUIZ_COIN_ABI = QUIZ_COIN_ABI_JSON.abi;
export const ACCESS_CONTROL_ABI = ACCESS_CONTROL_ABI_JSON.abi;
