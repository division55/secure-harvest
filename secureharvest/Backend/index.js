require('dotenv').config();
const express = require('express');
const {
  fetchMultiSourceReadings,
  setPlotScenario,
  clearPlotScenario
} = require('./services/oracleAdapter');

const {
  evaluateReadings,
  flagDispute,
  getAllDisputes,
  getDisputeByPolicyId,
  resolveDispute
} = require('./services/disputeEngine');

const {
  createAuditEntry,
  getAuditEntry,
  getPolicyAuditLogs,
  verifyAuditHash
} = require('./services/auditLogger');

const {
  initializeBridge,
  recordOracleTrigger
} = require('./services/blockchainBridge');

const { fetchPricingQuote } = require('./services/pricingClient');
const authRoutes = require('./auth');
const { authenticate } = require('./auth');
const {
  createPolicy,
  getPolicy,
  getAllPolicies,
  getPoliciesByFarmer,
  getPolicyEvents,
  updatePolicyEvaluation,
  updatePolicyStatus,
  updatePolicyResolution
} = require('./services/policyStore');

const app = express();
app.use(express.json());

// Farmer registration, login, and plot management
app.use('/api/auth', authRoutes);

/* --- SHARED POLICY API --- */

// List policies
app.get('/api/policies', (req, res) => {
  try {
    res.json({ policies: getAllPolicies() });
  } catch (error) {
    console.error('Failed to list policies:', error);
    res.status(500).json({ error: 'Could not retrieve policies.' });
  }
});

// My policies — returns only the logged-in farmer's policies
// IMPORTANT: registered BEFORE /:id so Express doesn't treat "mine" as an ID.
app.get('/api/policies/mine', authenticate, (req, res) => {
  try {
    const policies = getPoliciesByFarmer(req.farmer.id);
    res.json({ policies });
  } catch (error) {
    console.error('Failed to list farmer policies:', error);
    res.status(500).json({ error: 'Could not retrieve your policies.' });
  }
});

app.get('/api/policies/:id/timeline', (req, res) => {
  const policy = getPolicy(req.params.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found.' });
  return res.json({ events: getPolicyEvents(req.params.id) });
});

// Retrieve one policy
app.get('/api/policies/:id', (req, res) => {
  const policy = getPolicy(req.params.id);

  if (!policy) {
    return res.status(404).json({ error: 'Policy not found.' });
  }

  return res.json({ policy });
});

// Repair a stale policy resolution (admin / one-time repair endpoint).
// Accepts the four resolution fields and writes them atomically.
// Use this to reconcile an existing record when the in-memory dispute state
// was lost (e.g. after a server restart) but the correct decision is known.
app.patch('/api/policies/:id/resolution', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid policy ID.' });
  }

  const { status, oracleStatus, disputeId, auditId } = req.body;

  const VALID_STATUSES    = ['ACTIVE', 'PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'CANCELLED'];
  const VALID_ORACLE_STATUSES = [
    'NOT_EVALUATED', 'TRIGGER_APPROVED', 'SAFE',
    'DISPUTE_FLAGGED', 'DISPUTE_APPROVED_MANUALLY', 'DISPUTE_REJECTED_MANUALLY',
    'INSUFFICIENT_DATA'
  ];

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });
  }
  if (!VALID_ORACLE_STATUSES.includes(oracleStatus)) {
    return res.status(400).json({ error: `Invalid oracleStatus. Allowed: ${VALID_ORACLE_STATUSES.join(', ')}` });
  }

  try {
    const existing = getPolicy(id);
    if (!existing) {
      return res.status(404).json({ error: 'Policy not found.' });
    }

    const repaired = updatePolicyResolution(id, {
      status,
      oracleStatus,
      disputeId: disputeId ?? existing.disputeId,   // preserve if not supplied
      auditId:   auditId   ?? existing.auditId
    });

    return res.json({
      message: 'Policy resolution fields updated.',
      policy: repaired
    });
  } catch (error) {
    console.error('Policy repair failed:', error);
    return res.status(500).json({ error: 'Could not repair policy record.' });
  }
});

// Create a simulated policy
app.post('/api/policies', (req, res) => {
  const {
    plotId,
    location,
    coverageAmount,
    premiumAmount,
    triggerThreshold,
    quoteHash,
    latitude,
    longitude
  } = req.body;
  const hasCoordinates = latitude != null || longitude != null;
  const validCoordinates = !hasCoordinates || (
    latitude != null && longitude != null &&
    Number.isFinite(Number(latitude)) && Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number.isFinite(Number(longitude)) && Number(longitude) >= -180 && Number(longitude) <= 180
  );

  if (
    plotId === undefined ||
    !String(plotId).trim() ||
    !location?.trim() ||
    !Number.isFinite(Number(coverageAmount)) ||
    Number(coverageAmount) <= 0 ||
    !Number.isFinite(Number(premiumAmount)) ||
    Number(premiumAmount) <= 0 ||
    !Number.isFinite(Number(triggerThreshold)) ||
    Number(triggerThreshold) < 0 ||
    !validCoordinates
  ) {
    return res.status(400).json({
      error: 'Provide a plot ID, location, positive coverage and premium, and a valid rainfall threshold.'
    });
  }

  try {
    // Extract farmer ID from auth header if present (optional — anonymous creation still allowed)
    let farmerId = null;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token && process.env.JWT_SECRET) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        farmerId = decoded.id || null;
      } catch { /* token invalid or expired — proceed without farmer binding */ }
    }

    const policy = createPolicy({
      plotId,
      location: location.trim(),
      coverageAmount,
      premiumAmount,
      triggerThreshold,
      quoteHash,
      farmerId,
      latitude,
      longitude
    });

    return res.status(201).json({
      message: 'Simulated policy created. No blockchain transaction or payment occurred.',
      simulated: true,
      policy
    });
  } catch (error) {
    console.error('Failed to create policy:', error);
    return res.status(500).json({ error: 'Could not create policy.' });
  }
});

// Initialize Blockchain connection (will fallback to dry-run if node unavailable)
initializeBridge();

// --- 0. AI RISK PRICING QUOTE ENDPOINT ---
app.post('/api/pricing/quote', async (req, res) => {
  try {
    const quote = await fetchPricingQuote(req.body);
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute pricing quote', details: error.message });
  }
});

// --- 1. ORACLE EVALUATION ENDPOINT ---
app.post('/api/oracle/evaluate', async (req, res) => {
  const { policyId, plotId, triggerThreshold, toleranceThreshold } = req.body;

  if (policyId === undefined || !plotId || triggerThreshold === undefined) {
    return res.status(400).json({
      error: 'Missing required parameters: policyId, plotId, triggerThreshold'
    });
  }

  try {
    // Use the saved policy location so readings are tied to the farmer's chosen plot.
    const policy = getPolicy(policyId);
    if (!policy) return res.status(404).json({ error: 'Policy not found.' });
    const readings = await fetchMultiSourceReadings(plotId, policy.location);

    // Step B: Consensus & Dispute Evaluation
    const evalResult = evaluateReadings(readings, triggerThreshold, toleranceThreshold);

    let txResult = null;
    let disputeRecord = null;

    if (evalResult.status === 'TRIGGER_APPROVED') {
      // Step C: Trigger smart contract payout
      txResult = await recordOracleTrigger(policyId, evalResult.averageReading);
    } else if (evalResult.status === 'DISPUTE_FLAGGED') {
      // Step D: Flag policy into dispute window
      disputeRecord = flagDispute(policyId, plotId, evalResult);
    }

    // Step E: Create cryptographic audit trail
    const auditEntry = createAuditEntry(
      policyId,
      plotId,
      evalResult,
      txResult?.transactionHash || null
    );

    // Synchronize the shared policy record with the oracle result.
    updatePolicyEvaluation(policyId, {
      oracleStatus: evalResult.status,
      disputeId: disputeRecord?.disputeId || null,
      auditId: auditEntry.auditId
    });

    return res.json({
      policyId,
      plotId,
      status: evalResult.status,
      averageReading: evalResult.averageReading,
      difference: evalResult.difference,
      toleranceThreshold: evalResult.toleranceThreshold,
      triggerThreshold,
      readings,
      reason: evalResult.reason,
      disputeId: disputeRecord?.disputeId || null,
      transactionHash: txResult?.transactionHash || null,
      simulatedTransaction: txResult?.simulated || false,
      auditId: auditEntry.auditId,
      auditHash: auditEntry.auditHash
    });

  } catch (error) {
    console.error('Oracle Evaluation Error:', error);
    res.status(500).json({ error: 'Oracle evaluation failed', details: error.message });
  }
});

// --- 2. MULTI-SOURCE FEEDS ENDPOINT ---
app.get('/api/oracle/feeds/:plotId', async (req, res) => {
  try {
    const readings = await fetchMultiSourceReadings(req.params.plotId, req.query.location);
    res.json({ plotId: req.params.plotId, readings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch oracle feeds' });
  }
});

// --- 3. DISPUTES ENDPOINTS ---
app.get('/api/oracle/disputes', (req, res) => {
  res.json({ disputes: getAllDisputes() });
});

app.post('/api/oracle/disputes/resolve', async (req, res) => {
  const { policyId, decision, overrideValue, operatorNotes } = req.body;

  if (policyId === undefined || !decision || overrideValue === undefined) {
    return res.status(400).json({
      error: 'Missing required parameters: policyId, decision, overrideValue'
    });
  }

  try {
    const dispute = resolveDispute(policyId, decision, overrideValue, operatorNotes);
    const resolvedStatus =
      decision === 'APPROVE_PAYOUT'
        ? 'PAYOUT_APPROVED'
        : 'PAYOUT_REJECTED';
    const resolvedOracleStatus =
      decision === 'APPROVE_PAYOUT'
        ? 'DISPUTE_APPROVED_MANUALLY'
        : 'DISPUTE_REJECTED_MANUALLY';

    let txResult = null;

    if (decision === 'APPROVE_PAYOUT') {
      txResult = await recordOracleTrigger(policyId, overrideValue);
    }

    // Create the resolution audit entry BEFORE writing to the policy store.
    // If audit creation fails we surface an error immediately rather than
    // storing a null auditId in the policy record and falsely claiming a
    // valid audit trail exists.
    let auditEntry;
    try {
      auditEntry = createAuditEntry(
        policyId,
        dispute.plotId,
        {
          status: resolvedOracleStatus,
          averageReading: overrideValue,
          difference: dispute.evaluationResult.difference,
          toleranceThreshold: dispute.evaluationResult.toleranceThreshold,
          readings: dispute.evaluationResult.readings
        },
        txResult?.transactionHash || null
      );
    } catch (auditErr) {
      console.error('Audit creation failed during dispute resolution:', auditErr);
      return res.status(500).json({
        error: 'Dispute was resolved but the audit entry could not be created. Policy record was not updated.',
        details: auditErr.message
      });
    }

    // Atomically write all four resolution fields to the policy record only
    // after the audit entry has been successfully stored in memory.
    updatePolicyResolution(policyId, {
      status:        resolvedStatus,
      oracleStatus:  resolvedOracleStatus,
      disputeId:     dispute.disputeId,
      auditId:       auditEntry.auditId
    });

    res.json({
      message: 'Dispute resolved successfully',
      dispute,
      transactionHash: txResult?.transactionHash || null,
      auditId: auditEntry.auditId,
      auditHash: auditEntry.auditHash
    });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- 4. AUDIT TRAIL ENDPOINTS ---
// Issue 2 fix: register the static /policy/:policyId segment BEFORE the
// wildcard /:auditId route.  Express matches routes top-to-bottom, so placing
// the wildcard first caused the literal string "policy" to be treated as an
// audit ID, making every policy-audit lookup return 404.
app.get('/api/oracle/audit/policy/:policyId', (req, res) => {
  const logs = getPolicyAuditLogs(req.params.policyId);
  res.json({ policyId: req.params.policyId, logs });
});

app.get('/api/oracle/audit/:auditId', (req, res) => {
  const verification = verifyAuditHash(req.params.auditId);
  if (!verification.payload && !verification.valid) {
    return res.status(404).json({ error: 'Audit record not found' });
  }
  res.json(verification);
});

// --- 5. TEST SCENARIO HELPER ENDPOINT ---
app.post('/api/test/set-scenario', (req, res) => {
  const { plotId, scenario, customValues } = req.body;
  if (!plotId || !scenario) {
    return res.status(400).json({ error: 'plotId and scenario required' });
  }
  setPlotScenario(plotId, scenario, customValues);
  res.json({ message: `Scenario ${scenario} set for plot ${plotId}` });
});

app.post('/api/test/clear-scenario', (req, res) => {
  const { plotId } = req.body;
  clearPlotScenario(plotId);
  res.json({ message: `Scenario cleared for plot ${plotId}` });
});

// Export app for testing & start server if called directly
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌾 SecureHarvest Oracle Aggregator & Dispute Service listening on port ${PORT}`);
  });
}

module.exports = app;
