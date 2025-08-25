// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library LibMerkleStorage {
    bytes32 constant MERKLE_STORAGE_POSITION = keccak256("quizcoin.diamond.merkle.storage");

    struct MerkleStorage {
        // quizId => root
        mapping(uint256 => bytes32) quizRoots;

        // leaf => quizId (ทำให้ verify เร็ว ไม่ต้องวน loop)
        mapping(bytes32 => uint256) leafToQuizId;
    }

    function merkleStorage() internal pure returns (MerkleStorage storage ms) {
        bytes32 position = MERKLE_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }
}
