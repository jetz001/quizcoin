// Script to grant admin role to frontend account
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const DIAMOND_ADDRESS = process.env.DIAMOND_ADDRESS || '0x6DDD5b880dc79A093B55573Fe788aF88dB8125ce';
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// ABI for OwnershipFacet functions
const OWNERSHIP_FACET_ABI = [
  "function grantRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)"
];

async function grantAdminRole(frontendAddress) {
  try {
    console.log('🔧 Granting admin role to frontend account...');
    
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not found in environment variables');
    }
    
    if (!frontendAddress) {
      throw new Error('Frontend address is required');
    }
    
    // Create provider and signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Create contract instance
    const contract = new ethers.Contract(DIAMOND_ADDRESS, OWNERSHIP_FACET_ABI, signer);
    
    // Get DEFAULT_ADMIN_ROLE
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    console.log(`📋 DEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`);
    
    // Check if already has admin role
    const hasRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, frontendAddress);
    if (hasRole) {
      console.log(`✅ Address ${frontendAddress} already has admin role`);
      return;
    }
    
    // Grant admin role
    console.log(`🔑 Granting admin role to ${frontendAddress}...`);
    const tx = await contract.grantRole(DEFAULT_ADMIN_ROLE, frontendAddress);
    console.log(`📝 Transaction hash: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Admin role granted successfully!`);
    console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
    
    // Verify the role was granted
    const hasRoleAfter = await contract.hasRole(DEFAULT_ADMIN_ROLE, frontendAddress);
    if (hasRoleAfter) {
      console.log(`✅ Verification successful: ${frontendAddress} now has admin role`);
    } else {
      console.log(`❌ Verification failed: ${frontendAddress} does not have admin role`);
    }
    
  } catch (error) {
    console.error('❌ Error granting admin role:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const frontendAddress = process.argv[2];
  
  if (!frontendAddress) {
    console.error('❌ Please provide frontend address as argument');
    console.log('Usage: node grant-admin-role.js <frontend_address>');
    process.exit(1);
  }
  
  try {
    await grantAdminRole(frontendAddress);
    console.log('🎉 Admin role granted successfully!');
  } catch (error) {
    console.error('💥 Failed to grant admin role:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { grantAdminRole };
