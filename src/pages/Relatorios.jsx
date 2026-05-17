import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, BarChart2, TrendingUp, Truck, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Relatorios() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/reports/dashboard');
      setData(d && typeof d === 'object' ? d : {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ color: '#90afd4', textAlign: 'center', paddingTop: 60 }}>Carregando...</div>;

  const orders = data?.orders || {};
  const fleet = data?.fleet || {};

  const chartData = [
    { name: 'Pendentes', value: orders.pending || 0, color: '#f59e0b' },
    { name: 'Roteirizados', value: orders.routed || 0, color: '#64B4FF' },
    { name: 'Entregues', value: orders.delivered || 0, color: '#10b981' },
    { name: 'Falhas', value: orders.failed || 0, color: '#ef4444' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Relatorios</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Analise de desempenho operacional</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-control" style={{ width: 140 }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="7">Ultimos 7 dias</option>
            <option value="15">Ultimos 15 dias</option>
            <option value="30">Ultimos 30 dias</option>
          </select>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Pedidos Hoje', value: (orders.pending || 0) + (orders.delivered || 0), icon: Package, color: '#64B4FF' },
          { label: 'Entregues', value: orders.delivered || 0, icon: TrendingUp, color: '#10b981' },
          { label: 'Veiculos Ativos', value: fleet.vehicles_active || 0, icon: Truck, color: '#f97316' },
          { label: 'Taxa Entrega', value: orders.delivered ? `${Math.round(orders.delivered / ((orders.delivered + (orders.failed || 0)) || 1) * 100)}%` : '—', icon: BarChart2, color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, background: k.color + '20', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <k.icon size={20} color={k.color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Graficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64B4FF', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>Status dos Pedidos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5c" />
              <XAxis dataKey="name" tick={{ fill: '#90afd4', fontSize: 11 }} />
              <YAxis tick={{ fill: '#90afd4', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe' }} />
              <Bar dataKey="value" fill="#e8521a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>Resumo da Frota</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            {[
              { label: 'Veiculos Ativos', value: fleet.vehicles_active || 0, max: 20, color: '#e8521a' },
              { label: 'Motoristas em Campo', value: fleet.drivers_active || 0, max: 20, color: '#64B4FF' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#90afd4' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
                <div style={{ height: 8, background: '#1e3a5c', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (item.value / item.max) * 100)}%`, background: item.color, borderRadius: 4, transition: 'width .5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
