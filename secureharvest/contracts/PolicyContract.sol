// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PolicyContract
/// @notice Core parametric insurance policy logic for SecureHarvest.
/// @dev Iteration 1 scope: policy creation, premium escrow, and a single-source
///      manual trigger for testing. Multi-source oracle verification, fractional
///      claims, and pool solvency logic are added in later iterations.
contract PolicyContract {
    address public owner;

    enum PolicyStatus {
        Active,
        Triggered,
        PaidOut,
        Expired
    }

    struct Policy {
        address farmer;
        uint256 premiumPaid;
        uint256 coverageAmount;
        uint256 triggerThreshold;   // e.g. rainfall in mm below which payout fires
        uint256 seasonStart;
        uint256 seasonEnd;
        PolicyStatus status;
    }

    uint256 public nextPolicyId;
    mapping(uint256 => Policy) public policies;

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed farmer,
        uint256 premiumPaid,
        uint256 coverageAmount,
        uint256 triggerThreshold,
        uint256 seasonStart,
        uint256 seasonEnd
    );

    event PolicyTriggered(uint256 indexed policyId, uint256 observedValue);
    event PolicyPaidOut(uint256 indexed policyId, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "PolicyContract: caller is not the owner");
        _;
    }

    modifier policyExists(uint256 policyId) {
        require(policies[policyId].farmer != address(0), "PolicyContract: policy does not exist");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Farmer purchases a policy by paying the premium up front.
    /// @dev Coverage amount and trigger threshold are supplied by the backend
    ///      after the AI pricing service has computed them off-chain.
    function createPolicy(
        uint256 coverageAmount,
        uint256 triggerThreshold,
        uint256 seasonStart,
        uint256 seasonEnd
    ) external payable returns (uint256 policyId) {
        require(msg.value > 0, "PolicyContract: premium required");
        require(seasonEnd > seasonStart, "PolicyContract: invalid season window");

        policyId = nextPolicyId++;

        policies[policyId] = Policy({
            farmer: msg.sender,
            premiumPaid: msg.value,
            coverageAmount: coverageAmount,
            triggerThreshold: triggerThreshold,
            seasonStart: seasonStart,
            seasonEnd: seasonEnd,
            status: PolicyStatus.Active
        });

        emit PolicyCreated(
            policyId,
            msg.sender,
            msg.value,
            coverageAmount,
            triggerThreshold,
            seasonStart,
            seasonEnd
        );
    }

    /// @notice Manually record a trigger event for testing purposes.
    /// @dev TEMPORARY single-source trigger for Iteration 1 only. This will be
    ///      replaced by the multi-source oracle verification flow, which
    ///      requires agreement across independent data feeds before a policy
    ///      can move to Triggered status.
    function recordTrigger(uint256 policyId, uint256 observedValue)
        external
        onlyOwner
        policyExists(policyId)
    {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Active, "PolicyContract: policy not active");
        require(
            block.timestamp >= policy.seasonStart && block.timestamp <= policy.seasonEnd,
            "PolicyContract: outside season window"
        );
        require(observedValue < policy.triggerThreshold, "PolicyContract: threshold not breached");

        policy.status = PolicyStatus.Triggered;
        emit PolicyTriggered(policyId, observedValue);
    }

    /// @notice Executes payout for a triggered policy.
    /// @dev Payout currently draws directly from contract balance. Pool
    ///      solvency checks and fractional claim distribution are added when
    ///      the capital pool contract is integrated in a later iteration.
    function executePayout(uint256 policyId) external policyExists(policyId) {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Triggered, "PolicyContract: policy not triggered");
        require(address(this).balance >= policy.coverageAmount, "PolicyContract: insufficient funds");

        policy.status = PolicyStatus.PaidOut;

        (bool sent, ) = policy.farmer.call{value: policy.coverageAmount}("");
        require(sent, "PolicyContract: payout transfer failed");

        emit PolicyPaidOut(policyId, policy.coverageAmount);
    }

    /// @notice Allows the contract to receive funding for the payout pool.
    receive() external payable {}
}
