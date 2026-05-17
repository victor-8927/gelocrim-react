import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Search, X, MapPin } from 'lucide-react';

function ModalParceiro({ parceiro, onFechar }) {
  if (!parceiro) return null;
  const temGps = parceiro.lat && parceiro.lng;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>🤝 {parceiro.name || parceiro.nome}</div>
            <div style={{ fontSize: 11, color: '#90afd4' }}>Cód. {parceiro.codparc}</div>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* GPS */}
          <div style={{ background: temGps ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${temGps ? '#10b981' : '#ef4444'}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: temGps ? '#10b981' : '#ef4444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>📍 GEOLOCALIZAÇÃO</div>
            {temGps ? (
              <>
                <div style={{ fontSize: 13, color: '#e8f0fe', marginBottom: 8 }}>✓ GPS: {parseFloat(parceiro.lat).toFixed(6)}, {parseFloat(parceiro.lng).toFixed(6)}</div>
                <a href={`https://www.google.com/maps?q=${parceiro.lat},${parceiro.lng}`} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64B4FF', fontSize: 12, textDecoration: 'none' }}>
                  <MapPin size={14} /> Ver no Google Maps
                </a>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#ef4444' }}>Sem coordenadas GPS cadastradas</div>
            )}
          </div>

          {/* Dados principais */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>DADOS CADASTRAIS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Código ERP', value: parceiro.codparc },
                { label: 'Nome Fantasia', value: parceiro.name || parceiro.nome },
                { label: 'Razão Social', value: parceiro.razao_social || parceiro.corporate_name },
                { label: 'CPF/CNPJ', value: parceiro.cnpj || parceiro.cpf },
                { label: 'Telefone', value: parceiro.phone || parceiro.telefone },
                { label: 'Segmento', value: parceiro.segment || parceiro.segmento },
              ].map(item => item.value ? (
                <div key={item.label}>
                  <div style={{ fontSize: 10, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f0fe' }}>{item.value}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Logística */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>📦 LOGÍSTICA E ROTEIRIZAÇÃO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Rota', value: parceiro.route || parceiro.rota },
                { label: 'Zona Geo', value: parceiro.geo_zone || parceiro.regiao },
                { label: '⏱️ Tempo Médio', value: parceiro.service_time ? `${parceiro.service_time} min` : null },
              ].map(item => item.value ? (
                <div key={item.label} style={{ background: '#0a1628', borderRadius: 8, padding: '8px 12px', border: '1px solid #1e3a5c' }}>
                  <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e8521a' }}>{item.value}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Endereço */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>🏠 ENDEREÇO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Endereço Completo', value: parceiro.address || parceiro.endereco },
                { label: 'Bairro', value: parceiro.district || parceiro.bairro },
                { label: 'Cidade', value: parceiro.city || parceiro.cidade },
                { label: 'CEP', value: parceiro.cep },
                { label: 'Estado', value: parceiro.state || 'AM' },
              ].map(item => item.value ? (
                <div key={item.label}>
                  <div style={{ fontSize: 10, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: '#e8f0fe' }}>{item.value}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Outros */}
          {(parceiro.comodatos || parceiro.notes) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>📋 OUTROS</div>
              {parceiro.comodatos && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>Comodatos</div>
                  <div style={{ fontSize: 13, color: '#e8f0fe' }}>{parceiro.comodatos}</div>
                </div>
              )}
              {parceiro.notes && (
                <div>
                  <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>Observações</div>
                  <div style={{ fontSize: 13, color: '#e8f0fe' }}>{parceiro.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
            <span style={{ fontSize: 11, color: '#90afd4' }}>Status</span>
            <span className={`badge ${parceiro.status === 'inactive' ? 'inactive' : 'active'}`} style={{ fontSize: 12 }}>
              {parceiro.status === 'inactive' ? 'Inativo' : '✅ Ativo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Parceiros() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroGps, setFiltroGps] = useState('');
  const [parceiro, setParceiro] = useState(null);

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
      String(c.codparc || '').includes(busca) ||
      (c.address || c.endereco || '').toLowerCase().includes(busca.toLowerCase());
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
          <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Nome, codigo, endereco..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={filtroRegiao} onChange={e => setFiltroRegiao(e.target.value)}>
          <option value="">Todas as regioes</option>
          {regioes.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-control" style={{ width: 120 }} value={filtroGps} onChange={e => setFiltroGps(e.target.value)}>
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
                <th>GPS / Coords</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Clique em Atualizar para carregar</td></tr>
              ) : filtrados.slice(0, 300).map((c, i) => (
                <tr key={c.id || i}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64B4FF' }}>{c.codparc || '—'}</td>
                  <td style={{ fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.nome || '—'}</td>
                  <td style={{ color: '#90afd4', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || c.endereco || '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.district || c.bairro || '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.city || 'Manaus'}</td>
                  <td><span style={{ fontSize: 11, color: '#a78bfa' }}>{c.geo_zone || c.regiao || '—'}</span></td>
                  <td style={{ fontSize: 11, color: c.lat && c.lng ? '#10b981' : '#ef4444' }}>
                    {c.lat && c.lng ? `✓ ${parseFloat(c.lat).toFixed(4)}, ${parseFloat(c.lng).toFixed(4)}` : 'Sem GPS'}
                  </td>
                  <td style={{ fontSize: 12 }}>{c.phone || c.telefone || '—'}</td>
                  <td><span className={`badge ${c.status === 'inactive' ? 'inactive' : 'active'}`}>{c.status === 'inactive' ? 'Inativo' : 'Ativo'}</span></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setParceiro(c)}>🔍 Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > 300 && (
            <div style={{ padding: '12px 16px', color: '#90afd4', fontSize: 12, borderTop: '1px solid #1e3a5c' }}>
              Mostrando 300 de {filtrados.length} parceiros. Use os filtros para refinar.
            </div>
          )}
        </div>
      </div>

      {parceiro && <ModalParceiro parceiro={parceiro} onFechar={() => setParceiro(null)} />}
    </div>
  );
}
