// scripts/test-log.js
async function main() {
  console.log("Hello from test-log.js! Script is running.");

  const [signer] = await ethers.getSigners();
  console.log("Signer address retrieved:", signer.address);
  console.log("This is running on Hardhat Network (local).");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("An error occurred:", error);
    process.exit(1);
  });