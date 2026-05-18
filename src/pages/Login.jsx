import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Flocos de gelo animados
function Snowflakes() {
  const flakes = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${6 + Math.random() * 6}s`,
    size: `${10 + Math.random() * 16}px`,
    opacity: 0.2 + Math.random() * 0.4,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      <style>{`
        @keyframes snowfall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.5; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(232,82,26,0.3); }
          50% { box-shadow: 0 0 40px rgba(232,82,26,0.6); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
      {flakes.map(f => (
        <div key={f.id} style={{
          position: 'absolute',
          left: f.left,
          top: '-20px',
          fontSize: f.size,
          opacity: f.opacity,
          animation: `snowfall ${f.duration} ${f.delay} infinite linear`,
        }}>❄</div>
      ))}
    </div>
  );
}

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass, setFocusPass]   = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Foto aérea de Manaus - Rio Negro
  const BG_IMAGE = 'https://images.unsplash.com/photo-1583500178450-e59e4309b57f?w=1920&q=80&auto=format&fit=crop';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const msg = err?.detail
        ? (Array.isArray(err.detail) ? err.detail[0]?.msg || 'Erro' : String(err.detail))
        : String(err?.message || 'Email ou senha incorretos');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Fundo — foto Manaus */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${BG_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Gradiente sobre a foto */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(6,16,32,0.92) 0%, rgba(10,31,61,0.85) 50%, rgba(6,16,32,0.95) 100%)',
        zIndex: 0,
      }} />



      {/* Flocos */}
      <Snowflakes />

      {/* Conteúdo */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', maxWidth: 440,
        padding: '0 20px',
        animation: 'fadeInUp 0.8s ease forwards',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 16,
            marginBottom: 12,
          }}>
            <div style={{
              width: 64, height: 64,
              background: 'linear-gradient(135deg, #e8521a, #ff6b35)',
              borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
              animation: 'pulse-glow 3s ease infinite',
            }}>🚛</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: 36, fontWeight: 900, color: '#fff',
                letterSpacing: 4,
                background: 'linear-gradient(90deg, #fff, #64B4FF, #fff)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'shimmer 4s linear infinite',
              }}>GELOCRIM</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 3, marginTop: 2 }}>
                PURA REFRESCÂNCIA
              </div>
            </div>
          </div>

          {/* Linha divisória com gelo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(100,180,255,0.4))' }} />
            <span style={{ color: 'rgba(100,180,255,0.6)', fontSize: 14 }}>❄ ❄ ❄</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(100,180,255,0.4))' }} />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: 2 }}>
            SISTEMA DE ROTEIRIZAÇÃO — MANAUS/AM
          </div>
        </div>

        {/* Card de login */}
        <div style={{
          background: 'rgba(10, 25, 50, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(100,180,255,0.2)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#fff' }}>
            Bem-vindo de volta
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
            Acesse o painel de operações da Gelocrim
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64B4FF', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: focusEmail ? 'rgba(100,180,255,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${focusEmail ? '#64B4FF' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12, padding: '14px 16px',
                  color: '#fff', fontSize: 15, fontWeight: 500,
                  outline: 'none', transition: 'all 0.2s',
                }}
              />
            </div>

            {/* Senha */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64B4FF', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                onFocus={() => setFocusPass(true)}
                onBlur={() => setFocusPass(false)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: focusPass ? 'rgba(100,180,255,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${focusPass ? '#64B4FF' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12, padding: '14px 16px',
                  color: '#fff', fontSize: 15, fontWeight: 500,
                  outline: 'none', transition: 'all 0.2s',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 10, padding: '10px 14px', color: '#ef4444',
                fontSize: 13, marginBottom: 16,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '15px',
                background: loading ? 'rgba(232,82,26,0.5)' : 'linear-gradient(135deg, #e8521a, #ff6b35)',
                border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 14, fontWeight: 800,
                letterSpacing: 1.5, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(232,82,26,0.4)',
              }}
            >
              {loading ? '⏳ Entrando...' : '🚀 ENTRAR NO SISTEMA'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
            GELOCRIM INDÚSTRIA DE GELO LTDA • MANAUS/AM
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', marginTop: 4 }}>
            Powered by Supabase & Google Maps
          </p>
        </div>
      </div>
    </div>
  );
}
