// test-organized-connection.js - Test connection to organized backend
async function testOrganizedBackend() {
  const API_BASE = 'http://localhost:3001';
  
  console.log('🧪 Testing Organized Backend Connection...\n');
  
  const tests = [
    { name: 'Health Check', endpoint: '/health' },
    { name: 'Database Stats', endpoint: '/data/stats' },
    { name: 'Quiz List', endpoint: '/api/quiz?limit=5' },
    { name: 'Admin Stats', endpoint: '/admin/stats' }
  ];
  
  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      const response = await fetch(`${API_BASE}${test.endpoint}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${test.name}: SUCCESS`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Data:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR`);
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
  }
  
  console.log('🎉 Backend connection test completed!');
  console.log('\n📋 Next steps:');
  console.log('1. cd frontend');
  console.log('2. npm run dev:organized');
  console.log('3. Open http://localhost:5173');
}

// Run the test
testOrganizedBackend().catch(console.error);
