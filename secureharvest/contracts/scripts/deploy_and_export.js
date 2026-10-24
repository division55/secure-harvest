const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;

  console.log(`🚀 Deploying & Exporting SecureHarvest contracts on network: ${networkName}`);
  console.log(`Deployer Address: ${deployer.address}`);

  // 1. Deploy CapitalPool
  console.log("\n1️⃣ Deploying CapitalPool...");
  const CapitalPoolFactory = await hre.ethers.getContractFactory("CapitalPool");
  const capitalPool = await CapitalPoolFactory.deploy();
  await capitalPool.waitForDeployment();
  const capitalPoolAddress = await capitalPool.getAddress();
  console.log(`✅ CapitalPool deployed at: ${capitalPoolAddress}`);

  // 2. Deploy PolicyContract
  console.log("\n2️⃣ Deploying PolicyContract...");
  const PolicyContractFactory = await hre.ethers.getContractFactory("PolicyContract");
  const policyContract = await PolicyContractFactory.deploy();
  await policyContract.waitForDeployment();
  const policyContractAddress = await policyContract.getAddress();
  console.log(`✅ PolicyContract deployed at: ${policyContractAddress}`);

  // 3. Link Contracts
  console.log("\n3️⃣ Linking CapitalPool & PolicyContract...");
  const tx1 = await capitalPool.setPolicyContract(policyContractAddress);
  await tx1.wait();
  const tx2 = await policyContract.setCapitalPool(capitalPoolAddress);
  await tx2.wait();
  console.log("✅ Contracts successfully linked!");

  // 4. Export Addresses & ABIs to Frontend and Backend
  const addressesData = {
    network: networkName,
    chainId: hre.network.config.chainId || 31337,
    capitalPoolAddress,
    policyContractAddress,
    deployedAt: new Date().toISOString()
  };

  const capitalPoolArtifact = await hre.artifacts.readArtifact("CapitalPool");
  const policyContractArtifact = await hre.artifacts.readArtifact("PolicyContract");

  // Targets
  const frontendContractsDir = path.join(__dirname, "../../frontend/src/contracts");
  const backendConfigDir = path.join(__dirname, "../../Backend/config");

  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }
  if (!fs.existsSync(backendConfigDir)) {
    fs.mkdirSync(backendConfigDir, { recursive: true });
  }

  // Write JSONs
  fs.writeFileSync(path.join(frontendContractsDir, "contractAddresses.json"), JSON.stringify(addressesData, null, 2));
  fs.writeFileSync(path.join(frontendContractsDir, "CapitalPoolABI.json"), JSON.stringify(capitalPoolArtifact.abi, null, 2));
  fs.writeFileSync(path.join(frontendContractsDir, "PolicyContractABI.json"), JSON.stringify(policyContractArtifact.abi, null, 2));

  fs.writeFileSync(path.join(backendConfigDir, "contractAddresses.json"), JSON.stringify(addressesData, null, 2));
  fs.writeFileSync(path.join(backendConfigDir, "PolicyContractABI.json"), JSON.stringify(policyContractArtifact.abi, null, 2));

  console.log("\n📦 Contract addresses and ABIs successfully exported to:");
  console.log(`   - ${path.relative(process.cwd(), frontendContractsDir)}`);
  console.log(`   - ${path.relative(process.cwd(), backendConfigDir)}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
