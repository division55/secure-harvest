/**
 * Automated Test Suite for SecureHarvest Oracle Aggregator & Dispute Engine
 */

const assert = require('assert');
const http = require('http');
const app = require('../index');

const PORT = 3099;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          : {}
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ statusCode: res.statusCode, body: json });
          } catch (err) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting SecureHarvest Oracle & Dispute Engine Tests...\n');

  server = app.listen(PORT);
  let passed = 0;
  let failed = 0;

  async function test(description, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // Test 0: AI Risk Pricing Quote
    await test('Computes plot-specific AI pricing quote and basis risk score', async () => {
      const res = await request('POST', '/api/pricing/quote', {
        plotId: 'plot-alpha',
        coverageAmount: 1.0,
        triggerThreshold: 50.0,
        historicalRainfallMean: 40.0
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.plotId, 'plot-alpha');
      assert.ok(res.body.recommendedPremium > 0);
      assert.ok(res.body.basisRisk.basis_risk_score > 0);
      assert.ok(res.body.quoteHash.startsWith('0x'));
    });

    // Test 1: Fetch multi-source feeds
    await test('Fetches readings from NOAA and Satellite NDVI feeds', async () => {
      const res = await request('GET', '/api/oracle/feeds/plot-101');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.readings.length, 2);
      assert.strictEqual(res.body.readings[0].source, 'NOAA_RAINFALL');
      assert.strictEqual(res.body.readings[1].source, 'SATELLITE_NDVI');
    });

    // Test 2: Consensus trigger approval (Agree Breach)
    await test('Triggers payout approval when sources agree below threshold', async () => {
      await request('POST', '/api/test/set-scenario', {
        plotId: 'plot-breach',
        scenario: 'AGREE_BREACH'
      });

      const res = await request('POST', '/api/oracle/evaluate', {
        policyId: 1,
        plotId: 'plot-breach',
        triggerThreshold: 50,
        toleranceThreshold: 10
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'TRIGGER_APPROVED');
      assert.ok(res.body.averageReading <= 50);
      assert.ok(res.body.auditHash.startsWith('0x'));
      assert.ok(res.body.transactionHash);
    });

    // Test 3: Consensus safe (Agree Safe)
    await test('Returns SAFE status when sources agree rainfall is above threshold', async () => {
      await request('POST', '/api/test/set-scenario', {
        plotId: 'plot-safe',
        scenario: 'AGREE_SAFE'
      });

      const res = await request('POST', '/api/oracle/evaluate', {
        policyId: 2,
        plotId: 'plot-safe',
        triggerThreshold: 50,
        toleranceThreshold: 10
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'SAFE');
      assert.ok(res.body.averageReading > 50);
      assert.strictEqual(res.body.transactionHash, null);
    });

    // Test 4: Dispute Flagged (Disagreement beyond tolerance)
    await test('Flags policy for dispute when sources disagree beyond tolerance', async () => {
      await request('POST', '/api/test/set-scenario', {
        plotId: 'plot-dispute',
        scenario: 'DISAGREE_DISPUTE'
      });

      const res = await request('POST', '/api/oracle/evaluate', {
        policyId: 3,
        plotId: 'plot-dispute',
        triggerThreshold: 50,
        toleranceThreshold: 10
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'DISPUTE_FLAGGED');
      assert.ok(res.body.disputeId.startsWith('DSP-'));
      assert.ok(res.body.difference > 10);

      // Verify dispute appears in disputes list
      const disputeRes = await request('GET', '/api/oracle/disputes');
      assert.strictEqual(disputeRes.statusCode, 200);
      assert.ok(disputeRes.body.disputes.some((d) => d.policyId === 3));
    });

    // Test 5: Manual Dispute Resolution
    await test('Allows manual operator resolution of flagged dispute', async () => {
      const res = await request('POST', '/api/oracle/disputes/resolve', {
        policyId: 3,
        decision: 'APPROVE_PAYOUT',
        overrideValue: 30,
        operatorNotes: 'Verified via regional field station report.'
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.dispute.status, 'RESOLVED');
      assert.ok(res.body.transactionHash);
      assert.ok(res.body.auditHash.startsWith('0x'));
    });

    // Test 6: Cryptographic Audit Trail Verification
    await test('Reconstructs and cryptographically verifies audit log', async () => {
      const evalRes = await request('POST', '/api/oracle/evaluate', {
        policyId: 4,
        plotId: 'plot-audit-test',
        triggerThreshold: 50
      });

      const auditId = evalRes.body.auditId;
      const verifyRes = await request('GET', `/api/oracle/audit/${auditId}`);

      assert.strictEqual(verifyRes.statusCode, 200);
      assert.strictEqual(verifyRes.body.valid, true);
      assert.strictEqual(verifyRes.body.storedHash, evalRes.body.auditHash);
    });

  } finally {
    server.close();
  }

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
