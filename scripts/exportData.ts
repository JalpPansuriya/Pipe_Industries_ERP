import Database from 'better-sqlite3';
import fs from 'fs';

const sqlite = new Database('./database.sqlite');

function exportData() {
  console.log("Exporting data from SQLite...");

  const users = sqlite.prepare('SELECT id, name, email, role, password_hash FROM users').all();
  const products = sqlite.prepare('SELECT * FROM products').all();
  const dealers = sqlite.prepare('SELECT * FROM dealers').all();
  const ledger = sqlite.prepare('SELECT * FROM ledger_entries').all();

  const data = { users, products, dealers, ledger };
  fs.writeFileSync('./sqlite_export.json', JSON.stringify(data, null, 2));
  
  console.log("Exported to sqlite_export.json");
}

exportData();
