import { config } from 'dotenv';
config();

import Database from 'better-sqlite3';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  Timestamp 
} from "firebase/firestore";

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

const sqlite = new Database('./database.sqlite');

async function migrate() {
  console.log("Starting migration...");

  // 1. Migrate Users
  console.log("Migrating users...");
  const users = sqlite.prepare('SELECT * FROM users').all() as any[];
  for (const user of users) {
    await setDoc(doc(db, "users", user.email), {
      name: user.name,
      email: user.email,
      role: user.role,
      password_hash: user.password_hash
    });
  }

  // 2. Migrate Products
  console.log("Migrating products...");
  const products = sqlite.prepare('SELECT * FROM products').all() as any[];
  for (const product of products) {
    await addDoc(collection(db, "products"), {
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      hsn_code: product.hsn_code,
      price: product.price,
      stock_qty: product.stock_qty,
      low_stock_threshold: product.low_stock_threshold
    });
  }

  // 3. Migrate Dealers
  console.log("Migrating dealers...");
  const dealers = sqlite.prepare('SELECT * FROM dealers').all() as any[];
  const dealerIdMap = new Map();
  for (const dealer of dealers) {
    const docRef = await addDoc(collection(db, "dealers"), {
      name: dealer.name,
      gstin: dealer.gstin,
      address: dealer.address,
      credit_limit: dealer.credit_limit,
      pricing_tier: dealer.pricing_tier
    });
    dealerIdMap.set(dealer.id, docRef.id);

    // Create initial ledger if balance is 0? 
    // In SQLite, balance is calculated. We'll migrate history later if needed.
    // For now, let's just make sure they exist.
  }

  // 4. Migrate Ledger Entries (to keep balances correct)
  console.log("Migrating ledger entries...");
  const entries = sqlite.prepare('SELECT * FROM ledger_entries').all() as any[];
  for (const entry of entries) {
    const firestoreDealerId = dealerIdMap.get(entry.dealer_id);
    if (!firestoreDealerId) continue;

    await addDoc(collection(db, "ledger"), {
      dealer_id: firestoreDealerId,
      type: entry.type,
      amount: entry.amount,
      reference: entry.reference,
      balance: entry.balance,
      date: Timestamp.fromDate(new Date(entry.date))
    });
  }

  console.log("Migration finished successfully!");
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
