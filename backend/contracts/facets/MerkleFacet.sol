// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/LibMerkleStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MerkleFacet {
    event MerkleRootSubmitted(uint256 indexed quizId, bytes32 root);

    /// @notice Submit Merkle root for a quiz
    /// @param quizId The quiz ID
    /// @param root The Merkle root
    /// @param leaves The leaves for mapping leaf → quizId
    function submitMerkleRoot(uint256 quizId, bytes32 root, bytes32[] calldata leaves) external {
        LibMerkleStorage.MerkleStorage storage ms = LibMerkleStorage.merkleStorage();
        ms.quizRoots[quizId] = root;

        for (uint256 i = 0; i < leaves.length; i++) {
            ms.leafToQuizId[leaves[i]] = quizId;
        }

        emit MerkleRootSubmitted(quizId, root);
    }

    /// @notice Verify leaf is valid under stored root
    function verifyQuiz(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        LibMerkleStorage.MerkleStorage storage ms = LibMerkleStorage.merkleStorage();
        uint256 quizId = ms.leafToQuizId[leaf];
        require(quizId != 0, "MerkleFacet: Leaf not registered");
        return MerkleProof.verify(proof, ms.quizRoots[quizId], leaf);
    }

    /// @notice Get quizId from a leaf
    function getQuizIdFromLeaf(bytes32 leaf) external view returns (uint256) {
        return LibMerkleStorage.merkleStorage().leafToQuizId[leaf];
    }
}
