import React, { useState, useEffect, useCallback } from 'react';
import FarmLocationMap from './FarmLocationMap';
import PolicyTimeline from './PolicyTimeline';
import {
  Sprout,
  LogIn,
  Sparkles,
  Zap,
  User,
  ArrowRight
} from 'lucide-react';

const TOKEN_KEY = 'sh_farmer_token';
const FARMER_KEY = 'sh_farmer_info';

function authHeader(token) {
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
}

function boundaryAcres(points) {
  if (points.length < 3) return 0;
  const earthRadius = 6378137;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const lon1 = Number(current.longitude) * Math.PI / 180;
    const lon2 = Number(next.longitude) * Math.PI / 180;
    const lat1 = Number(current.latitude) * Math.PI / 180;
    const lat2 = Number(next.latitude) * Math.PI / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(area * earthRadius * earthRadius / 2) / 4046.8564224;
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE: { label: 'Active', cls: 'badge-active' },
    PAYOUT_APPROVED: { label: 'Payout approved', cls: 'badge-approved' },
    PAYOUT_REJECTED: { label: 'Payout rejected', cls: 'badge-rejected' },
    CANCELLED: { label: 'Cancelled', cls: 'badge-muted' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'badge-muted' };
  return <span className={`sh-badge ${cls}`}>{label}</span>;
}

function OracleBadge({ status }) {
  const map = {
    NOT_EVALUATED: { label: 'Not evaluated', cls: 'badge-muted' },
    TRIGGER_APPROVED: { label: 'Trigger approved', cls: 'badge-warning' },
    SAFE: { label: 'Safe', cls: 'badge-active' },
    DISPUTE_FLAGGED: { label: 'Dispute flagged', cls: 'badge-warning' },
    DISPUTE_APPROVED_MANUALLY: { label: 'Approved (manual)', cls: 'badge-approved' },
    DISPUTE_REJECTED_MANUALLY: { label: 'Rejected (manual)', cls: 'badge-rejected' },
    INSUFFICIENT_DATA: { label: 'Insufficient data', cls: 'badge-muted' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'badge-muted' };
  return <span className={`sh-badge ${cls}`}>{label}</span>;
}

/* ─── Auth Screen ─────────────────────────────────────────────────────── */

function AuthScreen({ onLogin }) {
  const [view, setView] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = view === 'login' ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Authentication failed.');

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(FARMER_KEY, JSON.stringify(data.farmer));
      onLogin(data.farmer, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchView = (v) => {
    setView(v);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-card-header">
          <p className="section-kicker">FARMER PORTAL</p>
          <h2>{view === 'login' ? 'Sign in to your account' : 'Create an account'}</h2>
          <p className="section-description">
            {view === 'login'
              ? 'Access your plots, policies and oracle evaluations.'
              : 'Register to start managing crop insurance policies.'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${view === 'login' ? 'active' : ''}`}
            onClick={() => switchView('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${view === 'register' ? 'active' : ''}`}
            onClick={() => switchView('register')}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {view === 'register' && (
            <div className="form-field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                className="form-control"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}
          <div className="form-field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              className="form-control"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={view === 'register' ? 'Minimum 8 characters' : ''}
              required
            />
          </div>

          {error && <p className="inline-error" role="alert">{error}</p>}

          <button type="submit" className="btn-primary purchase-button" disabled={loading}>
            {loading ? (view === 'login' ? 'Signing in...' : 'Creating account...') : (view === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Farmer Welcome / Auth Gating Screen ─────────────────────────────── */

function FarmerWelcomeScreen({ onOpenAuth, onLogin, onQuickDemo, error }) {
  const [showInlineForm, setShowInlineForm] = useState(false);

  return (
    <div className="farmer-welcome-container">
      <div className="farmer-welcome-card glass-card">
        <div className="farmer-welcome-badge">
          <Sprout size={16} />
          <span>FARMER MANAGEMENT SUITE</span>
        </div>

        <h2>Farmer Insurance Dashboard</h2>
        <p className="farmer-welcome-desc">
          Sign in or create a farmer account to register farm plots, calculate instant AI parametric quotes,
          and monitor autonomous satellite drought triggers.
        </p>

        <div className="farmer-welcome-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => (onOpenAuth ? onOpenAuth('login') : setShowInlineForm(true))}
          >
            <LogIn size={16} />
            <span>Sign In to Account</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => (onOpenAuth ? onOpenAuth('register') : setShowInlineForm(true))}
          >
            <Sparkles size={16} />
            <span>Register as Farmer</span>
          </button>

          <button
            type="button"
            className="btn-secondary demo-accent-btn"
            onClick={onQuickDemo}
          >
            <Zap size={16} />
            <span>Open demo account</span>
          </button>
        </div>

        {error && <p className="inline-error" role="alert">{error}</p>}

        <div className="farmer-feature-preview-grid">
          <div className="farmer-preview-item">
            <span className="preview-icon">01</span>
            <div>
              <strong>Plot Registry</strong>
              <p>GPS coordinates, acreage, and crop mapping</p>
            </div>
          </div>
          <div className="farmer-preview-item">
            <span className="preview-icon">02</span>
            <div>
              <strong>AI Risk Underwriting</strong>
              <p>10-year satellite rainfall and climate index analysis</p>
            </div>
          </div>
          <div className="farmer-preview-item">
            <span className="preview-icon">03</span>
            <div>
              <strong>Parametric Escrow</strong>
              <p>Instant smart contract claim settlement &lt; 60 seconds</p>
            </div>
          </div>
        </div>

        {showInlineForm && (
          <div className="inline-auth-toggle-box">
            <AuthScreen onLogin={onLogin} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Farmer Portal ──────────────────────────────────────────────── */

export default function FarmerPortal({
  account,
  signer,
  contracts,
  user: propUser,
  token: propToken,
  onLogout: propLogout,
  onOpenAuth,
  onLogin: propLogin
}) {
  // ── Auth ──
  const [farmer, setFarmer] = useState(propUser || null);
  const [token, setToken] = useState(propToken || null);
  const [authChecked, setAuthChecked] = useState(false);

  // Sync with props when passed from App.jsx
  useEffect(() => {
    if (propUser !== undefined) setFarmer(propUser);
  }, [propUser]);

  useEffect(() => {
    if (propToken !== undefined) setToken(propToken);
  }, [propToken]);

  // ── Plots ──
  const [plots, setPlots] = useState([]);
  const [selectedPlotId, setSelectedPlotId] = useState(null);
  const [loadingPlots, setLoadingPlots] = useState(false);
  const [showAddPlot, setShowAddPlot] = useState(false);
  const [newPlotName, setNewPlotName] = useState('');
  const [newPlotLocation, setNewPlotLocation] = useState('');
  const [newPlotCoordinates, setNewPlotCoordinates] = useState(null);
  const [newPlotArea, setNewPlotArea] = useState('');
  const [newPlotBoundary, setNewPlotBoundary] = useState([]);
  const [drawingFarmBoundary, setDrawingFarmBoundary] = useState(false);
  const [newPlotCrop, setNewPlotCrop] = useState('');
  const [addingPlot, setAddingPlot] = useState(false);
  const [plotError, setPlotError] = useState('');
  const [demoError, setDemoError] = useState('');
  const [editingPlotPin, setEditingPlotPin] = useState(false);
  const [plotMapCoordinates, setPlotMapCoordinates] = useState(null);
  const [savingPlotPin, setSavingPlotPin] = useState(false);
  const [plotMapError, setPlotMapError] = useState('');

  // ── Quote ──
  const [coverageAmount, setCoverageAmount] = useState('1.0');
  const [triggerThreshold, setTriggerThreshold] = useState('50');
  const [scenarioRainfall, setScenarioRainfall] = useState('25');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [loadingQuote, setLoadingQuote] = useState(false);

  // ── Policy creation ──
  const [createdPolicy, setCreatedPolicy] = useState(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchasingPolicy, setPurchasingPolicy] = useState(false);

  // ── Oracle ──
  const [oracleResult, setOracleResult] = useState(null);
  const [evaluatingOracle, setEvaluatingOracle] = useState(false);
  const [oracleError, setOracleError] = useState('');
  const [auditVerification, setAuditVerification] = useState(null);
  const [verifyingAudit, setVerifyingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');

  // ── My policies ──
  const [myPolicies, setMyPolicies] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  // ── Check localStorage on mount ──
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedFarmer = localStorage.getItem(FARMER_KEY);
    if (savedToken && savedFarmer) {
      try {
        setToken(savedToken);
        setFarmer(JSON.parse(savedFarmer));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(FARMER_KEY);
      }
    }
    setAuthChecked(true);
  }, []);

  const fetchPlots = useCallback(async (tok) => {
    setLoadingPlots(true);
    try {
      const res = await fetch('/api/auth/plots', { headers: authHeader(tok) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlots(data.plots || []);
      if (data.plots?.length > 0 && !selectedPlotId) {
        setSelectedPlotId(data.plots[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch plots:', err);
    } finally {
      setLoadingPlots(false);
    }
  }, [selectedPlotId]);

  const fetchMyPolicies = useCallback(async (tok) => {
    setLoadingPolicies(true);
    try {
      const res = await fetch('/api/policies/mine', { headers: authHeader(tok) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyPolicies(data.policies || []);
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    } finally {
      setLoadingPolicies(false);
    }
  }, []);

  // Load plots and policies when auth is ready
  useEffect(() => {
    if (farmer && token) {
      fetchPlots(token);
      fetchMyPolicies(token);
    }
  }, [farmer, token]);

  const handleLogin = (farmerData, tok) => {
    setFarmer(farmerData);
    setToken(tok);
    localStorage.setItem(TOKEN_KEY, tok);
    localStorage.setItem(FARMER_KEY, JSON.stringify(farmerData));
    if (propLogin) propLogin(farmerData, tok);
  };

  const handleQuickDemo = async () => {
    setDemoError('');
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Demo service did not return JSON. Restart the SecureHarvest backend, then try again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open demo account.');
      handleLogin(data.farmer, data.token);
    } catch (err) {
      setDemoError(err.message || 'Could not open demo account. Start the application services and try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FARMER_KEY);
    setFarmer(null);
    setToken(null);
    setPlots([]);
    setSelectedPlotId(null);
    setMyPolicies([]);
    setQuote(null);
    setCreatedPolicy(null);
    setOracleResult(null);
    setAuditVerification(null);
    if (propLogout) propLogout();
  };

  const selectedPlot = plots.find((p) => p.id === selectedPlotId) || null;

  useEffect(() => {
    setPlotMapCoordinates(
      selectedPlot?.latitude != null && selectedPlot?.longitude != null
        ? { latitude: Number(selectedPlot.latitude), longitude: Number(selectedPlot.longitude) }
        : null
    );
    setEditingPlotPin(false);
  }, [selectedPlot?.id, selectedPlot?.latitude, selectedPlot?.longitude]);

  const handleSavePlotPin = async () => {
    if (!selectedPlot || !plotMapCoordinates) return;
    setSavingPlotPin(true);
    setPlotMapError('');
    try {
      const res = await fetch(`/api/auth/plots/${selectedPlot.id}/location`, {
        method: 'PATCH',
        headers: authHeader(token),
        body: JSON.stringify(plotMapCoordinates)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the farm pin.');
      setPlots((current) => current.map((plot) => plot.id === data.plot.id ? data.plot : plot));
      setEditingPlotPin(false);
    } catch (error) {
      setPlotMapError(error.message || 'Could not save the farm pin.');
    } finally {
      setSavingPlotPin(false);
    }
  };

  // ── Add plot ──
  const handleAddPlot = async (e) => {
    e.preventDefault();
    setPlotError('');
    if (!newPlotName.trim() || !newPlotLocation.trim() || !newPlotCrop.trim()) {
      setPlotError('Fill in all plot fields.');
      return;
    }
    if (!Number.isFinite(Number(newPlotArea)) || Number(newPlotArea) <= 0) {
      setPlotError('Area must be a positive number.');
      return;
    }
    if (!newPlotCoordinates) {
      setPlotError('Place a farm pin on the map before saving the plot.');
      return;
    }
    setAddingPlot(true);
    try {
      const res = await fetch('/api/auth/plots', {
        method: 'POST',
        headers: authHeader(token),
        body: JSON.stringify({
          name: newPlotName.trim(),
          location: newPlotLocation.trim(),
          latitude: newPlotCoordinates.latitude,
          longitude: newPlotCoordinates.longitude,
          areaAcres: Number(newPlotArea),
          boundary: newPlotBoundary.length >= 3 ? newPlotBoundary : undefined,
          cropType: newPlotCrop.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add plot.');
      const updated = [...plots, data.plot];
      setPlots(updated);
      setSelectedPlotId(data.plot.id);
      setNewPlotName('');
      setNewPlotLocation('');
      setNewPlotCoordinates(null);
      setNewPlotBoundary([]);
      setDrawingFarmBoundary(false);
      setNewPlotArea('');
      setNewPlotCrop('');
      setShowAddPlot(false);
    } catch (err) {
      setPlotError(err.message);
    } finally {
      setAddingPlot(false);
    }
  };

  const handleDeletePlot = async (plotId) => {
    try {
      const res = await fetch(`/api/auth/plots/${plotId}`, {
        method: 'DELETE',
        headers: authHeader(token),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Could not delete plot.');
      }
      const remaining = plots.filter((p) => p.id !== plotId);
      setPlots(remaining);
      if (selectedPlotId === plotId) {
        setSelectedPlotId(remaining.length > 0 ? remaining[0].id : null);
        setQuote(null);
        setCreatedPolicy(null);
        setOracleResult(null);
      }
    } catch (err) {
      console.error('Delete plot failed:', err);
    }
  };

  // ── Quote ──
  const fetchQuote = async () => {
    if (!selectedPlot) {
      setQuoteError('Select a plot first.');
      return;
    }
    if (!Number.isFinite(Number(coverageAmount)) || Number(coverageAmount) <= 0) {
      setQuoteError('Coverage must be greater than zero.');
      return;
    }
    if (!Number.isFinite(Number(triggerThreshold)) || Number(triggerThreshold) < 0) {
      setQuoteError('Enter a valid rainfall threshold.');
      return;
    }
    setLoadingQuote(true);
    setQuoteError('');
    setQuote(null);
    setPurchaseError('');
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plotId: String(selectedPlot.id),
          location: selectedPlot.location,
          latitude: selectedPlot.latitude,
          longitude: selectedPlot.longitude,
          coverageAmount: Number(coverageAmount),
          triggerThreshold: Number(triggerThreshold),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not calculate the quote.');
      setQuote(data);
    } catch (err) {
      setQuoteError(err.message || 'Could not retrieve rainfall data.');
    } finally {
      setLoadingQuote(false);
    }
  };

  // ── Create policy ──
  const handlePurchasePolicy = async () => {
    if (!quote || !selectedPlot) {
      setPurchaseError('Select a plot and calculate a quote first.');
      return;
    }
    const premium = Number(quote.recommendedPremium);
    if (!Number.isFinite(premium) || premium <= 0) {
      setPurchaseError('The quote does not contain a valid premium.');
      return;
    }
    setPurchasingPolicy(true);
    setPurchaseError('');
    setCreatedPolicy(null);
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: authHeader(token),
        body: JSON.stringify({
          plotId: String(selectedPlot.id),
          location: selectedPlot.location,
          coverageAmount: Number(coverageAmount),
          premiumAmount: premium,
          triggerThreshold: Number(triggerThreshold),
          quoteHash: quote.quoteHash || null,
          latitude: selectedPlot.latitude ?? null,
          longitude: selectedPlot.longitude ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the simulated policy.');
      setCreatedPolicy(data.policy);
      // Refresh the policies list
      fetchMyPolicies(token);
    } catch (err) {
      setPurchaseError(err.message || 'Could not create the simulated policy.');
    } finally {
      setPurchasingPolicy(false);
    }
  };

  // ── Oracle evaluation ──
  const evaluateOracleConsensus = async () => {
    if (!createdPolicy) {
      setOracleError('Create a simulated policy before evaluating its oracle conditions.');
      return;
    }
    setEvaluatingOracle(true);
    setOracleError('');
    setAuditVerification(null);
    try {
      const res = await fetch('/api/oracle/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: createdPolicy.id,
          plotId: createdPolicy.plotId,
          triggerThreshold: createdPolicy.triggerThreshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Oracle evaluation failed.');
      setOracleResult(data);
      // Refresh policies to show updated oracle status
      fetchMyPolicies(token);
    } catch (err) {
      setOracleError(err.message || 'Could not evaluate oracle feeds.');
    } finally {
      setEvaluatingOracle(false);
    }
  };

  const verifyAuditHash = async (auditId) => {
    setVerifyingAudit(true);
    setAuditError('');
    setAuditVerification(null);
    try {
      const res = await fetch(`/api/oracle/audit/${auditId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit verification failed.');
      setAuditVerification(data);
    } catch (err) {
      setAuditError(err.message || 'Could not verify the audit record.');
    } finally {
      setVerifyingAudit(false);
    }
  };


  // ── Derived ──
  const rainfall = quote?.environmentalData?.rainfall;
  const ndvi = quote?.environmentalData?.ndvi;
  const basisRisk = quote?.basisRisk;
  const readings = oracleResult?.readings || [];

  // ── Render ──
  if (!authChecked) return null;

  if (!farmer) {
    return (
      <FarmerWelcomeScreen
        onOpenAuth={onOpenAuth}
        onLogin={handleLogin}
        onQuickDemo={handleQuickDemo}
        error={demoError}
      />
    );
  }

  return (
    <div className="farmer-page">
      {/* ── Farmer header bar ── */}
      <div className="farmer-account-bar">
        <div>
          <span className="farmer-account-name">{farmer.name}</span>
          <span className="farmer-account-email">{farmer.email}</span>
        </div>
        <button className="btn-ghost" onClick={handleLogout}>Sign out</button>
      </div>

      {/* ── 01 Plot management ── */}
      <section className="farm-location-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">01 / PLOTS</p>
            <h2>Your registered plots</h2>
            <p className="section-description">
              Select a plot to use for quoting and policy creation. Plots are saved to your account.
            </p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => {
              setShowAddPlot((visible) => !visible);
              setPlotError('');
              if (showAddPlot) {
                setNewPlotName('');
                setNewPlotLocation('');
                setNewPlotCoordinates(null);
                setNewPlotBoundary([]);
                setDrawingFarmBoundary(false);
                setNewPlotArea('');
                setNewPlotCrop('');
              }
            }}
          >
            {showAddPlot ? 'Cancel' : '+ Add plot'}
          </button>
        </div>

        {/* Add plot form */}
        {showAddPlot && (
          <form className="add-plot-form" onSubmit={handleAddPlot}>
            <div className="add-plot-grid">
              <div className="form-field">
                <label htmlFor="plot-name">Plot name</label>
                <input id="plot-name" className="form-control" type="text" value={newPlotName} onChange={(e) => setNewPlotName(e.target.value)} placeholder="e.g. North Field" required />
              </div>
              <div className="form-field">
                <label htmlFor="plot-location">Location</label>
                <input id="plot-location" className="form-control" type="text" value={newPlotLocation} onChange={(e) => setNewPlotLocation(e.target.value)} placeholder="District, State, Country" required />
              </div>
              <div className="form-field">
                <label htmlFor="plot-area">Area (acres)</label>
                <input id="plot-area" className="form-control" type="number" min="0.01" step="any" value={newPlotBoundary.length >= 3 ? boundaryAcres(newPlotBoundary).toFixed(2) : newPlotArea} onChange={(e) => setNewPlotArea(e.target.value)} placeholder="e.g. 12.5" readOnly={newPlotBoundary.length >= 3} required />
              </div>
              <div className="form-field">
                <label htmlFor="plot-crop">Crop type</label>
                <input id="plot-crop" className="form-control" type="text" value={newPlotCrop} onChange={(e) => setNewPlotCrop(e.target.value)} placeholder="e.g. Rice, Wheat" required />
              </div>
            </div>
            <FarmLocationMap
              query={newPlotLocation}
              value={newPlotCoordinates}
              onChange={setNewPlotCoordinates}
              boundary={newPlotBoundary}
              drawingBoundary={drawingFarmBoundary}
              onBoundaryChange={(points) => {
                setNewPlotBoundary(points);
                if (points.length >= 3) setNewPlotArea(boundaryAcres(points).toFixed(2));
              }}
              onPlaceResolved={(place) => {
                setNewPlotLocation(place);
                setPlotError('');
              }}
            />
            <div className="farm-boundary-actions">
              <span>{newPlotBoundary.length >= 3 ? `Outlined area: ${boundaryAcres(newPlotBoundary).toFixed(2)} acres` : `${newPlotBoundary.length} boundary points · add at least 3 to calculate acreage`}</span>
              <button type="button" className="btn-secondary" onClick={() => setDrawingFarmBoundary((drawing) => !drawing)}>{drawingFarmBoundary ? 'Finish outline' : 'Draw farm boundary'}</button>
              {newPlotBoundary.length > 0 && <button type="button" className="btn-ghost" onClick={() => { setNewPlotBoundary([]); setNewPlotArea(''); }}>Clear outline</button>}
            </div>
            {plotError && <p className="inline-error" role="alert">{plotError}</p>}
            <button type="submit" className="btn-primary" disabled={addingPlot}>
              {addingPlot ? 'Saving...' : 'Save plot'}
            </button>
          </form>
        )}

        {/* Plot list */}
        {loadingPlots ? (
          <p className="empty-state">Loading your plots…</p>
        ) : plots.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No plots yet</p>
            <p>Add a plot above to get started with insurance quotes and policies.</p>
          </div>
        ) : (
          <div className="plot-list">
            {plots.map((plot) => (
              <div
                key={plot.id}
                className={`plot-item ${selectedPlotId === plot.id ? 'plot-item-selected' : ''}`}
                onClick={() => {
                  setSelectedPlotId(plot.id);
                  setQuote(null);
                  setPurchaseError('');
                  setCreatedPolicy(null);
                  setOracleResult(null);
                }}
              >
                <div className="plot-item-info">
                  <strong>{plot.name}</strong>
                  <span className="metric-caption">{plot.location}</span>
                  <span className="metric-caption">{plot.cropType} · {plot.areaAcres} acres</span>
                </div>
                <div className="plot-item-actions">
                  {selectedPlotId === plot.id && (
                    <span className="sh-badge badge-active">Selected</span>
                  )}
                  <button
                    className="btn-ghost-danger"
                    onClick={(e) => { e.stopPropagation(); handleDeletePlot(plot.id); }}
                    title="Delete plot"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedPlot && (
          <section className="selected-farm-map-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">SELECTED FARM</p>
                <h3>{selectedPlot.name} map pin</h3>
                <p className="section-description">{selectedPlot.location} · {selectedPlot.cropType} · {selectedPlot.areaAcres} acres</p>
              </div>
              {selectedPlot.latitude != null && !editingPlotPin && (
                <button type="button" className="btn-ghost" onClick={() => {
                  setPlotMapCoordinates({ latitude: Number(selectedPlot.latitude), longitude: Number(selectedPlot.longitude) });
                  setEditingPlotPin(true);
                }}>Move pin</button>
              )}
            </div>
            {selectedPlot.latitude != null || editingPlotPin ? (
              <>
                <FarmLocationMap
                  query={selectedPlot.location}
                  value={plotMapCoordinates}
                  boundary={selectedPlot.boundary || []}
                  onChange={setPlotMapCoordinates}
                  readOnly={!editingPlotPin}
                />
                {plotMapError && <p className="inline-error" role="alert">{plotMapError}</p>}
                {editingPlotPin && (
                  <div className="farm-map-edit-actions">
                    <button type="button" className="btn-secondary" onClick={() => {
                      setPlotMapCoordinates(selectedPlot.latitude != null
                        ? { latitude: Number(selectedPlot.latitude), longitude: Number(selectedPlot.longitude) }
                        : null);
                      setEditingPlotPin(false);
                    }}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={handleSavePlotPin} disabled={!plotMapCoordinates || savingPlotPin}>
                      {savingPlotPin ? 'Saving pin…' : 'Save map pin'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="farm-map-missing">
                <p>This saved plot has no map pin yet.</p>
                <button type="button" className="btn-secondary" onClick={() => setEditingPlotPin(true)}>Set map pin</button>
              </div>
            )}
          </section>
        )}

        <p className="field-help">
          Historical rainfall source: NASA POWER. Data availability depends on the location and source response.
        </p>
      </section>

      <div className="farmer-content-grid">
        {/* ── 02 Quote ── */}
        <div className="quote-column">
          <section className="quote-overview">
            <div className="section-heading">
              <div>
                <p className="section-kicker">02 / RISK ASSESSMENT</p>
                <h2>Your insurance estimate</h2>
              </div>
              <span className={`text-status ${quote ? 'status-ready' : ''}`}>
                {loadingQuote ? 'Calculating' : quote ? 'Quote ready' : 'Awaiting quote'}
              </span>
            </div>

            {!selectedPlot && !loadingPlots && (
              <div className="empty-state">
                <p className="empty-state-title">No plot selected</p>
                <p>Add and select a plot above to generate a quote.</p>
              </div>
            )}

            {selectedPlot && !quote && !loadingQuote && (
              <div className="empty-state">
                <p className="empty-state-title">No estimate yet</p>
                <p>Configure coverage and calculate a location-based quote.</p>
              </div>
            )}

            {loadingQuote && (
              <div className="empty-state">
                <p className="empty-state-title">Retrieving climate data</p>
                <p>The service is processing your location and calculating an estimate.</p>
              </div>
            )}

            {quote && (
              <>
                <div className="quote-primary-metric">
                  <span className="metric-label">Recommended premium</span>
                  <div className="premium-value">
                    {quote.recommendedPremium}
                    <span>ETH</span>
                  </div>
                  <p className="metric-caption">{quote.premiumRatePercent}% premium rate</p>
                </div>

                <div className="quote-secondary-metrics">
                  <div className="simple-metric">
                    <span className="metric-label">Estimated drought probability</span>
                    <strong>{(Number(quote.droughtProbability) * 100).toFixed(1)}%</strong>
                    <span className="metric-caption">Model estimate, not a verified forecast</span>
                  </div>
                  <div className="simple-metric">
                    <span className="metric-label">Basis risk score</span>
                    <strong>
                      {basisRisk?.basis_risk_score ?? '—'}
                      {basisRisk?.basis_risk_score != null ? '/100' : ''}
                    </strong>
                    <span className="metric-caption">
                      {basisRisk?.category ? `${basisRisk.category} category` : 'Not available'}
                    </span>
                  </div>
                </div>

                {basisRisk?.explanation && (
                  <p className="basis-explanation">{basisRisk.explanation}</p>
                )}

                <div className="quote-hash">
                  <span className="metric-label">Quote SHA-256 hash</span>
                  <code>{quote.quoteHash || 'Not provided'}</code>
                </div>

                {quote.location && (
                  <div className="resolved-location">
                    <span className="resolved-label">Resolved location</span>
                    <span>{quote.location.displayName}</span>
                    <span className="coordinates">
                      {Number(quote.location.latitude).toFixed(5)},{' '}
                      {Number(quote.location.longitude).toFixed(5)}
                    </span>
                  </div>
                )}
              </>
            )}
          </section>

          {quote && (
            <section className="data-section">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">CLIMATE DATA</p>
                  <h3>Historical rainfall</h3>
                </div>
                <span className="source-label">{rainfall?.source || 'Source unavailable'}</span>
              </div>

              {rainfall ? (
                <>
                  <div className="rainfall-metrics">
                    <div className="rainfall-metric">
                      <span className="metric-label">Mean monthly rainfall</span>
                      <strong>{rainfall.historicalRainfallMean} <span>mm</span></strong>
                    </div>
                    <div className="rainfall-metric">
                      <span className="metric-label">Rainfall variability</span>
                      <strong>{rainfall.historicalRainfallStd} <span>mm</span></strong>
                    </div>
                  </div>
                  <p className="data-caption">
                    Historical period: {rainfall.periodStart} to {rainfall.periodEnd}
                  </p>
                  {Array.isArray(rainfall.monthlyTotalsSample) && rainfall.monthlyTotalsSample.length > 0 && (
                    <div className="rainfall-chart" role="img" aria-label={`Rainfall for the latest ${rainfall.monthlyTotalsSample.length} available months, in millimeters`}>
                      <div className="rainfall-chart-heading"><strong>Recent monthly totals</strong><span>mm · {rainfall.periodEnd}</span></div>
                      <div className="rainfall-bars">
                        {rainfall.monthlyTotalsSample.map((amount, index) => {
                          const maximum = Math.max(...rainfall.monthlyTotalsSample.map(Number), 1);
                          return <div className="rainfall-bar-column" key={`${index}-${amount}`} title={`${Number(amount).toFixed(1)} mm`}><span className="rainfall-bar-value">{Math.round(Number(amount))}</span><span className="rainfall-bar" style={{ height: `${Math.max(Number(amount) / maximum * 100, 3)}%` }} /><small>{index + 1}</small></div>;
                        })}
                      </div>
                      <p className="field-help">The quote provides a 12 month sample from the historical rainfall record.</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="field-help">Rainfall statistics were not included in this quote.</p>
              )}

              <div className="data-divider" />

              <div className="ndvi-row">
                <div>
                  <span className="metric-label">Satellite vegetation data (NDVI)</span>
                  <p className="ndvi-description">
                    {ndvi?.status === 'AVAILABLE'
                      ? `NDVI value: ${ndvi.value}`
                      : 'Not configured. Satellite vegetation measurements are not currently available.'}
                  </p>
                </div>
                <span className="text-status">
                  {ndvi?.status === 'AVAILABLE' ? 'Available' : 'Unavailable'}
                </span>
              </div>

              <div className="prototype-notice">
                <strong>Prototype risk estimate</strong>
                <p>
                  The model was trained on synthetic data. In an initial holdout check using NASA POWER
                  rainfall for five example locations (1981–2000 baseline, 2001–2024 holdout; June–September
                  rainfall at least 20% below normal), its Brier score was 0.271 versus 0.124 for a
                  historical-rate baseline (lower is better). This tests rainfall deficits, not crop
                  losses, and the model performed worse than the baseline. It also does not use the
                  policy's selected rainfall threshold.
                </p>
              </div>
            </section>
          )}
        </div>

        {/* ── 03 Policy setup ── */}
        <section className="policy-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">03 / POLICY SETUP</p>
              <h2>Configure coverage</h2>
              <p className="section-description">
                Set the coverage amount and rainfall threshold, then get a quote and create a policy.
              </p>
            </div>
          </div>

          <div className="policy-form">
            <div className="form-field">
              <label htmlFor="coverage-amount">Coverage amount (ETH)</label>
              <input
                id="coverage-amount"
                type="number"
                min="0.000001"
                step="any"
                className="form-control"
                value={coverageAmount}
                onChange={(e) => setCoverageAmount(e.target.value)}
              />
              <p className="field-help">The amount of coverage requested for this policy.</p>
            </div>

            <div className="form-field">
              <label htmlFor="rainfall-threshold">Rainfall trigger threshold (mm)</label>
              <input
                id="rainfall-threshold"
                type="number"
                min="0"
                step="any"
                className="form-control"
                value={triggerThreshold}
                onChange={(e) => setTriggerThreshold(e.target.value)}
              />
              <p className="field-help">
                The configured threshold used by the policy and oracle evaluation.
              </p>
            </div>

            {quoteError && <p className="inline-error" role="alert">{quoteError}</p>}

            <button
              type="button"
              className="btn-secondary"
              onClick={fetchQuote}
              disabled={loadingQuote || !selectedPlot}
            >
              {loadingQuote ? 'Calculating quote...' : 'Calculate quote'}
            </button>

            <div className="policy-summary">
              <div>
                <span className="metric-label">Selected plot</span>
                <strong>{selectedPlot ? `${selectedPlot.name} — ${selectedPlot.location}` : 'No plot selected'}</strong>
              </div>
              <div>
                <span className="metric-label">Estimated premium</span>
                <strong>{quote ? `${quote.recommendedPremium} ETH` : 'Calculate a quote first'}</strong>
              </div>
              <div>
                <span className="metric-label">Mode</span>
                <strong>Simulation (no payment)</strong>
              </div>
            </div>

            <div className="payout-explorer">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">POLICY EXPLORER</p>
                  <h3>Try a rainfall scenario</h3>
                  <p className="section-description">Move the rainfall amount to see how your selected trigger changes the claim decision.</p>
                </div>
              </div>
              <label className="scenario-control-label" htmlFor="scenario-rainfall">
                Scenario rainfall <strong>{Number(scenarioRainfall || 0).toFixed(1)} mm</strong>
              </label>
              <input id="scenario-rainfall" className="scenario-slider" type="range" min="0" max="200" step="1" value={scenarioRainfall} onChange={(event) => setScenarioRainfall(event.target.value)} />
              <div className="scenario-scale"><span>0 mm</span><span>Trigger: {Number(triggerThreshold || 0)} mm</span><span>200 mm</span></div>
              <div className={`scenario-result ${Number(scenarioRainfall) <= Number(triggerThreshold) ? 'scenario-triggered' : ''}`} aria-live="polite">
                <div><span className="metric-label">Result at this reading</span><strong>{Number(scenarioRainfall) <= Number(triggerThreshold) ? 'Trigger condition met' : 'Trigger condition not met'}</strong></div>
                <div><span className="metric-label">Illustrative payout</span><strong>{Number(scenarioRainfall) <= Number(triggerThreshold) ? `${Number(coverageAmount || 0).toFixed(3)} ETH` : '0 ETH'}</strong></div>
              </div>
              <p className="field-help">Interactive policy preview only. It does not change a policy, use live readings, or send a payment.</p>
            </div>

            <button
              className="btn-primary purchase-button"
              onClick={handlePurchasePolicy}
              disabled={purchasingPolicy || !quote || !selectedPlot}
            >
              {purchasingPolicy ? 'Saving policy...' : 'Create simulated policy'}
            </button>

            {purchaseError && <p className="inline-error" role="alert">{purchaseError}</p>}

            {createdPolicy && (
              <div className="success-panel" role="status">
                <strong>Simulated policy created successfully</strong>
                <p>Policy #{createdPolicy.id} saved. No premium was charged and no blockchain transaction occurred.</p>
                <p>Plot: {selectedPlot?.name} — {createdPolicy.location}</p>
                <p>Coverage: {createdPolicy.coverageAmount} ETH · Premium: {createdPolicy.premiumAmount} ETH</p>
                <p>Status: {createdPolicy.status}</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 04 Oracle evaluation ── */}
      <section className="oracle-section">
        <div className="section-heading oracle-heading">
          <div>
            <p className="section-kicker">04 / VERIFICATION</p>
            <h2>Oracle and audit records</h2>
            <p className="section-description">
              Run the oracle evaluation for the most recently created policy and inspect its audit record.
            </p>
          </div>
          <button
            className="btn-secondary"
            onClick={evaluateOracleConsensus}
            disabled={evaluatingOracle || !createdPolicy}
          >
            {evaluatingOracle ? 'Evaluating...' : 'Evaluate oracle'}
          </button>
        </div>

        {oracleError && <p className="inline-error" role="alert">{oracleError}</p>}

        {!oracleResult && !evaluatingOracle && (
          <p className="empty-state">
            {createdPolicy
              ? 'No evaluation result yet. Run the oracle evaluation to inspect the response.'
              : 'Create a simulated policy first, then run oracle evaluation.'}
          </p>
        )}

        {evaluatingOracle && (
          <p className="empty-state">Waiting for the oracle evaluation response…</p>
        )}

        {oracleResult && (
          <>
            <div className="oracle-metrics">
              <div className="oracle-metric">
                <span className="metric-label">Rainfall forecast</span>
                <strong>{readings[0]?.value ?? '—'}</strong>
                <span className="metric-caption">{readings[0]?.unit || 'mm'} · {readings[0]?.provider || readings[0]?.source || 'Rainfall source'} · {readings[0]?.mode || 'unknown source status'}</span>
              </div>
              <div className="oracle-metric">
                <span className="metric-label">Soil moisture estimate</span>
                <strong>{readings[1]?.value ?? '—'}</strong>
                <span className="metric-caption">{readings[1]?.unit || ''} · {readings[1]?.provider || readings[1]?.source || 'Soil moisture source'} · {readings[1]?.mode || 'unknown source status'}</span>
              </div>
              <div className="oracle-metric">
                <span className="metric-label">Evaluation outcome</span>
                <strong className="oracle-outcome">{oracleResult.status || 'Not provided'}</strong>
                <span className="metric-caption">Rainfall used for trigger: {oracleResult.averageReading ?? "Unavailable"} mm</span>
              </div>
              <div className="oracle-metric">
                <span className="metric-label">Reason</span>
                <span className="metric-caption">{oracleResult.reason || '—'}</span>
              </div>
            </div>

            <div className="audit-record">
              <div className="audit-record-details">
                <span className="metric-label">Audit record</span>
                <strong>Cryptographic audit trail</strong>
                <span className="audit-id">Audit ID: {oracleResult.auditId ?? 'Not provided'}</span>
                <code>{oracleResult.auditHash ?? 'Hash not provided'}</code>
              </div>
              {oracleResult.auditId != null && (
                <button
                  className="btn-secondary"
                  onClick={() => verifyAuditHash(oracleResult.auditId)}
                  disabled={verifyingAudit}
                >
                  {verifyingAudit ? 'Verifying...' : 'Verify audit hash'}
                </button>
              )}
            </div>

            {auditError && <p className="inline-error" role="alert">{auditError}</p>}

            {auditVerification && (
              <div className={`verification-result ${auditVerification.valid ? 'verification-valid' : 'verification-invalid'}`}>
                <strong>{auditVerification.valid ? 'Audit verification passed' : 'Audit verification failed'}</strong>
                <p>
                  {auditVerification.valid
                    ? 'The backend reports that the audit hash is valid.'
                    : 'The backend reports that the audit hash could not be validated.'}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── 05 My Policies ── */}
      <section className="my-policies-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">05 / HISTORY</p>
            <h2>My policies</h2>
            <p className="section-description">
              All insurance policies created under your account, with their current statuses.
            </p>
          </div>
          <button className="btn-ghost" onClick={() => fetchMyPolicies(token)} disabled={loadingPolicies}>
            {loadingPolicies ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loadingPolicies ? (
          <p className="empty-state">Loading your policies…</p>
        ) : myPolicies.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No policies yet</p>
            <p>Policies you create will appear here and persist across sessions.</p>
          </div>
        ) : (
          <div className="policy-history-list">
            {myPolicies.map((p) => (
              <div key={p.id} className="policy-history-item">
                <div className="policy-history-main">
                  <div className="policy-history-id">Policy #{p.id}</div>
                  <div className="policy-history-location">{p.location}</div>
                  <div className="policy-history-meta">
                    Coverage: {p.coverageAmount} ETH &nbsp;·&nbsp; Premium: {p.premiumAmount} ETH &nbsp;·&nbsp; Threshold: {p.triggerThreshold} mm
                  </div>
                  <div className="policy-history-meta">
                    Created: {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="policy-history-badges">
                  <StatusBadge status={p.status} />
                  <OracleBadge status={p.oracleStatus} />
                </div>
                <PolicyTimeline policyId={p.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
