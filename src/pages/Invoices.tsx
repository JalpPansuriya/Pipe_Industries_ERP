import React, { useState, useEffect } from 'react';
import { Plus, Search, FileText, Download, Eye, X, Calculator } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { generateInvoiceSummary } from '../services/geminiService';
import { InvoicePrintModal } from '../components/InvoicePrintModal';
import { 
  getInvoices, 
  getDealers, 
  getProducts, 
  addDealer, 
  createInvoice 
} from '../services/firestoreService';

export const Invoices: React.FC = () => {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);
  const [downloadInvoiceId, setDownloadInvoiceId] = useState<string | null>(null);

  // Form State
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [isNewDealer, setIsNewDealer] = useState(false);
  const [newDealerName, setNewDealerName] = useState('');
  const [newDealerGstin, setNewDealerGstin] = useState('');
  const [newDealerAddress, setNewDealerAddress] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [isGstInclusive, setIsGstInclusive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [invData, dealData, prodData] = await Promise.all([
        getInvoices(),
        getDealers(),
        getProducts()
      ]);
      
      setInvoices(invData);
      setDealers(dealData);
      setProducts(prodData);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const addItem = () => {
    setInvoiceItems([...invoiceItems, { product_id: '', qty: 1, rate: 0, gst_rate: 18 }]);
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...invoiceItems];
    
    if (field === 'qty') {
      const productId = newItems[index].product_id;
      const product = products.find(p => p.id === parseInt(productId));
      if (product && value > product.stock_qty) {
        setErrorMsg(`Cannot add more than available stock (${product.stock_qty} ${product.unit})`);
        return;
      }
    }

    newItems[index][field] = value;
    if (field === 'product_id') {
      const prod = products.find(p => p.id === parseInt(value));
      if (prod) newItems[index].rate = prod.price;
    }
    setInvoiceItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let gst = 0;

    if (isGstInclusive) {
      invoiceItems.forEach(item => {
        const totalRate = item.rate;
        const baseRate = totalRate / (1 + item.gst_rate / 100);
        const itemSubtotal = item.qty * baseRate;
        const itemGst = item.qty * (totalRate - baseRate);
        subtotal += itemSubtotal;
        gst += itemGst;
      });
    } else {
      subtotal = invoiceItems.reduce((acc, item) => acc + (item.qty * item.rate), 0);
      gst = invoiceItems.reduce((acc, item) => acc + (item.qty * item.rate * item.gst_rate / 100), 0);
    }
    
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalDealerId = selectedDealer;
    
    if (isNewDealer) {
      try {
        const newDealer = await addDealer({
          name: newDealerName,
          gstin: newDealerGstin,
          address: newDealerAddress,
          credit_limit: 0,
          pricing_tier: 'Standard'
        });
        
        finalDealerId = newDealer.id;
      } catch (err: any) {
        console.error('Error creating dealer:', err);
        setErrorMsg(err.message || 'An error occurred while creating the dealer');
        return;
      }
    }

    const { total, gst } = calculateTotals();
    const dealerObject = dealers.find(d => d.id === finalDealerId);
    const dealerName = dealerObject?.name || newDealerName;
    const dealerAddress = dealerObject?.address || newDealerAddress;
    const dealerGstin = dealerObject?.gstin || newDealerGstin;
    
    const payload = {
      dealer_id: finalDealerId,
      dealer_name: dealerName,
      dealer_address: dealerAddress,
      dealer_gstin: dealerGstin,
      invoice_no: invoiceNo,
      date: new Date().toISOString().split('T')[0],
      total,
      gst,
      status: 'Issued',
      items: invoiceItems.map(item => ({
        ...item,
        product_name: products.find(p => p.id === item.product_id)?.name || 'Unknown Product'
      }))
    };

    try {
      const newInvoiceId = await createInvoice(payload);
      setIsModalOpen(false);
      setInvoiceItems([]);
      setSelectedDealer('');
      setIsNewDealer(false);
      setNewDealerName('');
      setNewDealerGstin('');
      setNewDealerAddress('');
      setInvoiceNo(`INV-${Date.now().toString().slice(-6)}`);
      fetchData();
      
      // Generate AI Summary
      const summary = await generateInvoiceSummary(payload);
      setAiSummary(summary);
      
      setPrintInvoiceId(newInvoiceId);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while creating the invoice');
    }
  };

  if (loading) return <div>Loading...</div>;

  const { subtotal, gst, total } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141414]">Invoices</h2>
          <p className="text-gray-500 mt-1">Generate and manage GST-compliant tax invoices.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 rounded-lg font-medium hover:bg-black transition-colors"
        >
          <Plus size={18} />
          <span>New Invoice</span>
        </button>
      </div>

      {aiSummary && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
            <FileText size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">AI Summary</p>
            <p className="text-sm text-blue-700 break-words">{aiSummary}</p>
          </div>
          <button onClick={() => setAiSummary(null)} className="ml-auto text-blue-400 hover:text-blue-600 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Invoice #</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Dealer</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Date</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4 text-sm font-mono font-bold text-[#141414]">{inv.invoice_no}</td>
                <td className="px-6 py-4 text-sm font-bold text-[#141414]">{inv.dealer_name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatDate(inv.date)}</td>
                <td className="px-6 py-4 text-sm font-bold text-[#141414]">{formatCurrency(inv.total)}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                    inv.status === 'Paid' ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                  )}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button 
                    onClick={() => setPrintInvoiceId(inv.id)}
                    className="p-2 text-gray-400 hover:text-[#141414] hover:bg-gray-100 rounded-lg transition-all"
                    title="View Invoice"
                  >
                    <Eye size={18} />
                  </button>
                  <button 
                    onClick={() => setDownloadInvoiceId(inv.id)}
                    className="p-2 text-gray-400 hover:text-[#141414] hover:bg-gray-100 rounded-lg transition-all"
                    title="Download Invoice"
                  >
                    <Download size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold italic serif">Create Tax Invoice</h3>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Invoice No</p>
                <p className="text-lg font-mono font-bold">{invoiceNo}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {isNewDealer ? 'New Dealer Details' : 'Select Dealer'}
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setIsNewDealer(!isNewDealer)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest"
                    >
                      {isNewDealer ? 'Select Existing' : '+ Add New'}
                    </button>
                  </div>
                  {isNewDealer ? (
                    <div className="space-y-2">
                      <input 
                        required 
                        placeholder="Dealer Name"
                        value={newDealerName}
                        onChange={(e) => setNewDealerName(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-sm outline-none transition-all"
                      />
                      <input 
                        placeholder="GSTIN (Optional)"
                        value={newDealerGstin}
                        onChange={(e) => setNewDealerGstin(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-sm outline-none transition-all"
                      />
                      <textarea 
                        placeholder="Address"
                        value={newDealerAddress}
                        onChange={(e) => setNewDealerAddress(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-sm outline-none transition-all resize-none"
                      />
                    </div>
                  ) : (
                    <select 
                      required 
                      value={selectedDealer}
                      onChange={(e) => setSelectedDealer(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-sm outline-none transition-all"
                    >
                      <option value="">Choose a dealer...</option>
                      {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Invoice Date</label>
                  <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-sm outline-none transition-all" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Line Items</h4>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer hover:text-[#141414] transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isGstInclusive}
                        onChange={(e) => setIsGstInclusive(e.target.checked)}
                        className="rounded border-gray-300 text-[#141414] focus:ring-[#141414]"
                      />
                      Inclusive of GST
                    </label>
                  </div>
                  <button 
                    type="button" 
                    onClick={addItem}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {invoiceItems.map((item, index) => (
                    <div key={index} className="flex flex-wrap md:grid md:grid-cols-12 gap-3 items-end bg-gray-50 p-3 rounded-lg">
                      <div className="w-full md:col-span-4 space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Product</label>
                        <select 
                          required
                          value={item.product_id}
                          onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-xs outline-none transition-all"
                        >
                          <option value="">Select Product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock_qty} left)</option>)}
                        </select>
                      </div>
                      <div className="w-[22%] md:col-span-2 space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Qty</label>
                        <input 
                          type="number" 
                          value={item.qty}
                          onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-xs outline-none transition-all"
                        />
                      </div>
                      <div className="w-[28%] md:col-span-2 space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Rate</label>
                        <input 
                          type="number" 
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-xs outline-none transition-all"
                        />
                      </div>
                      <div className="w-[32%] md:col-span-2 space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400">GST %</label>
                        <select 
                          value={item.gst_rate}
                          onChange={(e) => updateItem(index, 'gst_rate', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#141414] focus:border-[#141414] text-xs outline-none transition-all"
                        >
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>
                      <div className="flex-1 md:col-span-1 text-right pb-2 min-w-[60px]">
                        <p className="text-[10px] font-bold">
                          {formatCurrency(isGstInclusive ? (item.qty * (item.rate / (1 + item.gst_rate / 100))) : (item.qty * item.rate))}
                        </p>
                      </div>
                      <div className="w-auto md:col-span-1 text-right pb-1">
                        <button type="button" onClick={() => removeItem(index)} className="text-gray-300 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2 border-t border-gray-100 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="font-bold">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">GST Total</span>
                    <span className="font-bold">{formatCurrency(gst)}</span>
                  </div>
                  <div className="flex justify-between text-lg border-t border-gray-200 pt-2">
                    <span className="font-bold italic serif">Grand Total</span>
                    <span className="font-bold text-[#141414]">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-8">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-[#141414] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={invoiceItems.length === 0 || (!isNewDealer && !selectedDealer) || (isNewDealer && !newDealerName)}
                  className="flex-1 bg-[#141414] text-white py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Calculator size={18} />
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {printInvoiceId && (
        <InvoicePrintModal 
          invoiceId={printInvoiceId} 
          onClose={() => setPrintInvoiceId(null)} 
        />
      )}
      {downloadInvoiceId && (
        <InvoicePrintModal 
          invoiceId={downloadInvoiceId} 
          onClose={() => setDownloadInvoiceId(null)} 
          autoDownload={true}
        />
      )}
      {/* Error Modal */}
      {errorMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">Error</h3>
            <p className="text-gray-600 mb-6">{errorMsg}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorMsg(null)}
                className="bg-[#141414] text-white px-4 py-2 rounded-lg font-medium hover:bg-black transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
