import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  limit
} from "firebase/firestore";
import { db } from "../lib/firebase";
import bcrypt from 'bcryptjs';

interface AuthContextType {
  token: string | null;
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        } catch (e) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email), limit(1));
      const querySnapshot = await getDocs(q);
      
      let userData: any = null;
      let userId: string = '';

      if (querySnapshot.empty) {
        // First-time setup: check if system is empty
        const allUsersSnap = await getDocs(query(usersRef, limit(1)));
        if (allUsersSnap.empty && email === 'admin@samrat.com' && password === 'admin123') {
          const hashedPassword = await bcrypt.hash('admin123', 8);
          userData = {
            name: "System Admin",
            email: "admin@samrat.com",
            role: "Admin",
            password_hash: hashedPassword
          };
          await setDoc(doc(db, "users", "admin@samrat.com"), userData);
          userId = "admin@samrat.com";
        } else {
          throw new Error('User not found');
        }
      } else {
        const userDoc = querySnapshot.docs[0];
        userData = userDoc.data();
        userId = userDoc.id;
      }

      const isValid = await bcrypt.compare(password, userData.password_hash);
      if (!isValid) throw new Error('Invalid password');

      const loggedInUser = {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      };

      const simulatedToken = 'simulated-token-' + Date.now();
      setToken(simulatedToken);
      setUser(loggedInUser);
      
      localStorage.setItem('token', simulatedToken);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const isAuthenticated = !!token && !!user;
  const isInitialized = !isLoading;

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoading, isAuthenticated, isInitialized }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
