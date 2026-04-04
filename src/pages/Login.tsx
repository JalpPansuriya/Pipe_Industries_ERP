import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@samrat.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await login(email, password);
      navigate('/');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white tracking-tighter italic serif mb-2">SAMRAT PIPE</h1>
          <p className="text-gray-500 uppercase tracking-widest text-xs">Enterprise Resource Planning</p>
        </div>

        <div className="bg-white rounded-3xl p-10 shadow-2xl">
          <h2 className="text-2xl font-bold text-[#141414] mb-8">Sign In</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#141414] text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? 'Authenticating...' : 'Enter System'}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100">
            <p className="text-[10px] text-center text-gray-400 uppercase tracking-widest leading-relaxed">
              Authorized personnel only. All access is logged and monitored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
