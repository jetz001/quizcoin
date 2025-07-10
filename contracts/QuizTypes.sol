// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// This file defines common structs used across multiple facets and libraries.

struct Question {
    string questionText;
    string[] options;
    uint8 correctAnswerIndex;
}

struct Quiz {
    string name;
    address creator;
    uint256 rewardAmount;
    uint256 totalQuestions;
    uint256 maxParticipants;
    bool isActive;
}