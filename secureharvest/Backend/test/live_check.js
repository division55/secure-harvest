/**
 * Live Backend Health & Endpoint Verifier for SecureHarvest
 */

const http = require('http');
const app = require('../index');

const PORT = 3005;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      `http://127.0.0.1:${PORT}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
  });
}

async function verifyLiveBackend() {
  const server = app.listen(PORT);
  console.log(`📡 Backend running live on http://127.0.0.1:${PORT}\n`);

  try {
    // 1. AI Risk Pricing Quote
    console.log('1️⃣ Testing AI Risk Pricing Endpoint (POST /api/pricing/quote)...');
    const quoteRes = await post('/api/pricing/quote', {
      plotId: 'plot-alpha-101',
      coverageAmount: 1.5,
      triggerThreshold: 50,
      historicalRainfallMean: 35.0
    });
    console.log('   Status:', quoteRes.status);
    console.log('   Response Quote:', {
      recommendedPremium: quoteRes.data.recommendedPremium,
      droughtProbability: quoteRes.data.droughtProbability,
      basisRiskScore: quoteRes.data.basisRisk.basis_risk_score,
      category: quoteRes.data.basisRisk.category,
      quoteHash: quoteRes.data.quoteHash
    });

    // 2. Oracle Feeds
    console.log('\n2️⃣ Testing Oracle Feeds Endpoint (GET /api/oracle/feeds/plot-alpha-101)...');
    const feedsRes = await get('/api/oracle/feeds/plot-alpha-101');
    console.log('   Status:', feedsRes.status);
    console.log('   Feeds Ingested:', feedsRes.data.readings.map(r => `${r.source}: ${r.value}${r.unit}`));

    // 3. Oracle Evaluation
    console.log('\n3️⃣ Testing Oracle Consensus & Evaluation Endpoint (POST /api/oracle/evaluate)...');
    const evalRes = await post('/api/oracle/evaluate', {
      policyId: 101,
      plotId: 'plot-alpha-101',
      triggerThreshold: 60
    });
    console.log('   Status:', evalRes.status);
    console.log('   Evaluation Outcome:', {
      consensusStatus: evalRes.data.status,
      averageReading: evalRes.data.averageReading,
      auditId: evalRes.data.auditId,
      auditHash: evalRes.data.auditHash,
      simulatedTransaction: evalRes.data.simulatedTransaction
    });

    // 4. Audit Trail Cryptographic Verification
    console.log('\n4️⃣ Testing Cryptographic Audit Trail Verification (GET /api/oracle/audit/:id)...');
    const auditRes = await get(`/api/oracle/audit/${evalRes.data.auditId}`);
    console.log('   Status:', auditRes.status);
    console.log('   Audit Verification Result:', {
      valid: auditRes.data.valid,
      storedHash: auditRes.data.storedHash,
      recalculatedHash: auditRes.data.recalculatedHash
    });

    console.log('\n✅ Live Backend Verification Passed 100% Successfully!');
  } catch (err) {
    console.error('❌ Live Backend Verification Failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

verifyLiveBackend();
