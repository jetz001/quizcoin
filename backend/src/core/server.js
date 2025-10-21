// server-organized.js - Entry point for organized structure
// This demonstrates the new organized backend structure

console.log('🏗️ Starting QuizCoin with Organized Structure...');

import('./src/core/server.js')
  .then(() => {
    console.log('✅ Organized server started successfully');
  })
  .catch((error) => {
    console.error('❌ Failed to start organized server:', error);
    console.log('\n💡 If you see import errors, run the reorganization first:');
    console.log('   node reorganize.js');
    process.exit(1);
  });
