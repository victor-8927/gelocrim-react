import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fleet_token');
    if (token) {
      api.get('/auth/me')
        .then(data => setUser(typeof data === 'object' ? data : { name: 'Admin' }))
        .catch(() => localStorage.removeItem('fleet_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const data = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const token = data.access_token || data.token;
    if (!token) throw new Error('Token nao recebido');
    localStorage.setItem('fleet_token', token);
    try {
      const me = await api.get('/auth/me');
      setUser(typeof me === 'object' ? me : { name: 'Admin', email });
    } catch {
      setUser({ name: 'Admin', email });
    }
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
