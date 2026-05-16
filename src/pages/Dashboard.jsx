import React, { useEffect, useState } from 'react';
import { getDashboard } from '../services/api';
import { Truck, Package, Users, MapPin, TrendingUp, AlertTriangle } from 'lucide-react';

function KpiCard({ icon: Icon, label, value, sub, color = '#64B4FF' }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, background: `${color}20`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color }}>{value ?? '—'}</div>
        <div style={{ fontSize: 12, color: '#90afd4' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#64B4FF', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#90afd4', textAlign: 'center', paddingTop: 60 }}>Carregando...</div>;

  const orders = data?.orders || {};
  const fleet = data?.fleet || {};

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Painel Operacional</h1>
        <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Visão geral da operação de hoje</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard icon={Package} label="Pedidos Pendentes" value={orders.pending} color="#f59e0b" />
        <KpiCard icon={MapPin} label="Em Rota" value={orders.routed} color="#64B4FF" />
        <KpiCard icon={TrendingUp} label="Entregues Hoje" value={orders.delivered} color="#10b981" />
        <KpiCard icon={AlertTriangle} label="Falhas" value={orders.failed} color="#ef4444" />
        <KpiCard icon={Truck} label="Frotas Ativas" value={fleet.vehicles_active} sub={`${fleet.drivers_active || 0} motoristas em campo`} color="#f97316" />
        <KpiCard icon={Users} label="Clientes Ativos" value={data?.clients?.active} color="#a78bfa" />
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64B4FF', marginBottom: 16, letterSpacing: '1px', textTransform: 'uppercase' }}>
            📦 Resumo de Pedidos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Pendentes', value: orders.pending, color: '#f59e0b' },
              { label: 'Roteirizados', value: orders.routed, color: '#64B4FF' },
              { label: 'Entregues', value: orders.delivered, color: '#10b981' },
              { label: 'Falhas', value: orders.failed, color: '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#90afd4', fontSize: 13 }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700, fontSize: 16 }}>{item.value ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64B4FF', marginBottom: 16, letterSpacing: '1px', textTransform: 'uppercase' }}>
            🚛 Frota
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Veículos Ativos', value: fleet.vehicles_active },
              { label: 'Motoristas em Campo', value: fleet.drivers_active },
              { label: 'Km Hoje', value: fleet.total_km ? `${fleet.total_km} km` : '—' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#90afd4', fontSize: 13 }}>{item.label}</span>
                <span style={{ color: '#e8f0fe', fontWeight: 700, fontSize: 16 }}>{item.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
