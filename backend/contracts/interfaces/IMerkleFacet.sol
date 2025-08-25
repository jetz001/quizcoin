// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMerkleFacet {
    function submitMerkleRoot(uint256 quizId, bytes32 root, bytes32[] calldata leaves) external;
    function verifyQuiz(bytes32 leaf, bytes32[] calldata proof) external view returns (bool);
    function getQuizIdFromLeaf(bytes32 leaf) external view returns (uint256);
}
