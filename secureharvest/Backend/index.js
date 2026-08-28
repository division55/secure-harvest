const express = require('express');
const app = express();
app.use(express.json());

// 1. Mock Data Sources
// In reality, these would be external API calls to NOAA, Satellite providers, etc.
const fetchNOAAReading = async (plotId) => {
    return { source: 'NOAA', value: 50 }; // Simulated rainfall in mm
};

const fetchNDVIReading = async (plotId) => {
    return { source: 'Satellite_NDVI', value: 45 }; // Simulated rainfall equivalent
};

// 2. Oracle Aggregator Endpoint
app.post('/api/oracle/evaluate', async (req, res) => {
    const { policyId, plotId, triggerThreshold } = req.body;

    try {
        const noaaData = await fetchNOAAReading(plotId);
        const ndviData = await fetchNDVIReading(plotId);

        // 3. Tolerance Comparison Logic
        const difference = Math.abs(noaaData.value - ndviData.value);
        
        // Note: The exact tolerance threshold is currently an open question awaiting historical data calibration.
        const TOLERANCE_THRESHOLD = 10; 

        if (difference > TOLERANCE_THRESHOLD) {
            // If sources disagree beyond tolerance, do NOT auto-payout; flag for manual resolution.
            return res.json({
                policyId,
                status: 'FLAGGED_FOR_REVIEW',
                reason: 'Data sources disagree beyond acceptable tolerance.',
                readings: [noaaData, ndviData]
            });
        }

        // 4. Trigger Evaluation
        const averageReading = (noaaData.value + ndviData.value) / 2;
        
        if (averageReading <= triggerThreshold) {
            // This is where you will eventually use ethers.js to call the smart contract
            // and replace the temporary manual testing behavior of recordTrigger().
            return res.json({
                policyId,
                status: 'TRIGGER_CONDITIONS_MET',
                averageReading,
                message: 'Ready to submit cryptographic proof to smart contract.'
            });
        }

        res.json({
            policyId,
            status: 'SAFE',
            averageReading
        });

    } catch (error) {
        res.status(500).json({ error: 'Oracle fetch failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Semi-backend running on port ${PORT}`));