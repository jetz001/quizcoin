// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/LibMerkleStorage.sol";
import "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract MerkleFacet {
    event MerkleRootSubmitted(uint256 indexed quizId, bytes32 root);

    function _appStorage() internal pure returns (LibAppStorage.AppStorage storage ds) {
        ds = LibAppStorage.s();
    }

    modifier onlyAdmin() {
        LibAppStorage.AppStorage storage ds = _appStorage();
        require(
            AccessControlUpgradeable(address(this)).hasRole(ds.DEFAULT_ADMIN_ROLE, msg.sender),
            "MerkleFacet: Caller is not an admin"
        );
        _;
    }

    /// @notice Commit Merkle root for a quiz (store only root)
    function submitMerkleRoot(uint256 quizId, bytes32 root) external onlyAdmin {
        LibMerkleStorage.MerkleStorage storage ms = LibMerkleStorage.merkleStorage();
        ms.quizRoots[quizId] = root;

        emit MerkleRootSubmitted(quizId, root);
    }

    /// @notice Verify leaf against stored Merkle root
    function verifyQuiz(
        uint256 quizId,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        LibMerkleStorage.MerkleStorage storage ms = LibMerkleStorage.merkleStorage();
        bytes32 root = ms.quizRoots[quizId];
        require(root != 0, "MerkleFacet: Root not found");
        return MerkleProof.verify(proof, root, leaf);
    }

    /// @notice Get Merkle root for a quizId
    function getMerkleRoot(uint256 quizId) external view returns (bytes32) {
        return LibMerkleStorage.merkleStorage().quizRoots[quizId];
    }
}
