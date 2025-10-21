// test-auth.js - Test authentication endpoints
async function testAuth() {
  const API_BASE = 'http://localhost:3001';
  
  console.log('🔐 Testing Authentication System...\n');

  try {
    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User'
      })
    });

    const registerData = await registerResponse.json();
    console.log('✅ Registration:', registerData.success ? 'SUCCESS' : 'FAILED');
    if (registerData.success) {
      console.log(`   User: ${registerData.user.username} (${registerData.user.email})`);
      console.log(`   Token: ${registerData.token.substring(0, 20)}...`);
    } else {
      console.log(`   Error: ${registerData.error}`);
    }

    // Test 2: Login with the user
    console.log('\n2. Testing user login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identifier: 'testuser',
        password: 'password123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('✅ Login:', loginData.success ? 'SUCCESS' : 'FAILED');
    let authToken = null;
    if (loginData.success) {
      authToken = loginData.token;
      console.log(`   Welcome: ${loginData.user.displayName}`);
      console.log(`   Token: ${authToken.substring(0, 20)}...`);
    } else {
      console.log(`   Error: ${loginData.error}`);
    }

    // Test 3: Get user profile (if login successful)
    if (authToken) {
      console.log('\n3. Testing authenticated profile access...');
      const profileResponse = await fetch(`${API_BASE}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const profileData = await profileResponse.json();
      console.log('✅ Profile:', profileData.success ? 'SUCCESS' : 'FAILED');
      if (profileData.success) {
        console.log(`   User: ${profileData.user.username}`);
        console.log(`   Stats: ${profileData.user.questionsAnswered} questions answered`);
        console.log(`   Score: ${profileData.user.totalScore} points`);
      }
    }

    // Test 4: Test quiz submission with auth
    if (authToken) {
      console.log('\n4. Testing authenticated quiz submission...');
      
      // First get a random quiz
      const quizResponse = await fetch(`${API_BASE}/api/quiz/random`);
      const quizData = await quizResponse.json();
      
      if (quizData.success) {
        console.log(`   Quiz: ${quizData.question}`);
        
        // Submit an answer
        const submitResponse = await fetch(`${API_BASE}/api/quiz/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            quizId: quizData.quizId,
            answer: quizData.options[1], // Pick second option
            userAccount: 'test-account'
          })
        });

        const submitData = await submitResponse.json();
        console.log('✅ Quiz Submit:', submitData.success ? 'SUCCESS' : 'FAILED');
        if (submitData.success) {
          console.log(`   Result: ${submitData.isCorrect ? 'CORRECT' : 'INCORRECT'}`);
          console.log(`   Reward: ${submitData.reward} QZC`);
        }
      }
    }

    // Test 5: Check username availability
    console.log('\n5. Testing username availability...');
    const usernameResponse = await fetch(`${API_BASE}/api/auth/check-username/newuser`);
    const usernameData = await usernameResponse.json();
    console.log('✅ Username Check:', usernameData.success ? 'SUCCESS' : 'FAILED');
    console.log(`   Available: ${usernameData.available}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎉 Authentication testing completed!');
  console.log('\n📋 Next: Build frontend login/register components');
}

testAuth();
