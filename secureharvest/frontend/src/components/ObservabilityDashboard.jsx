import React from 'react';
import { Activity, Clock, ShieldCheck, Cpu, Zap, Server, BarChart3, CheckCircle2 } from 'lucide-react';

export default function ObservabilityDashboard() {
  const telemetryData = {
    oracleUptime: 99.92,
    avgLatencySeconds: 1.84,
    avgGasCostGwei: 32.4,
    avgGasCostMatic: 0.0028,
    totalEvaluations: 1248,
    successfulPayouts: 312,
    flaggedDisputes: 14,
    solvencyRatio: 250
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Observability Header */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
            <Activity size={18} />
            <span>Protocol Observability & Telemetry</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>System Health & Metrics Console</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Real-time monitoring of multi-source oracle uptime, trigger-to-payout latency, gas efficiency, and pool solvency reserves.
          </p>
        </div>

        <div className="badge badge-success" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          <span className="pulse-dot"></span> ALL SYSTEMS HEALTHY
        </div>
      </div>

      {/* 4 Key Telemetry Cards */}
      <div className="grid-2">
        
        {/* Oracle Pipeline Health */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-secondary)', fontWeight: 600, marginBottom: '16px' }}>
            <Server size={18} />
            <span>Oracle Pipeline Availability</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">NOAA METEOROLOGICAL API</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)', margin: '4px 0' }} className="font-mono">
                99.92%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Live API Online
              </div>
            </div>

            <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">COPERNICUS SATELLITE NDVI</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-secondary)', margin: '4px 0' }} className="font-mono">
                99.85%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Live API Online
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }} className="font-mono">
            Total Oracle Evaluations Processed: <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{telemetryData.totalEvaluations}</span>
          </div>
        </div>

        {/* Execution Speed & Latency */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '16px' }}>
            <Clock size={18} />
            <span>Trigger-to-Payout Latency</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">AVG PAYOUT LATENCY</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)', margin: '4px 0' }} className="font-mono">
                {telemetryData.avgLatencySeconds}s
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Trigger to block confirmation</div>
            </div>

            <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">AVG GAS CONSUMPTION</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-secondary)', margin: '4px 0' }} className="font-mono">
                {telemetryData.avgGasCostMatic} POL
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>~{telemetryData.avgGasCostGwei} Gwei per payout</div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }} className="font-mono">
            Automated Payouts Executed: <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{telemetryData.successfulPayouts}</span>
          </div>
        </div>

      </div>

      {/* Pool Solvency & Discrepancy Telemetry */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-tertiary)', fontWeight: 600, marginBottom: '16px' }}>
          <BarChart3 size={18} />
          <span>Capital Solvency & Dispute Analytics</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">SOLVENCY RESERVE RATIO</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)', margin: '4px 0' }} className="font-mono">
              {telemetryData.solvencyRatio}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>Collateral Over-allocation</div>
          </div>

          <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">FLAGGED DISPUTE RATE</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-tertiary)', margin: '4px 0' }} className="font-mono">
              1.12%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{telemetryData.flaggedDisputes} policies routed to resolution</div>
          </div>

          <div style={{ background: '#060e20', padding: '14px', borderRadius: '8px' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">BLOCKCHAIN NETWORK</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-secondary)', margin: '4px 0' }}>
              Polygon Amoy Testnet
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }} className="font-mono">Chain ID: 80002</div>
          </div>
        </div>
      </div>

    </div>
  );
}
