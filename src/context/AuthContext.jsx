import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

// Busca perfil com timeout de 5 segundos
const fetchProfile = async (supabaseUser) => {
  if (!supabaseUser) return null;

  const defaultProfile = {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.email,
    role: 'user',
  };

  try {
    const result = await Promise.race([
      supabase
        .from('user_profiles')
        .select('name, role')
        .eq('id', supabaseUser.id)
        .maybeSingle(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      ),
    ]);

    if (result?.data) {
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: result.data.name || supabaseUser.email,
        role: result.data.role || 'user',
      };
    }

    // Se não achou perfil, usa o role do metadata do Supabase Auth
    const metaRole = supabaseUser.user_metadata?.role || 'user';
    return { ...defaultProfile, role: metaRole };

  } catch (e) {
    console.warn('fetchProfile falhou, usando padrão:', e.message);
    return defaultProfile;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user);
          setUser(profile);
        }
      } catch (e) {
        console.error('Erro ao iniciar sessão:', e);
      } finally {
        setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user);
          setUser(profile);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

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
