// Test the check-quiz-completed API endpoint
import fetch from 'node-fetch';

async function testCheckQuizCompleted() {
  try {
    console.log('🧪 Testing /api/check-quiz-completed endpoint...');
    
    const response = await fetch('http://localhost:3001/api/check-quiz-completed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAccount: '0x91464947c61570ad8095ebd701d6ff57722ce483',
        quizId: 'q_1760363314_10'
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCheckQuizCompleted();
