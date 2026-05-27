import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

const fetchProfile = async (supabaseUser) => {
  if (!supabaseUser) return null;

  // 1. Tenta pegar role do metadata do Auth — instantâneo, sem query
  const metaRole = supabaseUser.user_metadata?.role;
  const metaName = supabaseUser.user_metadata?.name;

  if (metaRole) {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: metaName || supabaseUser.email,
      role: metaRole,
    };
  }

  // 2. Fallback: tenta buscar da tabela user_profiles com timeout generoso
  try {
    const { data } = await Promise.race([
      supabase
        .from('user_profiles')
        .select('name, role')
        .eq('id', supabaseUser.id)
        .maybeSingle(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000)
      ),
    ]);

    if (data) {
      // Salvar no metadata para próximas vezes
      await supabase.auth.updateUser({
        data: { role: data.role, name: data.name }
      }).catch(() => {});

      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: data.name || supabaseUser.email,
        role: data.role || 'user',
      };
    }
  } catch (e) {
    console.warn('fetchProfile tabela falhou:', e.message);
  }

  // 3. Último fallback
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.email,
    role: 'user',
  };
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
