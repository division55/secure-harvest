// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICapitalPool {
    function reserveCoverage(uint256 coverageAmount) external payable;
    function releaseExposure(uint256 coverageAmount) external;
    function disbursePayout(address payable farmer, uint256 coverageAmount) external;
}

/// @title PolicyContract
/// @notice Core parametric insurance policy logic for SecureHarvest.
/// @dev Integrated with CapitalPool.sol for fractional capital backing, yield routing, and on-chain solvency enforcement.
contract PolicyContract {
    address public owner;
    address public capitalPool;

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
    event PolicyExpired(uint256 indexed policyId);
    event CapitalPoolUpdated(address indexed newCapitalPool);

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

    /// @notice Set or update the CapitalPool contract address.
    function setCapitalPool(address _capitalPool) external onlyOwner {
        require(_capitalPool != address(0), "PolicyContract: invalid address");
        capitalPool = _capitalPool;
        emit CapitalPoolUpdated(_capitalPool);
    }

    /// @notice Farmer purchases a policy by paying the premium up front.
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

        // Forward premium to CapitalPool and reserve exposure if pool is connected
        if (capitalPool != address(0)) {
            ICapitalPool(capitalPool).reserveCoverage{value: msg.value}(coverageAmount);
        }

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

    /// @notice Manually record a trigger event when oracle consensus is verified.
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
    function executePayout(uint256 policyId) external policyExists(policyId) {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Triggered, "PolicyContract: policy not triggered");

        policy.status = PolicyStatus.PaidOut;

        if (capitalPool != address(0)) {
            // Disburse from CapitalPool
            ICapitalPool(capitalPool).disbursePayout(payable(policy.farmer), policy.coverageAmount);
        } else {
            // Fallback direct balance transfer if standalone
            require(address(this).balance >= policy.coverageAmount, "PolicyContract: insufficient funds");
            (bool sent, ) = policy.farmer.call{value: policy.coverageAmount}("");
            require(sent, "PolicyContract: payout transfer failed");
        }

        emit PolicyPaidOut(policyId, policy.coverageAmount);
    }

    /// @notice Expires an active policy when season window ends without payout trigger.
    function expirePolicy(uint256 policyId) external policyExists(policyId) {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Active, "PolicyContract: policy not active");
        require(block.timestamp > policy.seasonEnd, "PolicyContract: season not ended");

        policy.status = PolicyStatus.Expired;

        if (capitalPool != address(0)) {
            ICapitalPool(capitalPool).releaseExposure(policy.coverageAmount);
        }

        emit PolicyExpired(policyId);
    }

    /// @notice Allows the contract to receive direct funding.
    receive() external payable {}
}
