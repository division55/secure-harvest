/**
 * Pricing Client Service for Express Backend
 * Connects Express backend to Python AI Pricing Microservice on port 5000 with analytical fallback.
 */

const http = require('http');

const AI_SERVICE_URL = process.env.AI_PRICING_URL || 'http://127.0.0.1:5000/api/pricing/quote';

/**
 * Computes an analytical fallback quote if Python AI pricing microservice is offline.
 */
function computeAnalyticalFallbackQuote(plotId, coverageAmount, triggerThreshold, rainfallMean = 60.0) {
  const droughtProbability = Math.min(Math.max(roundTo((70.0 - rainfallMean) / 100.0 + 0.25, 4), 0.05), 0.80);
  const purePremium = coverageAmount * droughtProbability;
  const safetyMargin = purePremium * 0.18;
  const rawPremium = purePremium + safetyMargin;
  const recommendedPremium = Math.min(rawPremium, coverageAmount * 0.85);

  return {
    plotId,
    coverageAmount,
    triggerThreshold,
    recommendedPremium: roundTo(recommendedPremium, 6),
    purePremium: roundTo(purePremium, 6),
    safetyMargin: roundTo(safetyMargin, 6),
    premiumRatePercent: roundTo((recommendedPremium / coverageAmount) * 100, 2),
    droughtProbability,
    basisRisk: {
      basis_risk_score: 28.5,
      category: 'MODERATE',
      explanation: 'Calculated via analytical fallback model.',
      components: { distance_penalty: 15.0, elevation_penalty: 5.0, soil_variance_penalty: 8.5 }
    },
    quoteHash: `0xfallback_${Date.now()}_${plotId}`,
    source: 'ANALYTICAL_FALLBACK'
  };
}

function roundTo(num, decimals) {
  return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
}

/**
 * Fetches plot-specific AI pricing quote.
 */
async function fetchPricingQuote(params) {
  const {
    plotId = 'plot-default',
    coverageAmount = 1.0,
    triggerThreshold = 50.0,
    historicalRainfallMean = 60.0,
    historicalRainfallStd = 15.0,
    soilRetentionIndex = 0.5,
    sensorDistanceKm = 5.0,
    elevationMeters = 300.0
  } = params;

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      plotId,
      coverageAmount,
      triggerThreshold,
      historicalRainfallMean,
      historicalRainfallStd,
      soilRetentionIndex,
      sensorDistanceKm,
      elevationMeters
    });

    const req = http.request(
      AI_SERVICE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 1500
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const quote = JSON.parse(data);
              resolve({ ...quote, source: 'AI_MICROSERVICE' });
            } else {
              resolve(computeAnalyticalFallbackQuote(plotId, coverageAmount, triggerThreshold, historicalRainfallMean));
            }
          } catch {
            resolve(computeAnalyticalFallbackQuote(plotId, coverageAmount, triggerThreshold, historicalRainfallMean));
          }
        });
      }
    );

    req.on('error', () => {
      resolve(computeAnalyticalFallbackQuote(plotId, coverageAmount, triggerThreshold, historicalRainfallMean));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(computeAnalyticalFallbackQuote(plotId, coverageAmount, triggerThreshold, historicalRainfallMean));
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  fetchPricingQuote,
  computeAnalyticalFallbackQuote
};
