/**
 * Blockchain Bridge for SecureHarvest Backend
 * Interacts with PolicyContract.sol deployed on Hardhat or Polygon Amoy testnet.
 */

const { ethers } = require('ethers');

// Default RPC & Private Key configuration (for local Hardhat node)
const DEFAULT_RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const DEFAULT_PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Updated Contract ABI matching PolicyContract.sol
const POLICY_CONTRACT_ABI = [
  "function recordTrigger(uint256 policyId, uint256 observedValue) external",
  "function executePayout(uint256 policyId) external",
  "function policies(uint256 policyId) external view returns (address farmer, uint256 premiumPaid, uint256 coverageAmount, uint256 triggerThreshold, uint256 seasonStart, uint256 seasonEnd, uint8 status)"
];

let provider;
let wallet;
let contractAddress = process.env.CONTRACT_ADDRESS || null;
let policyContract = null;

function initializeBridge(customContractAddress = null, customRpcUrl = null) {
  try {
    const rpcUrl = customRpcUrl || DEFAULT_RPC_URL;
    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new ethers.Wallet(DEFAULT_PRIVATE_KEY, provider);

    if (customContractAddress) {
      contractAddress = customContractAddress;
    }

    if (contractAddress && contractAddress !== '0xYourDeployedContractAddressHere') {
      policyContract = new ethers.Contract(contractAddress, POLICY_CONTRACT_ABI, wallet);
    }
  } catch (error) {
    console.warn('⚠️ Blockchain bridge initialized in offline mode:', error.message);
  }
}

/**
 * Triggers payout execution on-chain by recording an oracle trigger.
 * 
 * @param {number|string} policyId 
 * @param {number} observedValue - Consensus value (e.g. average rainfall in mm)
 * @returns {Promise<object>} Transaction receipt or simulation result
 */
async function recordOracleTrigger(policyId, observedValue) {
  if (!policyContract) {
    // Dry-run / mock simulation when no deployed contract address is set or RPC unavailable
    console.log(`[Bridge Simulation] Calling recordTrigger(policyId=${policyId}, observedValue=${observedValue})`);
    return {
      success: true,
      simulated: true,
      transactionHash: `0xmock_${Date.now()}_${policyId}`,
      policyId,
      observedValue
    };
  }

  try {
    const tx = await policyContract.recordTrigger(policyId, Math.floor(observedValue));
    const receipt = await tx.wait();
    return {
      success: true,
      simulated: false,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      policyId,
      observedValue
    };
  } catch (error) {
    console.error(`❌ recordTrigger transaction failed for policy ${policyId}:`, error.message);
    throw error;
  }
}

module.exports = {
  initializeBridge,
  recordOracleTrigger
};
