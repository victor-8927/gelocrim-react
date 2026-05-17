import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Plus, X } from 'lucide-react';

const TIPOS = [
  { val: 'avaria', label: '🧊 Avaria de Carga' },
  { val: 'recusa', label: '🚫 Recusa do Cliente' },
  { val: 'atraso', label: '⏰ Atraso Logístico' },
  { val: 'faturamento', label: '💰 Erro de Faturamento' },
  { val: 'localizacao', label: '📍 Ocorrência de Localização' },
  { val: 'veiculo', label: '🚛 Problema com Veículo' },
  { val: 'outros', label: '📋 Outros' },
];

const GRAVIDADES = [
  { val: 'informativa', label: 'Informativa', cor: '#10b981', emoji: '🟢' },
  { val: 'media', label: 'Média', cor: '#f59e0b', emoji: '🟡' },
  { val: 'alta', label: 'Alta', cor: '#f97316', emoji: '🟠' },
  { val: 'critica', label: 'Crítica', cor: '#ef4444', emoji: '🔴' },
];

const STATUS_OPS = ['Pendente', 'Em Tratamento', 'Resolvida', 'Crítica'];

const FORM_VAZIO = {
  gravidade: 'media', tipo: '', vehicle_id: '', pedido: '', cliente: '',
  descricao: '', foto: '', status: 'Pendente'
};

export default function Ocorrencias() {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroGrav, setFiltroGrav] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroData, setFiltroData] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [o, v] = await Promise.all([
        api.get('/ocorrencias').catch(() => []),
        api.get('/vehicles').catch(() => [])
      ]);
      setOcorrencias(Array.isArray(o) ? o : []);
      setVeiculos(Array.isArray(v) ? v : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const salvar = async () => {
    if (!form.tipo) return alert('Selecione o tipo de ocorrência');
    if (!form.descricao) return alert('Descrição obrigatória');
    setSalvando(true);
    try {
      await api.post('/ocorrencias', { ...form, data: new Date().toISOString() });
      setModal(false);
      setForm(FORM_VAZIO);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
    finally { setSalvando(false); }
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const filtradas = ocorrencias.filter(o => {
    if (filtroTipo && o.tipo !== filtroTipo) return false;
    if (filtroGrav && o.gravidade !== filtroGrav) return false;
    if (filtroStatus && o.status !== filtroStatus) return false;
    if (filtroData && !String(o.data || '').startsWith(filtroData)) return false;
    return true;
  });

  const pendentes = ocorrencias.filter(o => o.status === 'Pendente').length;
  const emTrat = ocorrencias.filter(o => o.status === 'Em Tratamento').length;
  const criticas = ocorrencias.filter(o => o.gravidade === 'critica').length;
  const hoje = new Date().toISOString().slice(0, 10);
  const resolvidasHoje = ocorrencias.filter(o => o.status === 'Resolvida' && String(o.data || '').startsWith(hoje)).length;

  const getGrav = (val) => GRAVIDADES.find(g => g.val === val) || GRAVIDADES[1];
  const getTipo = (val) => TIPOS.find(t => t.val === val)?.label || val || '—';

  const tempoDecorrido = (data) => {
    if (!data) return '—';
    const diff = Math.floor((Date.now() - new Date(data)) / 60000);
    if (diff < 60) return `${diff} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestão de Ocorrências</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Auditoria e suporte operacional em tempo real</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={() => { setForm(FORM_VAZIO); setModal(true); }}><Plus size={14} /> Nova Ocorrência</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { emoji: '⏳', label: 'Pendentes', value: pendentes, sub: 'aguardando tratamento', cor: '#f59e0b' },
          { emoji: '🔧', label: 'Em Tratamento', value: emTrat, sub: 'sendo resolvidas', cor: '#64B4FF' },
          { emoji: '🚨', label: 'Críticas', value: criticas, sub: 'exigem ação imediata', cor: '#ef4444' },
          { emoji: '✅', label: 'Resolvidas', value: resolvidasHoje, sub: 'hoje', cor: '#10b981' },
        ].map(k => (
          <div key={k.label} className="card" style={{ borderTop: `3px solid ${k.cor}` }}>
            <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>{k.emoji} {k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.cor }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#90afd4' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 180 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Tipo — Todos</option>
          {TIPOS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
        </select>
        <select className="form-control" style={{ width: 150 }} value={filtroGrav} onChange={e => setFiltroGrav(e.target.value)}>
          <option value="">Gravidade — Todas</option>
          {GRAVIDADES.map(g => <option key={g.val} value={g.val}>{g.emoji} {g.label}</option>)}
        </select>
        <input className="form-control" type="date" style={{ width: 160 }} value={filtroData} onChange={e => setFiltroData(e.target.value)} />
        <select className="form-control" style={{ width: 150 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Status — Todos</option>
          {STATUS_OPS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => { setFiltroTipo(''); setFiltroGrav(''); setFiltroData(''); setFiltroStatus(''); }}>✕ Limpar</button>
        <span style={{ color: '#90afd4', fontSize: 12, marginLeft: 'auto' }}>{filtradas.length} ocorrências</span>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Gravidade</th><th>Data/Hora</th><th>Tipo</th><th>Cliente / Pedido</th>
                <th>Veículo</th><th>Descrição</th><th>⏱️ Tempo</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Nenhuma ocorrência registrada</td></tr>
              ) : filtradas.map((o, i) => {
                const grav = getGrav(o.gravidade);
                return (
                  <tr key={o.id || i}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: grav.cor }}>
                        {grav.emoji} {grav.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{o.data ? new Date(o.data).toLocaleString('pt-BR') : '—'}</td>
                    <td style={{ fontSize: 12 }}>{getTipo(o.tipo)}</td>
                    <td style={{ fontSize: 12 }}>{o.cliente || '—'}{o.pedido ? <><br /><span style={{ color: '#90afd4', fontSize: 11 }}>#{o.pedido}</span></> : ''}</td>
                    <td style={{ fontSize: 12 }}>{veiculos.find(v => v.id === o.vehicle_id)?.name || o.veiculo || '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descricao || '—'}</td>
                    <td style={{ fontSize: 12, color: '#f59e0b' }}>{tempoDecorrido(o.data)}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
                        background: o.status === 'Resolvida' ? 'rgba(16,185,129,.2)' : o.status === 'Crítica' ? 'rgba(239,68,68,.2)' : o.status === 'Em Tratamento' ? 'rgba(100,180,255,.2)' : 'rgba(245,158,11,.2)',
                        color: o.status === 'Resolvida' ? '#10b981' : o.status === 'Crítica' ? '#ef4444' : o.status === 'Em Tratamento' ? '#64B4FF' : '#f59e0b'
                      }}>{o.status}</span>
                    </td>
                    <td>
                      <select value={o.status} onChange={async e => {
                        try { await api.patch(`/ocorrencias/${o.id}`, { status: e.target.value }); load(); }
                        catch { load(); }
                      }} style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                        {STATUS_OPS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 540, maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Nova Ocorrência</span>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Gravidade */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>🎯 GRAVIDADE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {GRAVIDADES.map(g => (
                    <button key={g.val} onClick={() => setForm(p => ({ ...p, gravidade: g.val }))}
                      style={{ padding: '10px 6px', border: `2px solid ${form.gravidade === g.val ? g.cor : '#1e3a5c'}`, background: form.gravidade === g.val ? `${g.cor}22` : 'transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 20 }}>{g.emoji}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: form.gravidade === g.val ? g.cor : '#90afd4', marginTop: 4 }}>{g.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dados */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📋 DADOS DA OCORRÊNCIA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Tipo de Ocorrência *</label>
                    <select className="form-control" value={form.tipo} onChange={f('tipo')}>
                      <option value="">— Selecione —</option>
                      {TIPOS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Veículo</label>
                    <select className="form-control" value={form.vehicle_id} onChange={f('vehicle_id')}>
                      <option value="">— Selecione —</option>
                      {veiculos.map(v => <option key={v.id} value={v.id}>{v.name} — {v.plate}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Nº do Pedido</label>
                      <input className="form-control" value={form.pedido} onChange={f('pedido')} placeholder="Ex: 123456" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cliente</label>
                      <input className="form-control" value={form.cliente} onChange={f('cliente')} placeholder="Nome do cliente" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descrição Detalhada *</label>
                    <textarea className="form-control" rows={3} value={form.descricao} onChange={f('descricao')} placeholder="Descreva detalhadamente a ocorrência..." />
                  </div>
                </div>
              </div>

              {/* Foto */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📷 EVIDÊNCIAS</div>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, background: '#0a1628', border: '2px dashed #1e3a5c', borderRadius: 10, cursor: 'pointer' }}>
                  {form.foto ? (
                    <img src={form.foto} alt="evidencia" style={{ maxHeight: 120, borderRadius: 8, objectFit: 'cover' }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 32 }}>📷</span>
                      <span style={{ fontSize: 12, color: '#90afd4' }}>Clique para adicionar foto</span>
                    </>
                  )}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setForm(p => ({ ...p, foto: ev.target.result }));
                    reader.readAsDataURL(file);
                  }} />
                </label>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : '💾 Registrar Ocorrência'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
