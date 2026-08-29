import React, { useState, useEffect } from 'react';
import { AlertOctagon, Check, X, ShieldAlert, RefreshCw, FileText, Search } from 'lucide-react';

export default function DisputeConsole() {
  const [disputes, setDisputes] = useState([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);

  const [overrideValue, setOverrideValue] = useState('30');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolutionResult, setResolutionResult] = useState(null);

  const [searchAuditId, setSearchAuditId] = useState('');
  const [auditResult, setAuditResult] = useState(null);
  const [searchingAudit, setSearchingAudit] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    setLoadingDisputes(true);
    try {
      const res = await fetch('/api/oracle/disputes');
      const data = await res.json();
      setDisputes(data.disputes || []);
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
    } finally {
      setLoadingDisputes(false);
    }
  };

  const handleResolve = async (decision) => {
    if (!selectedDispute) return;
    setResolving(true);
    try {
      const res = await fetch('/api/oracle/disputes/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: selectedDispute.policyId,
          decision,
          overrideValue: parseFloat(overrideValue) || 30.0,
          operatorNotes: operatorNotes || 'Verified via regional station manual check.'
        })
      });
      const data = await res.json();
      setResolutionResult(data);
      fetchDisputes();
    } catch (err) {
      console.error('Failed to resolve dispute:', err);
    } finally {
      setResolving(false);
    }
  };

  const handleInspectAudit = async () => {
    if (!searchAuditId) return;
    setSearchingAudit(true);
    try {
      const res = await fetch(`/api/oracle/audit/${searchAuditId.trim()}`);
      const data = await res.json();
      setAuditResult(data);
    } catch (err) {
      console.error('Failed to inspect audit:', err);
    } finally {
      setSearchingAudit(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Console Header */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-tertiary)', fontWeight: 600 }}>
            <ShieldAlert size={18} />
            <span>Oracle Dispute Fallback & Audit Console</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>Oracle Disagreement Resolution</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            When NOAA rainfall and Satellite NDVI feeds disagree beyond tolerance (&gt;10mm), payouts are automatically halted and routed here.
          </p>
        </div>

        <button className="btn-secondary" onClick={fetchDisputes} disabled={loadingDisputes}>
          <RefreshCw size={14} className={loadingDisputes ? 'animate-spin' : ''} />
          Refresh Flagged Disputes
        </button>
      </div>

      {/* Grid: Disputes List + Resolution Panel */}
      <div className="grid-2">
        
        {/* Disputes List */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Flagged Policy Disputes</h3>

          {disputes.length === 0 ? (
            <div style={{ background: '#060e20', padding: '20px', borderRadius: '8px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              ✅ No active flagged disputes. Oracle feeds are operating in consensus.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {disputes.map(d => (
                <div 
                  key={d.disputeId}
                  onClick={() => setSelectedDispute(d)}
                  style={{
                    background: selectedDispute?.disputeId === d.disputeId ? 'rgba(6, 182, 212, 0.15)' : '#060e20',
                    border: `1px solid ${selectedDispute?.disputeId === d.disputeId ? 'var(--color-secondary)' : 'var(--color-border)'}`,
                    padding: '14px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>Policy #{d.policyId} ({d.plotId})</span>
                    <span className={`badge ${d.status === 'OPEN' ? 'badge-danger' : 'badge-success'}`}>
                      {d.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }} className="font-mono">
                    Discrepancy: {d.evaluationResult?.difference}mm (Tolerance Limit: {d.evaluationResult?.toleranceThreshold}mm)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resolution Panel */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Manual Resolution Action Window</h3>

          {selectedDispute ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ color: 'var(--color-tertiary)', fontWeight: 600, fontSize: '0.9rem' }}>Dispute Reason:</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {selectedDispute.evaluationResult?.reason}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '6px' }} className="font-mono">
                  OVERRIDE RAINFALL VALUE (MM)
                </label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={overrideValue} 
                  onChange={(e) => setOverrideValue(e.target.value)} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '6px' }} className="font-mono">
                  OPERATOR JUSTIFICATION / NOTES
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={operatorNotes} 
                  onChange={(e) => setOperatorNotes(e.target.value)} 
                  placeholder="e.g. Verified via ground meteorological station report"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleResolve('APPROVE_PAYOUT')} disabled={resolving}>
                  <Check size={16} /> Approve Payout
                </button>
                <button className="btn-secondary" style={{ flex: 1, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleResolve('REJECT_PAYOUT')} disabled={resolving}>
                  <X size={16} /> Reject Payout
                </button>
              </div>

              {resolutionResult && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-primary)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>✅ Dispute Resolved!</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '4px' }} className="font-mono">
                    Audit ID: {resolutionResult.auditId}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Select a flagged dispute from the list to view feed telemetry and issue a manual resolution decision.
            </p>
          )}
        </div>

      </div>

      {/* SHA-256 Audit Trail Inspector */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '16px' }}>
          <FileText size={18} />
          <span>Independent SHA-256 Audit Hash Inspector</span>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Enter Audit ID (e.g. AUDIT-101-1787974939-812)" 
            value={searchAuditId}
            onChange={(e) => setSearchAuditId(e.target.value)}
          />
          <button className="btn-primary" onClick={handleInspectAudit} disabled={searchingAudit}>
            <Search size={16} /> Inspect Hash
          </button>
        </div>

        {auditResult && (
          <div style={{ background: '#060e20', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }} className="font-mono">
            <div style={{ color: auditResult.valid ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 600, marginBottom: '8px' }}>
              Status: {auditResult.valid ? '✅ VALID & RECONSTRUCTED 100%' : '❌ HASH MISMATCH'}
            </div>
            <div>Stored Audit Hash: {auditResult.storedHash}</div>
            <div>Recalculated Hash: {auditResult.recalculatedHash}</div>
          </div>
        )}
      </div>

    </div>
  );
}
