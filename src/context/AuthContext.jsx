import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Busca o perfil real do usuário (nome + role)
  const fetchProfile = async (supabaseUser) => {
    if (!supabaseUser) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('name, role')
      .eq('id', supabaseUser.id)
      .single();
    if (error) {
      console.warn('Perfil não encontrado, usando role padrão:', error.message);
      return { id: supabaseUser.id, email: supabaseUser.email, name: supabaseUser.email, role: 'user' };
    }
    return { id: supabaseUser.id, email: supabaseUser.email, name: data.name || supabaseUser.email, role: data.role || 'user' };
  };

  // Ao iniciar, verifica sessão ativa
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user);
        setUser(profile);
      }
      setLoading(false);
    };
    init();

    // Escuta mudanças de sessão (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const profile = await fetchProfile(data.user);
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
