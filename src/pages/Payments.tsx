import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../lib/utils';
import { 
  getPayments, 
  getDealers, 
  getInvoices, 
  addDealer, 
  recordPayment 
} from '../services/firestoreService';

export const Payments: React.FC = () => {
  const { token } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [isNewDealer, setIsNewDealer] = useState(false);
  const [newDealerName, setNewDealerName] = useState('');
  const [newDealerGstin, setNewDealerGstin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [payData, dealData, invData] = await Promise.all([
        getPayments(),
        getDealers(),
        getInvoices()
      ]);
      
      setPayments(payData as any[]);
      setDealers(dealData);
      setInvoices(invData);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      let finalDealerId = selectedDealer;
      let finalDealerName = dealers.find(d => d.id === selectedDealer)?.name;

      if (isNewDealer) {
        const newDealer = await addDealer({
          name: newDealerName,
          gstin: newDealerGstin,
          address: '',
          credit_limit: 0,
          pricing_tier: 'Standard'
        });
        finalDealerId = newDealer.id!;
        finalDealerName = newDealerName;
      }

      const invoice = invoices.find(i => i.id === data.invoice_id);

      const payload = {
        amount: parseFloat(data.amount as string),
        method: data.method as string,
        date: data.date as string,
        invoice_id: (data.invoice_id as string) || null,
        invoice_no: invoice?.invoice_no || null,
        dealer_id: finalDealerId,
        dealer_name: finalDealerName
      };

      await recordPayment(payload);
      setSelectedDealer('');
      setIsNewDealer(false);
      setNewDealerName('');
      setNewDealerGstin('');
      setIsModalOpen(false);
      fetchData();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while recording payment');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141414]">Payments</h2>
          <p className="text-gray-500 mt-1">Record and track dealer payments and collections.</p>
        </div>
        <button 
          onClick={() => {
            setSelectedDealer('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 rounded-lg font-medium hover:bg-black transition-colors"
        >
          <Plus size={18} />
          <span>Record Payment</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Date</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Dealer</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Invoice #</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Method</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Amount</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4 text-sm text-gray-500">{formatDate(payment.date)}</td>
                <td className="px-6 py-4 text-sm font-bold text-[#141414]">{payment.dealer_name}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{payment.invoice_no || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">
                    {payment.method}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-green-600">{formatCurrency(payment.amount)}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5 text-green-600 text-[10px] font-bold uppercase tracking-widest">
                    <CheckCircle2 size={12} />
                    Cleared
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-2xl font-bold italic serif mb-6">Record Payment</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm"
                    />
                    <input 
                      placeholder="GSTIN (Optional)"
                      value={newDealerGstin}
                      onChange={(e) => setNewDealerGstin(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm"
                    />
                  </div>
                ) : (
                  <select 
                    name="dealer_id" 
                    required 
                    value={selectedDealer}
                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm"
                    onChange={(e) => {
                      setSelectedDealer(e.target.value);
                      const select = e.target.form?.elements.namedItem('invoice_id') as HTMLSelectElement;
                      if (select) select.value = '';
                    }}
                  >
                    <option value="">Choose a dealer...</option>
                    {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Invoice (Optional)</label>
                <select name="invoice_id" disabled={isNewDealer} className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm disabled:opacity-50">
                  <option value="">General Payment</option>
                  {!isNewDealer && invoices
                    .filter(i => i.status !== 'Paid' && (!selectedDealer || i.dealer_id.toString() === selectedDealer))
                    .map(i => (
                    <option key={i.id} value={i.id} data-dealer={i.dealer_id}>{i.invoice_no} ({formatCurrency(i.total)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Amount (₹)</label>
                  <input name="amount" type="number" step="0.01" required className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Method</label>
                  <select name="method" className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm">
                    <option>Cash</option>
                    <option>NEFT</option>
                    <option>RTGS</option>
                    <option>Cheque</option>
                    <option>UPI</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Payment Date</label>
                <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedDealer('');
                    setIsNewDealer(false);
                    setNewDealerName('');
                    setNewDealerGstin('');
                    setIsModalOpen(false);
                  }}
                  className="flex-1 py-2 text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-[#141414] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={(!isNewDealer && !selectedDealer) || (isNewDealer && !newDealerName)}
                  className="flex-1 bg-[#141414] text-white py-2 rounded-lg font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
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
