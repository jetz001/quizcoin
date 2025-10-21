# Firebase to PostgreSQL Migration Guide

## Prerequisites

1. **Install PostgreSQL on your server**:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # Start PostgreSQL service
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

2. **Create database and user**:
   ```bash
   sudo -u postgres psql
   CREATE DATABASE quizcoin_db;
   CREATE USER quizcoin_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE quizcoin_db TO quizcoin_user;
   \q
   ```

## Migration Steps

### 1. Install Dependencies
```bash
cd backend
npm install prisma @prisma/client pg
npm install --save-dev @types/pg
```

### 2. Setup Environment Variables
Copy `.env.example` to `.env` and update:
```env
DATABASE_URL=postgresql://quizcoin_user:your_secure_password@localhost:5432/quizcoin_db
```

### 3. Initialize Database Schema
```bash
# Generate Prisma client
npm run db:generate

# Create and run initial migration
npm run db:migrate
```

### 4. Export Firebase Data
```bash
# Export all Firebase data to JSON
npm run export:firebase
```

### 5. Import to PostgreSQL
```bash
# Import exported data to PostgreSQL
npm run import:postgresql
```

### 6. Update Server Configuration

The server will automatically use the new database service. The migration maintains the same API interface, so no frontend changes are needed.

### 7. Test the Migration
```bash
# Start the server
npm start

# Verify data integrity
# Check http://localhost:3001/api/quizzes
# Check http://localhost:3001/admin (if available)
```

### 8. Switch to Database Service

Update `server.js` to use the new database service instead of Firebase:

```javascript
// Replace Firebase import
import { initializeDatabase } from './services/database.js';

// Replace Firebase initialization
const db = await initializeDatabase();
```

## Rollback Plan

If you need to rollback to Firebase:
1. Keep Firebase service files
2. Switch back imports in `server.js`
3. Update environment variables
4. Restart server

## Performance Comparison

### Before (Firebase):
- Query limitations
- Cost per operation
- Cold start delays
- Limited complex queries

### After (PostgreSQL):
- Unlimited queries
- Fixed hosting cost
- Consistent performance
- Full SQL capabilities
- Better joins and aggregations

## Monitoring

After migration, monitor:
- Database connection pool
- Query performance
- Memory usage
- Disk space

Use `npm run db:studio` to access Prisma Studio for database management.

## Troubleshooting

### Common Issues:

1. **Connection Error**: Check DATABASE_URL format
2. **Migration Fails**: Ensure PostgreSQL is running
3. **Data Missing**: Verify export completed successfully
4. **Performance Issues**: Add database indexes if needed

### Useful Commands:
```bash
# Check database status
sudo systemctl status postgresql

# View database logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Connect to database directly
psql postgresql://quizcoin_user:password@localhost:5432/quizcoin_db
```
