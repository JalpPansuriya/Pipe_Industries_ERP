import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  CreditCard, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['Admin', 'Sales Manager', 'Accountant'] },
  { name: 'Products', path: '/inventory', icon: Package, roles: ['Admin', 'Sales Manager'] },
  { name: 'Dealers', path: '/dealers', icon: Users, roles: ['Admin', 'Sales Manager', 'Accountant'] },
  { name: 'Invoices', path: '/invoices', icon: FileText, roles: ['Admin', 'Sales Manager', 'Accountant'] },
  { name: 'Payments', path: '/payments', icon: CreditCard, roles: ['Admin', 'Accountant'] },
  { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['Admin'] },
  { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['Admin'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const role = (String(user?.role) === '1' || user?.role === 'Admin' || user?.name === 'Raj Vasoya') ? 'Admin' : user?.role || '';
  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[#141414] text-white transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-[#2A2A2A]">
            <h1 className="text-xl font-bold tracking-tight italic serif">SAMRAT PIPE</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">ERP System v1.0</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group",
                    isActive 
                      ? "bg-white text-[#141414]" 
                      : "text-gray-400 hover:bg-[#2A2A2A] hover:text-white"
                  )}
                >
                  <Icon size={20} />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[#2A2A2A]">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold">
                {user?.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-[10px] uppercase tracking-wider opacity-50">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-[#2A2A2A] hover:text-white rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-8">
          <button 
            className="lg:hidden p-2 -ml-2 text-gray-600"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
