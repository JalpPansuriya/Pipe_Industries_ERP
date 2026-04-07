import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";

// --- Types ---
export interface Product {
  id?: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  hsn_code: string;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface Dealer {
  id?: string;
  name: string;
  gstin: string;
  address: string;
  credit_limit: number;
  pricing_tier: string;
}

export interface InvoiceItem {
  product_id: string;
  product_name: string;
  qty: number;
  rate: number;
  gst_rate: number;
}

export interface Invoice {
  id?: string;
  dealer_id: string;
  dealer_name: string;
  invoice_no: string;
  date: any;
  total: number;
  gst: number;
  status: string;
  items: InvoiceItem[];
}

// --- Collections ---
const productsRef = collection(db, "products");
const dealersRef = collection(db, "dealers");
const invoicesRef = collection(db, "invoices");
const paymentsRef = collection(db, "payments");
const ledgerRef = collection(db, "ledger");

// --- Product Services ---
export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(productsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const addProduct = async (product: Omit<Product, 'id'>) => {
  return await addDoc(productsRef, product);
};

export const updateProduct = async (id: string, product: Partial<Product>) => {
  const docRef = doc(db, "products", id);
  return await updateDoc(docRef, product);
};

export const deleteProduct = async (id: string) => {
  const docRef = doc(db, "products", id);
  return await deleteDoc(docRef);
};

export const adjustStock = async (productId: string, quantity: number, type: 'IN' | 'OUT', reference: string) => {
  return await runTransaction(db, async (transaction) => {
    const productRef = doc(db, "products", productId);
    const productDoc = await transaction.get(productRef);
    
    if (!productDoc.exists()) throw new Error("Product not found");
    
    const currentStock = productDoc.data().stock_qty || 0;
    const newStock = type === 'IN' ? currentStock + quantity : currentStock - quantity;
    
    if (newStock < 0) throw new Error("Insufficient stock for this adjustment");
    
    transaction.update(productRef, { stock_qty: newStock });
    
    const txRef = doc(collection(db, "inventory_transactions"));
    transaction.set(txRef, {
      product_id: productId,
      type,
      qty: quantity,
      reference_id: reference,
      date: serverTimestamp()
    });
  });
};

export const getTransactions = async (productId: string) => {
  const q = query(
    collection(db, "inventory_transactions"), 
    where("product_id", "==", productId), 
    orderBy("date", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Dealer Services ---
export const getDealers = async (): Promise<Dealer[]> => {
  const snapshot = await getDocs(dealersRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dealer));
};

export const getDealer = async (id: string): Promise<Dealer> => {
  const docRef = doc(db, "dealers", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("Dealer not found");
  return { id: snap.id, ...snap.data() } as Dealer;
};

export const addDealer = async (dealer: Omit<Dealer, 'id'>) => {
  return await addDoc(dealersRef, dealer);
};

export const updateDealer = async (id: string, dealer: Partial<Dealer>) => {
  const docRef = doc(db, "dealers", id);
  return await updateDoc(docRef, dealer);
};

// --- Invoice Services ---
export const getInvoices = async (): Promise<Invoice[]> => {
  const q = query(invoicesRef, orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
};

export const getInvoice = async (id: string): Promise<Invoice> => {
  const docRef = doc(db, "invoices", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("Invoice not found");
  return { id: snap.id, ...snap.data() } as Invoice;
};

export const createInvoice = async (invoiceData: Omit<Invoice, 'id'>) => {
  return await runTransaction(db, async (transaction) => {
    // 1. Check & Update Stock for each product
    for (const item of invoiceData.items) {
      const productRef = doc(db, "products", item.product_id);
      const productDoc = await transaction.get(productRef);
      
      if (!productDoc.exists()) {
        throw new Error(`Product ${item.product_name} not found`);
      }
      
      const currentStock = productDoc.data().stock_qty || 0;
      if (currentStock < item.qty) {
        throw new Error(`Insufficient stock for ${item.product_name}. Available: ${currentStock}`);
      }
      
      transaction.update(productRef, {
        stock_qty: currentStock - item.qty
      });
      
      // Log transaction
      const txRef = doc(collection(db, "inventory_transactions"));
      transaction.set(txRef, {
        product_id: item.product_id,
        type: 'OUT',
        qty: item.qty,
        reference_id: `INV-${invoiceData.invoice_no}`,
        date: serverTimestamp()
      });
    }

    // 2. Create Invoice
    const invRef = doc(collection(db, "invoices"));
    transaction.set(invRef, {
      ...invoiceData,
      status: 'Issued',
      date: Timestamp.fromDate(new Date(invoiceData.date))
    });

    // 3. Update Dealer Ledger
    const lastLedgerQ = query(
      ledgerRef, 
      where("dealer_id", "==", invoiceData.dealer_id),
      orderBy("date", "desc"),
      limit(1)
    );
    const lastLedgerSnap = await getDocs(lastLedgerQ);
    const lastBalance = lastLedgerSnap.docs[0]?.data().balance || 0;
    
    const ledgerEntryRef = doc(collection(db, "ledger"));
    transaction.set(ledgerEntryRef, {
      dealer_id: invoiceData.dealer_id,
      type: 'INVOICE',
      amount: invoiceData.total,
      reference: `INV-${invoiceData.invoice_no}`,
      balance: lastBalance + invoiceData.total,
      date: serverTimestamp()
    });

    return invRef.id;
  });
};

export const performMigration = async (data: any) => {
  return await runTransaction(db, async (transaction) => {
    // 1. Migrate Users
    for (const user of data.users) {
      const userRef = doc(db, "users", user.email);
      transaction.set(userRef, {
        name: user.name,
        email: user.email,
        role: user.role,
        password_hash: user.password_hash
      });
    }

    // 2. Migrate Products
    for (const product of data.products) {
      const prodRef = doc(collection(db, "products"));
      transaction.set(prodRef, {
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
    const dealerIdMap = new Map();
    for (const dealer of data.dealers) {
      const dealerRef = doc(collection(db, "dealers"));
      transaction.set(dealerRef, {
        name: dealer.name,
        gstin: dealer.gstin,
        address: dealer.address,
        credit_limit: dealer.credit_limit,
        pricing_tier: dealer.pricing_tier
      });
      dealerIdMap.set(dealer.id, dealerRef.id);
    }

    // 4. Migrate Ledger
    for (const entry of data.ledger) {
      const firestoreDealerId = dealerIdMap.get(entry.dealer_id);
      if (firestoreDealerId) {
        const entryRef = doc(collection(db, "ledger"));
        transaction.set(entryRef, {
          dealer_id: firestoreDealerId,
          type: entry.type,
          amount: entry.amount,
          reference: entry.reference,
          balance: entry.balance,
          date: serverTimestamp()
        });
      }
    }
  });
};

// --- Payment Services ---
export const getPayments = async () => {
  const snapshot = await getDocs(query(paymentsRef, orderBy("date", "desc")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const recordPayment = async (paymentData: any) => {
  return await runTransaction(db, async (transaction) => {
    // 1. Create Payment
    const payRef = doc(collection(db, "payments"));
    transaction.set(payRef, {
      ...paymentData,
      date: Timestamp.fromDate(new Date(paymentData.date))
    });

    // 2. Update Dealer Ledger
    const lastLedgerQ = query(
      ledgerRef, 
      where("dealer_id", "==", paymentData.dealer_id),
      orderBy("date", "desc"),
      limit(1)
    );
    const lastLedgerSnap = await getDocs(lastLedgerQ);
    const lastBalance = lastLedgerSnap.docs[0]?.data().balance || 0;
    
    const ledgerEntryRef = doc(collection(db, "ledger"));
    transaction.set(ledgerEntryRef, {
      dealer_id: paymentData.dealer_id,
      type: 'PAYMENT',
      amount: paymentData.amount,
      reference: paymentData.method,
      balance: lastBalance - paymentData.amount,
      date: serverTimestamp()
    });

    // 3. Mark Invoice as Paid (if linked)
    if (paymentData.invoice_id) {
      const invRef = doc(db, "invoices", paymentData.invoice_id);
      transaction.update(invRef, { status: 'Paid' });
    }

    return payRef.id;
  });
};

export const getLedger = async (dealerId: string) => {
  const q = query(
    ledgerRef, 
    where("dealer_id", "==", dealerId), 
    orderBy("date", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Statistics & Dashboard ---
export const getDashboardStats = async () => {
  try {
    const invoices = await getInvoices();
    const dealers = await getDealers();
    
    const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
    
    let outstanding = 0;
    let outstandingError = false;
    
    for (const dealer of dealers) {
      try {
        const q = query(ledgerRef, where("dealer_id", "==", dealer.id), orderBy("date", "desc"), limit(1));
        const snap = await getDocs(q);
        outstanding += snap.docs[0]?.data().balance || 0;
      } catch (err) {
        console.error(`Error fetching ledger for dealer ${dealer.id}:`, err);
        outstandingError = true;
      }
    }

    let lowStock = 0;
    try {
      const lowStockQ = query(productsRef, where("stock_qty", "<=", 10));
      const lowStockSnap = await getDocs(lowStockQ);
      lowStock = lowStockSnap.size;
    } catch (err) {
      console.error("Error fetching low stock:", err);
    }

    return {
      totalSales,
      outstanding: outstandingError ? null : outstanding,
      lowStock,
      activeDealers: dealers.length,
      recentInvoices: invoices.slice(0, 5),
      hasIndexingError: outstandingError
    };
  } catch (error: any) {
    console.error("Failed to fetch dashboard stats:", error);
    throw error;
  }
};

export const getReports = async () => {
  const invoices = await getInvoices();
  const payments = await getPayments();
  const dealers = await getDealers();

  // 1. Sales by Month
  const salesByMonthMap: Record<string, number> = {};
  invoices.forEach(inv => {
    const date = inv.date.toDate ? inv.date.toDate() : new Date(inv.date);
    const month = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    salesByMonthMap[month] = (salesByMonthMap[month] || 0) + inv.total;
  });
  const salesByMonth = Object.entries(salesByMonthMap).map(([month, sales]) => ({ month, sales }));

  // 2. Payment Methods
  const paymentMethodsMap: Record<string, number> = {};
  payments.forEach((pay: any) => {
    paymentMethodsMap[pay.method] = (paymentMethodsMap[pay.method] || 0) + pay.amount;
  });
  const paymentMethods = Object.entries(paymentMethodsMap).map(([method, total]) => ({ method, total }));

  // 3. Top Dealers
  const dealerSalesMap: Record<string, number> = {};
  invoices.forEach(inv => {
    dealerSalesMap[inv.dealer_name] = (dealerSalesMap[inv.dealer_name] || 0) + inv.total;
  });
  const topDealers = Object.entries(dealerSalesMap)
    .map(([name, total_sales]) => ({ name, total_sales }))
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 5);

  return { salesByMonth, paymentMethods, topDealers };
};
