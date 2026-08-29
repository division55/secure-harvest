import React, { useState } from 'react';
import { Shield, Coins, ShieldAlert, Wallet, Activity } from 'lucide-react';
import FarmerPortal from './components/FarmerPortal';
import InvestorPortal from './components/InvestorPortal';
import DisputeConsole from './components/DisputeConsole';
import ObservabilityDashboard from './components/ObservabilityDashboard';

export default function App() {
  const [activePortal, setActivePortal] = useState('farmer');
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } catch (err) {
        console.error('Wallet connection rejected:', err);
      }
    } else {
      setAccount('0x71C765...d89B');
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px 60px 20px' }}>
      
      {/* Top Navigation Bar */}
      <header className="glass-card" style={{ padding: '16px 24px', marginBottom: '28px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <Shield size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #dae2fd 0%, #4cd7f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SecureHarvest
            </h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }} className="font-mono">
              Parametric Crop Insurance Protocol
            </div>
          </div>
        </div>

        {/* Portal View Switcher */}
        <div style={{ display: 'flex', background: '#060e20', padding: '4px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
          <button 
            className={activePortal === 'farmer' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActivePortal('farmer')}
            style={{ padding: '8px 16px', fontSize: '0.85rem', border: 'none' }}
          >
            <Shield size={16} /> Farmer Portal
          </button>
          <button 
            className={activePortal === 'investor' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActivePortal('investor')}
            style={{ padding: '8px 16px', fontSize: '0.85rem', border: 'none' }}
          >
            <Coins size={16} /> Investor LP Pool
          </button>
          <button 
            className={activePortal === 'dispute' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActivePortal('dispute')}
            style={{ padding: '8px 16px', fontSize: '0.85rem', border: 'none' }}
          >
            <ShieldAlert size={16} /> Dispute & Audit
          </button>
          <button 
            className={activePortal === 'observability' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActivePortal('observability')}
            style={{ padding: '8px 16px', fontSize: '0.85rem', border: 'none' }}
          >
            <Activity size={16} /> Observability
          </button>
        </div>

        {/* Live Oracle Indicator & Wallet Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="badge badge-success">
            <span className="pulse-dot"></span>
            ORACLE LIVE SYNC
          </div>

          <button className="btn-secondary" onClick={connectWallet}>
            <Wallet size={16} />
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect MetaMask'}
          </button>
        </div>

      </header>

      {/* Main View Render */}
      <main>
        {activePortal === 'farmer' && <FarmerPortal account={account} />}
        {activePortal === 'investor' && <InvestorPortal account={account} />}
        {activePortal === 'dispute' && <DisputeConsole />}
        {activePortal === 'observability' && <ObservabilityDashboard />}
      </main>

    </div>
  );
}
