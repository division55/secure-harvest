import React, { useEffect, useState } from 'react';

export default function DisputeConsole() {
  const [disputes, setDisputes] = useState([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [disputeError, setDisputeError] = useState('');
  const [selectedDispute, setSelectedDispute] = useState(null);

  const [overrideValue, setOverrideValue] = useState('30');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolutionResult, setResolutionResult] = useState(null);
  const [resolutionError, setResolutionError] = useState('');

  const [searchAuditId, setSearchAuditId] = useState('');
  const [auditResult, setAuditResult] = useState(null);
  const [searchingAudit, setSearchingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [policyAuditId, setPolicyAuditId] = useState('');
  const [policyAuditLogs, setPolicyAuditLogs] = useState([]);
  const [policyAuditError, setPolicyAuditError] = useState('');
  const [loadingPolicyAudit, setLoadingPolicyAudit] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    setLoadingDisputes(true);
    setDisputeError('');

    try {
      const res = await fetch('/api/oracle/disputes');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to retrieve disputes.');
      }

      const items = data.disputes || [];
      setDisputes(items);

      if (selectedDispute) {
        const updated = items.find(
          (item) => item.disputeId === selectedDispute.disputeId
        );
        if (updated) setSelectedDispute(updated);
      }
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
      setDisputeError(err.message || 'Unable to retrieve disputes.');
    } finally {
      setLoadingDisputes(false);
    }
  };

  const handleResolve = async (decision) => {
    if (!selectedDispute) return;

    if (!Number.isFinite(Number(overrideValue)) || Number(overrideValue) < 0) {
      setResolutionError('Enter a valid non-negative rainfall value.');
      return;
    }

    setResolving(true);
    setResolutionError('');
    setResolutionResult(null);

    try {
      const res = await fetch('/api/oracle/disputes/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: selectedDispute.policyId,
          decision,
          overrideValue: Number(overrideValue),
          operatorNotes: operatorNotes.trim() ||
            'Manual review requested through the demo console.'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to resolve dispute.');
      }

      setResolutionResult(data);
      await fetchDisputes();
    } catch (err) {
      console.error('Failed to resolve dispute:', err);
      setResolutionError(err.message || 'Unable to resolve dispute.');
    } finally {
      setResolving(false);
    }
  };

  const handleInspectAudit = async (event) => {
    event.preventDefault();

    if (!searchAuditId.trim()) {
      setAuditError('Enter an audit ID.');
      return;
    }

    setSearchingAudit(true);
    setAuditError('');
    setAuditResult(null);

    try {
      const res = await fetch(
        `/api/oracle/audit/${encodeURIComponent(searchAuditId.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to inspect this audit record.');
      }

      setAuditResult(data);
    } catch (err) {
      console.error('Failed to inspect audit:', err);
      setAuditError(err.message || 'Unable to inspect this audit record.');
    } finally {
      setSearchingAudit(false);
    }
  };

  const handleLoadPolicyAudit = async (event) => {
    event.preventDefault();
    if (!policyAuditId.trim()) {
      setPolicyAuditError('Enter a policy ID to load its audit history.');
      return;
    }
    setLoadingPolicyAudit(true);
    setPolicyAuditError('');
    setPolicyAuditLogs([]);
    try {
      const res = await fetch(`/api/oracle/audit/policy/${encodeURIComponent(policyAuditId.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load policy audit history.');
      setPolicyAuditLogs(data.logs || []);
      if (!data.logs?.length) setPolicyAuditError('No audit evaluations are stored for this policy yet.');
    } catch (err) {
      setPolicyAuditError(err.message || 'Unable to load policy audit history.');
    } finally {
      setLoadingPolicyAudit(false);
    }
  };

  const exportPolicyAudit = () => {
    const blob = new Blob([JSON.stringify(policyAuditLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `secureharvest-policy-${policyAuditId}-audit.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dispute-page">
      <section className="dispute-intro">
        <div>
          <p className="section-kicker">POLICY GOVERNANCE</p>
          <h2>Disputes and audit</h2>
          <p className="section-description">
            Review oracle disagreements, record a manual decision, and inspect
            the audit information returned by the backend.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={fetchDisputes}
          disabled={loadingDisputes}
        >
          {loadingDisputes ? 'Refreshing...' : 'Refresh disputes'}
        </button>
      </section>

      {disputeError && (
        <p className="inline-error" role="alert">{disputeError}</p>
      )}

      <div className="dispute-main-grid">
        <section className="dispute-list-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">REVIEW QUEUE</p>
              <h3>Flagged disputes</h3>
            </div>
            <span className="dispute-count">{disputes.length}</span>
          </div>

          {loadingDisputes && disputes.length === 0 && (
            <p className="empty-state">Loading dispute records...</p>
          )}

          {!loadingDisputes && !disputeError && disputes.length === 0 && (
            <div className="dispute-empty-state">
              <strong>No dispute records returned</strong>
              <p>
                The backend currently reports no flagged disputes. This does
                not independently establish that all oracle feeds agree.
              </p>
            </div>
          )}

          {disputes.length > 0 && (
            <div className="dispute-list">
              {disputes.map((dispute) => (
                <button
                  key={dispute.disputeId}
                  type="button"
                  className={`dispute-item ${
                    selectedDispute?.disputeId === dispute.disputeId
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedDispute(dispute);
                    setResolutionResult(null);
                    setResolutionError('');
                    setOverrideValue(
                      String(dispute.evaluationResult?.averageReading ?? 30)
                    );
                  }}
                >
                  <span className="dispute-item-top">
                    <strong>Policy #{dispute.policyId}</strong>
                    <span
                      className={`text-status ${
                        dispute.status === 'OPEN' ? 'status-open' : 'status-ready'
                      }`}
                    >
                      {dispute.status || 'UNKNOWN'}
                    </span>
                  </span>

                  <span className="dispute-plot">
                    Plot: {dispute.plotId || 'Not specified'}
                  </span>

                  <span className="dispute-difference">
                    Difference: {dispute.evaluationResult?.difference ?? '—'} mm
                  </span>

                  <span className="dispute-item-action">
                    {selectedDispute?.disputeId === dispute.disputeId
                      ? 'Selected'
                      : 'Review record'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="dispute-resolution-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">MANUAL REVIEW</p>
              <h3>Resolution details</h3>
            </div>
          </div>

          {!selectedDispute ? (
            <div className="dispute-empty-state">
              <strong>Select a dispute</strong>
              <p>
                Choose a record from the review queue to inspect its reason
                and submit a resolution decision.
              </p>
            </div>
          ) : (
            <div className="resolution-form">
              <div className="resolution-summary">
                <div className="resolution-summary-row">
                  <span>Dispute ID</span>
                  <strong>{selectedDispute.disputeId}</strong>
                </div>
                <div className="resolution-summary-row">
                  <span>Policy</span>
                  <strong>#{selectedDispute.policyId}</strong>
                </div>
                <div className="resolution-summary-row">
                  <span>Feed difference</span>
                  <strong>
                    {selectedDispute.evaluationResult?.difference ?? '—'} mm
                  </strong>
                </div>
              </div>

              <div className="resolution-reason">
                <span className="metric-label">Reported reason</span>
                <p>
                  {selectedDispute.evaluationResult?.reason ||
                    'No reason was included in the dispute response.'}
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="override-rainfall">
                  Reviewed rainfall value (mm)
                </label>
                <input
                  id="override-rainfall"
                  className="form-control"
                  type="number"
                  min="0"
                  step="any"
                  value={overrideValue}
                  onChange={(event) => setOverrideValue(event.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="operator-notes">Review notes</label>
                <textarea
                  id="operator-notes"
                  className="form-control dispute-notes"
                  value={operatorNotes}
                  onChange={(event) => setOperatorNotes(event.target.value)}
                  placeholder="Record the reason for your decision."
                  rows={3}
                />
              </div>

              <div className="resolution-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleResolve('APPROVE_PAYOUT')}
                  disabled={resolving || selectedDispute.status !== 'OPEN'}
                >
                  {resolving ? 'Submitting...' : 'Approve payout'}
                </button>

                <button
                  type="button"
                  className="btn-secondary reject-button"
                  onClick={() => handleResolve('REJECT_PAYOUT')}
                  disabled={resolving || selectedDispute.status !== 'OPEN'}
                >
                  Reject payout
                </button>
              </div>

              {selectedDispute.status !== 'OPEN' && (
                <p className="field-help">
                  This record is not marked OPEN by the backend.
                </p>
              )}

              {resolutionError && (
                <p className="inline-error" role="alert">{resolutionError}</p>
              )}

              {resolutionResult && (
                <div className="resolution-result" role="status">
                  <strong>Resolution response received</strong>
                  <p>
                    The backend accepted the resolution request. This message
                    alone does not prove an on-chain payout occurred.
                  </p>
                  {resolutionResult.auditId && (
                    <div className="resolution-audit-id">
                      Audit ID: {resolutionResult.auditId}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="audit-history-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">POLICY HISTORY</p>
            <h3>Audit timeline</h3>
            <p className="section-description">Load every recorded evaluation for one policy, inspect the readings and outcome, and export the records for review.</p>
          </div>
        </div>
        <form className="audit-search-form" onSubmit={handleLoadPolicyAudit}>
          <div className="form-field">
            <label htmlFor="policy-audit-id">Policy ID</label>
            <input id="policy-audit-id" type="number" min="1" className="form-control" value={policyAuditId} onChange={(event) => setPolicyAuditId(event.target.value)} placeholder="For example, 1" />
          </div>
          <button type="submit" className="btn-primary" disabled={loadingPolicyAudit}>{loadingPolicyAudit ? 'Loading history...' : 'Load timeline'}</button>
          {policyAuditLogs.length > 0 && <button type="button" className="btn-secondary" onClick={exportPolicyAudit}>Export JSON</button>}
        </form>
        {policyAuditError && <p className={policyAuditLogs.length ? 'field-help' : 'inline-error'} role="status">{policyAuditError}</p>}
        {policyAuditLogs.length > 0 && (
          <div className="audit-timeline">
            {policyAuditLogs.slice().reverse().map((log) => (
              <article className="audit-timeline-item" key={log.auditId}>
                <div className="audit-timeline-top"><strong>{log.status}</strong><span>{new Date(log.timestamp * 1000).toLocaleString()}</span></div>
                <p>Rainfall used: {log.averageReading ?? 'Unavailable'} mm · Plot {log.plotId}</p>
                <code>{log.auditHash}</code>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="audit-inspector-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">RECORD VERIFICATION</p>
            <h3>Audit inspector</h3>
            <p className="section-description">
              Retrieve a stored audit record and inspect the verification
              result returned by the backend.
            </p>
          </div>
        </div>

        <form className="audit-search-form" onSubmit={handleInspectAudit}>
          <div className="form-field">
            <label htmlFor="audit-id-search">Audit ID</label>
            <input
              id="audit-id-search"
              type="text"
              className="form-control"
              value={searchAuditId}
              onChange={(event) => setSearchAuditId(event.target.value)}
              placeholder="Enter an audit ID"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={searchingAudit}
          >
            {searchingAudit ? 'Inspecting...' : 'Inspect record'}
          </button>
        </form>

        {auditError && (
          <p className="inline-error" role="alert">{auditError}</p>
        )}

        {auditResult && (
          <div className="audit-inspection-result">
            <div className="audit-result-status">
              <span className="metric-label">Verification result</span>
              <strong className={
                auditResult.valid ? 'audit-valid' : 'audit-invalid'
              }>
                {auditResult.valid ? 'Valid' : 'Invalid'}
              </strong>
            </div>

            <div className="audit-hash-field">
              <span className="metric-label">Stored hash</span>
              <code>{auditResult.storedHash || 'Not provided'}</code>
            </div>

            <div className="audit-hash-field">
              <span className="metric-label">Recalculated hash</span>
              <code>{auditResult.recalculatedHash || 'Not provided'}</code>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
