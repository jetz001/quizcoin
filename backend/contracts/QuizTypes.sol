// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage } from './libraries/LibAppStorage.sol';

// This file defines common structs used across multiple facets and libraries.
struct Question {
    string questionText;
    string[] options;
    uint8 correctAnswerIndex;
    bytes32 correctAnswerHash;
    bytes32 hintHash;
    address questionCreator;
    uint256 difficultyLevel;
    uint256 baseRewardAmount;
    bool isClosed;
    LibAppStorage.QuestionMode mode;
    uint256 blockCreationTime;
    uint256 firstCorrectAnswerTime;
    address firstSolverAddress;
    address[] poolCorrectSolvers;
    mapping(address => uint256) lastAnswerDay;
}

struct Quiz {
    string name;
    address creator;
    uint256 rewardAmount;
    uint256 totalQuestions;
    uint256 maxParticipants;
    bool isActive;
    // แก้ไข: เพิ่ม mapping เพื่อเชื่อมโยง question index กับ question ID
    mapping(uint256 => uint256) questionIds;
}
