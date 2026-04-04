import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = 'samrat-erp-secret-key-2026';

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json());

    // Database Initialization
    const db = new Database('./database.sqlite');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dealers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        gstin TEXT,
        address TEXT,
        credit_limit REAL DEFAULT 0,
        pricing_tier TEXT DEFAULT 'Standard'
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        unit TEXT,
        hsn_code TEXT,
        price REAL NOT NULL,
        stock_qty INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 10
      );

      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        type TEXT, -- 'IN' or 'OUT'
        qty INTEGER,
        reference_id TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dealer_id INTEGER,
        invoice_no TEXT UNIQUE NOT NULL,
        date DATE NOT NULL,
        total REAL NOT NULL,
        gst REAL NOT NULL,
        status TEXT DEFAULT 'Draft', -- 'Draft', 'Issued', 'Paid', 'Overdue'
        FOREIGN KEY(dealer_id) REFERENCES dealers(id)
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        product_id INTEGER,
        qty INTEGER,
        rate REAL,
        gst_rate REAL,
        FOREIGN KEY(invoice_id) REFERENCES invoices(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        dealer_id INTEGER,
        amount REAL NOT NULL,
        method TEXT, -- 'Cash', 'NEFT', 'RTGS', 'Cheque', 'UPI'
        date DATE NOT NULL,
        FOREIGN KEY(invoice_id) REFERENCES invoices(id),
        FOREIGN KEY(dealer_id) REFERENCES dealers(id)
      );

      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dealer_id INTEGER,
        type TEXT, -- 'INVOICE' or 'PAYMENT'
        amount REAL,
        reference TEXT,
        balance REAL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(dealer_id) REFERENCES dealers(id)
      );
    `);

    // Seed Admin User if not exists
    const adminExists = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@samrat.com');
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 8);
      db.prepare('INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)').run(
        'System Admin', 'admin@samrat.com', 'Admin', hashedPassword
      );
    }

    // Migration: Add hsn_code to products if it doesn't exist
    const tableInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
    const hasHsnCode = tableInfo.some((column: any) => column.name === 'hsn_code');
    if (!hasHsnCode) {
      db.exec("ALTER TABLE products ADD COLUMN hsn_code TEXT");
    }

    // Middleware for Auth
    const authenticateToken = (req: any, res: any, next: any) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        console.warn(`Unauthorized access attempt to ${req.url}: No token provided`);
        return res.status(401).json({ message: 'Unauthorized' });
      }

      jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
          console.error(`Forbidden access attempt to ${req.url}: Invalid or expired token`, err.message);
          return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = user;
        next();
      });
    };

    // --- API Routes ---

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.post('/api/auth/login', async (req, res) => {
      const { email, password } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      if (!user) return res.status(400).json({ message: 'User not found' });

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    });

    app.get('/api/products', authenticateToken, (req, res) => {
      const products = db.prepare('SELECT * FROM products').all();
      res.json(products);
    });

    app.get('/api/products/:id/transactions', authenticateToken, (req, res) => {
      const transactions = db.prepare('SELECT * FROM inventory_transactions WHERE product_id = ? ORDER BY date DESC').all(req.params.id);
      res.json(transactions);
    });

    app.post('/api/products/:id/adjust-stock', authenticateToken, (req, res) => {
      const { quantity: rawQuantity, type, reference } = req.body;
      const quantity = parseInt(rawQuantity as string, 10);
      const productId = req.params.id;

      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }

      try {
        db.transaction(() => {
          // Update stock quantity
          if (type === 'IN') {
            db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(quantity, productId);
          } else {
            const product = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(productId) as any;
            if (product.stock_qty < quantity) {
              throw new Error('Insufficient stock for this adjustment');
            }
            db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(quantity, productId);
          }

          // Record transaction
          db.prepare(`
            INSERT INTO inventory_transactions (product_id, type, qty, reference_id)
            VALUES (?, ?, ?, ?)
          `).run(productId, type, quantity, reference);
        })();

        res.json({ success: true });
      } catch (err: any) {
        res.status(400).json({ message: err.message || 'Failed to adjust stock' });
      }
    });

    app.post('/api/products', authenticateToken, (req, res) => {
      const { sku, name, category, unit, hsn_code, price: rawPrice, stock_qty: rawStock, low_stock_threshold: rawThreshold } = req.body;
      const price = parseFloat(rawPrice as string);
      const stock_qty = parseInt(rawStock as string, 10) || 0;
      const low_stock_threshold = parseInt(rawThreshold as string, 10) || 10;

      if (stock_qty < 0) return res.status(400).json({ message: 'Stock cannot be negative' });
      if (isNaN(price) || price < 0) return res.status(400).json({ message: 'Invalid price' });

      try {
        const result = db.prepare(
          'INSERT INTO products (sku, name, category, unit, hsn_code, price, stock_qty, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(sku, name, category, unit, hsn_code, price, stock_qty, low_stock_threshold);
        res.json({ id: result.lastInsertRowid });
      } catch (e) {
        res.status(400).json({ message: 'SKU must be unique' });
      }
    });

    app.put('/api/products/:id', authenticateToken, (req, res) => {
      const { name, category, unit, hsn_code, price: rawPrice, stock_qty: rawStock, low_stock_threshold: rawThreshold } = req.body;
      const price = parseFloat(rawPrice as string);
      const stock_qty = parseInt(rawStock as string, 10) || 0;
      const low_stock_threshold = parseInt(rawThreshold as string, 10) || 10;

      if (stock_qty < 0) return res.status(400).json({ message: 'Stock cannot be negative' });
      if (isNaN(price) || price < 0) return res.status(400).json({ message: 'Invalid price' });

      db.prepare(
        'UPDATE products SET name = ?, category = ?, unit = ?, hsn_code = ?, price = ?, stock_qty = ?, low_stock_threshold = ? WHERE id = ?'
      ).run(name, category, unit, hsn_code, price, stock_qty, low_stock_threshold, req.params.id);
      res.json({ message: 'Updated' });
    });

    app.delete('/api/products/:id', authenticateToken, (req, res) => {
      try {
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
      }
    });

    app.get('/api/dealers', authenticateToken, (req, res) => {
      const dealers = db.prepare('SELECT * FROM dealers').all();
      res.json(dealers);
    });

    app.post('/api/dealers', authenticateToken, (req, res) => {
      const { name, gstin, address, credit_limit: rawLimit, pricing_tier } = req.body;
      const credit_limit = parseFloat(rawLimit as string) || 0;
      const result = db.prepare(
        'INSERT INTO dealers (name, gstin, address, credit_limit, pricing_tier) VALUES (?, ?, ?, ?, ?)'
      ).run(name, gstin, address, credit_limit, pricing_tier);
      res.json({ id: result.lastInsertRowid });
    });

    app.get('/api/invoices', authenticateToken, (req, res) => {
      const invoices = db.prepare(`
        SELECT i.*, d.name as dealer_name 
        FROM invoices i 
        JOIN dealers d ON i.dealer_id = d.id
        ORDER BY i.date DESC
      `).all();
      res.json(invoices);
    });

    app.get('/api/invoices/:id', authenticateToken, (req, res) => {
      const invoice = db.prepare(`
        SELECT i.*, d.name as dealer_name, d.address as dealer_address, d.gstin as dealer_gstin
        FROM invoices i 
        JOIN dealers d ON i.dealer_id = d.id
        WHERE i.id = ?
      `).get(req.params.id);
      
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

      const items = db.prepare(`
        SELECT ii.*, p.name as product_name, p.hsn_code
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = ?
      `).all(req.params.id);

      res.json({ ...invoice, items });
    });

    app.post('/api/invoices', authenticateToken, (req, res) => {
      const { dealer_id, invoice_no, date, total, gst, items } = req.body;
      
      try {
        const createInvoice = db.transaction(() => {
          // Check stock first
          const checkStock = db.prepare('SELECT name, stock_qty FROM products WHERE id = ?');
          for (const item of items) {
            const product = checkStock.get(item.product_id) as any;
            if (!product || product.stock_qty < item.qty) {
              throw new Error(`Insufficient stock for ${product?.name || 'Unknown Product'}. Available: ${product?.stock_qty || 0}`);
            }
          }

          const result = db.prepare(
            'INSERT INTO invoices (dealer_id, invoice_no, date, total, gst, status) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(dealer_id, invoice_no, date, total, gst, 'Issued');
          const invoiceId = result.lastInsertRowid;
          
          const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, product_id, qty, rate, gst_rate) VALUES (?, ?, ?, ?, ?)');
          const updateStock = db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?');
          const logTx = db.prepare('INSERT INTO inventory_transactions (product_id, type, qty, reference_id) VALUES (?, ?, ?, ?)');

          for (const item of items) {
            insertItem.run(invoiceId, item.product_id, item.qty, item.rate, item.gst_rate);
            updateStock.run(item.qty, item.product_id);
            logTx.run(item.product_id, 'OUT', item.qty, `INV-${invoice_no}`);
          }

          const lastLedger = db.prepare('SELECT balance FROM ledger_entries WHERE dealer_id = ? ORDER BY id DESC LIMIT 1').get(dealer_id) as any;
          const currentBalance = (lastLedger?.balance || 0) + total;
          db.prepare('INSERT INTO ledger_entries (dealer_id, type, amount, reference, balance) VALUES (?, ?, ?, ?, ?)').run(
            dealer_id, 'INVOICE', total, `INV-${invoice_no}`, currentBalance
          );
          
          return invoiceId;
        });

        const invoiceId = createInvoice();
        res.json({ id: invoiceId });
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/api/payments', authenticateToken, (req, res) => {
      const payments = db.prepare(`
        SELECT p.*, d.name as dealer_name, i.invoice_no 
        FROM payments p 
        JOIN dealers d ON p.dealer_id = d.id
        LEFT JOIN invoices i ON p.invoice_id = i.id
        ORDER BY p.date DESC
      `).all();
      res.json(payments);
    });

    app.post('/api/payments', authenticateToken, (req, res) => {
      try {
        const { invoice_id, dealer_id, amount: rawAmount, method, date } = req.body;
        const amount = parseFloat(rawAmount as string);
        if (isNaN(amount) || amount <= 0) {
          return res.status(400).json({ message: 'Invalid payment amount' });
        }

        const invId = invoice_id ? invoice_id : null;
        
        const result = db.prepare(
          'INSERT INTO payments (invoice_id, dealer_id, amount, method, date) VALUES (?, ?, ?, ?, ?)'
        ).run(invId, dealer_id, amount, method, date);
        
        const lastLedger = db.prepare('SELECT balance FROM ledger_entries WHERE dealer_id = ? ORDER BY id DESC LIMIT 1').get(dealer_id) as any;
        const currentBalance = (lastLedger?.balance || 0) - amount;
        db.prepare('INSERT INTO ledger_entries (dealer_id, type, amount, reference, balance) VALUES (?, ?, ?, ?, ?)').run(
          dealer_id, 'PAYMENT', amount, `PAY-${result.lastInsertRowid}`, currentBalance
        );
        
        if (invId) {
          const totalPaid = db.prepare('SELECT SUM(amount) as total FROM payments WHERE invoice_id = ?').get(invId) as any;
          const invoice = db.prepare('SELECT total FROM invoices WHERE id = ?').get(invId) as any;
          if (totalPaid.total >= invoice.total) {
            db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run('Paid', invId);
          }
        }
        res.json({ id: result.lastInsertRowid });
      } catch (error: any) {
        console.error('Payment error:', error);
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/api/ledger/:dealerId', authenticateToken, (req, res) => {
      const entries = db.prepare('SELECT * FROM ledger_entries WHERE dealer_id = ? ORDER BY date DESC').all(req.params.dealerId);
      res.json(entries);
    });

    app.get('/api/reports', authenticateToken, (req, res) => {
      const salesByMonth = db.prepare(`
        SELECT strftime('%Y-%m', date) as month, SUM(total) as sales
        FROM invoices
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `).all();

      const topDealers = db.prepare(`
        SELECT d.name, SUM(i.total) as total_sales
        FROM invoices i
        JOIN dealers d ON i.dealer_id = d.id
        GROUP BY d.id
        ORDER BY total_sales DESC
        LIMIT 5
      `).all();

      const paymentMethods = db.prepare(`
        SELECT method, SUM(amount) as total
        FROM payments
        GROUP BY method
      `).all();

      res.json({
        salesByMonth,
        topDealers,
        paymentMethods
      });
    });

    app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
      const totalSales = db.prepare('SELECT SUM(total) as total FROM invoices').get() as any;
      const outstanding = db.prepare('SELECT SUM(balance) as total FROM (SELECT dealer_id, balance FROM ledger_entries GROUP BY dealer_id HAVING id = MAX(id))').get() as any;
      const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock_qty <= low_stock_threshold').get() as any;
      const recentInvoices = db.prepare('SELECT i.*, d.name as dealer_name FROM invoices i JOIN dealers d ON i.dealer_id = d.id ORDER BY i.date DESC LIMIT 5').all();
      const activeDealers = db.prepare('SELECT COUNT(*) as count FROM dealers').get() as any;
      
      const salesData = db.prepare(`
        SELECT strftime('%w', date) as day_of_week, SUM(total) as sales
        FROM invoices
        WHERE date >= date('now', '-7 days')
        GROUP BY day_of_week
      `).all();

      res.json({
        totalSales: totalSales?.total || 0,
        outstanding: outstanding?.total || 0,
        lowStock: lowStock?.count || 0,
        activeDealers: activeDealers?.count || 0,
        recentInvoices,
        salesData
      });
    });

    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Global error handler:', err);
      res.status(500).json({ message: 'Internal Server Error', error: err.message });
    });

    // 404 handler for API routes
    app.all('/api/*', (req, res) => {
      res.status(404).json({ message: `API route not found: ${req.method} ${req.url}` });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startServer();
