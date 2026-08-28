const express = require('express');
const { ethers } = require('ethers');
const app = express();
app.use(express.json());

// --- BLOCKCHAIN SETUP ---
// Connect to local Hardhat node
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

// Hardhat's default Account #0 Private Key (DO NOT use in production)
const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const wallet = new ethers.Wallet(privateKey, provider);

// TODO: Replace with your actual deployed contract address from Hardhat
const contractAddress = '0xYourDeployedContractAddressHere'; 

// Minimal ABI just for the recordTrigger function
const contractABI = [
    "function recordTrigger(uint256 policyId) external"
];

const policyContract = new ethers.Contract(contractAddress, contractABI, wallet);

// --- MOCK ORACLES ---
const fetchNOAAReading = async (plotId) => ({ source: 'NOAA', value: 50 });
const fetchNDVIReading = async (plotId) => ({ source: 'Satellite_NDVI', value: 45 });

// --- AGGREGATOR ENDPOINT ---
app.post('/api/oracle/evaluate', async (req, res) => {
    const { policyId, plotId, triggerThreshold } = req.body;

    try {
        const noaaData = await fetchNOAAReading(plotId);
        const ndviData = await fetchNDVIReading(plotId);
        
        const difference = Math.abs(noaaData.value - ndviData.value);
        const TOLERANCE_THRESHOLD = 10; 

        if (difference > TOLERANCE_THRESHOLD) {
            return res.json({
                policyId,
                status: 'FLAGGED_FOR_REVIEW',
                reason: 'Data sources disagree beyond acceptable tolerance.'
            });
        }

        const averageReading = (noaaData.value + ndviData.value) / 2;
        
        if (averageReading <= triggerThreshold) {
            // FIRE THE SMART CONTRACT TRANSACTION
            console.log(`Triggering payout for Policy ${policyId}...`);
            
            // Calls the manual trigger function currently in your contract[cite: 1]
            const tx = await policyContract.recordTrigger(policyId);
            await tx.wait(); // Wait for confirmation

            return res.json({
                policyId,
                status: 'TRIGGER_CONDITIONS_MET',
                averageReading,
                transactionHash: tx.hash
            });
        }

        res.json({ policyId, status: 'SAFE', averageReading });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Oracle fetch or transaction failed' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Backend bridging to Hardhat on port ${PORT}`));