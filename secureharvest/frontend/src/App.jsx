import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ChevronRight,
  ShieldCheck,
  User,
  LogOut,
  LogIn,
  Sparkles,
  ExternalLink,
  Home,
  Sprout,
  TrendingUp,
  Activity
} from 'lucide-react';

import LandingPage from './components/LandingPage';
import FarmerPortal from './components/FarmerPortal';
import InvestorPortal from './components/InvestorPortal';
import DisputeConsole from './components/DisputeConsole';
import ObservabilityDashboard from './components/ObservabilityDashboard';
import AuthModal from './components/AuthModal';

import {
  connectMetaMask,
  getContractInstances,
  subscribeToWeb3Events
} from './services/web3';

const TOKEN_KEY = 'sh_farmer_token';
const FARMER_KEY = 'sh_farmer_info';

const portals = [
  { id: 'landing', label: 'Home', icon: Home },
  { id: 'farmer', label: 'For farmers', icon: Sprout },
  { id: 'investor', label: 'For investors', icon: TrendingUp }
];

const protocolTools = [
  { id: 'dispute', label: 'Disputes & audit', icon: ShieldCheck },
  { id: 'observability', label: 'System monitoring', icon: Activity }
];

const portalDescriptions = {
  farmer: 'Set up a farm plot, review a weather based quote, and follow the policy evaluation.',
  investor: 'Review pool exposure, explore variable returns, and inspect the policies behind the pool.',
  dispute: 'Arbitrate Byzantine oracle discrepancies, verify cryptographic audit hashes, and enact overrides.',
  observability: 'Inspect live contract events, multi-source oracle latencies, and protocol solvency indicators.'
};

export default function App() {
  const [activePortal, setActivePortal] = useState('landing');
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [networkName, setNetworkName] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [web3Error, setWeb3Error] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // Global Auth State
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');

  // Load auth state from localStorage on startup
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedFarmer = localStorage.getItem(FARMER_KEY);
      if (savedToken && savedFarmer) {
        setToken(savedToken);
        setUser(JSON.parse(savedFarmer));
      }
    } catch (err) {
      console.warn('Failed to parse stored user profile:', err);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(FARMER_KEY);
    }
  }, []);

  const handleLogin = (farmerData, tok) => {
    setUser(farmerData);
    setToken(tok);
    localStorage.setItem(TOKEN_KEY, tok);
    localStorage.setItem(FARMER_KEY, JSON.stringify(farmerData));
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FARMER_KEY);
  };

  const handleOpenAuth = (tab = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleConnectWallet = async () => {
    setWeb3Error(null);
    setConnecting(true);

    try {
      const web3Info = await connectMetaMask();

      setAccount(web3Info.account);
      setSigner(web3Info.signer);
      setProvider(web3Info.provider);
      setNetworkName(web3Info.networkName);

      const instances = await getContractInstances(web3Info.signer);
      setContracts(instances);
    } catch (err) {
      console.error('MetaMask connection failed:', err);
      setWeb3Error(err.message || 'Unable to connect wallet.');

      setAccount(null);
      setSigner(null);
      setProvider(null);
      setNetworkName(null);
      setContracts(null);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (window.ethereum && window.ethereum.selectedAddress) {
      handleConnectWallet();
    }

    subscribeToWeb3Events(
      (newAccount) => {
        if (!newAccount) {
          setAccount(null);
          setSigner(null);
          setProvider(null);
          setNetworkName(null);
          setContracts(null);
        } else {
          handleConnectWallet();
        }
      },
      () => handleConnectWallet()
    );
  }, []);

  const activeLabel = portals.find((p) => p.id === activePortal)?.label ?? 'Farmer Insurance';
  const activeDesc = portalDescriptions[activePortal] ?? 'Parametric crop insurance protocol';

  return (
    <div className="app-shell">
      {/* ──────────────── Site Header with Global Auth & Wallet ──────────────── */}
      <header className="site-header">
        <a
          href="#main-content"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            setActivePortal('landing');
          }}
          aria-label="SecureHarvest home"
        >
          <div className="brand-badge-row">
            <span className="brand-name">SecureHarvest</span>
            <span className="protocol-pill">Parametric Web3</span>
          </div>
          <span className="brand-description">
            Weather based crop cover & shared risk capital
          </span>
        </a>

        <div className="header-actions">
          {networkName && (
            <span className="network-label">
              <span className="network-dot" />
              {networkName}
            </span>
          )}

          {/* Web3 Wallet Button */}
          <button
            className="wallet-button"
            onClick={handleConnectWallet}
            disabled={connecting}
            title={account ? account : 'Connect Ethereum Wallet'}
          >
            <Wallet size={16} strokeWidth={1.8} />
            <span>
              {connecting
                ? 'Connecting...'
                : account
                  ? `${account.slice(0, 6)}...${account.slice(-4)}`
                  : 'Connect wallet'}
            </span>
          </button>

          {/* Farmer account controls stay with the farmer journey. */}
          {activePortal !== 'investor' && (user ? (
            <div className="user-profile-menu">
              <div
                className="user-profile-pill"
                title={`Logged in as ${user.name} (${user.email})`}
              >
                <div className="user-avatar-badge">
                  <User size={14} />
                </div>
                <div className="user-profile-info">
                  <span className="user-profile-name">{user.name}</span>
                  <span className="user-profile-role">Verified Farmer</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost logout-btn"
                onClick={handleLogout}
                title="Sign out of your account"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="auth-header-btns">
              <button
                type="button"
                className="btn-ghost header-login-btn"
                onClick={() => handleOpenAuth('login')}
              >
                <LogIn size={15} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                className="btn-primary header-register-btn"
                onClick={() => handleOpenAuth('register')}
              >
                <Sparkles size={14} />
                <span>Register</span>
              </button>
            </div>
          ))}
        </div>
      </header>

      {/* ──────────────── Global Navigation ──────────────── */}
      <nav className="portal-navigation" aria-label="Main navigation">
        {portals.map((portal) => {
          const Icon = portal.icon;
          return (
            <button
              key={portal.id}
              type="button"
              className={`portal-link ${activePortal === portal.id ? 'active' : ''}`}
              aria-current={activePortal === portal.id ? 'page' : undefined}
              onClick={() => setActivePortal(portal.id)}
            >
              <Icon size={15} strokeWidth={1.8} className="portal-nav-icon" />
              <span>{portal.label}</span>
              {activePortal === portal.id && (
                <ChevronRight size={14} strokeWidth={1.8} />
              )}
            </button>
          );
        })}
        <details className="protocol-tools-menu">
          <summary>Protocol tools</summary>
          <div className="protocol-tools-list">
            {protocolTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  className={`portal-link ${activePortal === tool.id ? 'active' : ''}`}
                  onClick={() => setActivePortal(tool.id)}
                >
                  <Icon size={15} strokeWidth={1.8} className="portal-nav-icon" />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </details>
      </nav>

      {/* ──────────────── Demo Mode Notice ──────────────── */}
      {web3Error && (
        <div className="simulation-notice" role="status">
          <strong>Demo simulation mode</strong>
          <span>
            Wallet not connected. You can explore simulated farmer policies, oracle triggers, and
            investor pools without real Ethereum funds.
          </span>
        </div>
      )}

      {/* ──────────────── Main Content Area ──────────────── */}
      <main id="main-content" className="main-content">
        {activePortal !== 'landing' && (
          <div className="page-heading">
            <div>
              <p className="eyebrow">SECUREHARVEST / {activePortal.toUpperCase()}</p>
              <h1>{activeLabel}</h1>
              <p className="page-description">{activeDesc}</p>
            </div>

            <div className="system-status">
              <span className="status-indicator" />
              <span>Protocol active • Multi-source quorum</span>
            </div>
          </div>
        )}

        {/* Home / Landing Page */}
        {activePortal === 'landing' && (
          <LandingPage
            user={user}
            onNavigate={(portalId) => setActivePortal(portalId)}
            onOpenAuth={handleOpenAuth}
            account={account}
            onConnectWallet={handleConnectWallet}
          />
        )}

        {/* Farmer Insurance Portal */}
        {activePortal === 'farmer' && (
          <FarmerPortal
            account={account}
            signer={signer}
            contracts={contracts}
            user={user}
            token={token}
            onLogout={handleLogout}
            onOpenAuth={handleOpenAuth}
            onLogin={handleLogin}
          />
        )}

        {/* Investor Liquidity Pool */}
        {activePortal === 'investor' && (
          <InvestorPortal
            account={account}
            signer={signer}
            contracts={contracts}
            user={user}
          />
        )}

        {/* Dispute & Audit Console */}
        {activePortal === 'dispute' && (
          <DisputeConsole contracts={contracts} />
        )}

        {/* Observability Dashboard */}
        {activePortal === 'observability' && (
          <ObservabilityDashboard />
        )}
      </main>

      {/* ──────────────── Site Footer ──────────────── */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-brand-col">
            <strong>SecureHarvest Protocol</strong>
            <p>Autonomous parametric crop insurance on Ethereum.</p>
          </div>
          <div className="footer-links-col">
            <button type="button" onClick={() => setActivePortal('landing')}>Home</button>
            <button type="button" onClick={() => setActivePortal('farmer')}>Farmer Portal</button>
            <button type="button" onClick={() => setActivePortal('investor')}>Investor Pool</button>
            <button type="button" onClick={() => setActivePortal('dispute')}>Dispute Console</button>
            <button type="button" onClick={() => setActivePortal('observability')}>Observability</button>
          </div>
          <div className="footer-right-col">
            <span className="footer-status-pill">● Testnet Hardhat / Sepolia</span>
            <span className="footer-copy">© 2026 SecureHarvest</span>
          </div>
        </div>
      </footer>

      {/* ──────────────── Global Auth Modal ──────────────── */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLogin={handleLogin}
        initialTab={authModalTab}
      />
    </div>
  );
}
