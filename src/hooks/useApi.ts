import { useAuth } from '../context/AuthContext';

export const useApi = () => {
  const { token, logout } = useAuth();

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    // If no token, we might want to redirect or throw early
    // For login route, we don't need a token
    const isLoginRoute = url === '/api/auth/login';
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token && token !== 'null' && !isLoginRoute) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      // Handle 401/403 by logging out if not the login route
      if ((response.status === 401 || response.status === 403) && !isLoginRoute) {
        console.error(`Auth error (${response.status}) on ${url}. Logging out.`);
        logout();
        throw new Error('Session expired or unauthorized. Please login again.');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || data.error || `Error: ${response.status} ${response.statusText}`);
        }
        return data;
      } else {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
        }
        return text;
      }
    } catch (error: any) {
      console.error(`API Error on ${url}:`, error);
      throw error;
    }
  };

  return { fetchWithAuth };
};
