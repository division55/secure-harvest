/**
 * Audit Logging Service for SecureHarvest
 * Generates cryptographic audit trails for every oracle evaluation to guarantee
 * independent reconstructability on-chain and off-chain.
 */

const crypto = require('crypto');

// In-memory audit log repository
const auditLogs = new Map();

/**
 * Creates a cryptographically hashed audit entry for an oracle evaluation.
 */
function createAuditEntry(policyId, plotId, evaluationResult, transactionHash = null) {
  const timestamp = Math.floor(Date.now() / 1000);
  const auditId = `AUDIT-${policyId}-${timestamp}-${Math.floor(Math.random() * 1000)}`;

  const canonicalPayload = {
    auditId,
    policyId: String(policyId),
    plotId: String(plotId),
    status: evaluationResult.status,
    averageReading: evaluationResult.averageReading,
    difference: evaluationResult.difference,
    toleranceThreshold: evaluationResult.toleranceThreshold,
    readings: evaluationResult.readings,
    transactionHash,
    timestamp
  };

  // Generate SHA-256 hash of the canonical JSON string
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalPayload))
    .digest('hex');

  const auditEntry = {
    ...canonicalPayload,
    auditHash: `0x${hash}`
  };

  auditLogs.set(auditId, auditEntry);

  return auditEntry;
}

/**
 * Retrieves an audit log entry by audit ID.
 */
function getAuditEntry(auditId) {
  return auditLogs.get(auditId) || null;
}

/**
 * Retrieves all audit logs for a specific policy.
 */
function getPolicyAuditLogs(policyId) {
  const targetId = String(policyId);
  return Array.from(auditLogs.values()).filter(log => log.policyId === targetId);
}

/**
 * Verifies that an audit entry's stored hash matches its payload.
 */
function verifyAuditHash(auditId) {
  const entry = auditLogs.get(auditId);
  if (!entry) {
    return { valid: false, reason: 'Audit log entry not found' };
  }

  const { auditHash, ...payload } = entry;
  const recalculatedHash = `0x${crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')}`;

  const isValid = recalculatedHash === auditHash;

  return {
    valid: isValid,
    storedHash: auditHash,
    recalculatedHash,
    payload
  };
}

module.exports = {
  createAuditEntry,
  getAuditEntry,
  getPolicyAuditLogs,
  verifyAuditHash
};
