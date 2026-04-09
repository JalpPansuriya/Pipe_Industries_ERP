import React, { useState, useEffect } from 'react';
import { Save, Building2, MapPin, Hash, Globe, FileText, CheckCircle2 } from 'lucide-react';
import { getCompanySettings, updateCompanySettings } from '../services/firestoreService';
import { cn } from '../lib/utils';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    companyName: '',
    address: '',
    gstin: '',
    state: 'Gujarat',
    stateCode: '24',
    pan: '',
    terms: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getCompanySettings();
        setSettings(data as any);
      } catch (e: any) {
        console.error(e);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateCompanySettings(settings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141414]">Settings</h2>
          <p className="text-gray-500 mt-1">Configure your business details and invoice preferences.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-gray-100">
          {/* Company Identity */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 text-[#141414]">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Building2 size={20} />
              </div>
              <h3 className="text-lg font-bold">Business Identity</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Business Name</label>
                <input
                  name="companyName"
                  value={settings.companyName}
                  onChange={handleChange}
                  placeholder="e.g. SAMRAT PIPE INDUSTRIES"
                  className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all"
                  required
                />
                <p className="text-[10px] text-gray-400 italic">This name will appear as the main header on all invoices.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Business Address</label>
                <textarea
                  name="address"
                  value={settings.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Street, City, Pincode"
                  className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all resize-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Tax & Compliance */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 text-[#141414]">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Hash size={20} />
              </div>
              <h3 className="text-lg font-bold">Tax & Registration</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">GSTIN Number</label>
                <input
                  name="gstin"
                  value={settings.gstin}
                  onChange={handleChange}
                  placeholder="24XXXXXXXXXXXXX"
                  className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">PAN Number</label>
                <input
                  name="pan"
                  value={settings.pan}
                  onChange={handleChange}
                  placeholder="ABCDE1234F"
                  className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">State</label>
                <input
                  name="state"
                  value={settings.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">State Code</label>
                <input
                  name="stateCode"
                  value={settings.stateCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all"
                />
              </div>
            </div>
          </div>

          {/* Legal */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 text-[#141414]">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileText size={20} />
              </div>
              <h3 className="text-lg font-bold">Invoicing Terms</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Terms & Conditions</label>
              <textarea
                name="terms"
                value={settings.terms}
                onChange={handleChange}
                rows={4}
                placeholder="e.g. Subject to JUNAGADH jurisdiction."
                className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all resize-none"
              />
            </div>
          </div>

          <div className="p-8 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showSuccess && (
                <div className="flex items-center gap-2 text-green-600 animate-in fade-in slide-in-from-left-2 transition-all">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-bold uppercase tracking-widest">Settings Saved</span>
                </div>
              )}
              {error && (
                <div className="text-red-600 text-sm font-medium">{error}</div>
              )}
            </div>
            
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#141414] text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
            >
              <Save size={18} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
