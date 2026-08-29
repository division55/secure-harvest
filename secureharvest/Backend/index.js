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

const app = express();
app.use(express.json());

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
    // Step A: Fetch multi-source data feeds (NOAA Rainfall + Satellite NDVI)
    const readings = await fetchMultiSourceReadings(plotId);

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
    const readings = await fetchMultiSourceReadings(req.params.plotId);
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
    let txResult = null;

    if (decision === 'APPROVE_PAYOUT') {
      txResult = await recordOracleTrigger(policyId, overrideValue);
    }

    const auditEntry = createAuditEntry(
      policyId,
      dispute.plotId,
      {
        status: decision === 'APPROVE_PAYOUT' ? 'DISPUTE_APPROVED_MANUALLY' : 'DISPUTE_REJECTED_MANUALLY',
        averageReading: overrideValue,
        difference: dispute.evaluationResult.difference,
        toleranceThreshold: dispute.evaluationResult.toleranceThreshold,
        readings: dispute.evaluationResult.readings
      },
      txResult?.transactionHash || null
    );

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
app.get('/api/oracle/audit/:auditId', (req, res) => {
  const verification = verifyAuditHash(req.params.auditId);
  if (!verification.payload && !verification.valid) {
    return res.status(404).json({ error: 'Audit record not found' });
  }
  res.json(verification);
});

app.get('/api/oracle/audit/policy/:policyId', (req, res) => {
  const logs = getPolicyAuditLogs(req.params.policyId);
  res.json({ policyId: req.params.policyId, logs });
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