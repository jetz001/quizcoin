// fix-imports-final.js - Final comprehensive import path fix
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Final Import Path Fix - Making Organized Server Work...\n');

// Function to find all JS files recursively
function findJSFiles(dir, files = []) {
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
        findJSFiles(fullPath, files);
      } else if (item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return files;
}

// Comprehensive import fixes
const importFixes = [
  // Config path fixes
  { from: "from '../config/", to: "from '../../config/" },
  { from: "from './config/", to: "from '../../config/" },
  { from: "from '../services/config/", to: "from '../../config/" },
  
  // Service path fixes
  { from: "from './firebase.js'", to: "from '../database/firebase.js'" },
  { from: "from '../firebase.js'", to: "from '../database/firebase.js'" },
  { from: "from './geminiService.js'", to: "from '../quiz/ai/gemini.js'" },
  { from: "from '../geminiService.js'", to: "from '../quiz/ai/gemini.js'" },
  { from: "from './smartContractService.js'", to: "from '../blockchain/contracts/smartContract.js'" },
  { from: "from '../smartContractService.js'", to: "from '../blockchain/contracts/smartContract.js'" },
  { from: "from './merkleService.js'", to: "from '../merkle/tree.js'" },
  { from: "from '../merkleService.js'", to: "from '../merkle/tree.js'" },
  
  // Route specific fixes
  { from: "from '../services/merkle.js'", to: "from '../../services/merkle/index.js'" },
  { from: "from '../services/blockchain.js'", to: "from '../../services/blockchain/index.js'" },
  { from: "from '../services/database.js'", to: "from '../../services/database/index.js'" },
  { from: "from '../services/quiz.js'", to: "from '../../services/quiz/index.js'" },
  
  // Dynamic import fixes
  { from: "import('../config/", to: "import('../../config/" },
  { from: "import('./config/", to: "import('../../config/" },
  { from: "import('../services/config/", to: "import('../../config/" }
];

// Function to fix imports in a single file
function fixImportsInFile(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  let content = readFileSync(filePath, 'utf8');
  let changed = false;
  const relativePath = filePath.replace(__dirname, '').replace(/\\/g, '/');

  importFixes.forEach(fix => {
    if (content.includes(fix.from)) {
      content = content.replaceAll(fix.from, fix.to);
      changed = true;
      console.log(`   ✅ ${relativePath}: ${fix.from} → ${fix.to}`);
    }
  });

  if (changed) {
    writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

// Check if organized server files exist
function checkServerFiles() {
  console.log('📋 Checking server files...');
  
  const serverFiles = [
    'src/core/server-organized.js',
    'src/services/database/index.js',
    'src/services/blockchain/index.js',
    'src/api/routes/index.js'
  ];
  
  serverFiles.forEach(file => {
    const exists = existsSync(join(__dirname, file));
    console.log(`${exists ? '✅' : '❌'} ${file}`);
  });
  
  console.log('');
}

// Main execution
function fixAllImports() {
  checkServerFiles();
  
  const srcDir = join(__dirname, 'src');
  if (!existsSync(srcDir)) {
    console.log('❌ src/ directory not found!');
    return;
  }
  
  const jsFiles = findJSFiles(srcDir);
  
  console.log(`🔍 Found ${jsFiles.length} JavaScript files to check...\n`);
  
  let totalFixed = 0;
  
  jsFiles.forEach(file => {
    if (fixImportsInFile(file)) {
      totalFixed++;
    }
  });
  
  console.log(`\n🎉 Fixed imports in ${totalFixed} files!`);
  
  if (totalFixed > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. npm run start:organized');
    console.log('2. If still errors, check specific error messages');
    console.log('3. Visit http://localhost:3001 to see your organized backend');
  } else {
    console.log('\n✅ All import paths appear to be correct!');
    console.log('Try: npm run start:organized');
  }
  
  console.log('\n🏆 Your organized backend should now work perfectly!');
}

fixAllImports();
