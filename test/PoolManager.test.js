const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PoolManager", function () {
    let PoolManager;
    let poolManager;
    let owner;
    let addr1;
    let addr2;

    const quizId = 1;
    const depositAmount = ethers.parseEther("1"); // 1 ETH/BNB

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy();
        await poolManager.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await poolManager.owner()).to.equal(owner.address);
        });
    });

    describe("Deposit to Pool", function () {
        it("Should allow owner to deposit funds to a quiz pool", async function () {
            // Check initial balance of PoolManager
            const initialPoolBalance = await ethers.provider.getBalance(await poolManager.getAddress());

            // Deposit funds
            await expect(poolManager.depositToPool(quizId, { value: depositAmount }))
                .to.emit(poolManager, "QuizPoolDeposited")
                .withArgs(quizId, depositAmount);

            // Check if funds are reflected in the contract's balance
            expect(await ethers.provider.getBalance(await poolManager.getAddress())).to.equal(initialPoolBalance + depositAmount);
            // Check if funds are recorded in the specific quiz pool
            expect(await poolManager.quizPools(quizId)).to.equal(depositAmount);
        });

        it("Should revert if non-owner tries to deposit", async function () {
            await expect(
                poolManager.connect(addr1).depositToPool(quizId, { value: depositAmount })
            ).to.be.revertedWithCustomError(poolManager, "OwnableUnauthorizedAccount");
        });

        it("Should revert if deposit amount is zero", async function () {
            await expect(
                poolManager.depositToPool(quizId, { value: 0 })
            ).to.be.revertedWith("Deposit amount must be greater than zero");
        });
    });

    describe("Withdraw from Pool", function () {
        beforeEach(async function () {
            // Owner deposits funds before withdrawal tests
            await poolManager.depositToPool(quizId, { value: depositAmount });
        });

        it("Should allow owner to withdraw funds from a quiz pool", async function () {
            const withdrawAmount = ethers.parseEther("0.5");
            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
            const initialPoolManagerBalance = await ethers.provider.getBalance(await poolManager.getAddress());

            // Withdraw funds to owner's address
            await expect(poolManager.withdrawFromPool(quizId, withdrawAmount, owner.address))
                .to.emit(poolManager, "QuizPoolWithdrawn")
                .withArgs(quizId, withdrawAmount, owner.address);

            // Check owner's balance (factoring in gas costs)
            // Use .changeEtherBalance to account for gas
            await expect(async () => await poolManager.withdrawFromPool(quizId, withdrawAmount, owner.address))
                 .to.changeEtherBalance(owner, withdrawAmount);

            // Check pool manager's balance
            expect(await ethers.provider.getBalance(await poolManager.getAddress())).to.equal(initialPoolManagerBalance - withdrawAmount);
            // Check quiz pool balance
            expect(await poolManager.quizPools(quizId)).to.equal(depositAmount - withdrawAmount);
        });

        it("Should revert if non-owner tries to withdraw", async function () {
            await expect(
                poolManager.connect(addr1).withdrawFromPool(quizId, depositAmount, addr1.address)
            ).to.be.revertedWithCustomError(poolManager, "OwnableUnauthorizedAccount");
        });

        it("Should revert if insufficient funds in quiz pool", async function () {
            const excessiveAmount = ethers.parseEther("2"); // More than deposited
            await expect(
                poolManager.withdrawFromPool(quizId, excessiveAmount, owner.address)
            ).to.be.revertedWith("Insufficient funds in quiz pool");
        });

        it("Should revert if recipient is zero address", async function () {
            await expect(
                poolManager.withdrawFromPool(quizId, depositAmount, ethers.ZeroAddress)
            ).to.be.revertedWith("Recipient cannot be the zero address");
        });
    });

    describe("Get Quiz Pool Balance", function () {
        it("Should return the correct balance for a quiz pool", async function () {
            await poolManager.depositToPool(quizId, { value: depositAmount });
            expect(await poolManager.getQuizPoolBalance(quizId)).to.equal(depositAmount);
        });

        it("Should return zero for an empty quiz pool", async function () {
            expect(await poolManager.getQuizPoolBalance(999)).to.equal(0);
        });
    });
});