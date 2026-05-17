import React, { useState } from 'react';
import api from '../services/api';
import { RefreshCw, Plus, X, Zap } from 'lucide-react';

const TABELAS_PADRAO = [
  { sankhya: 'TGFPAR', dados: 'Clientes/Parceiros', destino: 'recipients', campos: 'CODPARC, NOMEPARC, TELEFONE, CGC_CPF' },
  { sankhya: 'TGFEND', dados: 'Endereços', destino: 'recipients.address', campos: 'ENDERECO, NUMEND, BAIRRO, CEP' },
  { sankhya: 'TGFVEI', dados: 'Veículos', destino: 'vehicles', campos: 'PLACA, DESCRICAO, PESOMAX, VOLMAX' },
  { sankhya: 'TGFCAB+TGFITE', dados: 'Pedidos/Notas', destino: 'orders', campos: 'NUNOTA, CODPARC, DTNEG, PESO, VOLUME' },
];

export default function Sankhya() {
  const [dias, setDias] = useState(1);
  const [sincronizando, setSincronizando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusCor, setStatusCor] = useState('#90afd4');
  const [tabelas, setTabelas] = useState(TABELAS_PADRAO);
  const [modalTabela, setModalTabela] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [formTab, setFormTab] = useState({ sankhya: '', dados: '', destino: '', campos: '' });

  const testarConexao = async () => {
    setTestando(true);
    setStatusMsg('Testando conexão...');
    setStatusCor('#f59e0b');
    try {
      await api.get('/sankhya/test');
      setStatusMsg('✅ Conexão estabelecida com sucesso!');
      setStatusCor('#10b981');
    } catch (e) {
      setStatusMsg('❌ Falha na conexão: ' + (e.detail || e.message || 'Verifique as configurações'));
      setStatusCor('#ef4444');
    } finally { setTestando(false); }
  };

  const sincronizar = async () => {
    setSincronizando(true);
    setStatusMsg('Sincronizando...');
    setStatusCor('#64B4FF');
    try {
      const res = await api.post('/sankhya/sync', { days: parseInt(dias) });
      setStatusMsg(`✅ Sincronizado! ${res.orders || 0} pedidos · ${res.clients || 0} clientes`);
      setStatusCor('#10b981');
    } catch (e) {
      setStatusMsg('❌ Erro: ' + (e.detail || e.message));
      setStatusCor('#ef4444');
    } finally { setSincronizando(false); }
  };

  const verStatus = async () => {
    try {
      const res = await api.get('/sankhya/status');
      setStatusMsg(`📋 Última sync: ${res.last_sync || '—'} · Pedidos: ${res.total_orders || 0}`);
      setStatusCor('#64B4FF');
    } catch (e) {
      setStatusMsg('❌ Erro ao buscar status');
      setStatusCor('#ef4444');
    }
  };

  const abrirModalNovo = () => {
    setEditIdx(null);
    setFormTab({ sankhya: '', dados: '', destino: '', campos: '' });
    setModalTabela(true);
  };

  const abrirModalEditar = (idx) => {
    setEditIdx(idx);
    setFormTab({ ...tabelas[idx] });
    setModalTabela(true);
  };

  const salvarTabela = () => {
    if (!formTab.sankhya || !formTab.destino) return alert('Tabela Sankhya e Destino obrigatórios');
    const novas = [...tabelas];
    if (editIdx !== null) novas[editIdx] = formTab;
    else novas.push(formTab);
    setTabelas(novas);
    setModalTabela(false);
  };

  const removerTabela = (idx) => {
    if (!window.confirm('Remover este mapeamento?')) return;
    setTabelas(t => t.filter((_, i) => i !== idx));
  };

  const f = (k) => (e) => setFormTab(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>🔄 Integração Sankhya ERP</h1>
        <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Sincronize pedidos, clientes e frota do seu ERP</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Status da conexão */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>📡 Status da Conexão</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {[
              'SANKHYA_HOST=192.168.x.x',
              'SANKHYA_PORT=5432',
              'SANKHYA_DB=sankhya',
              'SANKHYA_USER=usuario',
              'GOOGLE_MAPS_KEY=AIza...',
            ].map(v => (
              <div key={v} style={{ fontFamily: 'monospace', fontSize: 12, color: '#90afd4', background: '#0a1628', padding: '6px 10px', borderRadius: 6, border: '1px solid #1e3a5c' }}>{v}</div>
            ))}
          </div>
          {statusMsg && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: `${statusCor}22`, border: `1px solid ${statusCor}`, color: statusCor, fontSize: 12, marginBottom: 12 }}>
              {statusMsg}
            </div>
          )}
          <button className="btn btn-secondary" onClick={testarConexao} disabled={testando} style={{ width: '100%' }}>
            🔌 {testando ? 'Testando...' : 'Testar Conexão'}
          </button>
        </div>

        {/* Sincronização manual */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🔄 Sincronização Manual</div>
          <div style={{ fontSize: 12, color: '#90afd4', marginBottom: 10 }}>Buscar pedidos dos últimos X dias</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="number" min="1" max="365" value={dias}
              onChange={e => setDias(e.target.value)}
              className="form-control" style={{ width: 80 }}
            />
            <span style={{ fontSize: 12, color: '#90afd4' }}>dias</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="btn btn-primary" onClick={sincronizar} disabled={sincronizando} style={{ flex: 1 }}>
              <Zap size={14} /> {sincronizando ? 'Sincronizando...' : 'Sincronizar Agora'}
            </button>
          </div>
          <button className="btn btn-secondary" onClick={verStatus} style={{ width: '100%' }}>
            <RefreshCw size={14} /> Ver Status
          </button>

          {/* Atalhos de dias */}
          <div style={{ marginTop: 16, borderTop: '1px solid #1e3a5c', paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 8 }}>Atalhos rápidos:</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 7, 15, 30].map(d => (
                <button key={d} onClick={() => setDias(d)}
                  style={{ padding: '4px 10px', border: `1px solid ${dias === d ? '#e8521a' : '#1e3a5c'}`, background: dias === d ? 'rgba(232,82,26,.15)' : 'transparent', color: dias === d ? '#e8521a' : '#90afd4', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mapeamento de tabelas */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px' }}>📋 Mapeamento de Tabelas</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 2 }}>Adicione novas tabelas conforme necessário</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={abrirModalNovo}><Plus size={14} /> Nova Tabela</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Tabela Sankhya</th>
                <th>Dados</th>
                <th>Destino Fleet</th>
                <th>Campos Mapeados</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tabelas.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#f97316' }}>{t.sankhya}</td>
                  <td style={{ fontSize: 12 }}>{t.dados}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64B4FF' }}>{t.destino}</td>
                  <td style={{ fontSize: 11, color: '#90afd4', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.campos}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirModalEditar(i)}>✏️ Editar</button>
                      <button onClick={() => removerTabela(i)} style={{ background: 'rgba(239,68,68,.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de tabela */}
      {modalTabela && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModalTabela(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 500 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>{editIdx !== null ? '✏️ Editar Mapeamento' : '+ Novo Mapeamento'}</span>
              <button onClick={() => setModalTabela(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Tabela Sankhya *</label>
                <input className="form-control" value={formTab.sankhya} onChange={f('sankhya')} placeholder="Ex: TGFPAR" style={{ fontFamily: 'monospace' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Dados</label>
                <input className="form-control" value={formTab.dados} onChange={f('dados')} placeholder="Ex: Clientes/Parceiros" />
              </div>
              <div className="form-group">
                <label className="form-label">Destino Fleet *</label>
                <input className="form-control" value={formTab.destino} onChange={f('destino')} placeholder="Ex: recipients" style={{ fontFamily: 'monospace' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Campos Mapeados</label>
                <textarea className="form-control" rows={3} value={formTab.campos} onChange={f('campos')} placeholder="Ex: CODPARC, NOMEPARC, TELEFONE" style={{ fontFamily: 'monospace', fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModalTabela(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarTabela}>💾 Salvar Mapeamento</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
