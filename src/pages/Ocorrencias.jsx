import React, { useEffect, useState } from 'react';
import { getOcorrencias } from '../services/api';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const TIPO_COLORS = {
  acidente: '#ef4444',
  avaria: '#f59e0b',
  atraso: '#f97316',
  recusa: '#a78bfa',
  outro: '#90afd4',
};

export default function Ocorrencias() {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  const load = () => {
    setLoading(true);
    getOcorrencias()
      .then(d => setOcorrencias(Array.isArray(d) ? d : []))
      .catch(() => setOcorrencias([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtradas = ocorrencias.filter(o =>
    !filtro || (o.tipo || '').toLowerCase().includes(filtro.toLowerCase()) ||
    (o.descricao || '').toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Ocorrencias</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>{ocorrencias.length} ocorrencias registradas</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: ocorrencias.length, color: '#64B4FF' },
          { label: 'Abertas', value: ocorrencias.filter(o => o.status === 'open' || !o.status).length, color: '#ef4444' },
          { label: 'Em andamento', value: ocorrencias.filter(o => o.status === 'in_progress').length, color: '#f59e0b' },
          { label: 'Resolvidas', value: ocorrencias.filter(o => o.status === 'resolved').length, color: '#10b981' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="card" style={{ marginBottom: 16 }}>
        <input
          className="form-control"
          placeholder="Buscar ocorrencia..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#90afd4', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma ocorrencia registrada</div>
          </div>
        ) : filtradas.map((o, i) => {
          const cor = TIPO_COLORS[o.tipo] || '#90afd4';
          return (
            <div key={o.id || i} className="card" style={{ borderLeft: `3px solid ${cor}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <AlertTriangle size={18} color={cor} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{o.tipo || 'Ocorrencia'}</span>
                    <span style={{ fontSize: 11, color: cor, background: cor + '20', padding: '2px 8px', borderRadius: 4 }}>
                      {o.status || 'aberta'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#90afd4' }}>
                      <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                      {o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#e8f0fe', marginBottom: 6 }}>{o.descricao || '—'}</div>
                  <div style={{ fontSize: 12, color: '#90afd4' }}>
                    {o.driver_name && <span>Motorista: {o.driver_name} · </span>}
                    {o.vehicle_name && <span>Veiculo: {o.vehicle_name} · </span>}
                    {o.rota_id && <span>Rota: {o.rota_id}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
