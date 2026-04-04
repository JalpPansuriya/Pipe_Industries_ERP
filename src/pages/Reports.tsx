import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { formatCurrency } from '../lib/utils';
import { Download, FileText } from 'lucide-react';

export const Reports: React.FC = () => {
  const { token } = useAuth();
  const { fetchWithAuth } = useApi();
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await fetchWithAuth('/api/reports');
        setReports(data);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || 'An error occurred while fetching reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [token]);

  const handleExportAll = () => {
    if (!reports) return;

    let csvContent = "";

    // Monthly Sales Trend
    csvContent += "Monthly Sales Trend\n";
    csvContent += "Month,Sales\n";
    reports.salesByMonth?.slice().reverse().forEach((row: any) => {
      csvContent += `${row.month},${row.sales}\n`;
    });
    csvContent += "\n";

    // Payment Methods
    csvContent += "Payment Methods\n";
    csvContent += "Method,Total\n";
    reports.paymentMethods?.forEach((row: any) => {
      csvContent += `${row.method},${row.total}\n`;
    });
    csvContent += "\n";

    // Top Dealers
    csvContent += "Top Dealers\n";
    csvContent += "Dealer Name,Total Revenue\n";
    reports.topDealers?.forEach((row: any) => {
      csvContent += `"${row.name}",${row.total_revenue}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `samrat_pipe_reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex flex-col items-center max-w-md text-center">
          <FileText size={48} className="mb-4" />
          <h3 className="text-lg font-bold mb-2">Failed to Load Reports</h3>
          <p className="text-sm opacity-80 mb-4">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const COLORS = ['#141414', '#4B5563', '#9CA3AF', '#D1D5DB', '#F3F4F6'];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141414]">Reports</h2>
          <p className="text-gray-500 mt-1">Detailed analytics and business insights.</p>
        </div>
        <button 
          onClick={handleExportAll}
          className="flex items-center gap-2 bg-white border border-gray-200 text-[#141414] px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          <Download size={18} />
          <span>Export All</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Sales Trend */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-lg italic serif mb-6">Monthly Sales Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports?.salesByMonth?.slice().reverse() || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#F9FAFB' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="sales" fill="#141414" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-lg italic serif mb-6">Payment Methods</h3>
          <div className="h-[300px] flex items-center justify-center">
            {reports?.paymentMethods?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reports.paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="total"
                    nameKey="method"
                  >
                    {reports.paymentMethods.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400">No payment data available.</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {reports?.paymentMethods?.map((method: any, index: number) => (
              <div key={method.method} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-sm text-gray-600">{method.method}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Dealers Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-lg italic serif">Top Dealers by Revenue</h3>
          <FileText className="text-gray-400" size={20} />
        </div>
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Rank</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Dealer Name</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Total Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports?.topDealers?.map((dealer: any, index: number) => (
              <tr key={dealer.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-gray-400">#{index + 1}</td>
                <td className="px-6 py-4 text-sm font-bold text-[#141414]">{dealer.name}</td>
                <td className="px-6 py-4 text-sm font-bold text-green-600 text-right">{formatCurrency(dealer.total_sales)}</td>
              </tr>
            ))}
            {(!reports?.topDealers || reports.topDealers.length === 0) && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                  No sales data available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
