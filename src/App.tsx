import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Dealers } from './pages/Dealers';
import { Invoices } from './pages/Invoices';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isInitialized } = useAuth();
  
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white italic serif animate-pulse">SAMRAT PIPE</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginWrapper />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/dealers" element={<Dealers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

const LoginWrapper = () => {
  const { isAuthenticated, isInitialized } = useAuth();
  if (isInitialized && isAuthenticated) return <Navigate to="/" />;
  return <Login />;
};


