"""
Unit & Integration Tests for SecureHarvest AI Pricing & Basis Risk Engine
"""

import unittest
from risk_model import PlotRiskModel

class TestPlotRiskModel(unittest.TestCase):
    def setUp(self):
        self.model = PlotRiskModel()

    def test_model_training_and_quote_generation(self):
        quote = self.model.predict_quote(
            plot_id="plot-101",
            coverage_amount=1.0,
            trigger_threshold=50.0,
            historical_rainfall_mean=35.0, # Dry plot -> higher drought probability
            historical_rainfall_std=12.0
        )

        self.assertEqual(quote["plotId"], "plot-101")
        self.assertGreater(quote["droughtProbability"], 0.0)
        self.assertLessEqual(quote["droughtProbability"], 1.0)
        self.assertGreater(quote["recommendedPremium"], 0.0)
        self.assertLess(quote["recommendedPremium"], quote["coverageAmount"])
        self.assertTrue(quote["quoteHash"].startswith("0x"))

    def test_high_risk_versus_low_risk_pricing(self):
        dry_quote = self.model.predict_quote(
            plot_id="dry-plot",
            coverage_amount=1.0,
            trigger_threshold=50.0,
            historical_rainfall_mean=25.0
        )

        wet_quote = self.model.predict_quote(
            plot_id="wet-plot",
            coverage_amount=1.0,
            trigger_threshold=50.0,
            historical_rainfall_mean=100.0
        )

        # Dry plot with lower rainfall mean should have higher drought probability & premium rate
        self.assertGreater(dry_quote["droughtProbability"], wet_quote["droughtProbability"])
        self.assertGreater(dry_quote["recommendedPremium"], wet_quote["recommendedPremium"])

    def test_basis_risk_quantification(self):
        close_sensor_basis = self.model.calculate_basis_risk(
            sensor_distance_km=1.0,
            soil_variance=0.1,
            elevation_diff_m=10.0
        )
        far_sensor_basis = self.model.calculate_basis_risk(
            sensor_distance_km=15.0,
            soil_variance=0.6,
            elevation_diff_m=150.0
        )

        self.assertEqual(close_sensor_basis["category"], "LOW")
        self.assertIn(far_sensor_basis["category"], ["MODERATE", "HIGH"])
        self.assertGreater(far_sensor_basis["basis_risk_score"], close_sensor_basis["basis_risk_score"])

if __name__ == "__main__":
    unittest.main()
