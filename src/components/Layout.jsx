import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, Zap, Map, Radio, AlertTriangle,
  Truck, Users, Factory, Handshake, RefreshCw, BarChart2,
  LogOut, ChevronLeft, ChevronRight, Shield
} from 'lucide-react';

const navItems = [
  { section: 'OPERACAO', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pedidos', icon: Package, label: 'Pedidos' },
    { to: '/roteirizacao', icon: Zap, label: 'Roteirizacao' },
    { to: '/rotas', icon: Map, label: 'Rotas' },
    { to: '/monitoramento', icon: Radio, label: 'Monitoramento' },
    { to: '/ocorrencias', icon: AlertTriangle, label: 'Ocorrencias' },
  ]},
  { section: 'CADASTROS', items: [
    { to: '/veiculos', icon: Truck, label: 'Veiculos' },
    { to: '/equipe', icon: Users, label: 'Equipe de Entrega' },
    { to: '/producao', icon: Factory, label: 'Producao' },
    { to: '/parceiros', icon: Handshake, label: 'Parceiros' },
  ]},
  { section: 'INTEGRACAO', items: [
    { to: '/integracao', icon: RefreshCw, label: 'Sankhya ERP' },
  ]},
  { section: 'RELATORIOS', items: [
    { to: '/relatorios', icon: BarChart2, label: 'Relatorios' },
  ]},
  { section: 'SISTEMA', items: [
    { to: '/admin', icon: Shield, label: 'Administracao' },
  ]},
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const now = new Date();

  const handleLogout = () => { logout(); navigate('/login'); };

  const userName = user
    ? (typeof user.name === 'string' ? user.name : typeof user.email === 'string' ? user.email : 'Admin')
    : 'Admin';

  const userRole = user && typeof user.role === 'string' ? user.role : 'admin';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: collapsed ? 60 : 240,
        background: '#0a1f3d',
        borderRight: '1px solid #1e3a5c',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width .2s',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #1e3a5c', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#e8521a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            🚛
          </div>
          {!collapsed && <span style={{ fontWeight: 700, fontSize: 16, color: '#e8f0fe' }}>Gelocrim</span>}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {navItems.map(section => (
            <div key={section.section}>
              {!collapsed && (
                <div style={{ padding: '12px 16px 4px', fontSize: 10, color: '#90afd4', letterSpacing: '1px', fontWeight: 700 }}>
                  {section.section}
                </div>
              )}
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 16px',
                    color: isActive ? '#e8521a' : '#90afd4',
                    background: isActive ? 'rgba(232,82,26,.1)' : 'transparent',
                    borderLeft: isActive ? '3px solid #e8521a' : '3px solid transparent',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all .15s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  })}
                >
                  <item.icon size={16} style={{ flexShrink: 0 }} />
                  {!collapsed && item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', borderTop: '1px solid #1e3a5c' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          height: 56,
          background: '#0f2040',
          borderBottom: '1px solid #1e3a5c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: '#90afd4' }}>
            {now.toLocaleDateString('pt-BR')} - {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{userName}</div>
              <div style={{ fontSize: 11, color: '#90afd4' }}>{userRole}</div>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
