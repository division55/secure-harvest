const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CapitalPool & Solvency Enforcement Integration", function () {
  let capitalPool;
  let policyContract;
  let owner;
  let investorA;
  let investorB;
  let farmer;

  const ONE_DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [owner, investorA, investorB, farmer] = await ethers.getSigners();

    const CapitalPoolFactory = await ethers.getContractFactory("CapitalPool");
    capitalPool = await CapitalPoolFactory.deploy();
    await capitalPool.waitForDeployment();

    const PolicyContractFactory = await ethers.getContractFactory("PolicyContract");
    policyContract = await PolicyContractFactory.deploy();
    await policyContract.waitForDeployment();

    // Link contracts
    await capitalPool.setPolicyContract(await policyContract.getAddress());
    await policyContract.setCapitalPool(await capitalPool.getAddress());
  });

  async function currentTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }

  describe("LP Staking and Fractional Shares", function () {
    it("mints LP shares proportional to deposit size", async function () {
      // Investor A deposits 10 ETH
      await capitalPool.connect(investorA).depositLiquidity({ value: ethers.parseEther("10.0") });
      expect(await capitalPool.sharesOf(investorA.address)).to.equal(ethers.parseEther("10.0"));
      expect(await capitalPool.totalShares()).to.equal(ethers.parseEther("10.0"));

      // Investor B deposits 5 ETH
      await capitalPool.connect(investorB).depositLiquidity({ value: ethers.parseEther("5.0") });
      expect(await capitalPool.sharesOf(investorB.address)).to.equal(ethers.parseEther("5.0"));
      expect(await capitalPool.totalShares()).to.equal(ethers.parseEther("15.0"));
    });

    it("allows LP withdrawal and returns proportional capital", async function () {
      await capitalPool.connect(investorA).depositLiquidity({ value: ethers.parseEther("10.0") });

      const balanceBefore = await ethers.provider.getBalance(investorA.address);
      const tx = await capitalPool.connect(investorA).withdrawLiquidity(ethers.parseEther("5.0"));
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(investorA.address);
      expect(balanceAfter + gasCost - balanceBefore).to.equal(ethers.parseEther("5.0"));
      expect(await capitalPool.sharesOf(investorA.address)).to.equal(ethers.parseEther("5.0"));
    });
  });

  describe("Yield Accumulation from Policy Premiums", function () {
    it("accrues yield for LPs when unclaimed premiums enter the pool", async function () {
      // Investor A deposits 10 ETH
      await capitalPool.connect(investorA).depositLiquidity({ value: ethers.parseEther("10.0") });

      const now = await currentTimestamp();
      const premium = ethers.parseEther("2.0");
      const coverageAmount = ethers.parseEther("5.0");

      // Farmer creates policy, paying 2 ETH premium into the pool
      await policyContract.connect(farmer).createPolicy(
        coverageAmount,
        50,
        now,
        now + 30 * ONE_DAY,
        { value: premium }
      );

      // Total pool balance is now 12 ETH, backed by 10 LP shares
      const summary = await capitalPool.getPoolSummary();
      expect(summary.poolBalance).to.equal(ethers.parseEther("12.0"));
      expect(summary.activeExposure).to.equal(ethers.parseEther("5.0"));

      // Policy expires without trigger
      await ethers.provider.send("evm_increaseTime", [31 * ONE_DAY]);
      await ethers.provider.send("evm_mine");
      await policyContract.expirePolicy(0);

      // Active exposure released back to pool
      expect(await capitalPool.totalActiveExposure()).to.equal(0);

      // Investor A withdraws all 10 LP shares and receives 12 ETH (2 ETH yield earned!)
      const balanceBefore = await ethers.provider.getBalance(investorA.address);
      const tx = await capitalPool.connect(investorA).withdrawLiquidity(ethers.parseEther("10.0"));
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(investorA.address);

      expect(balanceAfter + gasCost - balanceBefore).to.equal(ethers.parseEther("12.0"));
    });
  });

  describe("On-Chain Solvency Enforcement", function () {
    it("reverts policy creation when the pool lacks capital for coverage", async function () {
      // Investor A deposits 4 ETH
      await capitalPool.connect(investorA).depositLiquidity({ value: ethers.parseEther("4.0") });

      const now = await currentTimestamp();
      const coverageAmount = ethers.parseEther("10.0"); // 10 ETH coverage > 4 ETH balance

      await expect(
        policyContract.connect(farmer).createPolicy(
          coverageAmount,
          50,
          now,
          now + 30 * ONE_DAY,
          { value: ethers.parseEther("0.5") }
        )
      ).to.be.revertedWith("CapitalPool: pool insolvent for coverage amount");
    });

    it("blocks LP withdrawal if remaining pool balance would drop below active exposure", async function () {
      await capitalPool.connect(investorA).depositLiquidity({ value: ethers.parseEther("10.0") });

      const now = await currentTimestamp();
      await policyContract.connect(farmer).createPolicy(
        ethers.parseEther("8.0"), // 8 ETH active exposure
        50,
        now,
        now + 30 * ONE_DAY,
        { value: ethers.parseEther("0.5") }
      );

      // Total balance = 10.5 ETH, exposure = 8.0 ETH. Max withdrawable = 2.5 ETH.
      // Attempting to withdraw 5.0 ETH should revert
      await expect(
        capitalPool.connect(investorA).withdrawLiquidity(ethers.parseEther("5.0"))
      ).to.be.revertedWith("CapitalPool: cannot withdraw below active policy exposure");
    });
  });

  describe("Payout Execution & Disbursal", function () {
    it("disburses payout from pool to farmer and updates exposure", async function () {
      await capitalPool.connect(investorA).depositLiquidity({ value: ethers.parseEther("10.0") });

      const now = await currentTimestamp();
      const coverageAmount = ethers.parseEther("3.0");

      await policyContract.connect(farmer).createPolicy(
        coverageAmount,
        50,
        now,
        now + 30 * ONE_DAY,
        { value: ethers.parseEther("0.2") }
      );

      // Record trigger and execute payout
      await policyContract.connect(owner).recordTrigger(0, 30);

      const farmerBalanceBefore = await ethers.provider.getBalance(farmer.address);
      await policyContract.executePayout(0);
      const farmerBalanceAfter = await ethers.provider.getBalance(farmer.address);

      expect(farmerBalanceAfter - farmerBalanceBefore).to.equal(coverageAmount);
      expect(await capitalPool.totalActiveExposure()).to.equal(0);
    });
  });
});
