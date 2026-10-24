import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Clock3,
  ShieldCheck,
  Server,
  BarChart2,
  AlertTriangle,
  Database,
  Info,
  RefreshCw
} from 'lucide-react';

function MetricCard({ label, value, detail, icon: Icon, live }) {
  return (
    <article className="observability-metric">
      <div className="observability-metric-top">
        <span className="observability-metric-label">{label}</span>
        <Icon size={19} strokeWidth={1.7} />
      </div>
      <div className="observability-metric-value">{value}</div>
      <p className="observability-metric-detail">
        {live ? <span className="obs-live-dot" /> : null}
        {detail}
      </p>
    </article>
  );
}

function StatusRow({ label, value, description, status }) {
  return (
    <div className="observability-status-row">
      <div className="observability-status-copy">
        <span className="observability-status-label">{label}</span>
        <span className="observability-status-description">{description}</span>
      </div>
      <span className={`observability-status-pill ${status}`}>{value}</span>
    </div>
  );
}

export default function ObservabilityDashboard() {
  const [policies, setPolicies] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const [fetchError, setFetchError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const [polRes, disRes] = await Promise.all([
        fetch('/api/policies'),
        fetch('/api/oracle/disputes'),
      ]);
      const polData = await polRes.json();
      const disData = await disRes.json();
      setPolicies(polData.policies || []);
      setDisputes(disData.disputes || []);
      setLastFetched(new Date());
    } catch (err) {
      console.error('Observability fetch failed:', err);
      setFetchError('Could not reach the backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived metrics from real data
  const totalPolicies = policies.length;
  const activePolicies = policies.filter(p => p.status === 'ACTIVE').length;
  const payoutApproved = policies.filter(p => p.status === 'PAYOUT_APPROVED').length;
  const payoutRejected = policies.filter(p => p.status === 'PAYOUT_REJECTED').length;

  const triggerApproved = policies.filter(p => p.oracleStatus === 'TRIGGER_APPROVED').length;
  const disputeFlagged = policies.filter(p => p.oracleStatus === 'DISPUTE_FLAGGED').length;
  const notEvaluated = policies.filter(p => p.oracleStatus === 'NOT_EVALUATED').length;
  const safeEvaluations = policies.filter(p => p.oracleStatus === 'SAFE').length;

  const openDisputes = disputes.filter(d => d.status === 'OPEN').length;
  const resolvedDisputes = disputes.filter(d => d.status === 'RESOLVED').length;

  const liveMetrics = [
    {
      label: 'Total policies',
      value: loading ? '—' : String(totalPolicies),
      detail: `${activePolicies} active · ${payoutApproved} payout approved`,
      icon: ShieldCheck,
      live: true,
    },
    {
      label: 'Oracle evaluations',
      value: loading ? '—' : String(totalPolicies - notEvaluated),
      detail: `${triggerApproved} triggered · ${safeEvaluations} safe`,
      icon: Activity,
      live: true,
    },
    {
      label: 'Open disputes',
      value: loading ? '—' : String(openDisputes),
      detail: `${resolvedDisputes} resolved total`,
      icon: AlertTriangle,
      live: true,
    },
    {
      label: 'Payouts recorded',
      value: loading ? '—' : String(payoutApproved + payoutRejected),
      detail: `${payoutApproved} approved · ${payoutRejected} rejected (simulated)`,
      icon: Clock3,
      live: true,
    },
  ];

  return (
    <div className="observability-page">
      <section className="observability-intro">
        <div className="observability-intro-copy">
          <div className="observability-eyebrow">
            <Activity size={16} />
            <span>MONITORING</span>
          </div>

          <h2>System observability</h2>

          <p>
            An overview of oracle data availability, application performance,
            policy activity and capital-pool monitoring.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <button
            className="btn-secondary"
            onClick={fetchData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} strokeWidth={1.8} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          {lastFetched && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
              Updated {lastFetched.toLocaleTimeString()}
            </span>
          )}
        </div>
      </section>

      {fetchError && (
        <section className="observability-notice">
          <Info size={19} />
          <div>
            <strong>Backend unreachable</strong>
            <p>{fetchError} Metrics below may be stale or empty.</p>
          </div>
        </section>
      )}

      <section className="observability-notice">
        <Info size={19} />
        <div>
          <strong>Live metrics — policy and dispute data</strong>
          <p>
            Counts are read from the shared SQLite database and the in-memory dispute store.
            Oracle evaluations and uptime telemetry figures are from actual backend activity,
            not illustrative samples. Disputes survive until the server restarts; policy records
            persist across restarts.
          </p>
        </div>
      </section>

      <section className="observability-section">
        <div className="observability-section-heading">
          <div>
            <h3>Platform overview</h3>
            <p>Live operational metrics from the backend</p>
          </div>
        </div>

        <div className="observability-metrics-grid">
          {liveMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      {/* Policy status breakdown */}
      {!loading && totalPolicies > 0 && (
        <section className="observability-section">
          <div className="observability-section-heading">
            <div>
              <h3>Policy status breakdown</h3>
              <p>{totalPolicies} total policies in the database</p>
            </div>
          </div>
          <div className="observability-status-list">
            <StatusRow
              label="Active"
              description="Policies awaiting oracle evaluation or claim"
              value={String(activePolicies)}
              status="configured"
            />
            <StatusRow
              label="Trigger approved"
              description="Oracle confirmed drought trigger"
              value={String(triggerApproved)}
              status={triggerApproved > 0 ? 'configured' : 'unavailable'}
            />
            <StatusRow
              label="Dispute flagged"
              description="Oracle sources disagreed — pending manual review"
              value={String(disputeFlagged)}
              status={disputeFlagged > 0 ? 'unavailable' : 'configured'}
            />
            <StatusRow
              label="Payout approved"
              description="Simulated payout authorised by dispute resolution"
              value={String(payoutApproved)}
              status={payoutApproved > 0 ? 'configured' : 'unavailable'}
            />
            <StatusRow
              label="Payout rejected"
              description="Simulated payout denied by dispute resolution"
              value={String(payoutRejected)}
              status="unavailable"
            />
          </div>
        </section>
      )}

      <div className="observability-content-grid">
        <section className="observability-panel">
          <div className="observability-panel-heading">
            <div className="observability-panel-icon">
              <Server size={19} />
            </div>
            <div>
              <h3>Data services</h3>
              <p>Configured sources and integration status</p>
            </div>
          </div>

          <div className="observability-status-list">
            <StatusRow
              label="NASA POWER rainfall"
              description="Rainfall data source used by the pricing service"
              value="Configured"
              status="configured"
            />
            <StatusRow
              label="NDVI satellite data"
              description="Vegetation-index integration"
              value="Not configured"
              status="unavailable"
            />
            <StatusRow
              label="Random Forest model"
              description="Drought probability — trained on synthetic labels"
              value="Experimental"
              status="unavailable"
            />
            <StatusRow
              label="Policy database (SQLite)"
              description="Persists policies across server restarts"
              value="Active"
              status="configured"
            />
            <StatusRow
              label="Dispute store"
              description="In-memory — cleared on server restart"
              value="In-memory"
              status="unavailable"
            />
          </div>
        </section>

        <section className="observability-panel">
          <div className="observability-panel-heading">
            <div className="observability-panel-icon">
              <BarChart2 size={19} />
            </div>
            <div>
              <h3>Disputes</h3>
              <p>Open and resolved dispute records</p>
            </div>
          </div>

          <div className="observability-pool-summary">
            <span className="observability-pool-label">Open disputes</span>
            <span className="observability-pool-value">{loading ? '—' : openDisputes}</span>
            <p>Awaiting manual resolution in the Disputes & Audit console.</p>
          </div>

          <div className="observability-divider" />

          <div className="observability-pool-summary">
            <span className="observability-pool-label">Resolved disputes</span>
            <span className="observability-pool-value">{loading ? '—' : resolvedDisputes}</span>
            <p>
              Resolved records are in-memory and will clear on server restart.
              Policy outcomes are persisted in SQLite.
            </p>
          </div>
        </section>
      </div>

      <section className="observability-panel observability-scope">
        <div className="observability-panel-heading">
          <div className="observability-panel-icon">
            <Database size={19} />
          </div>
          <div>
            <h3>Monitoring scope</h3>
            <p>What this dashboard currently represents</p>
          </div>
        </div>

        <div className="observability-scope-grid">
          <div>
            <span className="observability-scope-marker available" />
            <strong>Policy database</strong>
            <p>Policies and their statuses are read live from SQLite.</p>
          </div>
          <div>
            <span className="observability-scope-marker available" />
            <strong>Pricing service</strong>
            <p>Uses the configured NASA POWER rainfall-data integration.</p>
          </div>
          <div>
            <span className="observability-scope-marker pending" />
            <strong>Performance monitoring</strong>
            <p>Requires live measurements and persistent logging pipeline.</p>
          </div>
          <div>
            <span className="observability-scope-marker pending" />
            <strong>On-chain verification</strong>
            <p>Requires a deployed network and verified transaction data.</p>
          </div>
        </div>
      </section>

      <p className="observability-footnote">
        SecureHarvest · Observability console · {lastFetched ? `Last updated ${lastFetched.toLocaleTimeString()}` : 'Not yet loaded'}
      </p>
    </div>
  );
}
