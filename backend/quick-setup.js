// quick-setup.js - Quick setup for testing organized structure
import { writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Quick Setup for Organized Structure...');

// 1. Create .env file if it doesn't exist
const envPath = join(__dirname, '.env');
const envExamplePath = join(__dirname, '.env.example');

if (!existsSync(envPath)) {
  if (existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env from .env.example');
  } else {
    // Create basic .env
    const basicEnv = `# Database Configuration
DATABASE_URL=file:./dev.db

# Port
PORT=3001

# Gemini AI (optional)
GEMINI_API_KEY=your_gemini_api_key_here
`;
    writeFileSync(envPath, basicEnv);
    console.log('✅ Created basic .env file');
  }
}

// 2. Update .env to use SQLite for quick testing
const envContent = `# Quick Setup - SQLite Database
DATABASE_URL=file:./dev.db

# Port
PORT=3001

# BSC Testnet (optional)
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Gemini AI (optional)
GEMINI_API_KEY=your_gemini_api_key_here
`;

writeFileSync(envPath, envContent);
console.log('✅ Updated .env with SQLite DATABASE_URL');

// 3. Use SQLite schema for quick testing
const sqliteSchemaPath = join(__dirname, 'prisma', 'schema-sqlite.prisma');
const mainSchemaPath = join(__dirname, 'prisma', 'schema.prisma');

if (existsSync(sqliteSchemaPath)) {
  copyFileSync(sqliteSchemaPath, mainSchemaPath);
  console.log('✅ Updated schema.prisma to use SQLite');
}

console.log('\n🎉 Quick setup completed!');
console.log('\n📋 Next steps:');
console.log('1. npm run db:generate');
console.log('2. npm run db:migrate');
console.log('3. npm run start:organized');
console.log('\n💡 This uses SQLite for quick testing. For production, use PostgreSQL.');
