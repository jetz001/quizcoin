# Backend Reorganization Plan

## 🎯 **New Structure (Service-Oriented)**

```
backend/
├── 📁 src/                          # Main source code
│   ├── 📁 core/                     # Core system components
│   │   ├── server.js                # Main server entry
│   │   ├── app.js                   # Express app setup
│   │   └── serviceManager.js        # Service orchestration
│   │
│   ├── 📁 services/                 # Business logic services
│   │   ├── 📁 database/             # Database service
│   │   │   ├── index.js             # Database service main
│   │   │   ├── models/              # Prisma models & queries
│   │   │   └── migrations/          # Database migrations
│   │   │
│   │   ├── 📁 blockchain/           # Blockchain service
│   │   │   ├── index.js             # Blockchain service main
│   │   │   ├── contracts/           # Smart contract interactions
│   │   │   └── web3/                # Web3 utilities
│   │   │
│   │   ├── 📁 quiz/                 # Quiz generation service
│   │   │   ├── index.js             # Quiz service main
│   │   │   ├── generators/          # Different quiz generators
│   │   │   └── ai/                  # AI integration (Gemini)
│   │   │
│   │   ├── 📁 merkle/               # Merkle tree service
│   │   │   ├── index.js             # Merkle service main
│   │   │   ├── tree.js              # Tree operations
│   │   │   └── proofs.js            # Proof generation
│   │   │
│   │   └── 📁 realtime/             # Real-time service
│   │       ├── index.js             # Socket.IO service
│   │       └── events/              # Event handlers
│   │
│   ├── 📁 api/                      # API layer
│   │   ├── 📁 routes/               # Route definitions
│   │   │   ├── index.js             # Route aggregator
│   │   │   ├── admin.js             # Admin routes
│   │   │   ├── quiz.js              # Quiz routes
│   │   │   ├── merkle.js            # Merkle routes
│   │   │   └── data.js              # Data viewing routes
│   │   │
│   │   ├── 📁 middleware/           # Express middleware
│   │   │   ├── auth.js              # Authentication
│   │   │   ├── validation.js        # Request validation
│   │   │   └── error.js             # Error handling
│   │   │
│   │   └── 📁 controllers/          # Route controllers
│   │       ├── adminController.js   # Admin logic
│   │       ├── quizController.js    # Quiz logic
│   │       └── merkleController.js  # Merkle logic
│   │
│   ├── 📁 config/                   # Configuration
│   │   ├── index.js                 # Config aggregator
│   │   ├── database.js              # Database config
│   │   ├── blockchain.js            # Blockchain config
│   │   └── services.json            # Service definitions
│   │
│   └── 📁 utils/                    # Shared utilities
│       ├── logger.js                # Logging utility
│       ├── crypto.js                # Crypto utilities
│       └── helpers.js               # General helpers
│
├── 📁 blockchain/                   # Blockchain-specific files
│   ├── 📁 contracts/               # Smart contracts
│   ├── 📁 scripts/                 # Deployment scripts
│   ├── 📁 test/                    # Contract tests
│   ├── hardhat.config.js           # Hardhat config
│   └── contractAddresses.json      # Deployed addresses
│
├── 📁 database/                     # Database-specific files
│   ├── 📁 prisma/                  # Prisma schema & migrations
│   └── 📁 seeds/                   # Database seed data
│
├── 📁 scripts/                      # Operational scripts
│   ├── 📁 setup/                   # Setup scripts
│   ├── 📁 migration/               # Migration scripts
│   ├── 📁 deployment/              # Deployment scripts
│   └── 📁 maintenance/             # Maintenance scripts
│
├── 📁 public/                       # Static files
│   ├── dashboard.html              # Admin dashboard
│   └── assets/                     # Static assets
│
├── 📁 docs/                         # Documentation
│   ├── API.md                      # API documentation
│   ├── SETUP.md                    # Setup guide
│   └── ARCHITECTURE.md             # Architecture docs
│
├── 📁 tests/                        # Test files
│   ├── 📁 unit/                    # Unit tests
│   ├── 📁 integration/             # Integration tests
│   └── 📁 e2e/                     # End-to-end tests
│
├── package.json                     # Dependencies
├── .env                            # Environment variables
└── server.js                       # Entry point (points to src/core/server.js)
```

## 🔄 **Migration Benefits**

### **Before (Current)**:
- Mixed concerns in same folders
- Hard to find related files
- No clear service boundaries
- Difficult to test individual services

### **After (Organized)**:
- **Clear separation** - each service in its own folder
- **Easy navigation** - logical file grouping
- **Testable** - isolated service testing
- **Scalable** - easy to add new services
- **Maintainable** - clear ownership of code

## 📋 **Migration Steps**

1. **Create new folder structure**
2. **Move files to appropriate locations**
3. **Update import paths**
4. **Update configuration**
5. **Test everything works**
