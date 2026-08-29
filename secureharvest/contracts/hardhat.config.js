require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    amoy: {
      url: AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
