// backend/config/database.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

export const initializeFirebase = () => {
  try {
    const serviceAccountPath = `${__dirname}/../serviceAccountKey.json`;
    const serviceAccountData = readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountData);
    
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    
    console.log("✅ Firebase initialized successfully");
    return db;
  } catch (error) {
    console.error("❌ Error: Could not load Firebase serviceAccountKey.json.", error);
    console.error("⚠️ Server will continue but Firebase features will be disabled");
    return null;
  }
};

export const getDatabase = () => {
  if (!db) {
    console.warn("⚠️ Database not initialized. Call initializeFirebase() first.");
  }
  return db;
};

export { admin };