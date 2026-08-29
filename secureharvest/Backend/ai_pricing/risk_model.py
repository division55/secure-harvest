"""
SecureHarvest AI Risk-Pricing & Basis Risk Quantification Model
Uses scikit-learn ML models trained on plot climate features to estimate plot-specific drought
probability, dynamic policy premiums, and explicit basis risk scores.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import hashlib
import json

class PlotRiskModel:
    def __init__(self):
        self.is_trained = False
        self.clf = RandomForestClassifier(n_estimators=50, random_state=42)
        self._train_baseline_model()

    def _train_baseline_model(self):
        """
        Trains baseline ML model on historical plot climate proxy dataset.
        Features: [historical_rainfall_mean, historical_rainfall_std, soil_retention_index, sensor_distance_km, elevation_m]
        Target: 1 if drought breached trigger, 0 otherwise
        """
        np.random.seed(42)
        n_samples = 500

        rainfall_mean = np.random.uniform(20, 120, n_samples)
        rainfall_std = np.random.uniform(5, 30, n_samples)
        soil_retention = np.random.uniform(0.1, 0.9, n_samples)
        sensor_dist = np.random.uniform(0.5, 25.0, n_samples)
        elevation = np.random.uniform(100, 1500, n_samples)

        X = np.column_stack([rainfall_mean, rainfall_std, soil_retention, sensor_dist, elevation])

        # Target rule: lower mean rainfall & lower soil retention -> higher drought breach probability
        logit = (50 - rainfall_mean) * 0.08 + (0.5 - soil_retention) * 2.0 + (sensor_dist * 0.03)
        probs = 1 / (1 + np.exp(-logit))
        y = (probs > 0.45).astype(int)

        self.clf.fit(X, y)
        self.is_trained = True

    def calculate_basis_risk(self, sensor_distance_km: float, soil_variance: float, elevation_diff_m: float) -> dict:
        """
        Explicitly quantifies basis risk (the risk that regional oracle trigger differs from actual farm loss).
        Scale: 0 to 100 (Lower = lower divergence risk, Higher = higher basis risk).
        """
        # Distance component: 3 points per km up to 45
        dist_factor = min(sensor_distance_km * 3.0, 45.0)

        # Microclimate elevation component: 1 point per 20m elevation difference up to 25
        elev_factor = min(abs(elevation_diff_m) / 20.0, 25.0)

        # Soil property divergence component: up to 30 points
        soil_factor = min(soil_variance * 30.0, 30.0)

        total_basis_risk_score = round(dist_factor + elev_factor + soil_factor, 1)
        total_basis_risk_score = min(max(total_basis_risk_score, 5.0), 95.0)

        if total_basis_risk_score < 25.0:
            category = "LOW"
            explanation = "Sensor proximity and microclimate are tightly aligned with plot conditions."
        elif total_basis_risk_score < 60.0:
            category = "MODERATE"
            explanation = "Moderate distance or elevation difference from oracle station."
        else:
            category = "HIGH"
            explanation = "High basis risk. Regional oracle trigger may diverge from localized plot losses."

        return {
            "basis_risk_score": total_basis_risk_score,
            "category": category,
            "explanation": explanation,
            "components": {
                "distance_penalty": round(dist_factor, 1),
                "elevation_penalty": round(elev_factor, 1),
                "soil_variance_penalty": round(soil_factor, 1)
            }
        }

    def predict_quote(self, plot_id: str, coverage_amount: float, trigger_threshold: float,
                      historical_rainfall_mean: float, historical_rainfall_std: float = 15.0,
                      soil_retention_index: float = 0.5, sensor_distance_km: float = 5.0,
                      elevation_m: float = 300.0) -> dict:
        """
        Computes plot-specific risk premium quote and basis risk analysis.
        """
        features = np.array([[historical_rainfall_mean, historical_rainfall_std,
                              soil_retention_index, sensor_distance_km, elevation_m]])

        # Predict drought breach probability
        proba = self.clf.predict_proba(features)[0][1]
        drought_prob = round(float(proba), 4)

        # Actuarially fair pure premium
        pure_premium = coverage_amount * drought_prob

        # Safety & volatility loading factor (15% base + volatility penalty)
        volatility_factor = max(0.05, historical_rainfall_std / max(historical_rainfall_mean, 1.0))
        safety_margin = pure_premium * (0.15 + 0.10 * volatility_factor)

        # Recommended premium capped at 85% of coverage amount (maximum insurable premium cap)
        max_allowed_premium = coverage_amount * 0.85
        recommended_premium = round(min(pure_premium + safety_margin, max_allowed_premium), 6)
        premium_rate_pct = round((recommended_premium / coverage_amount) * 100, 2)

        # Quantify basis risk
        basis_risk_info = self.calculate_basis_risk(sensor_distance_km, 1.0 - soil_retention_index, 50.0)

        # Cryptographic quote payload hash
        quote_payload = {
            "plotId": plot_id,
            "coverageAmount": coverage_amount,
            "triggerThreshold": trigger_threshold,
            "recommendedPremium": recommended_premium,
            "droughtProbability": drought_prob,
            "basisRiskScore": basis_risk_info["basis_risk_score"]
        }
        quote_hash = "0x" + hashlib.sha256(json.dumps(quote_payload, sort_keys=True).encode()).hexdigest()

        return {
            "plotId": plot_id,
            "coverageAmount": coverage_amount,
            "triggerThreshold": trigger_threshold,
            "recommendedPremium": recommended_premium,
            "purePremium": round(pure_premium, 6),
            "safetyMargin": round(safety_margin, 6),
            "premiumRatePercent": premium_rate_pct,
            "droughtProbability": drought_prob,
            "basisRisk": basis_risk_info,
            "quoteHash": quote_hash
        }


# Global model instance
model_instance = PlotRiskModel()
