// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';

// Interface สำหรับ QuizGameRewardFacet
interface IQuizGameReward {
    function calculateCurrentReward(uint256 _difficultyLevel) external view returns (uint256);
}
