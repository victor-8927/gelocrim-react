import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

const fetchProfile = async (supabaseUser) => {
  if (!supabaseUser) return null;

  const defaultProfile = {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.email,
    role: 'user',
  };

  // Tenta até 3 vezes com timeout crescente
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('user_profiles')
          .select('name, role')
          .eq('id', supabaseUser.id)
          .maybeSingle(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), tentativa * 5000)
        ),
      ]);

      if (data) {
        return {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: data.name || supabaseUser.email,
          role: data.role || 'user',
        };
      }

      if (error) console.warn(`fetchProfile tentativa ${tentativa} erro:`, error.message);
    } catch (e) {
      console.warn(`fetchProfile tentativa ${tentativa} falhou:`, e.message);
      if (tentativa < 3) await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Fallback: tenta pelo email diretamente
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('name, role')
      .eq('email', supabaseUser.email)
      .maybeSingle();
    if (data) {
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: data.name || supabaseUser.email,
        role: data.role || 'user',
      };
    }
  } catch (e) {
    console.warn('fetchProfile fallback email falhou:', e.message);
  }

  return defaultProfile;
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
