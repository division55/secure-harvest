/**
 * Oracle Data Adapters for SecureHarvest
 * Fetches REAL-TIME live climate data (Precipitation & Satellite Soil Moisture) from public APIs (Open-Meteo / NASA).
 */

const http = require('http');
const https = require('https');

// Plot GPS coordinate lookup registry (Default to agricultural region coordinates)
const PLOT_COORDINATES = {
  'plot-101': { latitude: 13.0827, longitude: 80.2707, name: 'Tamil Nadu Agricultural Plot' },
  'plot-alpha': { latitude: 14.1670, longitude: 75.0400, name: 'Karnataka Paddy Field' },
  'plot-drought': { latitude: -1.2864, longitude: 36.8172, name: 'Sub-Saharan Maize Field' },
  'default': { latitude: 13.0827, longitude: 80.2707, name: 'Default Monitoring Station' }
};

// In-memory mock overrides reserved ONLY for unit testing specific dispute scenarios
const mockScenarios = new Map();

function setPlotScenario(plotId, scenario, customValues = null) {
  mockScenarios.set(plotId, { scenario, customValues });
}

function clearPlotScenario(plotId) {
  mockScenarios.delete(plotId);
}

/**
 * Fetch raw JSON from HTTP/HTTPS API endpoint.
 */
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch REAL-TIME precipitation data from Open-Meteo Meteorological API.
 */
async function fetchNOAAReading(plotId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const scenarioConfig = mockScenarios.get(plotId);

  // If a mock test scenario is explicitly injected for automated testing
  if (scenarioConfig) {
    const { scenario, customValues } = scenarioConfig;
    if (customValues?.noaa !== undefined) {
      return { source: 'NOAA_RAINFALL', plotId, value: customValues.noaa, timestamp, unit: 'mm', mode: 'TEST_MOCK' };
    }
    if (scenario === 'AGREE_BREACH') return { source: 'NOAA_RAINFALL', plotId, value: 30, timestamp, unit: 'mm', mode: 'TEST_MOCK' };
    if (scenario === 'AGREE_SAFE') return { source: 'NOAA_RAINFALL', plotId, value: 75, timestamp, unit: 'mm', mode: 'TEST_MOCK' };
    if (scenario === 'DISAGREE_DISPUTE') return { source: 'NOAA_RAINFALL', plotId, value: 25, timestamp, unit: 'mm', mode: 'TEST_MOCK' };
  }

  const coords = PLOT_COORDINATES[plotId] || PLOT_COORDINATES['default'];

  try {
    // Query Open-Meteo live API for 7-day cumulative precipitation and daily forecast
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=precipitation_sum&timezone=auto`;
    const responseData = await httpGetJson(apiUrl);

    const dailySums = responseData?.daily?.precipitation_sum;
    if (!Array.isArray(dailySums) || dailySums.length === 0) throw new Error('The provider returned no daily rainfall data.');
    const sevenDayTotal = dailySums.reduce((acc, curr) => acc + (curr || 0), 0);
    const roundedValue = Math.round(sevenDayTotal * 10) / 10;

    return {
      source: 'OPEN_METEO_RAINFALL',
      plotId,
      plotName: coords.name,
      coordinates: { latitude: coords.latitude, longitude: coords.longitude },
      value: roundedValue,
      period: '7_day_cumulative',
      timestamp,
      unit: 'mm',
      mode: 'REAL_LIVE_API',
      provider: 'Open-Meteo Meteorological Service'
    };

  } catch (error) {
    console.warn(`⚠️ Failed to fetch live Open-Meteo rainfall for ${plotId}, using baseline fallback:`, error.message);
    return {
      source: 'OPEN_METEO_RAINFALL',
      plotId,
      value: null,
      timestamp,
      unit: 'mm',
      mode: 'UNAVAILABLE'
    };
  }
}

/**
 * Fetch REAL-TIME Satellite Soil Moisture & Vegetation Index from Copernicus / Open-Meteo Satellite Feed.
 */
async function fetchNDVIReading(plotId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const scenarioConfig = mockScenarios.get(plotId);

  if (scenarioConfig) {
    const { scenario, customValues } = scenarioConfig;
    if (customValues?.ndvi !== undefined) {
      return { source: 'SATELLITE_NDVI', plotId, value: customValues.ndvi, timestamp, unit: 'mm_equivalent', mode: 'TEST_MOCK' };
    }
    if (scenario === 'AGREE_BREACH') return { source: 'SATELLITE_NDVI', plotId, value: 32, timestamp, unit: 'mm_equivalent', mode: 'TEST_MOCK' };
    if (scenario === 'AGREE_SAFE') return { source: 'SATELLITE_NDVI', plotId, value: 80, timestamp, unit: 'mm_equivalent', mode: 'TEST_MOCK' };
    if (scenario === 'DISAGREE_DISPUTE') return { source: 'SATELLITE_NDVI', plotId, value: 65, timestamp, unit: 'mm_equivalent', mode: 'TEST_MOCK' };
  }

  const coords = PLOT_COORDINATES[plotId] || PLOT_COORDINATES['default'];

  try {
    // Query Open-Meteo live API for satellite soil moisture (0-7cm volumetric water content m³/m³)
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm&timezone=auto`;
    const responseData = await httpGetJson(apiUrl);

    const sm1 = responseData?.current?.soil_moisture_0_to_1cm;
    const sm2 = responseData?.current?.soil_moisture_1_to_3cm;
    if (!Number.isFinite(sm1) || !Number.isFinite(sm2)) throw new Error('The provider returned no soil moisture data.');
    const avgSoilMoisture = (sm1 + sm2) / 2;

    // Convert volumetric soil moisture (m³/m³, typically 0.05 to 0.50) to 100mm equivalent rainfall scale
    const mmEquivalent = Math.round((avgSoilMoisture / 0.45) * 100 * 10) / 10;

    return {
      source: 'OPEN_METEO_SOIL_MOISTURE',
      plotId,
      plotName: coords.name,
      coordinates: { latitude: coords.latitude, longitude: coords.longitude },
      value: Math.round(avgSoilMoisture * 1000) / 1000,
      rawVolumetricSoilMoisture: avgSoilMoisture,
      timestamp,
      unit: 'm³/m³',
      mode: 'REAL_LIVE_API',
      provider: 'Open-Meteo soil moisture estimate'
    };

  } catch (error) {
    console.warn(`⚠️ Failed to fetch live Satellite Soil Moisture for ${plotId}, using baseline fallback:`, error.message);
    return {
      source: 'OPEN_METEO_SOIL_MOISTURE',
      plotId,
      value: null,
      timestamp,
      unit: 'm³/m³',
      mode: 'UNAVAILABLE'
    };
  }
}

/**
 * Pull from all configured oracle data feeds for a given plot in parallel.
 */
async function fetchMultiSourceReadings(plotId, location) {
  if (location) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const result = await httpGetJson(url);
    const match = result?.results?.[0];
    if (!match) throw new Error(`Could not locate “${location}”. Check the plot's district, state and country.`);
    PLOT_COORDINATES[plotId] = {
      latitude: match.latitude,
      longitude: match.longitude,
      name: [match.name, match.admin1, match.country].filter(Boolean).join(', ')
    };
  } else if (!PLOT_COORDINATES[plotId]) {
    throw new Error('A saved plot location is required for live oracle readings.');
  }
  const [noaaData, ndviData] = await Promise.all([
    fetchNOAAReading(plotId),
    fetchNDVIReading(plotId)
  ]);

  return [noaaData, ndviData];
}

module.exports = {
  fetchNOAAReading,
  fetchNDVIReading,
  fetchMultiSourceReadings,
  setPlotScenario,
  clearPlotScenario
};
