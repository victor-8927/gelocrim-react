import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, X, Eye } from 'lucide-react';

function ModalRota({ rota, onFechar }) {
  if (!rota) return null;
  const paradas = rota.stops || rota.orders || [];
  const entregues = paradas.filter(p => p.status === 'delivered' || p.status === 'completed').length;
  const falhas = paradas.filter(p => p.status === 'refused' || p.status === 'failed').length;
  const pendentes = paradas.filter(p => !p.status || p.status === 'pending').length;
  const pct = paradas.length > 0 ? Math.round(entregues / paradas.length * 100) : 0;

  const statusLabel = (s) => {
    if (s === 'delivered' || s === 'completed') return { label: '✅ Entregue', cor: '#10b981' };
    if (s === 'refused' || s === 'failed') return { label: '❌ Falhou', cor: '#ef4444' };
    return { label: '⏳ Pendente', cor: '#f59e0b' };
  };

  const FotoBtn = ({ label, url }) => (
    <div style={{ textAlign: 'center' }}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#64B4FF', textDecoration: 'none', fontSize: 10 }}>
          <span>Ver {label}</span><span style={{ fontSize: 16 }}>📄</span>
        </a>
      ) : (
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', color: '#90afd4', fontSize: 10 }}>
          <span style={{ fontSize: 16 }}>📷</span><span>{label}</span>
          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} />
        </label>
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 720, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🗺️ {rota.trip_number || rota.id?.slice(0, 16)} — {rota.vehicle_name || rota.vehicle?.plate || '—'}</div>
            <div style={{ fontSize: 12, color: '#90afd4', marginTop: 2 }}>Motorista: {rota.driver_name || rota.driver?.name || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8, background: rota.status === 'completed' ? 'rgba(16,185,129,.2)' : rota.status === 'in_progress' ? 'rgba(249,115,22,.2)' : 'rgba(100,180,255,.2)', color: rota.status === 'completed' ? '#10b981' : rota.status === 'in_progress' ? '#f97316' : '#64B4FF' }}>
              {rota.status === 'completed' ? '✅ Concluída' : rota.status === 'in_progress' ? '🟠 Em Rota' : '🟢 Liberada'}
            </span>
            <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Entregues', value: entregues, cor: '#10b981' },
              { label: 'Falhas', value: falhas, cor: '#ef4444' },
              { label: 'Pendentes', value: pendentes, cor: '#f59e0b' },
              { label: 'Progresso', value: `${pct}%`, cor: '#64B4FF' },
            ].map(k => (
              <div key={k.label} style={{ background: '#0a1628', borderRadius: 10, padding: 12, textAlign: 'center', border: '1px solid #1e3a5c' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.cor }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#90afd4' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Paradas */}
          {paradas.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Sem paradas registradas</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e3a5c' }}>
                  {['#', 'Cliente', 'Peso', 'Status', 'Hora', 'NF', 'Boleto', 'Comodato', 'Outros'].map(h => (
                    <th key={h} style={{ padding: '8px 6px', fontSize: 10, color: '#90afd4', textAlign: h === '#' || h === 'Peso' || h === 'Hora' ? 'center' : 'left', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paradas.map((p, i) => {
                  const st = statusLabel(p.status);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64B4FF' }}>{i + 1}</td>
                      <td style={{ padding: '10px 6px' }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{p.recipient_name || p.name || '—'}</div>
                        {p.district && <div style={{ fontSize: 10, color: '#90afd4' }}>{p.district}, {p.city || 'Manaus'}</div>}
                        {(p.status === 'refused' || p.status === 'failed') && p.notes && (
                          <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Motivo: {p.notes}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontSize: 12, color: '#f59e0b' }}>{p.weight_kg ? `${parseFloat(p.weight_kg).toFixed(0)} kg` : '—'}</td>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: st.cor }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontSize: 12, color: '#90afd4' }}>{p.arrival_time || p.eta || '—'}</td>
                      <td style={{ padding: '6px', textAlign: 'center' }}><FotoBtn label="NF" url={p.nf_url} /></td>
                      <td style={{ padding: '6px', textAlign: 'center' }}><FotoBtn label="Boleto" url={p.boleto_url} /></td>
                      <td style={{ padding: '6px', textAlign: 'center' }}><FotoBtn label="Comodato" url={p.comodato_url} /></td>
                      <td style={{ padding: '6px', textAlign: 'center' }}><FotoBtn label="Outros" url={p.outros_url} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Rotas() {
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [filtroStatus, setFiltroStatus] = useState('');
  const [rotaSel, setRotaSel] = useState(null);
  const [selecionados, setSelecionados] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/routes?date=${data}`);
      setRotas(Array.isArray(r) ? r : []);
    } catch { setRotas([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [data]); // eslint-disable-line

  const filtradas = rotas.filter(r => !filtroStatus || r.status === filtroStatus);

  // KPIs
  const totalParadas = rotas.reduce((s, r) => s + (r.total_stops || 0), 0);
  const entregues = rotas.reduce((s, r) => s + (r.completed_stops || 0), 0);
  const falhas = rotas.reduce((s, r) => s + (r.failed_stops || 0), 0);
  const taxaSucesso = totalParadas > 0 ? Math.round((entregues / (entregues + falhas || 1)) * 100) : 0;
  const veicAtivos = rotas.filter(r => r.status === 'in_progress').length;
  const kmTotal = rotas.reduce((s, r) => s + parseFloat(r.total_km || 0), 0);
  const kmPlan = rotas.reduce((s, r) => s + parseFloat(r.planned_km || 0), 0);
  const desvio = kmPlan > 0 ? Math.round((kmTotal - kmPlan) / kmPlan * 100) : 0;
  const progGeral = totalParadas > 0 ? Math.round(entregues / totalParadas * 100) : 0;

  const toggleSel = (id) => setSelecionados(p => { const n = { ...p }; if (n[id]) delete n[id]; else n[id] = true; return n; });
  const todosSelArr = Object.keys(selecionados);

  const statusLabel = (s) => {
    if (s === 'in_progress') return { label: 'Em Rota', cor: '#f97316' };
    if (s === 'completed') return { label: 'Concluída', cor: '#10b981' };
    if (s === 'planned') return { label: 'Liberada', cor: '#64B4FF' };
    if (s === 'cancelled') return { label: 'Cancelada', cor: '#ef4444' };
    return { label: s || 'Pendente', cor: '#90afd4' };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestão de Rotas</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Visão panorâmica da execução do dia</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          {todosSelArr.length > 0 && (
            <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Imprimir Selecionados ({todosSelArr.length})</button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { emoji: '📊', label: 'Taxa de Sucesso (SLA)', value: totalParadas > 0 ? `${taxaSucesso}%` : '—', sub: 'entregas no prazo', cor: taxaSucesso >= 90 ? '#10b981' : taxaSucesso >= 70 ? '#f59e0b' : '#ef4444' },
          { emoji: '🚛', label: 'Saúde da Frota', value: veicAtivos > 0 ? `${veicAtivos} ativos` : '—', sub: 'veículos em rota', cor: '#64B4FF' },
          { emoji: '📍', label: 'KM Real vs Planejado', value: kmPlan > 0 ? `${desvio > 0 ? '+' : ''}${desvio}%` : '—', sub: 'desvio médio', cor: desvio > 10 ? '#ef4444' : desvio > 5 ? '#f59e0b' : '#10b981' },
          { emoji: '✅', label: 'Progresso Geral', value: totalParadas > 0 ? `${progGeral}%` : '—', sub: 'do dia concluído', cor: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="card">
            <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>{k.emoji} {k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.cor }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#90afd4' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#90afd4' }}>Data</span>
          <input type="date" className="form-control" style={{ width: 160 }} value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#90afd4' }}>Status</span>
          <select className="form-control" style={{ width: 150 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="planned">Liberada</option>
            <option value="in_progress">Em Rota</option>
            <option value="completed">Concluída</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <span style={{ color: '#90afd4', fontSize: 12, marginLeft: 'auto' }}>{filtradas.length} rotas em {data}</span>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Nº Viagem</th><th>Veículo</th><th>Motorista</th><th>Data</th>
                <th>Progresso</th><th>Distância</th><th>Início Prev.</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
                    <div>Nenhuma rota para esta data</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>Use a Roteirização para criar rotas</div>
                  </td>
                </tr>
              ) : filtradas.map(r => {
                const st = statusLabel(r.status);
                const stops = r.total_stops || 0;
                const done = r.completed_stops || 0;
                const pct = stops > 0 ? Math.round(done / stops * 100) : 0;
                return (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={!!selecionados[r.id]} onChange={() => toggleSel(r.id)}
                        style={{ cursor: 'pointer', accentColor: '#e8521a' }} />
                    </td>
                    <td style={{ fontWeight: 700, color: '#64B4FF', fontSize: 12 }}>{r.trip_number || r.id?.slice(0, 16)}</td>
                    <td style={{ fontSize: 12 }}>{r.vehicle_name || r.vehicle?.plate || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.driver_name || r.driver?.name || '—'}</td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{r.date || data}</td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#1e3a5c', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10b981' : '#64B4FF', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#90afd4', whiteSpace: 'nowrap' }}>{pct}% ({stops} paradas)</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{r.total_km ? `${parseFloat(r.total_km).toFixed(0)} km` : '— km'}</td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{r.planned_start || r.start_time || '—'}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700, background: `${st.cor}22`, color: st.cor }}>{st.label}</span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRotaSel(r)}>
                        <Eye size={12} /> Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rotaSel && <ModalRota rota={rotaSel} onFechar={() => setRotaSel(null)} />}
    </div>
  );
}
