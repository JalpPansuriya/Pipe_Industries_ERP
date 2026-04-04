import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  FileText,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';

import { getDashboardStats, performMigration } from '../services/firestoreService';
import { Database as DatabaseIcon, Upload } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleMigration = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMigrationStatus('loading');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await performMigration(data);
      setMigrationStatus('success');
      window.location.reload();
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationStatus('error');
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || 'An error occurred while fetching dashboard statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex flex-col items-center max-w-md text-center">
          <AlertTriangle size={48} className="mb-4" />
          <h3 className="text-lg font-bold mb-2">Failed to Load Dashboard</h3>
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

  const cards = [
    { title: 'Total Sales', value: formatCurrency(stats?.totalSales || 0), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Outstanding', value: formatCurrency(stats?.outstanding || 0), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Low Stock Items', value: stats?.lowStock || 0, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Active Dealers', value: stats?.activeDealers || 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartData = days.map((day, index) => {
    const dataPoint = stats?.salesData?.find((d: any) => parseInt(d.day_of_week) === index);
    return { name: day, sales: dataPoint ? dataPoint.sales : 0 };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141414]">Dashboard</h2>
          <p className="text-gray-500 mt-1">Overview of your business operations.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{card.title}</p>
                <h3 className="text-2xl font-bold text-[#141414]">{card.value}</h3>
              </div>
              <div className={cn("p-2 rounded-lg", card.bg)}>
                <card.icon className={card.color} size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg italic serif">Sales Performance</h3>
            <select className="text-xs border-none bg-gray-50 rounded px-2 py-1 focus:ring-0">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#F9FAFB' }}
                />
                <Bar dataKey="sales" fill="#141414" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-lg italic serif mb-6">Recent Invoices</h3>
          <div className="space-y-4">
            {stats?.recentInvoices?.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#141414] truncate">{inv.dealer_name}</p>
                  <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter truncate">#{inv.invoice_no} • {formatDate(inv.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#141414]">{formatCurrency(inv.total)}</p>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter",
                    inv.status === 'Paid' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-[#141414] transition-colors">
            View All Invoices
          </button>
        </div>
      </div>
      {/* Admin Migration Section */}
      {user?.role === 'Admin' && (
        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-amber-600 text-white rounded-lg">
              <DatabaseIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-[#141414]">Legacy Data Migration</h3>
              <p className="text-xs text-amber-700">Import your existing data from SQLite to Firestore.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs cursor-pointer transition-all",
              migrationStatus === 'loading' ? "bg-amber-200 text-amber-500 pointer-events-none" : "bg-amber-600 text-white hover:bg-amber-700"
            )}>
              <Upload size={14} />
              {migrationStatus === 'loading' ? 'Migrating...' : 'Select sqlite_export.json'}
              <input type="file" accept=".json" onChange={handleMigration} className="hidden" />
            </label>
            
            {migrationStatus === 'success' && <p className="text-xs text-green-600 font-bold">Migration successful!</p>}
            {migrationStatus === 'error' && <p className="text-xs text-red-600 font-bold">Migration failed. Check console.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
