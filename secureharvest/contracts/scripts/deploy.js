const hre = require("hardhat");

async function main() {
    console.log("Deploying PolicyContract...");

    // Grab the contract factory
    const PolicyContract = await hre.ethers.getContractFactory("PolicyContract");

    // Deploy the contract 
    const policyContract = await PolicyContract.deploy();

    // Wait for the deployment transaction to be mined
    await policyContract.waitForDeployment();

    // Get the deployed address
    const targetAddress = await policyContract.getAddress();
    
    console.log(`\n✅ Success!`);
    console.log(`PolicyContract deployed to: ${targetAddress}`);
    console.log(`Copy the address above and paste it into your backend/index.js file.`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});