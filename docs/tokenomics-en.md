# QuizCoin (QZC) Tokenomics & Smart Contract Roles

This document outlines the core tokenomics of QuizCoin (QZC) and the roles of its smart contracts within the decentralized quiz game ecosystem.

---

## 1. QuizCoin (QZC) Tokenomics Overview

### Max Supply: Unlimited
* QZC has an **unlimited** total supply.
* **Minting Mechanism:** New QZC tokens are created ("minted") exclusively when a player successfully answers a quiz question for the first time in a block. This applies to both "Solo" and "Pool" game modes.

### Initial Distribution: None
* There is **no pre-minted supply, initial distribution, or Airdrop** of QZC tokens.
* Upon deployment, the QuizCoin contract's total supply is zero.
* The token supply will only begin to circulate in the ecosystem once players start earning rewards by correctly answering quiz questions.

### Treasury / Ecosystem Fund
The project's longevity and development are supported by a dedicated Treasury, managed by the Diamond Contract.

* **Funding Sources:**
    * **0.5% Reward Fee:** When a player successfully answers a question (in either Solo or Pool mode), 0.5% of the total calculated reward amount is minted and directed to the **Diamond Contract**, which serves as the project's primary Treasury.
    * **Hint Purchase Fees:** All QuizCoin (QZC) tokens spent by players to purchase hints (clues) for quiz questions are transferred **directly** from the player's wallet to the **Diamond Contract (Treasury)**.
* **Purpose & Usage:**
    * Operational costs, such as domain rental.
    * Development and maintenance expenses.
    * Other expenditures critical for the growth and sustainability of the QuizCoin ecosystem.

---

## 2. Smart Contract Mechanisms & Roles

The QuizCoin game is built using the **Diamond Standard (EIP-2535)**, enabling a modular, upgradeable, and efficient smart contract architecture.

### `QuizCoin.sol` (ERC-20 Token)
* The official ERC-20 token for the QuizCoin game (QZC).
* **No initial minting** in its constructor; `totalSupply` starts at 0.
* Utilizes OpenZeppelin's `AccessControl` for role-based permissions.
* Features a `MINTER_ROLE` that exclusively allows authorized entities to call the `mint()` function.
* Exposes a `MINTER_ROLE()` function for external contracts to retrieve the role's bytes32 hash.

### `PoolManager.sol`
Serves as the central hub for managing QZC token minting and distribution, acting as an intermediary between the game logic (Facets) and the `QuizCoin` token.

* `withdrawForUser(address _user, uint256 _amount)`:
    * Called by the `QuizGameDiamond` (via a Facet).
    * **Mints** new `_amount` of QZC and transfers it directly to the specified `_user` as a reward for solving a question.
* `mintAndTransferToTreasury(uint256 _amount)`:
    * Called by the `QuizGameDiamond` (via a Facet).
    * **Mints** new `_amount` of QZC and transfers it to the `QuizGameDiamond` address (the Treasury).
* `deposit(uint256 _amount)`:
    * Primarily intended for administrative purposes or future mechanics where existing QZC needs to be transferred *into* the `PoolManager`.
    * **Clarification:** `buyHint` fees are transferred directly to the Diamond Contract, so this function is *not* used for hint fee collection.
* `setQuizGameDiamondAddress(address _newQuizGameDiamondAddress)`:
    * Allows the `PoolManager` to recognize and authorize the `QuizGameDiamond` as the legitimate caller for minting and withdrawal functions.
* **`MINTER_ROLE` Grant:** The `PoolManager` contract is granted the `MINTER_ROLE` on the `QuizCoin` token during the initialization process of the `QuizGameDiamond`.

### `QuizGameDiamond.sol` (Diamond Proxy)
The central, upgradeable proxy contract that users interact with. It delegates calls to various Facets.

* Built with `UUPSUpgradeable` and `AccessControlUpgradeable` for upgradeability and robust role management.
* **`initialize()` function:**
    * Sets the initial `DEFAULT_ADMIN_ROLE` to the deployer.
    * Crucially, it calls `QuizCoin.grantRole(QuizCoin.MINTER_ROLE(), PoolManager Address)` to empower `PoolManager` to mint tokens.
    * It also calls `PoolManager.setQuizGameDiamondAddress(address(this))` to establish the trust relationship.
* **Treasury Role:** The `QuizGameDiamond` contract's address also serves as the main **Treasury address** where hint fees and the 0.5% reward fees are accumulated.

### `LibAppStorage.sol` (Solidity Library)
* Manages the `AppStorage` struct, which is the single source of truth for all persistent state variables of the QuizGame. All facets access this shared storage.
* Stores crucial game constants such as `HINT_COST_AMOUNT`, `BLOCK_DURATION_SECONDS`, `HALVING_PERIOD_SECONDS`, and `MIN_REWARD_AFTER_HALVING`.
* Includes `TREASURY_FEE_PERCENTAGE` (defined as `50` for 0.5% fee calculation, i.e., `amount * 50 / 10000`).
* Contains the `_calculateCurrentReward()` function, which determines dynamic reward amounts, factoring in difficulty and the halving mechanism.

### Facets (Modular Functionality)
Each facet is a separate contract that implements specific game logic, attached to the `QuizGameDiamond` via `diamondCut` operations.

* **`QuizGameModeFacet.sol`:**
    * Handles `createQuestion()`: Allows authorized creators to add new quiz questions.
    * Manages `submitAnswer()`:
        * **Solo Mode:** Calculates `totalReward`, then `treasuryFee` (0.5%). Calls `ds.poolManager.mintAndTransferToTreasury(treasuryFee)` and `ds.poolManager.withdrawForUser(msg.sender, rewardForSoloSolver)`.
    * Implements `buyHint()`: Requires player `approve()` for the Diamond Contract. `HINT_COST_AMOUNT` is directly `transferFrom` player to the `Diamond Contract (address(this))`, funding the Treasury.

* **`QuizGameRewardFacet.sol`:**
    * Manages `distributeRewards()`: Specifically for "Pool" mode questions after their reward window closes.
    * Calculates `totalFinalReward`, then `treasuryFee` (0.5%). Calls `ds.poolManager.mintAndTransferToTreasury(treasuryFee)`.
    * Distributes the remaining reward to all correct solvers in the pool by calling `ds.poolManager.withdrawForUser(solver, rewardPerSolver)`.

---

### Summary of Treasury Fund Flow

* **Hint Purchases:** QuizCoin (QZC) used for purchasing hints is transferred directly to the `QuizGameDiamond` contract (Treasury).
    * *Reference:* `contracts/facets/QuizGameModeFacet.sol::buyHint`
* **0.5% Reward Fee:** When rewards are calculated (for both Solo and Pool modes), 0.5% of the total reward is newly minted by the `PoolManager` and sent to the `QuizGameDiamond` contract (Treasury).
    * *Reference:* `contracts/facets/QuizGameModeFacet.sol::submitAnswer`
    * *Reference:* `contracts/facets/QuizGameRewardFacet.sol::distributeRewards`