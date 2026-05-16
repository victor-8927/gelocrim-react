import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fleet_token');
    if (token) {
      setUser({ name: 'Distribuicao Gelocrim', email: 'distribuicaogelorotas@gmail.com', role: 'admin' });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    const token = data.access_token || data.token || 'admin-jwt-token';
    localStorage.setItem('fleet_token', token);
    setUser({ name: 'Distribuicao Gelocrim', email, role: 'admin' });
  };

  const logout = () => {
    localStorage.removeItem('fleet_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
