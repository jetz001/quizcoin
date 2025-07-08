// contracts/QuizCoin.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @custom:security-contact security@example.com
contract QuizCoin is ERC20Upgradeable, OwnableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the QuizCoin contract.
     * @param _defaultAdmin The address to be granted the DEFAULT_ADMIN_ROLE.
     */
    function initialize(address _defaultAdmin) public initializer {
        __ERC20_init("QuizCoin", "QZC"); // Initialize ERC20 with name and symbol
        __Ownable_init(msg.sender); // Initialize Ownable, msg.sender (deployer) becomes the owner
        __AccessControl_init();     // Initialize AccessControl

        // Grant DEFAULT_ADMIN_ROLE to the specified _defaultAdmin
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        // Grant MINTER_ROLE to the initial owner (deployer)
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @notice Mints new QuizCoin tokens to a specified address.
     * Only accounts with the MINTER_ROLE can call this function.
     * @param to The address to mint tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Overrides the default _authorizeUpgrade function for UUPSUpgradeable.
     * Allows only the contract owner to perform upgrades.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}