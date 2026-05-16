import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.detail || 'Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2d4a 50%, #0a1628 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, background: '#e8521a', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              🚛
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Gelocrim</div>
              <div style={{ fontSize: 12, color: '#8a94a6' }}>Sistema de Roteirização — V1</div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Bem-vindo de volta</h2>
          <p style={{ color: '#90afd4', fontSize: 13, marginBottom: 24 }}>Informe seu usuário e senha para acessar</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-control"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
