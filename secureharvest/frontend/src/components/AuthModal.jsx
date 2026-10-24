import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

const TOKEN_KEY = 'sh_farmer_token';
const FARMER_KEY = 'sh_farmer_info';

export default function AuthModal({ isOpen, onClose, onLogin, initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = tab === 'login' ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication request failed.');
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(FARMER_KEY, JSON.stringify(data.farmer));

      setSuccessMsg(tab === 'login' ? 'Signed in successfully!' : 'Account registered successfully!');
      setTimeout(() => {
        onLogin(data.farmer, data.token);
        onClose();
      }, 500);
    } catch (err) {
      console.error('Auth error:', err);
      // If the backend server is unreachable or offline, offer demo fallback option
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('The service is offline. Use the demo account to explore the interface.');
      } else {
        setError(err.message || 'Authentication failed. Please verify your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setError('');
    setLoading(true);
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
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(FARMER_KEY, JSON.stringify(data.farmer));
      onLogin(data.farmer, data.token);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not open demo account. Start the application services and try again.');
      setLoading(false);
    }
  };

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setError('');
    setSuccessMsg('');
  };

  return (
    <div className="sh-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sh-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal close button */}
        <button
          type="button"
          className="sh-modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="sh-modal-header">
          <div className="sh-modal-icon-badge">
            <ShieldCheck size={22} className="text-primary" />
          </div>
          <div>
            <span className="sh-modal-kicker">SECUREHARVEST PROTOCOL</span>
            <h2 className="sh-modal-title">
              {tab === 'login' ? 'Sign in to your account' : 'Create an account'}
            </h2>
            <p className="sh-modal-subtitle">
              {tab === 'login'
                ? 'Access your farm plots, policies, oracle evaluations, and capital dashboard.'
                : 'Join the parametric crop insurance network to register plots and protect your yield.'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="sh-auth-nav-tabs">
          <button
            type="button"
            className={`sh-auth-nav-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`sh-auth-nav-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Create Account
          </button>
        </div>

        {/* Demo Fast Login Banner */}
        <div className="sh-demo-pill-banner">
          <div className="sh-demo-pill-content">
            <Sparkles size={16} className="sh-demo-sparkle" />
            <div>
              <span className="sh-demo-title">Evaluating or presenting?</span>
              <p className="sh-demo-desc">Use 1-click demo access to test all portals instantly.</p>
            </div>
          </div>
          <button
            type="button"
            className="sh-demo-btn"
            onClick={handleQuickDemo}
            disabled={loading}
          >
            Open demo account
          </button>
        </div>

        {/* Form */}
        <form className="sh-auth-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="sh-field-group">
              <label htmlFor="modal-name">Full name</label>
              <div className="sh-input-wrapper">
                <User size={16} className="sh-input-icon" />
                <input
                  id="modal-name"
                  type="text"
                  className="form-control sh-icon-input"
                  placeholder="e.g. Rajesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="sh-field-group">
            <label htmlFor="modal-email">Email address</label>
            <div className="sh-input-wrapper">
              <Mail size={16} className="sh-input-icon" />
              <input
                id="modal-email"
                type="email"
                className="form-control sh-icon-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="sh-field-group">
            <div className="sh-label-split">
              <label htmlFor="modal-password">Password</label>
              {tab === 'register' && <span className="sh-hint">At least 8 characters</span>}
            </div>
            <div className="sh-input-wrapper">
              <Lock size={16} className="sh-input-icon" />
              <input
                id="modal-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control sh-icon-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="sh-pwd-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="sh-alert-error" role="alert">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="sh-alert-success" role="status">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary sh-submit-auth-btn"
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{tab === 'login' ? 'Sign in to platform' : 'Create farmer account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer note */}
        <div className="sh-modal-footer">
          {tab === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                className="sh-link-button"
                onClick={() => switchTab('register')}
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                className="sh-link-button"
                onClick={() => switchTab('login')}
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
