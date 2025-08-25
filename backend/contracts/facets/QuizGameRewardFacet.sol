// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';
import { IPoolManager } from '../interfaces/IPoolManager.sol';
import { IQuizCoin } from '../interfaces/IQuizCoin.sol';

/**
 * @title QuizGameRewardFacet
 * @dev Facet สำหรับจัดการการคำนวณและแจกจ่ายรางวัล
 */
contract QuizGameRewardFacet {
    
    /// @notice คำนวณรางวัลปัจจุบันตามระดับความยากและกลไก Halving
    /// @param _difficultyLevel ระดับความยากของคำถาม
    /// @return uint256 จำนวนรางวัลที่ควรได้รับ
    function calculateCurrentReward(uint256 _difficultyLevel) external view returns (uint256) {
        LibAppStorage.AppStorage storage ds = LibAppStorage.s();
        
        if (_difficultyLevel == 100) {
            return ds.REWARD_FOR_LEVEL_100;
        }

        require(_difficultyLevel >= 1 && _difficultyLevel <= 99, "Quiz: Invalid question level for halving calculation");

        uint256 currentBaseReward = (ds.REWARD_FOR_LEVEL_1_99 * _difficultyLevel) / 99;

        uint256 timeElapsed = block.timestamp - ds.GAME_START_TIMESTAMP;
        uint256 halvingCycles = timeElapsed / ds.HALVING_PERIOD_SECONDS;

        uint256 finalReward = currentBaseReward;
        for (uint256 i = 0; i < halvingCycles; i++) {
            finalReward = finalReward / 2;
            if (finalReward < ds.MIN_REWARD_AFTER_HALVING) {
                finalReward = ds.MIN_REWARD_AFTER_HALVING;
                break;
            }
        }
        return finalReward;
    }
}
