import React, { useState } from 'react';
import {
  TrendingUp,
  CloudRain,
  Sprout,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
  Check
} from 'lucide-react';

const REGIONS = [
  { id: 'karnataka', name: 'Dharwad, Karnataka', defaultCrop: 'Cotton', baseRisk: 0.048, rainfallNorm: 65 },
  { id: 'maharashtra', name: 'Vidarbha, Maharashtra', defaultCrop: 'Soybean', baseRisk: 0.052, rainfallNorm: 55 },
  { id: 'punjab', name: 'Ludhiana, Punjab', defaultCrop: 'Wheat', baseRisk: 0.035, rainfallNorm: 70 },
  { id: 'tamilnadu', name: 'Thanjavur, Tamil Nadu', defaultCrop: 'Rice', baseRisk: 0.042, rainfallNorm: 80 },
  { id: 'telangana', name: 'Warangal, Telangana', defaultCrop: 'Maize', baseRisk: 0.046, rainfallNorm: 60 }
];

const CROPS = [
  { id: 'Rice', name: 'Basmati Rice', icon: 'RI', waterNeed: 'High', threshold: 30 },
  { id: 'Wheat', name: 'Wheat', icon: 'WH', waterNeed: 'Moderate', threshold: 22 },
  { id: 'Cotton', name: 'Cotton', icon: 'CO', waterNeed: 'Moderate', threshold: 25 },
  { id: 'Sugarcane', name: 'Sugarcane', icon: 'SU', waterNeed: 'High', threshold: 35 },
  { id: 'Maize', name: 'Maize', icon: 'MA', waterNeed: 'Low', threshold: 18 },
  { id: 'Soybean', name: 'Soybean', icon: 'SO', waterNeed: 'Low-Mod', threshold: 20 }
];

const FAQS = [
  {
    q: 'What is parametric crop insurance and how is it different from traditional insurance?',
    a: 'A parametric policy defines a measurable weather threshold in advance. This project demonstrates how rainfall readings can be compared with that threshold. In the current demo, policy creation and payout are simulated unless a connected, configured contract is used.'
  },
  {
    q: 'How does SecureHarvest prevent oracle tampering or sensor inaccuracy?',
    a: 'The demo compares multiple readings against a configured tolerance. When readings disagree, it flags the evaluation for review instead of showing an automatic decision.'
  },
  {
    q: 'How do capital providers earn yields in the Investor Pool?',
    a: 'Premiums can increase pool value, while claim payouts reduce it. LP shares represent a proportional claim on pool assets. Returns vary with premiums, claims, and liquidity; they are not guaranteed. In this demo, policy premiums are simulated and do not represent collected funds.'
  },
  {
    q: 'Can I test the platform without real cryptocurrency or MetaMask?',
    a: 'Yes! SecureHarvest includes a full simulated mode. You can test plot registration, AI pricing quotes, oracle evaluations, and investor deposits directly in your browser. You can also connect MetaMask on local Hardhat or testnets when ready.'
  }
];

export default function LandingPage({
  user,
  onNavigate,
  onOpenAuth,
  account,
  onConnectWallet
}) {
  // Simulator State
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [acres, setAcres] = useState(5);
  const [simulatingTrigger, setSimulatingTrigger] = useState(false);
  const [triggerSimResult, setTriggerSimResult] = useState(null);

  // FAQ open states
  const [openFaq, setOpenFaq] = useState(0);

  // Calculate live estimates
  const coverageEth = (acres * 0.45).toFixed(2);
  const premiumEth = (coverageEth * selectedRegion.baseRisk * 1.15).toFixed(3);
  const thresholdMm = selectedCrop.threshold;

  const handleSimulateTrigger = () => {
    setSimulatingTrigger(true);
    setTriggerSimResult(null);

    setTimeout(() => {
      setSimulatingTrigger(false);
      setTriggerSimResult({
        openMeteo: (thresholdMm - 7.4).toFixed(1),
        nasaPower: (thresholdMm - 6.8).toFixed(1),
        groundSensor: (thresholdMm - 8.1).toFixed(1),
        average: (thresholdMm - 7.4).toFixed(1),
        payoutEth: coverageEth,
        status: 'CRITICAL_DROUGHT_CONFIRMED'
      });
    }, 900);
  };

  return (
    <div className="landing-wrapper">
      {/* ──────────────── Hero Section ──────────────── */}
      <section className="landing-hero">
        <div className="hero-top-badge">
          <span className="hero-badge-dot" />
          <span className="hero-badge-text">CLIMATE COVER FOR SMALLHOLDER FARMS</span>
        </div>

        <h1 className="hero-headline">
          Crop protection,
          <br />
          <span className="hero-gradient-text">made clear and accessible.</span>
        </h1>

        <p className="hero-subheadline">
          Explore how weather based cover can work: get a transparent quote, see how a rainfall trigger
          is evaluated, and follow the decision through a clear policy journey.
        </p>

        <div className="hero-cta-cluster">
          <button
            type="button"
            className="btn-primary hero-btn-main"
            onClick={() => onNavigate('farmer')}
          >
            <Sprout size={18} />
            <span>Launch Farmer Portal</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="btn-secondary hero-btn-alt"
            onClick={() => onNavigate('investor')}
          >
            <TrendingUp size={18} />
            <span>Explore Investor Pool</span>
          </button>

          {!user && (
            <button
              type="button"
              className="btn-secondary hero-btn-alt"
              onClick={() => onOpenAuth('register')}
            >
              <Sparkles size={18} className="text-tertiary" />
              <span>Create Account</span>
            </button>
          )}
        </div>

        {/* Live Protocol Metric Strip */}
        <div className="hero-metrics-strip">
          <div className="hero-metric-item">
            <span className="metric-label">Coverage model</span>
            <strong className="metric-val">Rainfall index</strong>
            <span className="metric-sub">A defined threshold for each policy</span>
          </div>
          <div className="hero-metric-divider" />
          <div className="hero-metric-item">
            <span className="metric-label">Policy journey</span>
            <strong className="metric-val text-success">4 clear steps</strong>
            <span className="metric-sub">Plot, quote, cover, evaluation</span>
          </div>
          <div className="hero-metric-divider" />
          <div className="hero-metric-item">
            <span className="metric-label">Decision process</span>
            <strong className="metric-val">Multi-source</strong>
            <span className="metric-sub">Disagreements are flagged for review</span>
          </div>
          <div className="hero-metric-divider" />
          <div className="hero-metric-item">
            <span className="metric-label">Built for</span>
            <strong className="metric-val">Small farms</strong>
            <span className="metric-sub">Simple, transparent protection</span>
          </div>
        </div>
      </section>

      {/* ──────────────── Interactive Parametric Simulator ──────────────── */}
      <section className="landing-simulator-section">
        <div className="section-header-centered">
          <p className="section-kicker">01 / POLICY PREVIEW</p>
          <h2>Explore a sample policy</h2>
          <p className="section-description">
            Adjust the example crop and farm size to see how a coverage estimate changes, then preview
            how a rainfall trigger decision would appear.
          </p>
        </div>

        <div className="simulator-card glass-card">
          <div className="simulator-grid">
            {/* Left Controls */}
            <div className="sim-controls">
              <div className="sim-field">
                <label className="sim-label">Agricultural Region</label>
                <div className="sim-chips">
                  {REGIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`sim-chip ${selectedRegion.id === r.id ? 'active' : ''}`}
                      onClick={() => setSelectedRegion(r)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sim-field">
                <label className="sim-label">Target Crop</label>
                <div className="sim-crop-grid">
                  {CROPS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`sim-crop-btn ${selectedCrop.id === c.id ? 'active' : ''}`}
                      onClick={() => setSelectedCrop(c)}
                    >
                      <span className="crop-icon">{c.icon}</span>
                      <span className="crop-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="sim-field">
                <div className="sim-slider-header">
                  <label className="sim-label">Cultivated Land Area</label>
                  <span className="sim-slider-val"><strong>{acres}</strong> Acres</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="25"
                  step="1"
                  value={acres}
                  onChange={(e) => setAcres(Number(e.target.value))}
                  className="sim-range-input"
                />
                <div className="sim-slider-bounds">
                  <span>1 Acre</span>
                  <span>12 Acres</span>
                  <span>25 Acres</span>
                </div>
              </div>
            </div>

            {/* Right Live Computation Card */}
            <div className="sim-result-panel">
              <div className="sim-calc-header">
                <div>
                  <span className="eyebrow">ILLUSTRATIVE ESTIMATE</span>
                  <h3>Parametric Quote Breakdown</h3>
                </div>
                <span className="sh-badge badge-info">Example scenario</span>
              </div>

              <div className="sim-numbers-grid">
                <div className="sim-num-card">
                  <span className="num-lbl">Illustrative coverage</span>
                  <div className="num-val">{coverageEth} ETH</div>
                  <span className="num-sub">Automated claim limit</span>
                </div>
                <div className="sim-num-card">
                  <span className="num-lbl">Sample premium estimate</span>
                  <div className="num-val text-primary">{premiumEth} ETH</div>
                  <span className="num-sub">{(selectedRegion.baseRisk * 100).toFixed(1)}% risk rate</span>
                </div>
                <div className="sim-num-card full-width">
                  <div className="threshold-row">
                    <div>
                      <span className="num-lbl">Parametric Trigger Condition</span>
                    <div className="trigger-val">Below {thresholdMm} mm rainfall</div>
                    </div>
                    <CloudRain size={28} className="text-primary" />
                  </div>
                  <span className="num-sub">
                    Example threshold for a 14-day rainfall window.
                  </span>
                </div>
              </div>

              {/* Simulation Action */}
              <div className="sim-trigger-box">
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={handleSimulateTrigger}
                  disabled={simulatingTrigger}
                >
                  <Zap size={16} />
                  <span>
                    {simulatingTrigger ? 'Triangulating Satellite Oracles...' : 'Simulate Drought Trigger Event'}
                  </span>
                </button>

                {triggerSimResult && (
                  <div className="sim-trigger-result">
                    <div className="trigger-success-header">
                      <CheckCircle2 size={18} className="text-danger" />
                    <strong>Example trigger condition met</strong>
                    </div>
                    <div className="oracle-feed-readings">
                      <div className="feed-col">
                        <span>Sample source A</span>
                        <strong>{triggerSimResult.openMeteo} mm</strong>
                      </div>
                      <div className="feed-col">
                        <span>Sample source B</span>
                        <strong>{triggerSimResult.nasaPower} mm</strong>
                      </div>
                      <div className="feed-col">
                        <span>Sample source C</span>
                        <strong>{triggerSimResult.groundSensor} mm</strong>
                      </div>
                    </div>
                    <p className="trigger-conclusion">
                      These sample readings are below the <strong>{thresholdMm} mm</strong> threshold. In this
                      demo, the estimated cover is <strong>{triggerSimResult.payoutEth} ETH</strong>; no payment is made.
                    </p>
                  </div>
                )}
              </div>

              <div className="sim-cta-row">
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => onNavigate('farmer')}
                >
                  <span>Apply This Quote in Farmer Portal</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── Ecosystem Portals Showcase ──────────────── */}
      <section className="landing-portals-section">
        <div className="section-header-centered">
          <p className="section-kicker">02 / CHOOSE YOUR PATH</p>
          <h2>One pool, two ways to take part</h2>
          <p className="section-description">
            Farmers set up weather based cover. Investors explore the capital pool that can back
            those policies. Both journeys use the same policy and pool overview.
          </p>
        </div>

        <div className="portal-cards-grid journey-cards-grid">
          <article className="portal-feature-card journey-card">
            <div className="portal-card-top">
              <div className="portal-icon-wrapper farmer-theme">
                <Sprout size={24} />
              </div>
              <span className="sh-badge badge-active">For farmers</span>
            </div>
            <h3>Protect a farm</h3>
            <p>Set up a plot, explore a rainfall based quote, and follow the policy through evaluation.</p>
            <ul className="portal-points">
              <li><Check size={14} className="text-primary" /> Add a plot and crop</li>
              <li><Check size={14} className="text-primary" /> Review quote inputs and trigger</li>
              <li><Check size={14} className="text-primary" /> Track policy and oracle status</li>
            </ul>
            <button
              type="button"
              className="btn-primary portal-launch-btn"
              onClick={() => onNavigate('farmer')}
            >
              <span>Start farmer journey</span>
              <ArrowRight size={15} />
            </button>
          </article>

          <article className="portal-feature-card journey-card">
            <div className="portal-card-top">
              <div className="portal-icon-wrapper investor-theme">
                <TrendingUp size={24} />
              </div>
              <span className="sh-badge badge-info">For investors</span>
            </div>
            <h3>Explore the capital pool</h3>
            <p>See how premiums and claim payouts can affect LP share value before exploring a position.</p>
            <ul className="portal-points">
              <li><Check size={14} className="text-primary" /> Inspect covered policies and reserves</li>
              <li><Check size={14} className="text-primary" /> Model a sample season outcome</li>
              <li><Check size={14} className="text-primary" /> Review variable returns and risks</li>
            </ul>
            <button
              type="button"
              className="btn-secondary portal-launch-btn"
              onClick={() => onNavigate('investor')}
            >
              <span>Explore investor journey</span>
              <ArrowRight size={15} />
            </button>
          </article>
        </div>
      </section>

      {/* ──────────────── How It Works Workflow ──────────────── */}
      <section className="landing-workflow-section">
        <div className="section-header-centered">
          <p className="section-kicker">03 / HOW IT WORKS</p>
          <h2>From plot setup to policy review</h2>
          <p className="section-description">
            See the steps in the product and where this prototype currently simulates activity.
          </p>
        </div>

        <div className="workflow-steps-grid">
          <div className="workflow-step-card">
            <div className="step-number">01</div>
            <h4>Register Farm Plot</h4>
            <p>
              Add a farm location, crop, and area so the demo can prepare a plot specific quote.
            </p>
          </div>

          <div className="workflow-step-card">
            <div className="step-number">02</div>
            <h4>AI Risk Underwriting</h4>
            <p>
              Review a sample premium estimate with its rainfall data source and model limitations.
            </p>
          </div>

          <div className="workflow-step-card">
            <div className="step-number">03</div>
            <h4>Smart Contract Policy Escrow</h4>
            <p>
              Review the coverage, season, premium, and trigger terms. Policy creation is simulated
              unless a configured contract is connected.
            </p>
          </div>

          <div className="workflow-step-card">
            <div className="step-number">04</div>
            <h4>Autonomous Oracle Settlement</h4>
            <p>
              The demo compares readings with the agreed threshold. A real payout requires a funded,
              connected policy and a successful on-chain transaction.
            </p>
          </div>
        </div>
      </section>

      {/* ──────────────── Comparison Table ──────────────── */}
      <section className="landing-comparison-section">
        <div className="section-header-centered">
          <p className="section-kicker">04 / PROTOTYPE SCOPE</p>
          <h2>What this prototype demonstrates</h2>
        </div>

        <div className="comparison-table-wrapper glass-card">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Journey</th>
                <th>Product step</th>
                <th className="highlight-col">What you can explore here</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Farm setup</strong></td>
                <td>Plot, crop, and location</td>
                <td className="highlight-col text-success">Create a plot and preview a quote</td>
              </tr>
              <tr>
                <td><strong>Policy terms</strong></td>
                <td>Coverage and season terms</td>
                <td className="highlight-col text-success">Review a rainfall threshold and premium estimate</td>
              </tr>
              <tr>
                <td><strong>Oracle review</strong></td>
                <td>Weather observations</td>
                <td className="highlight-col text-success">Compare readings and inspect a dispute</td>
              </tr>
              <tr>
                <td><strong>Pool economics</strong></td>
                <td>Premium income and claim costs</td>
                <td className="highlight-col text-success">Explore share value and a sample season scenario</td>
              </tr>
              <tr>
                <td><strong>Prototype status</strong></td>
                <td>Illustrative data and simulated actions</td>
                <td className="highlight-col text-success">Clearly labeled; no claim of live insurance coverage</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ──────────────── FAQ Section ──────────────── */}
      <section className="landing-faq-section">
        <div className="section-header-centered">
          <p className="section-kicker">05 / FREQUENTLY ASKED QUESTIONS</p>
          <h2>Everything You Need to Know</h2>
        </div>

        <div className="faq-accordion-container">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className={`faq-card ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                >
                  <span className="faq-question-text">{faq.q}</span>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {isOpen && (
                  <div className="faq-answer-body">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ──────────────── Bottom Conversion CTA Banner ──────────────── */}
      <section className="landing-bottom-cta">
        <div className="bottom-cta-card">
          <div className="bottom-cta-content">
            <span className="bottom-cta-kicker">READY TO TRANSFORM CROP PROTECTION?</span>
            <h2>Empower Your Agricultural Journey with Decentralized Assurance</h2>
            <p>
              Explore the farmer journey or see how pool premiums and claim payouts affect investor share value.
            </p>
            <div className="bottom-cta-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => onNavigate('farmer')}
              >
                <span>Launch Farmer Portal</span>
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onNavigate('investor')}
              >
                <span>Provide Pool Capital</span>
              </button>
              {!user && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onOpenAuth('register')}
                >
                  <span>Sign Up / Register</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
