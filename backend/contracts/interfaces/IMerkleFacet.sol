// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMerkleFacet {
    function submitMerkleRoot(uint256 quizId, bytes32 root) external;
    function verifyQuiz(uint256 quizId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool);
    function getMerkleRoot(uint256 quizId) external view returns (bytes32);
}
