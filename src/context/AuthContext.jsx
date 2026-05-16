import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fleet_token');
    if (token) {
      const payload = parseJwt(token);
      if (payload) {
        setUser({
          name: payload.name || payload.sub || 'Admin',
          email: payload.sub || payload.email || '',
          role: payload.role || 'admin'
        });
      } else {
        localStorage.removeItem('fleet_token');
      }
    }
    setLoading(false);
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
    const payload = parseJwt(token);
    setUser({
      name: payload?.name || payload?.sub || email,
      email: payload?.sub || email,
      role: payload?.role || 'admin'
    });
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
