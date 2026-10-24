import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import FarmLocationMap from './FarmLocationMap';
import PolicyTimeline from './PolicyTimeline';

const INVESTOR_TOKEN_KEY = 'sh_investor_token';
const INVESTOR_INFO_KEY = 'sh_investor_info';
const DEMO_POOL_PREFIX = 'sh_investor_pool_';

function InvestorAccess({ onAuthenticated }) {
  const [view, setView] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openDemo = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/investor/demo', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open the demo investor account.');
      onAuthenticated(data.investor, data.token);
    } catch (err) {
      setError(err.message || 'Could not open the demo investor account.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const endpoint = view === 'login' ? '/api/auth/investor/login' : '/api/auth/investor/register';
      const body = view === 'login' ? { email, password } : { name, email, password };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Investor sign in failed.');
      onAuthenticated(data.investor, data.token);
    } catch (err) {
      setError(err.message || 'Investor sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="investor-access-screen">
      <section className="investor-access-card">
        <p className="section-kicker">INVESTOR ACCESS</p>
        <h2>{view === 'login' ? 'Sign in to your investor account' : 'Create an investor account'}</h2>
        <p className="section-description">Review your liquidity position and explore the SecureHarvest policy portfolio.</p>
        <div className="investor-tabs" role="tablist" aria-label="Investor account access">
          <button type="button" role="tab" aria-selected={view === 'login'} className={`investor-tab ${view === 'login' ? 'active' : ''}`} onClick={() => { setView('login'); setError(''); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={view === 'register'} className={`investor-tab ${view === 'register' ? 'active' : ''}`} onClick={() => { setView('register'); setError(''); }}>Register</button>
        </div>
        <form className="investor-access-form" onSubmit={submit}>
          {view === 'register' && <div className="form-field"><label htmlFor="investor-name">Name</label><input id="investor-name" className="form-control" value={name} onChange={(event) => setName(event.target.value)} required /></div>}
          <div className="form-field"><label htmlFor="investor-email">Email</label><input id="investor-email" className="form-control" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="form-field"><label htmlFor="investor-password">Password</label><input id="investor-password" className="form-control" type="password" minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Please wait...' : view === 'login' ? 'Sign in' : 'Create investor account'}</button>
        </form>
        <div className="investor-access-divider"><span>or</span></div>
        <button className="btn-secondary investor-demo-login" type="button" onClick={openDemo} disabled={busy}>{busy ? 'Opening demo...' : 'Open demo investor account'}</button>
        <p className="field-help">You can also connect a wallet from the site header to view an on-chain position.</p>
      </section>
    </div>
  );
}

export default function InvestorPortal({ account, signer, contracts }) {
  const [showInvestorAccess, setShowInvestorAccess] = useState(false);
  const [investorUser, setInvestorUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INVESTOR_INFO_KEY) || 'null'); } catch { return null; }
  });
  const [depositAmount, setDepositAmount] = useState('5.0');
  const [withdrawShares, setWithdrawShares] = useState('2.0');
  const [activeTab, setActiveTab] = useState('deposit');
  const [stressPayouts, setStressPayouts] = useState('0');
  const [exampleDeposit, setExampleDeposit] = useState('1');
  const [examplePremiumRate, setExamplePremiumRate] = useState(8);
  const [exampleClaimRate, setExampleClaimRate] = useState(6);
  const [txMessage, setTxMessage] = useState(null);
  const [txError, setTxError] = useState('');
  const [transacting, setTransacting] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState('');

  const [poolState, setPoolState] = useState({
    poolBalance: 12.5,
    activeExposure: 5.0,
    totalShares: 10.0,
    userShares: 5.0,
    solvencyRatio: 250
  });

  const [poolSource, setPoolSource] = useState('simulation');

  // Real policy metrics from the shared backend database
  const [policyMetrics, setPolicyMetrics] = useState(null);
  const [loadingPolicyMetrics, setLoadingPolicyMetrics] = useState(false);
  const [policyRows, setPolicyRows] = useState([]);
  const [policyFilter, setPolicyFilter] = useState('ALL');
  const [policySearch, setPolicySearch] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);

  const handleInvestorAuthenticated = (investor, token) => {
    localStorage.setItem(INVESTOR_TOKEN_KEY, token);
    localStorage.setItem(INVESTOR_INFO_KEY, JSON.stringify(investor));
    setInvestorUser(investor);
    setShowInvestorAccess(false);
  };

  const handleInvestorLogout = () => {
    localStorage.removeItem(INVESTOR_TOKEN_KEY);
    localStorage.removeItem(INVESTOR_INFO_KEY);
    setInvestorUser(null);
  };

  useEffect(() => {
    if (account || !investorUser) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`${DEMO_POOL_PREFIX}${investorUser.id}`) || 'null');
      if (saved) setPoolState((current) => ({ ...current, ...saved }));
    } catch {
      localStorage.removeItem(`${DEMO_POOL_PREFIX}${investorUser.id}`);
    }
  }, [account, investorUser]);

  const updateDemoPool = (updater) => {
    setPoolState((previous) => {
      const next = updater(previous);
      if (!account && investorUser) {
        localStorage.setItem(`${DEMO_POOL_PREFIX}${investorUser.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const fetchPolicyMetrics = useCallback(async () => {
    setLoadingPolicyMetrics(true);
    try {
      const res = await fetch('/api/policies');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const all = data.policies || [];
      setPolicyRows(all);
      setSelectedPolicyId((current) => current ?? all[0]?.id ?? null);
      const active = all.filter(p => p.status === 'ACTIVE').length;
      const payoutApproved = all.filter(p => p.status === 'PAYOUT_APPROVED').length;
      const payoutRejected = all.filter(p => p.status === 'PAYOUT_REJECTED').length;
      const disputed = all.filter(p => p.oracleStatus === 'DISPUTE_FLAGGED').length;
      const totalCoverage = all
        .filter(p => p.status === 'ACTIVE')
        .reduce((sum, p) => sum + Number(p.coverageAmount), 0);
      const totalPremiums = all.reduce((sum, p) => sum + Number(p.premiumAmount), 0);
      setPolicyMetrics({ total: all.length, active, payoutApproved, payoutRejected, disputed, totalCoverage, totalPremiums });
      if (poolSource === 'simulation') {
        setPoolState((previous) => ({
          ...previous,
          activeExposure: totalCoverage,
          solvencyRatio: totalCoverage > 0 ? (previous.poolBalance / totalCoverage) * 100 : null
        }));
      }
    } catch (err) {
      console.error('Failed to fetch policy metrics:', err);
    } finally {
      setLoadingPolicyMetrics(false);
    }
  }, [poolSource]);

  useEffect(() => {
    fetchPolicyMetrics();
  }, [fetchPolicyMetrics]);

  useEffect(() => {
    let cancelled = false;

    const fetchLivePoolState = async () => {
      if (!contracts?.capitalPoolContract || !signer) {
        setPoolSource('simulation');
        setPoolError('');
        return;
      }

      setPoolLoading(true);
      setPoolError('');

      try {
        const summary = await contracts.capitalPoolContract.getPoolSummary();

        const poolBal = Number(ethers.formatEther(summary.poolBalance));
        const activeExp = Number(ethers.formatEther(summary.activeExposure));
        const totShares = Number(ethers.formatEther(summary.totalLpShares));

        let userSh = 0;

        if (account && ethers.isAddress(account)) {
          const userShWei =
            await contracts.capitalPoolContract.sharesOf(account);

          userSh = Number(ethers.formatEther(userShWei));
        }

        if (cancelled) return;

        setPoolState({
          poolBalance: poolBal,
          activeExposure: activeExp,
          totalShares: totShares,
          userShares: userSh,
          solvencyRatio:
            activeExp > 0 ? (poolBal / activeExp) * 100 : null
        });

        setPoolSource('contract');
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to read capital pool:', err);
          setPoolError(
            err.shortMessage ||
            err.message ||
            'Unable to retrieve pool information.'
          );
          setPoolSource('error');
        }
      } finally {
        if (!cancelled) setPoolLoading(false);
      }
    };

    fetchLivePoolState();

    return () => {
      cancelled = true;
    };
  }, [contracts, account, signer]);

  const shareExchangeRate =
    poolState.totalShares > 0
      ? poolState.poolBalance / poolState.totalShares
      : 1;

  const userEthValue = poolState.userShares * shareExchangeRate;
  const isSolvent = poolState.poolBalance >= poolState.activeExposure;
  const stressedBalance = poolState.poolBalance - Number(stressPayouts || 0);
  const stressedRatio = poolState.activeExposure > 0
    ? (stressedBalance / poolState.activeExposure) * 100
    : null;
  const exampleDepositValue = Number(exampleDeposit);
  const exampleNetRate = (examplePremiumRate - exampleClaimRate) / 100;
  const exampleEndingValue = Number.isFinite(exampleDepositValue)
    ? exampleDepositValue * (1 + exampleNetRate)
    : 0;
  const exampleNetChange = exampleEndingValue - (Number.isFinite(exampleDepositValue) ? exampleDepositValue : 0);

  const depositValue = Number(depositAmount);
  const withdrawValue = Number(withdrawShares);

  const validDeposit =
    Number.isFinite(depositValue) && depositValue > 0;

  const validWithdrawal =
    Number.isFinite(withdrawValue) &&
    withdrawValue > 0 &&
    withdrawValue <= poolState.userShares;

  const visiblePolicies = policyRows.filter((policy) => {
    const matchesFilter = policyFilter === 'ALL'
      || (policyFilter === 'ACTIVE' && policy.status === 'ACTIVE')
      || (policyFilter === 'REVIEW' && policy.oracleStatus === 'DISPUTE_FLAGGED')
      || (policyFilter === 'CLOSED' && ['PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'CANCELLED'].includes(policy.status));
    const query = policySearch.trim().toLowerCase();
    const matchesSearch = !query || [policy.id, policy.plotId, policy.location, policy.status, policy.oracleStatus]
      .some((value) => String(value || '').toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });
  const selectedPolicy = policyRows.find((policy) => policy.id === selectedPolicyId) || null;
  const activePolicyRows = useMemo(() => policyRows.filter((policy) => policy.status === 'ACTIVE'), [policyRows]);
  const exposureMarkers = useMemo(() => activePolicyRows
    .filter((policy) => policy.latitude != null && policy.longitude != null)
    .map((policy) => ({ id: policy.id, latitude: Number(policy.latitude), longitude: Number(policy.longitude), label: `Policy #${policy.id}`, detail: `${Number(policy.coverageAmount).toFixed(3)} ETH · ${policy.location}` })), [activePolicyRows]);
  const regionalExposure = useMemo(() => {
    const regions = new Map();
    activePolicyRows.forEach((policy) => {
      const parts = String(policy.location || 'Unspecified location').split(',').map((part) => part.trim()).filter(Boolean);
      const region = parts.length >= 2 ? parts.slice(-2).join(', ') : (parts[0] || 'Unspecified location');
      const item = regions.get(region) || { region, policies: 0, coverage: 0 };
      item.policies += 1;
      item.coverage += Number(policy.coverageAmount) || 0;
      regions.set(region, item);
    });
    return [...regions.values()].sort((a, b) => b.coverage - a.coverage);
  }, [activePolicyRows]);

  const refreshPoolState = async () => {
    if (!contracts?.capitalPoolContract) return;

    try {
      const summary =
        await contracts.capitalPoolContract.getPoolSummary();

      const poolBal = Number(ethers.formatEther(summary.poolBalance));
      const activeExp = Number(ethers.formatEther(summary.activeExposure));
      const totShares = Number(ethers.formatEther(summary.totalLpShares));

      let userSh = 0;

      if (account && ethers.isAddress(account)) {
        const userShWei =
          await contracts.capitalPoolContract.sharesOf(account);

        userSh = Number(ethers.formatEther(userShWei));
      }

      setPoolState({
        poolBalance: poolBal,
        activeExposure: activeExp,
        totalShares: totShares,
        userShares: userSh,
        solvencyRatio:
          activeExp > 0 ? (poolBal / activeExp) * 100 : null
      });

      setPoolSource('contract');
      setPoolError('');
    } catch (err) {
      console.error('Failed to refresh pool state:', err);
      setPoolError('Transaction completed, but the pool summary could not refresh.');
    }
  };

  const handleDeposit = async () => {
    if (!validDeposit) {
      setTxError('Enter a deposit amount greater than zero.');
      return;
    }

    setTransacting(true);
    setTxMessage(null);
    setTxError('');

    try {
      if (contracts?.capitalPoolContract && signer) {
        const tx = await contracts.capitalPoolContract.depositLiquidity({
          value: ethers.parseEther(depositAmount)
        });

        setTxMessage(`Deposit submitted: ${tx.hash}`);
        await tx.wait();

        setTxMessage(`Deposit confirmed: ${tx.hash}`);
        await refreshPoolState();
      } else {
        const sharesToMint = depositValue / shareExchangeRate;

        updateDemoPool((prev) => ({
          ...prev,
          poolBalance: prev.poolBalance + depositValue,
          totalShares: prev.totalShares + sharesToMint,
          userShares: prev.userShares + sharesToMint,
          solvencyRatio:
            prev.activeExposure > 0
              ? ((prev.poolBalance + depositValue) / prev.activeExposure) * 100
              : null
        }));

        setPoolSource('simulation');
        setTxMessage(
          `SIMULATION: Deposited ${depositValue.toFixed(4)} ETH and minted ${sharesToMint.toFixed(4)} LP shares. No blockchain transaction occurred.`
        );
      }
    } catch (err) {
      console.error('Deposit failed:', err);
      setTxError(
        err.reason ||
        err.shortMessage ||
        err.message ||
        'The deposit failed or was rejected.'
      );
    } finally {
      setTransacting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!validWithdrawal) {
      setTxError('Enter a valid share amount within your available balance.');
      return;
    }

    setTransacting(true);
    setTxMessage(null);
    setTxError('');

    try {
      if (contracts?.capitalPoolContract && signer) {
        const sharesWei = ethers.parseEther(withdrawShares);
        const tx = await contracts.capitalPoolContract.withdrawLiquidity(sharesWei);

        setTxMessage(`Withdrawal submitted: ${tx.hash}`);
        await tx.wait();

        setTxMessage(`Withdrawal confirmed: ${tx.hash}`);
        await refreshPoolState();
      } else {
        const ethToReturn = withdrawValue * shareExchangeRate;
        const remainingBalance = poolState.poolBalance - ethToReturn;

        if (remainingBalance < poolState.activeExposure) {
          setTxError(
            'Simulation blocked: withdrawal would leave insufficient reserves for current policy exposure.'
          );
          return;
        }

        updateDemoPool((prev) => ({
          ...prev,
          poolBalance: prev.poolBalance - ethToReturn,
          totalShares: prev.totalShares - withdrawValue,
          userShares: prev.userShares - withdrawValue,
          solvencyRatio:
            prev.activeExposure > 0
              ? ((prev.poolBalance - ethToReturn) / prev.activeExposure) * 100
              : null
        }));

        setPoolSource('simulation');
        setTxMessage(
          `SIMULATION: Redeemed ${withdrawValue.toFixed(4)} LP shares for ${ethToReturn.toFixed(4)} ETH. No blockchain transaction occurred.`
        );
      }
    } catch (err) {
      console.error('Withdrawal failed:', err);
      setTxError(
        err.reason ||
        err.shortMessage ||
        err.message ||
        'The withdrawal failed or was rejected.'
      );
    } finally {
      setTransacting(false);
    }
  };

  return (
    <div className="investor-page">
      <section className="investor-intro">
        <div>
          <p className="section-kicker">CAPITAL MANAGEMENT</p>
          <h2>Investor liquidity pool</h2>
          <p className="section-description">
            Explore the coverage pool and how premiums and claims can affect LP share value.
          </p>
          {investorUser && <p className="investor-signed-in">Signed in as <strong>{investorUser.name}</strong> · {investorUser.email}</p>}
        </div>

        <div className="pool-status">
          <span className={`status-indicator ${
            isSolvent ? '' : 'status-indicator-warning'
          }`} />
          <span>
            {poolLoading
              ? 'Reading pool'
              : poolSource === 'simulation'
                ? 'Demo simulation active'
                : poolSource !== 'contract'
                  ? 'Contract data unavailable'
                  : isSolvent
                    ? 'Reserves cover current exposure'
                    : 'Reserves below current exposure'}
          </span>
          {!account && investorUser && <button type="button" className="btn-ghost investor-signout" onClick={handleInvestorLogout}>Sign out</button>}
          {!account && !investorUser && (
            <button type="button" className="btn-ghost investor-signout" onClick={() => setShowInvestorAccess((shown) => !shown)}>
              {showInvestorAccess ? 'Close sign in' : 'Investor sign in'}
            </button>
          )}
        </div>
      </section>

      {!account && !investorUser && showInvestorAccess && (
        <InvestorAccess onAuthenticated={handleInvestorAuthenticated} />
      )}

      <section className="investor-economics-intro">
        <div>
          <p className="section-kicker">HOW THE POOL WORKS</p>
          <h3>Premiums can grow pool value. Claims can reduce it.</h3>
          <p>
            Farmers pay premiums to transfer a defined weather risk. Those premiums can increase
            pool assets; claim payouts reduce them. LP shares represent a proportional interest in
            the pool, so their value can rise or fall with the pool balance.
          </p>
        </div>
        <div className="economics-flow" aria-label="Pool value flow">
          <span>Premiums in</span><strong>→</strong><span>Pool assets</span><strong>→</strong><span>Claims out</span>
        </div>
      </section>

      <div className={`investor-data-banner ${poolSource === 'contract' ? 'is-live' : ''}`} role="status">
        <strong>{poolSource === 'contract' ? 'Connected contract data' : 'Illustrative demo pool'}</strong>
        <span>{poolSource === 'contract'
          ? 'Balances and LP shares below are read from the connected contract.'
          : 'Demo balances are for exploring the interface. Simulated farmer policies have not paid real premiums into this pool.'}</span>
      </div>

      <section className="investor-metrics investor-overview-metrics" aria-label="Pool overview">
        <div className="investor-metric">
          <span className="metric-label">Pool balance</span>
          <strong>{poolState.poolBalance.toFixed(4)} <span>ETH</span></strong>
          <p>{poolSource === 'contract' ? 'Current contract balance' : 'Illustrative starting balance'}</p>
        </div>
        <div className="investor-metric">
          <span className="metric-label">Active coverage</span>
          <strong>{poolState.activeExposure.toFixed(4)} <span>ETH</span></strong>
          <p>Coverage exposure shown for this view</p>
        </div>
        <div className="investor-metric">
          <span className="metric-label">Reserve coverage</span>
          <strong>{poolState.activeExposure > 0 ? `${(poolState.poolBalance / poolState.activeExposure * 100).toFixed(0)}%` : '—'}</strong>
          <p>Pool balance divided by active exposure</p>
        </div>
        <div className="investor-metric">
          <span className="metric-label">LP share value</span>
          <strong>{shareExchangeRate.toFixed(4)} <span>ETH / LP</span></strong>
          <p>Pool balance divided by total shares</p>
        </div>
      </section>

      {poolError && (
        <div className="investor-notice" role="status">
          {poolError}
        </div>
      )}

      {/* Real policy data from shared backend DB */}
      <section className="investor-policy-metrics">
        <div className="section-heading">
          <div>
            <p className="section-kicker">POLICY EXPOSURE</p>
            <h3>Policies recorded in the app</h3>
            <p className="section-description">
              Counts and coverage figures are read directly from the shared policy database.
            </p>
          </div>
          <button className="btn-ghost" onClick={fetchPolicyMetrics} disabled={loadingPolicyMetrics}>
            {loadingPolicyMetrics ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loadingPolicyMetrics ? (
          <p className="empty-state">Loading policy data…</p>
        ) : policyMetrics === null ? (
          <p className="empty-state">Could not load policy data.</p>
        ) : (
          <div className="investor-policy-grid">
            <div className="investor-policy-stat">
              <span className="metric-label">Total policies</span>
              <strong>{policyMetrics.total}</strong>
            </div>
            <div className="investor-policy-stat">
              <span className="metric-label">Active</span>
              <strong>{policyMetrics.active}</strong>
            </div>
            <div className="investor-policy-stat">
              <span className="metric-label">Payout approved</span>
              <strong>{policyMetrics.payoutApproved}</strong>
            </div>
            <div className="investor-policy-stat">
              <span className="metric-label">Payout rejected</span>
              <strong>{policyMetrics.payoutRejected}</strong>
            </div>
            <div className="investor-policy-stat">
              <span className="metric-label">Flagged disputes</span>
              <strong>{policyMetrics.disputed}</strong>
            </div>
            <div className="investor-policy-stat">
              <span className="metric-label">Active coverage (ETH)</span>
              <strong>{policyMetrics.totalCoverage.toFixed(4)}</strong>
            </div>
            <div className="investor-policy-stat">
              <span className="metric-label">Collected premiums (ETH)</span>
              <strong>{policyMetrics.totalPremiums.toFixed(4)}</strong>
              <span className="metric-caption">Simulated — no real funds collected</span>
            </div>
          </div>
        )}
      </section>

      <section className="investor-exposure-section">
        <div className="section-heading">
          <div><p className="section-kicker">GEOGRAPHIC EXPOSURE</p><h3>Active coverage by region</h3><p className="section-description">Pins show active policies with saved farm coordinates. Regional totals also include active records without map pins.</p></div>
          <span className="portfolio-count">{exposureMarkers.length} mapped / {activePolicyRows.length} active</span>
        </div>
        {exposureMarkers.length > 0 ? <FarmLocationMap readOnly markers={exposureMarkers} /> : <div className="portfolio-empty"><strong>No active policies with coordinates yet</strong><p>New policies will appear on the map when they are linked to a pinned farm.</p></div>}
        {regionalExposure.length > 0 && <div className="regional-exposure-list">{regionalExposure.map((region) => <div key={region.region}><span><strong>{region.region}</strong><small>{region.policies} {region.policies === 1 ? 'policy' : 'policies'}</small></span><strong>{region.coverage.toFixed(3)} ETH</strong></div>)}</div>}
      </section>

      <section className="investor-portfolio-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">UNDERWRITING PORTFOLIO</p>
            <h3>Policy book</h3>
            <p className="section-description">Search the policies backing the exposure totals, filter by lifecycle, and inspect each policy’s coverage terms.</p>
          </div>
          <span className="portfolio-count">{visiblePolicies.length} shown / {policyRows.length} total</span>
        </div>

        <div className="portfolio-controls">
          <input aria-label="Search policies" className="form-control" type="search" placeholder="Search policy, plot or location" value={policySearch} onChange={(event) => setPolicySearch(event.target.value)} />
          <div className="investor-tabs portfolio-filters" role="tablist" aria-label="Filter policies">
            {[
              ['ALL', 'All'],
              ['ACTIVE', 'Active'],
              ['REVIEW', 'Needs review'],
              ['CLOSED', 'Closed']
            ].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={policyFilter === value} className={`investor-tab ${policyFilter === value ? 'active' : ''}`} onClick={() => setPolicyFilter(value)}>{label}</button>
            ))}
          </div>
        </div>

        {policyRows.length === 0 ? (
          <div className="portfolio-empty"><strong>No policies in the portfolio yet</strong><p>Create a policy from the Farmer Insurance portal, then refresh this page to review its exposure.</p></div>
        ) : visiblePolicies.length === 0 ? (
          <div className="portfolio-empty"><strong>No policies match this view</strong><p>Try another filter or search term.</p></div>
        ) : (
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead><tr><th>Policy</th><th>Location</th><th>Coverage</th><th>Premium</th><th>Rainfall trigger</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {visiblePolicies.map((policy) => (
                  <tr key={policy.id} className={selectedPolicyId === policy.id ? 'portfolio-row-selected' : ''}>
                    <td><strong>#{policy.id}</strong><small>{policy.plotId}</small></td>
                    <td>{policy.location}</td>
                    <td>{Number(policy.coverageAmount).toFixed(3)} ETH</td>
                    <td>{Number(policy.premiumAmount).toFixed(4)} ETH</td>
                    <td>≤ {policy.triggerThreshold} mm</td>
                    <td><span className="portfolio-status">{policy.status}</span><small>{policy.oracleStatus}</small></td>
                    <td><button type="button" className="btn-ghost portfolio-inspect" onClick={() => setSelectedPolicyId(policy.id)}>{selectedPolicyId === policy.id ? 'Selected' : 'Inspect'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedPolicy && (
          <div className="portfolio-policy-detail" aria-live="polite">
            <div><span className="metric-label">Selected exposure</span><strong>Policy #{selectedPolicy.id} · {selectedPolicy.location}</strong></div>
            <div><span className="metric-label">Coverage obligation</span><strong>{Number(selectedPolicy.coverageAmount).toFixed(4)} ETH</strong></div>
            <div><span className="metric-label">Premium / coverage</span><strong>{selectedPolicy.coverageAmount > 0 ? `${((selectedPolicy.premiumAmount / selectedPolicy.coverageAmount) * 100).toFixed(2)}%` : '—'}</strong></div>
            <div><span className="metric-label">Trigger condition</span><strong>Rainfall ≤ {selectedPolicy.triggerThreshold} mm</strong></div>
            <PolicyTimeline policyId={selectedPolicy.id} />
          </div>
        )}

        <div className="portfolio-capital-bar">
          <div className="portfolio-capital-heading"><span>Active coverage compared with displayed pool reserves</span><strong>{poolState.activeExposure.toFixed(3)} / {poolState.poolBalance.toFixed(3)} ETH</strong></div>
          <div className="portfolio-capital-track"><span style={{ width: `${Math.min(poolState.poolBalance > 0 ? (poolState.activeExposure / poolState.poolBalance) * 100 : 0, 100)}%` }} /></div>
          <p>{poolSource === 'simulation' ? 'Coverage comes from saved app policies; reserve figures are in-memory demo pool values.' : 'Coverage comes from the app policy database; reserves come from the connected contract.'}</p>
        </div>
      </section>

      <section className="investor-economics-simulator">
        <div className="section-heading">
          <div>
            <p className="section-kicker">ILLUSTRATIVE SEASON</p>
            <h3>See how premiums and claims could affect a position</h3>
            <p className="section-description">Adjust the assumptions for a 1 ETH position. This is a simple example, not a forecast or promised return.</p>
          </div>
          <span className="sh-badge badge-warning">Example only</span>
        </div>
        <div className="economics-simulator-grid">
          <div className="form-field">
            <label htmlFor="example-investment">Example position (ETH)</label>
            <input id="example-investment" className="form-control" type="number" min="0.01" step="0.1" value={exampleDeposit} onChange={(event) => setExampleDeposit(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="example-premium-rate">Premiums allocated to LPs (% of position)</label>
            <input id="example-premium-rate" className="form-control" type="range" min="0" max="30" step="1" value={examplePremiumRate} onChange={(event) => setExamplePremiumRate(Number(event.target.value))} />
            <span className="economics-assumption-value">{examplePremiumRate}%</span>
          </div>
          <div className="form-field">
            <label htmlFor="example-claim-rate">Claim payouts allocated to LPs (% of position)</label>
            <input id="example-claim-rate" className="form-control" type="range" min="0" max="50" step="1" value={exampleClaimRate} onChange={(event) => setExampleClaimRate(Number(event.target.value))} />
            <span className="economics-assumption-value">{exampleClaimRate}%</span>
          </div>
          <div className="economics-outcome" aria-live="polite">
            <span className="metric-label">Example ending value</span>
            <strong>{exampleEndingValue.toFixed(4)} ETH</strong>
            <p className={exampleNetChange >= 0 ? 'economics-positive' : 'economics-negative'}>
              {exampleNetChange >= 0 ? '+' : ''}{exampleNetChange.toFixed(4)} ETH ({exampleNetRate >= 0 ? '+' : ''}{(exampleNetRate * 100).toFixed(1)}%)
            </p>
          </div>
        </div>
        <p className="field-help">Example arithmetic: position + assumed premium share − assumed claim share. Real results depend on policy pricing, claims, pool accounting, timing, fees, and available liquidity. Principal can be lost.</p>
      </section>

      <section className="reserve-stress-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">RESERVE STRESS TEST</p>
            <h3>What if claims are paid?</h3>
            <p className="section-description">Explore how hypothetical payouts change reserves against the pool’s current active coverage.</p>
          </div>
        </div>
        <div className="stress-test-grid">
          <div className="form-field">
            <label htmlFor="stress-payouts">Hypothetical payouts (ETH)</label>
            <input id="stress-payouts" className="form-control" type="number" min="0" max={poolState.poolBalance} step="0.1" value={stressPayouts} onChange={(event) => setStressPayouts(event.target.value)} />
            <input aria-label="Adjust hypothetical payouts" className="scenario-slider" type="range" min="0" max={Math.max(1, poolState.poolBalance)} step="0.1" value={Math.min(Number(stressPayouts) || 0, poolState.poolBalance)} onChange={(event) => setStressPayouts(event.target.value)} />
          </div>
          <div className="stress-stat"><span className="metric-label">Reserves after scenario</span><strong>{stressedBalance.toFixed(3)} ETH</strong></div>
          <div className="stress-stat"><span className="metric-label">Coverage remaining</span><strong>{stressedRatio == null ? 'No active exposure' : `${stressedRatio.toFixed(1)}%`}</strong></div>
          <div className={`stress-status ${stressedBalance >= poolState.activeExposure ? 'stress-safe' : 'stress-risk'}`} aria-live="polite"><span className="metric-label">Reserve check</span><strong>{stressedBalance >= poolState.activeExposure ? 'Reserves cover active exposure' : 'Reserves fall below active exposure'}</strong></div>
        </div>
        <p className="field-help">This is a what-if calculation from the displayed pool balance and coverage figures. It does not alter balances or claim status.</p>
      </section>

      <div className="investor-main-grid">
        <section className="investor-action-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">LIQUIDITY OPERATIONS</p>
              <h3>Manage your position</h3>
            </div>
          </div>

          <div className="investor-tabs" role="tablist" aria-label="Liquidity operation">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'deposit'}
              className={`investor-tab ${activeTab === 'deposit' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('deposit');
                setTxError('');
                setTxMessage(null);
              }}
            >
              Deposit
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'withdraw'}
              className={`investor-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('withdraw');
                setTxError('');
                setTxMessage(null);
              }}
            >
              Withdraw
            </button>
          </div>

          {activeTab === 'deposit' ? (
            <div className="investor-form">
              <div className="form-field">
                <label htmlFor="deposit-amount">Deposit amount (ETH)</label>
                <input
                  id="deposit-amount"
                  type="number"
                  min="0.000001"
                  step="any"
                  className="form-control"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                />
              </div>

              <div className="investor-estimate">
                <span>Estimated shares received</span>
                <strong>
                  {validDeposit
                    ? (depositValue / shareExchangeRate).toFixed(4)
                    : '0.0000'} LP
                </strong>
              </div>

              <button
                type="button"
                className="btn-primary investor-submit"
                onClick={handleDeposit}
                disabled={transacting || !validDeposit}
              >
                {transacting ? 'Processing transaction...' : 'Deposit liquidity'}
              </button>
            </div>
          ) : (
            <div className="investor-form">
              <div className="form-field">
                <label htmlFor="withdraw-shares">
                  LP shares to redeem
                </label>
                <input
                  id="withdraw-shares"
                  type="number"
                  min="0.000001"
                  max={poolState.userShares}
                  step="any"
                  className="form-control"
                  value={withdrawShares}
                  onChange={(event) => setWithdrawShares(event.target.value)}
                />
                <p className="field-help">
                  Available balance: {poolState.userShares.toFixed(4)} LP
                </p>
              </div>

              <div className="investor-estimate">
                <span>Estimated ETH returned</span>
                <strong>
                  {validWithdrawal
                    ? (withdrawValue * shareExchangeRate).toFixed(4)
                    : '0.0000'} ETH
                </strong>
              </div>

              <button
                type="button"
                className="btn-primary investor-submit"
                onClick={handleWithdraw}
                disabled={transacting || !validWithdrawal}
              >
                {transacting ? 'Processing transaction...' : 'Redeem shares'}
              </button>
            </div>
          )}

          {!account && (
            <p className="field-help">
              Demo simulation is active. Deposits and withdrawals update temporary
              in-memory balances and do not move real ETH.
            </p>
          )}

          {txError && (
            <p className="inline-error" role="alert">{txError}</p>
          )}

          {txMessage && (
            <div className="investor-transaction-message" role="status">
              {txMessage}
            </div>
          )}
        </section>

        <section className="investor-position-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">YOUR ACCOUNT</p>
              <h3>Liquidity provider position</h3>
            </div>
          </div>

          <div className="position-total">
            <span className="metric-label">Your LP shares</span>
            <strong>{poolState.userShares.toFixed(4)} LP</strong>
            <p>
              Estimated value: {userEthValue.toFixed(4)} ETH
            </p>
          </div>

          <div className="position-detail">
            <span>Wallet</span>
            <strong>
              {account
                ? `${account.slice(0, 8)}...${account.slice(-6)}`
                : 'Not connected'}
            </strong>
          </div>

          <div className="position-detail">
            <span>Pool data source</span>
            <strong>
              {poolSource === 'contract'
                ? 'Smart contract'
                : poolSource === 'simulation'
                  ? 'Demo simulation'
                  : poolSource === 'error'
                    ? 'Read failed'
                    : 'Unavailable'}
            </strong>
          </div>

          <div className="position-explanation">
            <strong>How LP shares work</strong>
            <p>
              The exchange rate shown here is calculated from the reported
              pool balance divided by total LP shares. Deposits and withdrawals
              are submitted through the capital pool contract when connected, or simulated in-memory when disconnected.
            </p>
          </div>
        </section>
      </div>

      <section className="investor-disclosure">
        <p className="section-kicker">IMPORTANT INFORMATION</p>
        <h3>Pool data and returns</h3>
        <p>
          Premium income is not a fixed yield. A season with large claims can reduce pool assets
          and LP share value, including below the amount deposited. Demo policy premiums shown
          elsewhere are not collected funds. Wallet deposits and withdrawals use the connected
          contract; without a contract connection, those controls run as a simulation only.
        </p>
      </section>
    </div>
  );
}
