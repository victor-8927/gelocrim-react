import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TIPOS = [
  { value: 'overview', label: '📊 Visão Geral' },
  { value: 'team', label: '👥 Produtividade da Equipe' },
  { value: 'fuel', label: '⛽ Consumo de Combustível' },
  { value: 'clients', label: '🏪 Performance por Cliente' },
  { value: 'zones', label: '📍 Calor por Zona de Manaus' },
];

export default function Relatorios() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState('overview');
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [periodo, setPeriodo] = useState('7');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/reports/dashboard');
      setData(d && typeof d === 'object' ? d : {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const ini = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    setDataFim(hoje);
    setDataIni(ini);
    load();
  }, []); // eslint-disable-line

  const setPeriodoRapido = (dias) => {
    setPeriodo(dias);
    const hoje = new Date().toISOString().slice(0, 10);
    const ini = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    setDataFim(hoje);
    setDataIni(ini);
  };

  const orders = data?.orders || {};
  const fleet = data?.fleet || {};
  const total = (orders.delivered || 0) + (orders.failed || 0);
  const taxaEntrega = total > 0 ? Math.round((orders.delivered / total) * 100) : 0;

  const chartData = [
    { name: 'Pendentes', value: orders.pending || 0 },
    { name: 'Roteirizados', value: orders.routed || 0 },
    { name: 'Entregues', value: orders.delivered || 0 },
    { name: 'Falhas', value: orders.failed || 0 },
  ];

  const exportCSV = () => {
    const rows = [
      ['Metrica', 'Valor'],
      ['Pedidos Pendentes', orders.pending || 0],
      ['Roteirizados', orders.routed || 0],
      ['Entregues', orders.delivered || 0],
      ['Falhas', orders.failed || 0],
      ['Veiculos Ativos', fleet.vehicles_active || 0],
      ['Motoristas em Campo', fleet.drivers_active || 0],
      ['Taxa de Entrega', `${taxaEntrega}%`],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio_gelocrim_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  if (loading) return <div style={{ color: '#90afd4', textAlign: 'center', paddingTop: 60 }}>Carregando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>📊 Relatórios e Business Intelligence</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Análise estratégica da operação de Manaus</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> 📥 Exportar CSV</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>📄 Exportar PDF</button>
          <button className="btn btn-primary" onClick={load}><RefreshCw size={14} /> ⚡ Gerar Relatório</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Periodo De</label>
          <input className="form-control" type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} style={{ width: 140 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Ate</label>
          <input className="form-control" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ width: 140 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Tipo de Relatorio</label>
          <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: 200 }}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end', paddingBottom: 2 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriodoRapido(d)} style={{ padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: periodo === String(d) ? '#e8521a' : '#1e3a5c', color: periodo === String(d) ? '#fff' : '#90afd4' }}>
              {d}d
            </button>
          ))}
        </div>

      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { emoji: '✅', label: 'Eficiência de Entrega', value: taxaEntrega > 0 ? `${taxaEntrega}%` : '—', sub: 'entregas no prazo', color: '#10b981' },
          { emoji: '💲', label: 'Custo por KG', value: '—', sub: 'R$ por kg transportado', color: '#64B4FF' },
          { emoji: '🚛', label: 'Ocupação da Frota', value: fleet.vehicles_active ? `${fleet.vehicles_active}` : '—', sub: 'aproveitamento médio', color: '#f97316' },
          { emoji: '📍', label: 'Desvio de Rota', value: '—', sub: 'KM real vs planejado', color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="card">
            <div style={{ fontSize: 11, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{k.emoji} {k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Graficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64B4FF', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>Status dos Pedidos</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5c" />
              <XAxis dataKey="name" tick={{ fill: '#90afd4', fontSize: 11 }} />
              <YAxis tick={{ fill: '#90afd4', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#e8521a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>Performance da Frota</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            {[
              { label: 'Veiculos Ativos', value: fleet.vehicles_active || 0, max: 25, color: '#e8521a' },
              { label: 'Motoristas em Campo', value: fleet.drivers_active || 0, max: 25, color: '#64B4FF' },
              { label: 'Taxa de Entrega', value: taxaEntrega, max: 100, color: '#10b981', suffix: '%' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#90afd4' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}{item.suffix || ''}</span>
                </div>
                <div style={{ height: 8, background: '#1e3a5c', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (item.value / item.max) * 100)}%`, background: item.color, borderRadius: 4, transition: 'width .5s' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1e3a5c' }}>
            <div style={{ fontSize: 11, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Resumo Operacional</div>
            {[
              { label: 'Pedidos Pendentes', value: orders.pending || 0, color: '#f59e0b' },
              { label: 'Entregues Hoje', value: orders.delivered || 0, color: '#10b981' },
              { label: 'Falhas', value: orders.failed || 0, color: '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: 13, color: '#90afd4' }}>{item.label}</span>
                <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
