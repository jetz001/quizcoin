// scripts/setup/seed-quiz-questions.js - Seed database with quiz questions
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Comprehensive quiz questions across different categories
const quizQuestions = [
  // Math Questions
  {
    category: 'math',
    difficulty: 1,
    question: 'What is 15 + 27?',
    options: ['40', '42', '44', '46'],
    correctAnswer: '42'
  },
  {
    category: 'math',
    difficulty: 2,
    question: 'What is 12 × 8?',
    options: ['84', '96', '104', '112'],
    correctAnswer: '96'
  },
  {
    category: 'math',
    difficulty: 3,
    question: 'What is the square root of 144?',
    options: ['10', '11', '12', '13'],
    correctAnswer: '12'
  },
  {
    category: 'math',
    difficulty: 2,
    question: 'What is 25% of 200?',
    options: ['25', '50', '75', '100'],
    correctAnswer: '50'
  },

  // Science Questions
  {
    category: 'science',
    difficulty: 2,
    question: 'What is the chemical symbol for gold?',
    options: ['Go', 'Gd', 'Au', 'Ag'],
    correctAnswer: 'Au'
  },
  {
    category: 'science',
    difficulty: 1,
    question: 'How many planets are in our solar system?',
    options: ['7', '8', '9', '10'],
    correctAnswer: '8'
  },
  {
    category: 'science',
    difficulty: 3,
    question: 'What is the speed of light in vacuum?',
    options: ['299,792,458 m/s', '300,000,000 m/s', '299,000,000 m/s', '301,000,000 m/s'],
    correctAnswer: '299,792,458 m/s'
  },
  {
    category: 'science',
    difficulty: 2,
    question: 'What gas makes up about 78% of Earth\'s atmosphere?',
    options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'],
    correctAnswer: 'Nitrogen'
  },

  // Cryptocurrency Questions
  {
    category: 'crypto',
    difficulty: 1,
    question: 'What is the first and most well-known cryptocurrency?',
    options: ['Ethereum', 'Bitcoin', 'Litecoin', 'Ripple'],
    correctAnswer: 'Bitcoin'
  },
  {
    category: 'crypto',
    difficulty: 2,
    question: 'What does "HODL" mean in crypto culture?',
    options: ['Hold On for Dear Life', 'High Order Digital Ledger', 'Hash Output Data Link', 'Hold On, Don\'t Lose'],
    correctAnswer: 'Hold On for Dear Life'
  },
  {
    category: 'crypto',
    difficulty: 3,
    question: 'What is a Merkle tree used for in blockchain?',
    options: ['Mining rewards', 'Data verification', 'Wallet addresses', 'Transaction fees'],
    correctAnswer: 'Data verification'
  },
  {
    category: 'crypto',
    difficulty: 2,
    question: 'What consensus mechanism does Ethereum 2.0 use?',
    options: ['Proof of Work', 'Proof of Stake', 'Proof of Authority', 'Delegated Proof of Stake'],
    correctAnswer: 'Proof of Stake'
  },

  // Geography Questions
  {
    category: 'geography',
    difficulty: 1,
    question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswer: 'Paris'
  },
  {
    category: 'geography',
    difficulty: 2,
    question: 'Which is the longest river in the world?',
    options: ['Amazon', 'Nile', 'Mississippi', 'Yangtze'],
    correctAnswer: 'Nile'
  },
  {
    category: 'geography',
    difficulty: 3,
    question: 'What is the smallest country in the world?',
    options: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'],
    correctAnswer: 'Vatican City'
  },

  // Technology Questions
  {
    category: 'technology',
    difficulty: 2,
    question: 'What does "API" stand for?',
    options: ['Application Programming Interface', 'Advanced Programming Integration', 'Automated Program Interaction', 'Application Process Integration'],
    correctAnswer: 'Application Programming Interface'
  },
  {
    category: 'technology',
    difficulty: 1,
    question: 'Which company created the React JavaScript library?',
    options: ['Google', 'Microsoft', 'Facebook', 'Apple'],
    correctAnswer: 'Facebook'
  },
  {
    category: 'technology',
    difficulty: 3,
    question: 'What is the time complexity of binary search?',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    correctAnswer: 'O(log n)'
  },

  // History Questions
  {
    category: 'history',
    difficulty: 2,
    question: 'In which year did World War II end?',
    options: ['1944', '1945', '1946', '1947'],
    correctAnswer: '1945'
  },
  {
    category: 'history',
    difficulty: 1,
    question: 'Who was the first person to walk on the moon?',
    options: ['Buzz Aldrin', 'Neil Armstrong', 'John Glenn', 'Alan Shepard'],
    correctAnswer: 'Neil Armstrong'
  },

  // General Knowledge
  {
    category: 'general',
    difficulty: 1,
    question: 'How many days are there in a leap year?',
    options: ['365', '366', '367', '364'],
    correctAnswer: '366'
  },
  {
    category: 'general',
    difficulty: 2,
    question: 'What is the largest mammal in the world?',
    options: ['African Elephant', 'Blue Whale', 'Giraffe', 'Hippopotamus'],
    correctAnswer: 'Blue Whale'
  }
];

async function seedQuizQuestions() {
  console.log('🌱 Seeding quiz questions...\n');

  try {
    // Clear existing questions
    console.log('🗑️  Clearing existing questions...');
    await prisma.question.deleteMany({});
    console.log('✅ Existing questions cleared\n');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      
      try {
        // Generate unique quiz ID
        const quizId = `quiz_${Date.now()}_${i}`;
        
        // Find correct answer index
        const answerIndex = q.options.indexOf(q.correctAnswer);
        if (answerIndex === -1) {
          throw new Error(`Correct answer "${q.correctAnswer}" not found in options`);
        }

        // Create question
        await prisma.question.create({
          data: {
            quizId,
            question: q.question,
            options: JSON.stringify(q.options), // Store as JSON string for SQLite
            answerIndex,
            correctAnswer: q.correctAnswer,
            difficulty: q.difficulty,
            category: q.category,
            mode: 'solo',
            status: 'active'
          }
        });

        console.log(`✅ Added: ${q.category} - ${q.question.substring(0, 50)}...`);
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to add question ${i + 1}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n🎉 Seeding completed!`);
    console.log(`✅ Successfully added: ${successCount} questions`);
    console.log(`❌ Failed to add: ${errorCount} questions`);

    // Show category breakdown
    const categories = await prisma.question.groupBy({
      by: ['category'],
      _count: {
        category: true
      }
    });

    console.log('\n📊 Questions by category:');
    categories.forEach(cat => {
      console.log(`   ${cat.category}: ${cat._count.category} questions`);
    });

    // Show difficulty breakdown
    const difficulties = await prisma.question.groupBy({
      by: ['difficulty'],
      _count: {
        difficulty: true
      }
    });

    console.log('\n📈 Questions by difficulty:');
    difficulties.forEach(diff => {
      console.log(`   Level ${diff.difficulty}: ${diff._count.difficulty} questions`);
    });

    console.log('\n🚀 Your organized backend now has real quiz questions!');
    console.log('🎮 Test them in your frontend at http://localhost:5173');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
seedQuizQuestions();
