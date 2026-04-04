/**
 * Seed Admin User Script
 * Run with: npx tsx scripts/seedAdmin.ts
 * 
 * NOTE: This script requires a .env file with Firebase config.
 * The app's AuthContext also auto-creates the admin user on first login,
 * so this script is only needed if you want to seed the user manually.
 */
import { config } from 'dotenv';
config();

import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc 
} from "firebase/firestore";
import bcrypt from 'bcryptjs';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedAdmin() {
  console.log("Seeding admin user...");
  const hashedPassword = await bcrypt.hash('admin123', 8);
  
  await setDoc(doc(db, "users", "admin@samrat.com"), {
    name: "System Admin",
    email: "admin@samrat.com",
    role: "Admin",
    password_hash: hashedPassword
  });
  
  console.log("Admin user seeded successfully!");
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
