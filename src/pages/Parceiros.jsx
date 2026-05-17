import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Search } from 'lucide-react';

export default function Parceiros() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroGps, setFiltroGps] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/clientes')
      .then(d => setClientes(Array.isArray(d) ? d : []))
      .catch(() => setClientes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtrados = clientes.filter(c => {
    const matchBusca = !busca ||
      (c.name || c.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (c.codparc || '').toString().includes(busca);
    const matchRegiao = !filtroRegiao || (c.geo_zone || c.regiao || '') === filtroRegiao;
    const matchGps = !filtroGps ||
      (filtroGps === 'com' && c.lat && c.lng) ||
      (filtroGps === 'sem' && (!c.lat || !c.lng));
    return matchBusca && matchRegiao && matchGps;
  });

  const regioes = [...new Set(clientes.map(c => c.geo_zone || c.regiao).filter(Boolean))].sort();
  const comGps = clientes.filter(c => c.lat && c.lng).length;
  const ativos = clientes.filter(c => c.status === 'active' || !c.status).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Parceiros</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Base de clientes com geolocalizacao</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Parceiros', value: clientes.length, color: '#64B4FF' },
          { label: 'Com GPS', value: comGps, color: '#10b981' },
          { label: 'Ativos', value: ativos, color: '#f97316' },
          { label: 'Regioes', value: regioes.length, color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#90afd4' }} />
          <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar por nome ou codigo..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={filtroRegiao} onChange={e => setFiltroRegiao(e.target.value)}>
          <option value="">Todas as regioes</option>
          {regioes.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-control" style={{ width: 140 }} value={filtroGps} onChange={e => setFiltroGps(e.target.value)}>
          <option value="">Todos</option>
          <option value="com">Com GPS</option>
          <option value="sem">Sem GPS</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => { setBusca(''); setFiltroRegiao(''); setFiltroGps(''); }}>Limpar</button>
        <span style={{ color: '#90afd4', fontSize: 12, whiteSpace: 'nowrap' }}>{filtrados.length} parceiros</span>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Cod.</th>
                <th>Nome</th>
                <th>Endereco</th>
                <th>Bairro</th>
                <th>Cidade</th>
                <th>Regiao</th>
                <th>GPS</th>
                <th>Telefone</th>
                <th>T. Atend.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Clique em Atualizar para carregar</td></tr>
              ) : filtrados.slice(0, 200).map((c, i) => (
                <tr key={c.id || i}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64B4FF' }}>{c.codparc || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{c.name || c.nome || '—'}</td>
                  <td style={{ color: '#90afd4', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || c.endereco || '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.district || c.bairro || '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.city || 'Manaus'}</td>
                  <td><span style={{ fontSize: 11, color: '#a78bfa' }}>{c.geo_zone || c.regiao || c.route || '—'}</span></td>
                  <td style={{ color: c.lat && c.lng ? '#10b981' : '#ef4444', fontSize: 12 }}>
                    {c.lat && c.lng ? `${parseFloat(c.lat).toFixed(4)}, ${parseFloat(c.lng).toFixed(4)}` : '—'}
                  </td>
                  <td style={{ fontSize: 12 }}>{c.phone || c.telefone || '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.service_time ? `${c.service_time} min` : '—'}</td>
                  <td><span className={`badge ${c.status === 'inactive' ? 'inactive' : 'active'}`}>{c.status === 'inactive' ? 'Inativo' : 'Ativo'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > 200 && (
            <div style={{ padding: '12px 16px', color: '#90afd4', fontSize: 12, borderTop: '1px solid #1e3a5c' }}>
              Mostrando 200 de {filtrados.length} parceiros. Use os filtros para refinar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
