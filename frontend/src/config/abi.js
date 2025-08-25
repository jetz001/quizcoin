// D:\quizcoin\frontend\src\config\abi.js

// นำเข้า ABI JSON จากโฟลเดอร์ที่ถูกต้องคือ src/abi/
// Path นี้ถูกต้องเพราะ '..' คือการขึ้นจาก 'src/config' ไปที่ 'src'
// แล้วจึงเข้าไปที่โฟลเดอร์ 'abi'
import QUIZ_GAME_MODE_ABI_JSON from '../abi/QuizGameModeFacet.json';
import QUIZ_GAME_BASE_ABI_JSON from '../abi/QuizGameBaseFacet.json';
import QUIZ_GAME_REWARD_ABI_JSON from '../abi/QuizGameRewardFacet.json';
import QUIZ_COIN_ABI_JSON from '../abi/QuizCoin.json';
import ACCESS_CONTROL_ABI_JSON from '../abi/AccessControlUpgradeable.json';


// Export เฉพาะส่วน 'abi' ของแต่ละ JSON
export const QUIZ_GAME_MODE_ABI = QUIZ_GAME_MODE_ABI_JSON.abi;
export const QUIZ_GAME_BASE_ABI = QUIZ_GAME_BASE_ABI_JSON.abi;
export const QUIZ_GAME_REWARD_ABI = QUIZ_GAME_REWARD_ABI_JSON.abi;
export const QUIZ_COIN_ABI = QUIZ_COIN_ABI_JSON.abi;
export const ACCESS_CONTROL_ABI = ACCESS_CONTROL_ABI_JSON.abi;
