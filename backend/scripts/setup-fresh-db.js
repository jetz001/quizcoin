// scripts/setup-fresh-db.js - Setup fresh PostgreSQL database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupFreshDatabase() {
  try {
    console.log('🚀 Setting up fresh QuizCoin database...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Clear existing data (if any)
    console.log('🧹 Clearing existing data...');
    await prisma.userAnswer.deleteMany();
    await prisma.merkleLeaf.deleteMany();
    await prisma.question.deleteMany();
    await prisma.merkleBatch.deleteMany();
    
    console.log('✅ Database is clean and ready for fresh data');
    
    // Create a sample question for testing (optional)
    console.log('📝 Creating sample question for testing...');
    await prisma.question.create({
      data: {
        quizId: 'sample-quiz-001',
        question: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        answerIndex: 1,
        correctAnswer: '4',
        difficulty: 1,
        category: 'math',
        status: 'active'
      }
    });
    
    console.log('✅ Sample question created');
    
    // Show final status
    const counts = await Promise.all([
      prisma.question.count(),
      prisma.merkleLeaf.count(),
      prisma.merkleBatch.count(),
      prisma.userAnswer.count()
    ]);
    
    console.log('📊 Database status:');
    console.log(`  Questions: ${counts[0]}`);
    console.log(`  Merkle Leaves: ${counts[1]}`);
    console.log(`  Merkle Batches: ${counts[2]}`);
    console.log(`  User Answers: ${counts[3]}`);
    
    console.log('🎉 Fresh database setup completed!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupFreshDatabase();
