/**
 * Consensus and Dispute Engine for SecureHarvest
 * Verifies multi-source data feeds against tolerance thresholds before approving payouts.
 */

const DEFAULT_TOLERANCE_THRESHOLD = 10; // Maximum allowed divergence between feeds (e.g. 10mm)

// In-memory store for active disputes awaiting manual resolution
const activeDisputes = new Map();

/**
 * Evaluates oracle readings against tolerance thresholds and policy triggers.
 * 
 * @param {Array} readings - Array of oracle reading objects from oracleAdapter
 * @param {number} triggerThreshold - Policy rainfall trigger threshold (e.g. 50mm)
 * @param {number} toleranceThreshold - Custom tolerance limit (default: 10)
 * @returns {object} Consensus evaluation result
 */
function evaluateReadings(readings, triggerThreshold, toleranceThreshold = DEFAULT_TOLERANCE_THRESHOLD) {
  if (!readings || readings.length < 2) {
    return {
      status: 'INSUFFICIENT_DATA',
      reason: 'At least two independent oracle readings are required for consensus verification.'
    };
  }

  const values = readings.map(r => r.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const difference = maxVal - minVal;

  const sum = values.reduce((acc, curr) => acc + curr, 0);
  const averageReading = Math.round((sum / values.length) * 100) / 100;

  // 1. Check multi-source consensus tolerance
  if (difference > toleranceThreshold) {
    return {
      status: 'DISPUTE_FLAGGED',
      difference,
      toleranceThreshold,
      averageReading,
      readings,
      reason: `Data sources disagree beyond tolerance threshold (${difference}mm > ${toleranceThreshold}mm). Auto-payout halted.`
    };
  }

  // 2. Check trigger threshold breach
  if (averageReading <= triggerThreshold) {
    return {
      status: 'TRIGGER_APPROVED',
      difference,
      toleranceThreshold,
      averageReading,
      triggerThreshold,
      readings,
      reason: `Consensus verified (${averageReading}mm <= threshold ${triggerThreshold}mm). Trigger condition met.`
    };
  }

  // 3. Safe condition (threshold not breached)
  return {
    status: 'SAFE',
    difference,
    toleranceThreshold,
    averageReading,
    triggerThreshold,
    readings,
    reason: `Consensus verified (${averageReading}mm > threshold ${triggerThreshold}mm). Crop conditions normal.`
  };
}

/**
 * Flags a policy for manual resolution when oracle consensus fails.
 */
function flagDispute(policyId, plotId, evaluationResult) {
  const disputeRecord = {
    disputeId: `DSP-${policyId}-${Date.now()}`,
    policyId,
    plotId,
    flaggedAt: new Date().toISOString(),
    status: 'OPEN',
    evaluationResult
  };
  activeDisputes.set(String(policyId), disputeRecord);
  return disputeRecord;
}

/**
 * Retrieves all currently open disputes.
 */
function getAllDisputes() {
  return Array.from(activeDisputes.values());
}

/**
 * Retrieves a dispute by policy ID.
 */
function getDisputeByPolicyId(policyId) {
  return activeDisputes.get(String(policyId)) || null;
}

/**
 * Manually resolves a flagged dispute.
 * @param {number|string} policyId 
 * @param {'APPROVE_PAYOUT' | 'REJECT_PAYOUT'} decision 
 * @param {number} overrideValue 
 * @param {string} operatorNotes 
 */
function resolveDispute(policyId, decision, overrideValue, operatorNotes = '') {
  const dispute = activeDisputes.get(String(policyId));
  if (!dispute) {
    throw new Error(`No open dispute found for Policy ID ${policyId}`);
  }

  dispute.status = 'RESOLVED';
  dispute.resolvedAt = new Date().toISOString();
  dispute.resolution = {
    decision,
    overrideValue,
    operatorNotes
  };

  return dispute;
}

module.exports = {
  DEFAULT_TOLERANCE_THRESHOLD,
  evaluateReadings,
  flagDispute,
  getAllDisputes,
  getDisputeByPolicyId,
  resolveDispute
};
