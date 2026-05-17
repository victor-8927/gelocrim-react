import React, { useEffect, useState } from 'react';
import { getReportPeriod, getReportByRegion, getOrdersSummary, getFleetSummary } from '../services/supabase';
import { RefreshCw, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const TIPOS = [
  { value: 'overview', label: '📊 Visão Geral' },
  { value: 'team', label: '👥 Produtividade da Equipe' },
  { value: 'fuel', label: '⛽ Consumo de Combustível' },
  { value: 'clients', label: '🏪 Performance por Cliente' },
  { value: 'zones', label: '📍 Calor por Zona de Manaus' },
];

const CORES = ['#e8521a', '#64B4FF', '#10b981', '#f59e0b', '#a78bfa', '#f97316'];

export default function Relatorios() {
  const [periodo, setPeriodo] = useState([]);
  const [regioes, setRegioes] = useState([]);
  const [summary, setSummary] = useState({});
  const [frota, setFrota] = useState({});
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState('overview');
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [periodoBtn, setPeriodoBtn] = useState('30');

  const load = async () => {
    setLoading(true);
    try {
      const [p, r, s, f] = await Promise.all([
        getReportPeriod().catch(() => []),
        getReportByRegion().catch(() => []),
        getOrdersSummary().catch(() => ({})),
        getFleetSummary().catch(() => ({})),
      ]);
      setPeriodo(p);
      setRegioes(r);
      setSummary(s || {});
      setFrota(f || {});
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const ini = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    setDataFim(hoje);
    setDataIni(ini);
    load();
  }, []); // eslint-disable-line

  const setPeriodoRapido = (dias) => {
    setPeriodoBtn(String(dias));
    const hoje = new Date().toISOString().slice(0, 10);
    const ini = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    setDataFim(hoje);
    setDataIni(ini);
  };

  // KPIs calculados
  const totalPeriodo = periodo.reduce((s, d) => s + (d.total_pedidos || 0), 0);
  const entreguesPeriodo = periodo.reduce((s, d) => s + (d.entregues || 0), 0);
  const falhasPeriodo = periodo.reduce((s, d) => s + (d.falhas || 0), 0);
  const fatPeriodo = periodo.reduce((s, d) => s + parseFloat(d.faturamento || 0), 0);
  const taxaSucesso = totalPeriodo > 0 ? Math.round(entreguesPeriodo / totalPeriodo * 100) : 0;
  const ticketMedio = entreguesPeriodo > 0 ? fatPeriodo / entreguesPeriodo : 0;

  // Dados para gráfico de linha (período)
  const chartPeriodo = periodo.slice(-14).map(d => ({
    data: d.delivery_date ? new Date(d.delivery_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—',
    entregues: d.entregues || 0,
    falhas: d.falhas || 0,
    faturamento: parseFloat(d.faturamento || 0).toFixed(0),
  }));

  // Dados para gráfico de barras (regiões)
  const chartRegioes = regioes.slice(0, 8).map(r => ({
    regiao: r.regiao?.slice(0, 10) || '—',
    entregues: r.entregues || 0,
    falhas: r.falhas || 0,
    taxa: parseFloat(r.taxa_entrega || 0),
  }));

  // Dados para pizza (status pedidos)
  const pieData = [
    { name: 'Pendentes', value: summary.pendentes || 0 },
    { name: 'Em Rota', value: summary.roteirizados || 0 },
    { name: 'Entregues', value: summary.entregues || 0 },
    { name: 'Falhas', value: summary.falhas || 0 },
  ].filter(d => d.value > 0);

  const exportCSV = () => {
    const rows = [
      ['Data', 'Total', 'Entregues', 'Falhas', 'Faturamento'],
      ...periodo.map(d => [d.delivery_date, d.total_pedidos, d.entregues, d.falhas, parseFloat(d.faturamento||0).toFixed(2)])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_gelocrim_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>📊 Relatórios e Business Intelligence</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Análise estratégica da operação de Manaus</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> 📥 Exportar CSV</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>📄 Exportar PDF</button>
          <button className="btn btn-primary" onClick={load}><RefreshCw size={14} /> ⚡ Atualizar</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Período De</label>
          <input className="form-control" type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} style={{ width: 140 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Até</label>
          <input className="form-control" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ width: 140 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Tipo de Relatório</label>
          <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: 220 }}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end', paddingBottom: 2 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriodoRapido(d)}
              style={{ padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: periodoBtn === String(d) ? '#e8521a' : '#1e3a5c', color: periodoBtn === String(d) ? '#fff' : '#90afd4' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { emoji: '✅', label: 'Taxa de Sucesso', value: `${taxaSucesso}%`, sub: 'entregas no prazo', color: taxaSucesso >= 90 ? '#10b981' : taxaSucesso >= 70 ? '#f59e0b' : '#ef4444' },
          { emoji: '💰', label: 'Faturamento', value: fatPeriodo > 0 ? `R$ ${(fatPeriodo/1000).toFixed(1)}k` : '—', sub: 'no período', color: '#10b981' },
          { emoji: '🎫', label: 'Ticket Médio', value: ticketMedio > 0 ? `R$ ${ticketMedio.toFixed(0)}` : '—', sub: 'por entrega', color: '#64B4FF' },
          { emoji: '🚛', label: 'Frota Ativa', value: frota.veiculos_ativos || '—', sub: `de ${frota.total_veiculos || '—'} veículos`, color: '#f97316' },
        ].map(k => (
          <div key={k.label} className="card">
            <div style={{ fontSize: 11, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{k.emoji} {k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{loading ? '...' : k.value}</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Linha do tempo */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64B4FF', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>📈 Entregas por Dia (últimos 14 dias)</h3>
          {chartPeriodo.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartPeriodo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5c" />
                <XAxis dataKey="data" tick={{ fill: '#90afd4', fontSize: 10 }} />
                <YAxis tick={{ fill: '#90afd4', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8 }} />
                <Legend wrapperStyle={{ color: '#90afd4', fontSize: 11 }} />
                <Line type="monotone" dataKey="entregues" stroke="#10b981" strokeWidth={2} dot={false} name="Entregues" />
                <Line type="monotone" dataKey="falhas" stroke="#ef4444" strokeWidth={2} dot={false} name="Falhas" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: '#90afd4', padding: 40, fontSize: 13 }}>Sem dados no período</div>
          )}
        </div>

        {/* Pizza status atual */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>🥧 Status Atual dos Pedidos</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={CORES[index % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: '#90afd4', padding: 40, fontSize: 13 }}>Sem dados</div>
          )}
        </div>

        {/* Barras por região */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>📍 Performance por Região</h3>
          {chartRegioes.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartRegioes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5c" />
                <XAxis dataKey="regiao" tick={{ fill: '#90afd4', fontSize: 10 }} />
                <YAxis tick={{ fill: '#90afd4', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8 }} />
                <Legend wrapperStyle={{ color: '#90afd4', fontSize: 11 }} />
                <Bar dataKey="entregues" fill="#10b981" radius={[4,4,0,0]} name="Entregues" />
                <Bar dataKey="falhas" fill="#ef4444" radius={[4,4,0,0]} name="Falhas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: '#90afd4', padding: 40, fontSize: 13 }}>Sem dados por região</div>
          )}
        </div>

        {/* Tabela de regiões */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e3a5c', fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px' }}>
            📊 Resumo por Região
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 250 }}>
            <table>
              <thead>
                <tr>
                  <th>Região</th><th>Pedidos</th><th>Entregues</th><th>Taxa</th><th>Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {regioes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#90afd4', padding: 20 }}>Sem dados</td></tr>
                ) : regioes.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{r.regiao}</td>
                    <td style={{ fontSize: 12 }}>{r.total_pedidos}</td>
                    <td style={{ fontSize: 12, color: '#10b981' }}>{r.entregues}</td>
                    <td style={{ fontSize: 12, color: parseFloat(r.taxa_entrega) >= 90 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{parseFloat(r.taxa_entrega||0).toFixed(0)}%</td>
                    <td style={{ fontSize: 12, color: '#f59e0b' }}>R$ {parseFloat(r.faturamento||0).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Resumo operacional */}
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📋 RESUMO DO PERÍODO</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Total de Pedidos', value: totalPeriodo, color: '#64B4FF' },
            { label: 'Entregues', value: entreguesPeriodo, color: '#10b981' },
            { label: 'Falhas', value: falhasPeriodo, color: '#ef4444' },
            { label: 'Faturamento', value: fatPeriodo > 0 ? `R$ ${(fatPeriodo/1000).toFixed(1)}k` : '—', color: '#f59e0b' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: '12px', background: '#0a1628', borderRadius: 10, border: '1px solid #1e3a5c' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 11, color: '#90afd4', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
