const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;

  console.log(`🚀 Deploying SecureHarvest contracts to network: ${networkName}`);
  console.log(`Deployer Address: ${deployer.address}`);

  // 1. Deploy CapitalPool
  console.log("\n1️⃣ Deploying CapitalPool...");
  const CapitalPool = await hre.ethers.getContractFactory("CapitalPool");
  const capitalPool = await CapitalPool.deploy();
  await capitalPool.waitForDeployment();
  const capitalPoolAddress = await capitalPool.getAddress();
  console.log(`✅ CapitalPool deployed at: ${capitalPoolAddress}`);

  // 2. Deploy PolicyContract
  console.log("\n2️⃣ Deploying PolicyContract...");
  const PolicyContract = await hre.ethers.getContractFactory("PolicyContract");
  const policyContract = await PolicyContract.deploy();
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

  console.log("\n🎉 Deployment Complete!");
  console.log("--------------------------------------------------");
  console.log(`CapitalPool Address:     ${capitalPoolAddress}`);
  console.log(`PolicyContract Address:  ${policyContractAddress}`);
  
  if (networkName === "amoy") {
    console.log(`\n🔍 View on Amoy Polygonscan Explorer:`);
    console.log(`CapitalPool:    https://amoy.polygonscan.com/address/${capitalPoolAddress}`);
    console.log(`PolicyContract: https://amoy.polygonscan.com/address/${policyContractAddress}`);
  }
  console.log("--------------------------------------------------");
  console.log("👉 Update process.env.CONTRACT_ADDRESS in your backend with PolicyContract address.");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});