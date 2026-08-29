// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CapitalPool
/// @notice Fractional yield-bearing capital pool with on-chain solvency enforcement for SecureHarvest.
/// @dev Investors deposit ETH to receive LP shares, earning yield from unclaimed premiums.
///      Tracks total active exposure and enforces that pool balance meets solvency requirements.
contract CapitalPool {
    address public owner;
    address public policyContract;

    uint256 public totalShares;
    uint256 public totalActiveExposure;

    mapping(address => uint256) public sharesOf;

    event LiquidityDeposited(address indexed investor, uint256 amount, uint256 sharesMinted);
    event LiquidityWithdrawn(address indexed investor, uint256 amountReturned, uint256 sharesBurned);
    event CoverageReserved(uint256 amount, uint256 newTotalExposure);
    event CoverageReleased(uint256 amount, uint256 newTotalExposure);
    event PayoutDisbursed(address indexed farmer, uint256 amount);
    event PolicyContractUpdated(address indexed newPolicyContract);

    modifier onlyOwner() {
        require(msg.sender == owner, "CapitalPool: caller is not the owner");
        _;
    }

    modifier onlyPolicyContract() {
        require(msg.sender == policyContract, "CapitalPool: caller is not policy contract");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Set or update the authorized PolicyContract address.
    function setPolicyContract(address _policyContract) external onlyOwner {
        require(_policyContract != address(0), "CapitalPool: invalid address");
        policyContract = _policyContract;
        emit PolicyContractUpdated(_policyContract);
    }

    /// @notice Investors deposit ETH to fund the capital pool and receive fractional LP shares.
    function depositLiquidity() external payable returns (uint256 sharesMinted) {
        require(msg.value > 0, "CapitalPool: deposit must be greater than zero");

        uint256 poolBalanceBefore = address(this).balance - msg.value;

        if (totalShares == 0 || poolBalanceBefore == 0) {
            sharesMinted = msg.value;
        } else {
            sharesMinted = (msg.value * totalShares) / poolBalanceBefore;
        }

        require(sharesMinted > 0, "CapitalPool: zero shares minted");

        sharesOf[msg.sender] += sharesMinted;
        totalShares += sharesMinted;

        emit LiquidityDeposited(msg.sender, msg.value, sharesMinted);
    }

    /// @notice Investors withdraw ETH by burning LP shares.
    /// @dev Withdrawal is blocked if it would cause the pool balance to drop below active policy exposure.
    function withdrawLiquidity(uint256 shareAmount) external returns (uint256 amountToReturn) {
        require(shareAmount > 0, "CapitalPool: share amount must be greater than zero");
        require(sharesOf[msg.sender] >= shareAmount, "CapitalPool: insufficient LP shares");

        amountToReturn = (shareAmount * address(this).balance) / totalShares;
        uint256 poolBalanceAfter = address(this).balance - amountToReturn;

        require(poolBalanceAfter >= totalActiveExposure, "CapitalPool: cannot withdraw below active policy exposure");

        sharesOf[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        (bool sent, ) = msg.sender.call{value: amountToReturn}("");
        require(sent, "CapitalPool: ETH withdrawal transfer failed");

        emit LiquidityWithdrawn(msg.sender, amountToReturn, shareAmount);
    }

    /// @notice Reserves pool liquidity for a new active policy's coverage obligation.
    /// @dev Enforces on-chain solvency check. Reverts if pool balance cannot cover total active exposure.
    function reserveCoverage(uint256 coverageAmount) external payable onlyPolicyContract {
        require(address(this).balance >= totalActiveExposure + coverageAmount, "CapitalPool: pool insolvent for coverage amount");

        totalActiveExposure += coverageAmount;
        emit CoverageReserved(coverageAmount, totalActiveExposure);
    }

    /// @notice Releases reserved exposure when a policy expires without trigger.
    function releaseExposure(uint256 coverageAmount) external onlyPolicyContract {
        require(totalActiveExposure >= coverageAmount, "CapitalPool: coverage release exceeds active exposure");
        totalActiveExposure -= coverageAmount;
        emit CoverageReleased(coverageAmount, totalActiveExposure);
    }

    /// @notice Disburses insurance payout to farmer upon verified trigger.
    function disbursePayout(address payable farmer, uint256 coverageAmount) external onlyPolicyContract {
        require(address(this).balance >= coverageAmount, "CapitalPool: insufficient pool balance for payout");
        require(totalActiveExposure >= coverageAmount, "CapitalPool: coverage payout exceeds active exposure");

        totalActiveExposure -= coverageAmount;

        (bool sent, ) = farmer.call{value: coverageAmount}("");
        require(sent, "CapitalPool: payout transfer to farmer failed");

        emit PayoutDisbursed(farmer, coverageAmount);
    }

    /// @notice Checks if the capital pool is currently solvent (Balance >= Active Exposure).
    function isSolvent() external view returns (bool) {
        return address(this).balance >= totalActiveExposure;
    }

    /// @notice Returns full state summary for UI/observability dashboards.
    function getPoolSummary() external view returns (
        uint256 poolBalance,
        uint256 activeExposure,
        uint256 totalLpShares,
        bool solvent
    ) {
        return (
            address(this).balance,
            totalActiveExposure,
            totalShares,
            address(this).balance >= totalActiveExposure
        );
    }

    /// @notice Allows direct funding/premium transfer.
    receive() external payable {}
}
