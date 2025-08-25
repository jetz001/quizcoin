// This file is responsible for initializing Firebase once and only once.

import { initializeApp, getApps, getApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAkwLC74k8fiCOzcodBmd2F9RphTO3wsKY",
  authDomain: "quizcoin-backend.firebaseapp.com",
  projectId: "quizcoin-backend",
  storageBucket: "quizcoin-backend.firebasestorage.app",
  messagingSenderId: "405495322412",
  appId: "1:405495322412:web:1eb1a48ad3ea2033fdfe89",
  measurementId: "G-2726T8KNXN"
};

// Initialize Firebase only if an instance doesn't already exist.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export default app;
