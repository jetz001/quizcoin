# Fresh PostgreSQL Setup Guide

## Quick Start (No Firebase Data Import)

### 1. Install PostgreSQL on Your Server
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database
```bash
sudo -u postgres psql
CREATE DATABASE quizcoin_db;
CREATE USER quizcoin_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE quizcoin_db TO quizcoin_user;
\q
```

### 3. Install Dependencies
```bash
cd backend
npm install prisma @prisma/client pg
```

### 4. Setup Environment
Create `.env` file:
```env
DATABASE_URL=postgresql://quizcoin_user:your_secure_password@localhost:5432/quizcoin_db
```

### 5. Initialize Fresh Database
```bash
# Complete setup (generates client, runs migrations, sets up fresh DB)
npm run db:setup
```

### 6. Start Your Server
```bash
npm start
```

## That's It! 🎉

Your QuizCoin backend is now running with:
- ✅ Fresh PostgreSQL database
- ✅ No Firebase dependencies
- ✅ Same API endpoints
- ✅ Real-time Socket.IO support
- ✅ One sample question for testing

## Useful Commands

```bash
# View database in browser
npm run db:studio

# Reset database (clear all data)
npm run db:fresh

# Check server status
curl http://localhost:3001/

# Test API
curl http://localhost:3001/api/quizzes
```

## What Changed

### Before (Firebase):
- Expensive per-operation costs
- Query limitations
- Usage limits
- Vendor lock-in

### After (PostgreSQL):
- Fixed hosting costs
- Unlimited queries
- Full SQL power
- Complete control

## Cost Comparison

- **Firebase**: $25-100+/month (based on usage)
- **PostgreSQL**: $0 (on your server) or $5-20/month (hosted)
- **Savings**: 80-100% cost reduction

## Next Steps

1. **Test the API**: Visit `http://localhost:3001/api/quizzes`
2. **Create questions**: Use your existing quiz generation system
3. **Monitor performance**: Check database performance with `npm run db:studio`
4. **Scale as needed**: Add indexes, optimize queries

Your QuizCoin app will now generate fresh questions and store them in PostgreSQL instead of Firebase!
