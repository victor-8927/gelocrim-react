import React, { useEffect, useState } from 'react';
import { getRotas, liberarRota, deleteRota } from '../services/api';
import { RefreshCw, Truck, Trash2, Send } from 'lucide-react';

const STATUS = {
  draft: { label: 'Rascunho', color: '#90afd4' },
  confirmed: { label: 'Confirmada', color: '#f59e0b' },
  released: { label: 'Liberada', color: '#64B4FF' },
  in_progress: { label: 'Em andamento', color: '#f97316' },
  completed: { label: 'Concluida', color: '#10b981' },
};

export default function Rotas() {
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);

  const load = () => {
    setLoading(true);
    getRotas({ date: data })
      .then(d => setRotas(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [data]); // eslint-disable-line

  const liberar = async (id) => {
    if (!window.confirm('Liberar esta rota para o motorista?')) return;
    try { await liberarRota(id); load(); } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir esta rota?')) return;
    try { await deleteRota(id); load(); } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  const totalKm = rotas.reduce((s, r) => s + (parseFloat(r.total_km) || 0), 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestao de Rotas</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>{rotas.length} rotas em {data}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" className="form-control" style={{ width: 160 }} value={data} onChange={e => setData(e.target.value)} />
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Rotas', value: rotas.length, color: '#64B4FF' },
          { label: 'Liberadas', value: rotas.filter(r => r.status === 'released' || r.status === 'in_progress').length, color: '#f97316' },
          { label: 'Concluidas', value: rotas.filter(r => r.status === 'completed').length, color: '#10b981' },
          { label: 'Km Total', value: `${totalKm.toFixed(0)} km`, color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Lista de rotas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</div>
        ) : rotas.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
            <div>Nenhuma rota para esta data</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>Use a Roteirizacao para criar rotas</div>
          </div>
        ) : rotas.map(r => {
          const st = STATUS[r.status] || { label: r.status, color: '#90afd4' };
          return (
            <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Icone veiculo */}
              <div style={{ width: 48, height: 48, background: 'rgba(232,82,26,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Truck size={22} color="#e8521a" />
              </div>

              {/* Info principal */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{r.vehicle_name || r.vehicle_id || 'Veiculo'}</span>
                  <span style={{ fontSize: 11, color: st.color, background: st.color + '20', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 12, color: '#90afd4' }}>
                  {r.driver_name || 'Motorista nao definido'} · {r.total_stops || 0} paradas · {r.total_km || 0} km
                </div>
              </div>

              {/* Horarios */}
              <div style={{ textAlign: 'center', padding: '0 16px', borderLeft: '1px solid #1e3a5c', borderRight: '1px solid #1e3a5c' }}>
                <div style={{ fontSize: 11, color: '#90afd4' }}>Saida</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#64B4FF' }}>{r.start_time || '—'}</div>
              </div>

              <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid #1e3a5c' }}>
                <div style={{ fontSize: 11, color: '#90afd4' }}>Previsao</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{r.end_time || '—'}</div>
              </div>

              {/* Acoes */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {(r.status === 'confirmed' || r.status === 'draft') && (
                  <button className="btn btn-primary btn-sm" onClick={() => liberar(r.id)} title="Liberar rota">
                    <Send size={12} /> Liberar
                  </button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => excluir(r.id)} title="Excluir">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
