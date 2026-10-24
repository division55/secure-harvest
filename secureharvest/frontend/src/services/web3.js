import { ethers } from 'ethers';
import addresses from '../contracts/contractAddresses.json';
import CapitalPoolABI from '../contracts/CapitalPoolABI.json';
import PolicyContractABI from '../contracts/PolicyContractABI.json';

/**
 * Request MetaMask connection and return current Provider, Signer, Account, and Chain ID.
 */
export async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error('MetaMask browser extension is not installed. Please install MetaMask to use Web3 features.');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    account: accounts[0],
    chainId: Number(network.chainId),
    networkName: getNetworkName(Number(network.chainId))
  };
}

/**
 * Returns contract instances only after validating the network
 * and confirming that both contracts are deployed.
 */
export async function getContractInstances(signerOrProvider) {
  const provider = signerOrProvider.provider ?? signerOrProvider;

  if (!provider || typeof provider.getNetwork !== 'function') {
    throw new Error('A valid Ethereum provider is required.');
  }

  const network = await provider.getNetwork();
  const actualChainId = Number(network.chainId);
  const expectedChainId = Number(addresses.chainId);

  if (actualChainId !== expectedChainId) {
    throw new Error(
      `Wrong network. Expected chain ID ${expectedChainId}, ` +
      `but connected to ${actualChainId}.`
    );
  }

  const { capitalPoolAddress, policyContractAddress } = addresses;

  if (
    !ethers.isAddress(capitalPoolAddress) ||
    !ethers.isAddress(policyContractAddress) ||
    capitalPoolAddress === ethers.ZeroAddress ||
    policyContractAddress === ethers.ZeroAddress
  ) {
    throw new Error('Invalid contract addresses in contractAddresses.json.');
  }

  const [poolCode, policyCode] = await Promise.all([
    provider.getCode(capitalPoolAddress),
    provider.getCode(policyContractAddress)
  ]);

  if (poolCode === '0x' || policyCode === '0x') {
    throw new Error(
      'One or both contracts are not deployed at the configured addresses ' +
      'on this network. Deploy the contracts and update contractAddresses.json.'
    );
  }

  return {
    capitalPoolContract: new ethers.Contract(
      capitalPoolAddress,
      CapitalPoolABI,
      signerOrProvider
    ),
    policyContract: new ethers.Contract(
      policyContractAddress,
      PolicyContractABI,
      signerOrProvider
    ),
    capitalPoolAddress,
    policyContractAddress
  };
}

/**
 * Map Chain ID to human-readable network name.
 */
export function getNetworkName(chainId) {
  switch (chainId) {
    case 1: return 'Ethereum Mainnet';
    case 137: return 'Polygon Mainnet';
    case 80002: return 'Polygon Amoy Testnet';
    case 31337: return 'Hardhat Localhost (Chain #31337)';
    case 1337: return 'Localhost Network';
    default: return `Chain ID #${chainId}`;
  }
}

/**
 * Subscribe to MetaMask account or network change events.
 */
export function subscribeToWeb3Events(onAccountChange, onNetworkChange) {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      onAccountChange(accounts.length > 0 ? accounts[0] : null);
    });

    window.ethereum.on('chainChanged', (chainIdHex) => {
      onNetworkChange(parseInt(chainIdHex, 16));
    });
  }
}
