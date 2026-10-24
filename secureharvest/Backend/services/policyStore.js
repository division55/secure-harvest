const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'secureharvest.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    coverage_amount REAL NOT NULL,
    premium_amount REAL NOT NULL,
    trigger_threshold REAL NOT NULL,
    quote_hash TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    oracle_status TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
    dispute_id TEXT,
    audit_id TEXT,
    farmer_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`CREATE TABLE IF NOT EXISTS policy_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE
);`);

db.exec(`INSERT INTO policy_events (policy_id, event_type, title, details, created_at)
  SELECT id, 'created', 'Policy created', 'Historical policy record imported into the activity timeline.', created_at
  FROM policies p WHERE NOT EXISTS (SELECT 1 FROM policy_events e WHERE e.policy_id = p.id);`);

// Safe migration: add farmer_id if an older DB doesn't have it yet
const policyColumns = db.prepare('PRAGMA table_info(policies)').all();
if (!policyColumns.find(c => c.name === 'farmer_id')) {
  db.exec('ALTER TABLE policies ADD COLUMN farmer_id INTEGER');
}
if (!policyColumns.find(c => c.name === 'latitude')) db.exec('ALTER TABLE policies ADD COLUMN latitude REAL');
if (!policyColumns.find(c => c.name === 'longitude')) db.exec('ALTER TABLE policies ADD COLUMN longitude REAL');

function recordPolicyEvent(policyId, eventType, title, details = '') {
  db.prepare('INSERT INTO policy_events (policy_id, event_type, title, details) VALUES (?, ?, ?, ?)')
    .run(Number(policyId), eventType, title, details || null);
}

function getPolicyEvents(policyId) {
  return db.prepare(`SELECT id, event_type AS eventType, title, details, created_at AS createdAt
    FROM policy_events WHERE policy_id = ? ORDER BY id ASC`).all(Number(policyId));
}

function createPolicy({
  plotId,
  location,
  coverageAmount,
  premiumAmount,
  triggerThreshold,
  quoteHash,
  farmerId,
  latitude,
  longitude
}) {
  const result = db.prepare(`
    INSERT INTO policies (
      plot_id,
      location,
      latitude,
      longitude,
      coverage_amount,
      premium_amount,
      trigger_threshold,
      quote_hash,
      farmer_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(plotId),
    location,
    latitude == null ? null : Number(latitude),
    longitude == null ? null : Number(longitude),
    Number(coverageAmount),
    Number(premiumAmount),
    Number(triggerThreshold),
    quoteHash || null,
    farmerId != null ? Number(farmerId) : null
  );
  recordPolicyEvent(Number(result.lastInsertRowid), 'created', 'Policy created', 'Coverage and rainfall trigger saved.');
  return getPolicy(Number(result.lastInsertRowid));
}

function getPolicy(id) {
  return db.prepare(`
    SELECT
      id,
      plot_id AS plotId,
      location,
      latitude,
      longitude,
      coverage_amount AS coverageAmount,
      premium_amount AS premiumAmount,
      trigger_threshold AS triggerThreshold,
      quote_hash AS quoteHash,
      status,
      oracle_status AS oracleStatus,
      dispute_id AS disputeId,
      audit_id AS auditId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM policies
    WHERE id = ?
  `).get(Number(id));
}

function getAllPolicies() {
  return db.prepare(`
    SELECT
      id,
      plot_id AS plotId,
      location,
      latitude,
      longitude,
      coverage_amount AS coverageAmount,
      premium_amount AS premiumAmount,
      trigger_threshold AS triggerThreshold,
      quote_hash AS quoteHash,
      status,
      oracle_status AS oracleStatus,
      dispute_id AS disputeId,
      audit_id AS auditId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM policies
    ORDER BY id DESC
  `).all();
}

function getPoliciesByFarmer(farmerId) {
  return db.prepare(`
    SELECT
      id,
      plot_id AS plotId,
      location,
      latitude,
      longitude,
      coverage_amount AS coverageAmount,
      premium_amount AS premiumAmount,
      trigger_threshold AS triggerThreshold,
      quote_hash AS quoteHash,
      status,
      oracle_status AS oracleStatus,
      dispute_id AS disputeId,
      audit_id AS auditId,
      farmer_id AS farmerId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM policies
    WHERE farmer_id = ?
    ORDER BY id DESC
  `).all(Number(farmerId));
}

function updatePolicyEvaluation(id, {
  oracleStatus,
  disputeId,
  auditId
}) {
  db.prepare(`
    UPDATE policies
    SET oracle_status = ?,
        dispute_id = ?,
        audit_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    oracleStatus,
    disputeId == null ? null : String(disputeId),
    auditId == null ? null : String(auditId),
    Number(id)
  );

  const eventTitle = oracleStatus === 'DISPUTE_FLAGGED' ? 'Dispute flagged for review' : `Oracle evaluation: ${oracleStatus}`;
  recordPolicyEvent(id, oracleStatus === 'DISPUTE_FLAGGED' ? 'dispute' : 'evaluation', eventTitle,
    [disputeId && `Dispute ${disputeId}`, auditId && `Audit ${auditId}`].filter(Boolean).join(' · '));

  return getPolicy(id);
}

function updatePolicyStatus(id, status) {
  db.prepare(`
    UPDATE policies
    SET status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, Number(id));

  recordPolicyEvent(id, 'status', `Policy status changed to ${status}`);

  return getPolicy(id);
}

/**
 * Atomically writes every resolution-related field in one SQL statement.
 * Use this instead of calling updatePolicyStatus + updatePolicyEvaluation
 * separately, so the policy record is never left in a half-written state.
 *
 * @param {number|string} id
 * @param {{ status: string, oracleStatus: string, disputeId: string|null, auditId: string|null }} fields
 */
function updatePolicyResolution(id, { status, oracleStatus, disputeId, auditId }) {
  db.prepare(`
    UPDATE policies
    SET status       = ?,
        oracle_status = ?,
        dispute_id   = ?,
        audit_id     = ?,
        updated_at   = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status,
    oracleStatus,
    disputeId == null ? null : String(disputeId),
    auditId   == null ? null : String(auditId),
    Number(id)
  );

  recordPolicyEvent(id, 'resolution', `Policy resolved: ${status}`,
    `Oracle status: ${oracleStatus}${disputeId ? ` · Dispute ${disputeId}` : ''}${auditId ? ` · Audit ${auditId}` : ''}`);

  return getPolicy(id);
}

module.exports = {
  createPolicy,
  getPolicy,
  getAllPolicies,
  getPoliciesByFarmer,
  getPolicyEvents,
  updatePolicyEvaluation,
  updatePolicyStatus,
  updatePolicyResolution
};
