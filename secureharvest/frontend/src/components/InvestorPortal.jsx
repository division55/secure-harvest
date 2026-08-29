import React, { useState } from 'react';
import { Coins, TrendingUp, ShieldCheck, ArrowUpRight, ArrowDownLeft, AlertCircle, PieChart } from 'lucide-react';

export default function InvestorPortal({ account }) {
  const [depositAmount, setDepositAmount] = useState('5.0');
  const [withdrawShares, setWithdrawShares] = useState('2.0');
  const [activeTab, setActiveTab] = useState('deposit');
  const [txMessage, setTxMessage] = useState(null);

  // Simulated Pool State (Synced with CapitalPool.sol)
  const [poolState, setPoolState] = useState({
    poolBalance: 12.5,
    activeExposure: 5.0,
    totalShares: 10.0,
    userShares: 5.0,
    solvencyRatio: 250 // 250% collateralized
  });

  const shareExchangeRate = poolState.totalShares > 0 ? poolState.poolBalance / poolState.totalShares : 1.0;
  const userEthValue = poolState.userShares * shareExchangeRate;
  const isSolvent = poolState.poolBalance >= poolState.activeExposure;

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount) || 0;
    if (amount <= 0) return;

    const sharesToMint = amount / shareExchangeRate;
    setPoolState(prev => ({
      ...prev,
      poolBalance: prev.poolBalance + amount,
      totalShares: prev.totalShares + sharesToMint,
      userShares: prev.userShares + sharesToMint
    }));

    setTxMessage(`✅ Successfully deposited ${amount} ETH into CapitalPool! Minted ${sharesToMint.toFixed(4)} LP Shares.`);
    setTimeout(() => setTxMessage(null), 4000);
  };

  const handleWithdraw = () => {
    const shares = parseFloat(withdrawShares) || 0;
    if (shares <= 0 || shares > poolState.userShares) return;

    const ethToReturn = shares * shareExchangeRate;
    const remainingBalance = poolState.poolBalance - ethToReturn;

    if (remainingBalance < poolState.activeExposure) {
      alert('⚠️ Withdrawal blocked by CapitalPool contract: Cannot withdraw below active policy exposure obligation!');
      return;
    }

    setPoolState(prev => ({
      ...prev,
      poolBalance: prev.poolBalance - ethToReturn,
      totalShares: prev.totalShares - shares,
      userShares: prev.userShares - shares
    }));

    setTxMessage(`✅ Successfully burned ${shares} LP Shares! Redeemed ${ethToReturn.toFixed(4)} ETH.`);
    setTimeout(() => setTxMessage(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Pool Solvency & Yield Header */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-secondary)', fontWeight: 600 }}>
            <Coins size={18} />
            <span>Fractional Yield-Bearing Capital Pool</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>Investor Liquidity Dashboard</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Earn yield from unclaimed policy premiums with automated on-chain solvency enforcement.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={`badge ${isSolvent ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <ShieldCheck size={16} />
            {isSolvent ? 'ON-CHAIN POOL SOLVENT' : 'POOL INSOLVENT'}
          </span>
        </div>
      </div>

      {/* 4 Metrics Cards */}
      <div className="grid-3">
        <div className="glass-card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">TOTAL POOL LIQUIDITY</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primary)', margin: '4px 0' }} className="font-mono">
            {poolState.poolBalance.toFixed(2)} ETH
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Backed by {poolState.totalShares.toFixed(2)} LP Shares</div>
        </div>

        <div className="glass-card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">ACTIVE POLICY EXPOSURE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-tertiary)', margin: '4px 0' }} className="font-mono">
            {poolState.activeExposure.toFixed(2)} ETH
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Reserved coverage obligation</div>
        </div>

        <div className="glass-card">
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">LP SHARE EXCHANGE RATE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-secondary)', margin: '4px 0' }} className="font-mono">
            1 LP = {shareExchangeRate.toFixed(4)} ETH
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>+20.0% Yield from collected premiums</div>
        </div>
      </div>

      {/* Main Grid: Staking Form + User Holdings */}
      <div className="grid-2">
        
        {/* Deposit / Withdraw Action Card */}
        <div className="glass-card">
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--color-border)', pb: '12px', marginBottom: '20px' }}>
            <button 
              className={activeTab === 'deposit' ? 'btn-primary' : 'btn-secondary'} 
              onClick={() => setActiveTab('deposit')}
              style={{ flex: 1 }}
            >
              <ArrowUpRight size={16} /> Deposit Liquidity
            </button>
            <button 
              className={activeTab === 'withdraw' ? 'btn-primary' : 'btn-secondary'} 
              onClick={() => setActiveTab('withdraw')}
              style={{ flex: 1 }}
            >
              <ArrowDownLeft size={16} /> Redeem LP Shares
            </button>
          </div>

          {activeTab === 'deposit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '6px' }} className="font-mono">
                  DEPOSIT ETH AMOUNT
                </label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={depositAmount} 
                  onChange={(e) => setDepositAmount(e.target.value)} 
                  step="0.5"
                />
              </div>

              <div style={{ background: '#060e20', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                  <span>Estimated LP Shares Received:</span>
                  <span className="font-mono" style={{ color: 'var(--color-primary)' }}>
                    {((parseFloat(depositAmount) || 0) / shareExchangeRate).toFixed(4)} LP
                  </span>
                </div>
              </div>

              <button className="btn-primary" onClick={handleDeposit}>
                Deposit Liquidity & Mint LP Shares
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '6px' }} className="font-mono">
                  BURN LP SHARES AMOUNT (MAX: {poolState.userShares.toFixed(4)} LP)
                </label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={withdrawShares} 
                  onChange={(e) => setWithdrawShares(e.target.value)} 
                  step="0.5"
                />
              </div>

              <div style={{ background: '#060e20', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                  <span>Estimated ETH Returned:</span>
                  <span className="font-mono" style={{ color: 'var(--color-secondary)' }}>
                    {((parseFloat(withdrawShares) || 0) * shareExchangeRate).toFixed(4)} ETH
                  </span>
                </div>
              </div>

              <button className="btn-primary" onClick={handleWithdraw}>
                Burn LP Shares & Redeem ETH
              </button>
            </div>
          )}

          {txMessage && (
            <div style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-primary)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
              {txMessage}
            </div>
          )}
        </div>

        {/* User LP Position Summary */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '16px' }}>
            <PieChart size={18} />
            <span>Your Liquidity Provider Position</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#060e20', padding: '16px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} className="font-mono">YOUR LP SHARES HELD</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primary)', margin: '4px 0' }} className="font-mono">
                {poolState.userShares.toFixed(4)} LP
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-main)' }}>
                Current ETH Value: <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>{userEthValue.toFixed(4)} ETH</span>
              </div>
            </div>

            <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--color-secondary)' }}>
                <TrendingUp size={16} /> Yield Distribution Mechanism
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                When farmers purchase policies, premiums flow into `CapitalPool.sol`. Unclaimed premiums increase total pool balance without minting new shares, growing your LP share exchange rate over time.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
