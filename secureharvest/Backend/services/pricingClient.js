const http = require('http');

const AI_SERVICE_URL =
  process.env.AI_PRICING_URL ||
  'http://127.0.0.1:5000/api/pricing/quote';

function roundTo(num, decimals) {
  return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
}

function computeAnalyticalFallbackQuote(
  plotId,
  coverageAmount,
  triggerThreshold,
  rainfallMean = 60
) {
  const droughtProbability = Math.min(
    Math.max(roundTo((70 - rainfallMean) / 100 + 0.25, 4), 0.05),
    0.8
  );

  const purePremium = coverageAmount * droughtProbability;
  const safetyMargin = purePremium * 0.18;
  const recommendedPremium = Math.min(
    purePremium + safetyMargin,
    coverageAmount * 0.85
  );

  return {
    plotId,
    coverageAmount,
    triggerThreshold,
    recommendedPremium: roundTo(recommendedPremium, 6),
    purePremium: roundTo(purePremium, 6),
    safetyMargin: roundTo(safetyMargin, 6),
    premiumRatePercent: roundTo(
      (recommendedPremium / coverageAmount) * 100,
      2
    ),
    droughtProbability,
    basisRisk: {
      basis_risk_score: 28.5,
      category: 'MODERATE',
      explanation: 'Calculated via analytical fallback model.',
      components: {
        distance_penalty: 15,
        elevation_penalty: 5,
        soil_variance_penalty: 8.5
      }
    },
    quoteHash: `0xfallback_${Date.now()}_${plotId}`,
    source: 'ANALYTICAL_FALLBACK'
  };
}

async function fetchPricingQuote(params = {}) {
  const {
    plotId = 'plot-default',
    coverageAmount = 1,
    triggerThreshold = 50,
    location,
    latitude,
    longitude,
    historicalRainfallMean,
    historicalRainfallStd,
    soilRetentionIndex = 0.5,
    sensorDistanceKm = 5,
    elevationMeters = 300
  } = params;

  const payload = JSON.stringify({
    plotId,
    coverageAmount: Number(coverageAmount),
    triggerThreshold: Number(triggerThreshold),
    location,
    latitude,
    longitude,
    historicalRainfallMean,
    historicalRainfallStd,
    soilRetentionIndex,
    sensorDistanceKm,
    elevationMeters
  });

  return new Promise((resolve) => {
    const req = http.request(
      AI_SERVICE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 45000
      },
      (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          let data;

          try {
            data = JSON.parse(responseBody);
          } catch {
            resolve({
              error: 'Python pricing service returned invalid JSON.',
              source: 'DATA_UNAVAILABLE'
            });
            return;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            resolve({
              error: data.error || 'Could not retrieve location-based quote.',
              details: data.details,
              source: 'DATA_UNAVAILABLE'
            });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        error: 'Could not connect to the Python pricing service.',
        details: err.message,
        source: 'DATA_UNAVAILABLE'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        error: 'The location or rainfall request timed out.',
        source: 'DATA_UNAVAILABLE'
      });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  fetchPricingQuote,
  computeAnalyticalFallbackQuote
};
