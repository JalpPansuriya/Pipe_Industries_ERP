import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, FileText, History, UserPlus, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';

import { 
  getDealers, 
  getLedger, 
  addDealer 
} from '../services/firestoreService';

export const Dealers: React.FC = () => {
  const { token, user } = useAuth();
  const [dealers, setDealers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const statementRef = useRef<HTMLDivElement>(null);

  const fetchDealers = async () => {
    try {
      const data = await getDealers();
      setDealers(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while fetching dealers');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (dealerId: string) => {
    try {
      const data = await getLedger(dealerId);
      setLedger(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while fetching ledger');
    }
  };

  useEffect(() => {
    fetchDealers();
  }, [token]);

  const filteredDealers = dealers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      await addDealer({
        name: data.name as string,
        gstin: data.gstin as string,
        pricing_tier: data.pricing_tier as string,
        address: data.address as string,
        credit_limit: parseFloat(data.credit_limit as string) || 0
      });
      setIsModalOpen(false);
      fetchDealers();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while registering dealer');
    }
  };

  const handleExportStatement = () => {
    if (!selectedDealer || !ledger.length) return;

    let csvContent = `Statement for ${selectedDealer.name}\n`;
    csvContent += `GSTIN: ${selectedDealer.gstin || 'N/A'}\n`;
    csvContent += `Address: ${selectedDealer.address || 'N/A'}\n\n`;
    
    csvContent += "Date,Type,Reference,Amount,Balance\n";
    ledger.forEach((entry: any) => {
      const date = formatDate(entry.date);
      const type = entry.type;
      const ref = entry.reference || '';
      const amount = entry.amount;
      const balance = entry.balance;
      csvContent += `"${date}","${type}","${ref}",${amount},${balance}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `statement_${selectedDealer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportPDF = async () => {
    if (!selectedDealer || !ledger.length || !statementRef.current) return;
    
    setIsExporting(true);
    window.scrollTo(0, 0);
    try {
      const canvas = await html2canvas(statementRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Statement_${selectedDealer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setErrorMsg('Failed to generate PDF statement');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141414]">Dealers</h2>
          <p className="text-gray-500 mt-1">Manage dealer relationships and credit limits.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 rounded-lg font-medium hover:bg-black transition-colors"
        >
          <UserPlus size={18} />
          <span>Register Dealer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dealer List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search dealers..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Dealer Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">GSTIN</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Tier</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Credit Limit</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDealers.map((dealer) => (
                  <tr 
                    key={dealer.id} 
                    className={cn(
                      "hover:bg-gray-50 transition-colors cursor-pointer group",
                      selectedDealer?.id === dealer.id && "bg-gray-50"
                    )}
                    onClick={() => { setSelectedDealer(dealer); fetchLedger(dealer.id); }}
                  >
                    <td className="px-6 py-4 text-sm font-bold text-[#141414]">{dealer.name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{dealer.gstin || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">
                        {dealer.pricing_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-[#141414]">{formatCurrency(dealer.credit_limit)}</td>
                    <td className="px-6 py-4 text-right">
                      <History size={18} className="text-gray-400 group-hover:text-[#141414] transition-colors inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ledger View */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-12rem)]">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-lg italic serif">Dealer Ledger</h3>
            {selectedDealer ? (
              <div className="mt-2">
                <p className="text-sm font-bold text-[#141414]">{selectedDealer.name}</p>
                <p className="text-xs text-gray-400">{selectedDealer.address}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Select a dealer to view ledger.</p>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ledger.map((entry) => (
              <div key={entry.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                    entry.type === 'INVOICE' ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                  )}>
                    {entry.type}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    {formatDate(entry.date)}
                  </span>
                </div>
                <div className="flex justify-between items-end gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#141414] truncate">{entry.reference}</p>
                    <p className="text-[10px] text-gray-400">Balance: {formatCurrency(entry.balance)}</p>
                  </div>
                  <p className={cn(
                    "text-sm font-bold shrink-0",
                    entry.type === 'INVOICE' ? "text-red-600" : "text-green-600"
                  )}>
                    {entry.type === 'INVOICE' ? '+' : '-'}{formatCurrency(entry.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {selectedDealer && (
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl space-y-2">
              <button 
                onClick={handleExportStatement}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-widest text-[#141414] hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-all"
              >
                <FileText size={14} />
                Export CSV
              </button>
              <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-widest bg-[#141414] text-white hover:bg-black rounded-lg transition-all disabled:opacity-50"
              >
                <Download size={14} className={isExporting ? "animate-bounce" : ""} />
                {isExporting ? 'Generating...' : 'Export PDF'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Statement for PDF Generation - using off-screen instead of hidden for html2canvas */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        <div ref={statementRef} className="p-10 bg-white text-black font-sans w-[210mm]">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold uppercase tracking-widest">Dealer Statement</h1>
            <p className="text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mb-8 border-y border-gray-200 py-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dealer Details</p>
              <p className="text-lg font-bold">{selectedDealer?.name}</p>
              <p className="text-sm text-gray-600">{selectedDealer?.address}</p>
              <p className="text-sm font-mono mt-2">GSTIN: {selectedDealer?.gstin || 'N/A'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Summary</p>
              <p className="text-sm">Total Transactions: {ledger.length}</p>
              <p className="text-xl font-bold mt-2">Current Balance: {formatCurrency(ledger[0]?.balance || 0)}</p>
            </div>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-3 text-xs font-bold uppercase tracking-widest">Date</th>
                <th className="py-3 text-xs font-bold uppercase tracking-widest">Type</th>
                <th className="py-3 text-xs font-bold uppercase tracking-widest">Reference</th>
                <th className="py-3 text-xs font-bold uppercase tracking-widest text-right">Amount</th>
                <th className="py-3 text-xs font-bold uppercase tracking-widest text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-3 text-sm">{formatDate(entry.date)}</td>
                  <td className="py-3 text-sm font-bold">{entry.type}</td>
                  <td className="py-3 text-sm">{entry.reference}</td>
                  <td className={cn(
                    "py-3 text-sm font-bold text-right",
                    entry.type === 'INVOICE' ? "text-red-600" : "text-green-600"
                  )}>
                    {entry.type === 'INVOICE' ? '+' : '-'}{formatCurrency(entry.amount)}
                  </td>
                  <td className="py-3 text-sm font-bold text-right">{formatCurrency(entry.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-20 flex justify-between">
            <div className="border-t border-black pt-2 w-48 text-center">
              <p className="text-xs font-bold uppercase tracking-widest">Authorized Signatory</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 italic">This is a computer generated statement.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Register Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-2xl font-bold italic serif mb-6">Register New Dealer</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Dealer Name</label>
                <input name="name" required className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">GSTIN</label>
                  <input name="gstin" className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pricing Tier</label>
                  <select name="pricing_tier" className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm">
                    <option>Standard</option>
                    <option>Premium</option>
                    <option>Wholesale</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Address</label>
                <textarea name="address" rows={2} className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Credit Limit (₹)</label>
                <input name="credit_limit" type="number" defaultValue={0} className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-[#141414] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-[#141414] text-white py-2 rounded-lg font-bold uppercase tracking-widest hover:bg-black transition-colors"
                >
                  Register
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
