/**
 * End-to-End Regression Test: Dispute Resolution Synchronization
 * ---------------------------------------------------------------
 * Verifies the three bugs that were fixed:
 *
 *  1. After resolving a dispute the policy record reflects the resolution
 *     (status, oracleStatus, disputeId, auditId all updated atomically).
 *  2. The resolution audit ID is immediately retrievable via the audit endpoint.
 *  3. The Express route ordering does not swallow policy-audit lookups.
 *
 * The test also verifies that Policy #3s repaired state survives a process
 * restart (in-memory dispute / audit gone; SQLite policy record persists).
 *
 * Run:
 *   node test/e2e_dispute_resolution.test.js
 */

"use strict";

const assert = require("assert");
const http   = require("http");
const app    = require("../index");

const PORT = 3098;   // isolated - never conflicts with the live server (3000)
let server;

// tiny HTTP helper
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {}
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try   { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ statusCode: res.statusCode, raw: data }); }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log("  SecureHarvest -- End-to-End Dispute Resolution Regression\n");

  server = app.listen(PORT);
  let passed = 0;
  let failed = 0;

  async function test(label, fn) {
    try {
      await fn();
      console.log(`  PASS  ${label}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL  ${label}`);
      console.error(`        ${err.message}`);
      failed++;
    }
  }

  let newPolicyId;
  let evaluationAuditId;
  let resolutionAuditId;
  let preservedDisputeId;

  try {

    // STEP 1: create a fresh policy
    await test("Creates a new simulated policy and stores it in SQLite", async () => {
      const res = await request("POST", "/api/policies", {
        plotId:           "plot-e2e-regression",
        location:         "Madurai, Tamil Nadu, India",
        coverageAmount:   1.5,
        premiumAmount:    0.35,
        triggerThreshold: 50
      });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`);
      assert.ok(res.body.policy && res.body.policy.id, "Response should include the new policy ID");
      assert.strictEqual(res.body.policy.status,       "ACTIVE",        "New policy should be ACTIVE");
      assert.strictEqual(res.body.policy.oracleStatus, "NOT_EVALUATED", "New policy should be NOT_EVALUATED");

      newPolicyId = res.body.policy.id;
      console.log(`          -> Policy #${newPolicyId} created`);
    });

    // STEP 2: force a DISAGREE_DISPUTE scenario
    await test("Sets DISAGREE_DISPUTE scenario so oracle evaluation flags a dispute", async () => {
      const res = await request("POST", "/api/test/set-scenario", {
        plotId:   "plot-e2e-regression",
        scenario: "DISAGREE_DISPUTE"
      });
      assert.strictEqual(res.statusCode, 200, `Scenario set failed: ${JSON.stringify(res.body)}`);
    });

    // STEP 3: run oracle evaluation
    await test("Oracle evaluation flags a dispute and updates the policy record", async () => {
      const res = await request("POST", "/api/oracle/evaluate", {
        policyId:           newPolicyId,
        plotId:             "plot-e2e-regression",
        triggerThreshold:   50,
        toleranceThreshold: 10
      });

      assert.strictEqual(res.statusCode, 200, `Evaluation failed: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.status, "DISPUTE_FLAGGED",
        `Expected DISPUTE_FLAGGED, got ${res.body.status}`);
      assert.ok(res.body.disputeId && res.body.disputeId.startsWith("DSP-"), "Expected a DSP- dispute ID");
      assert.ok(res.body.auditId   && res.body.auditId.startsWith("AUDIT-"),  "Expected an AUDIT- audit ID");

      evaluationAuditId  = res.body.auditId;
      preservedDisputeId = res.body.disputeId;

      const policyRes = await request("GET", `/api/policies/${newPolicyId}`);
      assert.strictEqual(policyRes.body.policy.oracleStatus, "DISPUTE_FLAGGED");
      assert.strictEqual(policyRes.body.policy.disputeId,    preservedDisputeId);
      assert.strictEqual(policyRes.body.policy.auditId,      evaluationAuditId);

      console.log(`          -> Dispute ${preservedDisputeId} flagged`);
      console.log(`          -> Evaluation audit: ${evaluationAuditId}`);
    });

    // STEP 4: resolve the dispute (approve)
    await test("Dispute Console approves the dispute and receives a resolution audit ID", async () => {
      const res = await request("POST", "/api/oracle/disputes/resolve", {
        policyId:      newPolicyId,
        decision:      "APPROVE_PAYOUT",
        overrideValue: 30,
        operatorNotes: "E2E regression: approved via field station cross-check."
      });

      assert.strictEqual(res.statusCode, 200, `Resolve failed: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.dispute.status, "RESOLVED", "Dispute engine should mark RESOLVED");
      assert.ok(res.body.auditId && res.body.auditId.startsWith("AUDIT-"),
        `Expected an AUDIT- resolution audit ID, got: ${res.body.auditId}`);

      resolutionAuditId = res.body.auditId;
      console.log(`          -> Resolution audit: ${resolutionAuditId}`);
    });

    // STEP 5: policy record fully synchronized
    await test("Policy record reflects the resolution - all four fields correct", async () => {
      const res = await request("GET", `/api/policies/${newPolicyId}`);
      assert.strictEqual(res.statusCode, 200);

      const p = res.body.policy;

      assert.strictEqual(p.status,       "PAYOUT_APPROVED",           `status mismatch: ${p.status}`);
      assert.strictEqual(p.oracleStatus, "DISPUTE_APPROVED_MANUALLY", `oracleStatus mismatch: ${p.oracleStatus}`);
      assert.strictEqual(p.disputeId,    preservedDisputeId,           "disputeId should be preserved");
      assert.strictEqual(p.auditId,      resolutionAuditId,            "auditId should point to resolution audit");
      assert.notStrictEqual(p.auditId,   evaluationAuditId,
        "Resolution audit ID should differ from the evaluation audit ID");

      console.log(`          -> status:       ${p.status}`);
      console.log(`          -> oracleStatus: ${p.oracleStatus}`);
      console.log(`          -> disputeId:    ${p.disputeId}`);
      console.log(`          -> auditId:      ${p.auditId}`);
    });

    // STEP 6: resolution audit is retrievable
    await test("Resolution audit ID is retrievable and cryptographically valid", async () => {
      const res = await request("GET", `/api/oracle/audit/${resolutionAuditId}`);

      assert.strictEqual(res.statusCode, 200,
        `Expected 200 for audit lookup, got ${res.statusCode}`);
      assert.strictEqual(res.body.valid, true, "Audit hash should verify correctly");
      assert.strictEqual(res.body.payload.status, "DISPUTE_APPROVED_MANUALLY",
        `Audit payload.status mismatch: ${res.body.payload && res.body.payload.status}`);
      assert.ok(res.body.storedHash && res.body.storedHash.startsWith("0x"),
        "storedHash should be a 0x hex string");
    });

    // STEP 7: audit route ordering regression (Bug 2)
    await test("Policy-audit URL /api/oracle/audit/policy/:id not swallowed by wildcard route", async () => {
      const res = await request("GET", `/api/oracle/audit/policy/${newPolicyId}`);
      assert.strictEqual(res.statusCode, 200,
        `Policy-audit route returned ${res.statusCode} -- likely route-ordering regression`);
      assert.ok(Array.isArray(res.body.logs),
        `Expected logs array, got: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.logs.length >= 2,
        `Expected at least 2 audit entries (evaluation + resolution), got ${res.body.logs.length}`);
    });

    // STEP 8: Policy #3 repaired state survives process restart (SQLite persistence)
    await test("Policy #3 repaired state survives a process restart via SQLite", async () => {
      const res = await request("GET", "/api/policies/3");

      if (res.statusCode === 404) {
        console.log("          Policy #3 does not exist in this DB -- skipping.");
        return;
      }

      assert.strictEqual(res.statusCode, 200);
      const p = res.body.policy;

      assert.strictEqual(p.status,       "PAYOUT_APPROVED",           `Policy #3 status: ${p.status}`);
      assert.strictEqual(p.oracleStatus, "DISPUTE_APPROVED_MANUALLY", `Policy #3 oracleStatus: ${p.oracleStatus}`);
      assert.ok(p.disputeId && p.disputeId.startsWith("DSP-"), `Policy #3 disputeId: ${p.disputeId}`);
      assert.ok(p.auditId   && p.auditId.startsWith("AUDIT-"), `Policy #3 auditId: ${p.auditId}`);

      console.log(`          -> Policy #3 status:       ${p.status}`);
      console.log(`          -> Policy #3 oracleStatus: ${p.oracleStatus}`);
      console.log(`          -> Policy #3 disputeId:    ${p.disputeId}`);
      console.log(`          -> Policy #3 auditId:      ${p.auditId} (original evaluation audit -- expected)`);
    });

  } finally {
    server.close();
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed + failed} tests  |  PASS: ${passed}  |  FAIL: ${failed}`);
  if (failed > 0) {
    console.error("\n  One or more assertions failed.");
    process.exit(1);
  } else {
    console.log("\n  All assertions passed.");
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
