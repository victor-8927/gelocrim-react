import React, { useEffect, useState } from 'react';
import { getOrders, supabase } from '../services/supabase';
import { RefreshCw, Search, X } from 'lucide-react';

const STATUS_LABELS = {
  pending: 'Pendente', routed: 'Roteirizado', delivered: 'Entregue', failed: 'Falha',
};

const TOP_LABELS = {
  '1000': 'Venda', '1007': 'Bonif.', '1008': 'Consig.', '1009': 'Troca', '1010': 'Saldo',
};

const TOP_CORES = {
  '1000': '#10b981', '1009': '#64B4FF', '1007': '#a78bfa', '1010': '#f59e0b', '1008': '#f97316',
};

function ModalPedido({ pedido, onFechar }) {
  const [itens, setItens] = React.useState([]);
  const [loadingItens, setLoadingItens] = React.useState(false);

  React.useEffect(() => {
    if (!pedido) return;
    const nf = pedido.external_id || pedido.invoice_number;
    if (!nf) return;
    setLoadingItens(true);
    supabase.from('order_items')
      .select('item_type, item_name, qty, weight_unit')
      .eq('invoice_number', nf)
      .then(function(res) { setItens(res.data || []); })
      .finally(function() { setLoadingItens(false); });
  }, [pedido]);

  if (!pedido) return null;
  const topLabel = TOP_LABELS[pedido.order_type] || pedido.order_type || 'Venda';
  const topCor = TOP_CORES[pedido.order_type] || '#64B4FF';
  const isBoleto = pedido.payment_description && pedido.payment_description.toLowerCase().includes('boleto');
  const totalQtd = itens.reduce(function(s, i) { return s + (i.qty || 0); }, 0);
  const totalPeso = itens.reduce(function(s, i) { return s + ((i.qty || 0) * (i.weight_unit || 0)); }, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={function(e) { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
          <span style={{ fontWeight: 700 }}>Pedido {pedido.external_id}</span>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Cliente */}
          <div style={{ background: '#0a1628', borderRadius: 10, padding: 14, border: '1px solid #1e3a5c' }}>
            <div style={{ fontSize: 11, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>CLIENTE</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{pedido.recipient_name || '—'}</div>
            <div style={{ fontSize: 12, color: '#90afd4', marginTop: 2 }}>{pedido.address || '—'}</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 4 }}>COD: {pedido.codparc || '—'}</div>
          </div>

          {/* Identificação */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Nº Pedido', value: pedido.external_id, cor: '#64B4FF' },
              { label: 'NF', value: pedido.invoice_number || '—', cor: '#e8f0fe' },
              { label: 'TOP', value: topLabel, cor: topCor },
              { label: 'Status', value: STATUS_LABELS[pedido.status] || pedido.status, cor: pedido.status === 'pending' ? '#f59e0b' : '#10b981' },
              { label: 'Pagamento', value: pedido.payment_description || 'A Vista', cor: isBoleto ? '#f59e0b' : '#10b981' },
              { label: 'Entrega', value: pedido.delivery_date || '—', cor: '#e8f0fe' },
            ].map(function(i) { return (
              <div key={i.label} style={{ background: '#0a1628', borderRadius: 8, padding: '8px 12px', border: '1px solid #1e3a5c' }}>
                <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>{i.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: i.cor }}>{i.value}</div>
              </div>
            ); })}
          </div>

          {/* Pesos e valor */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'PESO', value: parseFloat(pedido.weight_kg || 0).toFixed(0) + ' kg', cor: '#f59e0b' },
              { label: 'VALOR', value: pedido.total_value ? 'R$ ' + parseFloat(pedido.total_value).toFixed(2) : '—', cor: '#a78bfa' },
              { label: 'BOLETO', value: isBoleto ? '🔔 SIM' : 'Não', cor: isBoleto ? '#f59e0b' : '#90afd4' },
            ].map(function(i) { return (
              <div key={i.label} style={{ background: '#0a1628', borderRadius: 8, padding: 10, border: '1px solid #1e3a5c', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 4 }}>{i.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: i.cor }}>{i.value}</div>
              </div>
            ); })}
          </div>

          {pedido.notes && (
            <div style={{ background: '#0a1628', borderRadius: 8, padding: 10, border: '1px solid #1e3a5c', fontSize: 12, color: '#90afd4' }}>
              📝 {pedido.notes}
            </div>
          )}

          {/* Mix de Itens */}
          <div>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>
              📦 MIX DE ITENS — {topLabel}
            </div>
            {loadingItens ? (
              <div style={{ color: '#90afd4', fontSize: 12, padding: 8 }}>Carregando itens...</div>
            ) : itens.length === 0 ? (
              <div style={{ color: '#90afd4', fontSize: 12, padding: '8px 12px', background: '#0a1628', borderRadius: 8, border: '1px solid #1e3a5c' }}>
                Sem itens detalhados — importe os Itens do Sankhya
              </div>
            ) : (
              <div style={{ background: '#0a1628', borderRadius: 10, border: '1px solid #1e3a5c', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0f2040' }}>
                      <th style={{ padding: '6px 8px', fontSize: 10, color: '#90afd4', fontWeight: 700, textAlign: 'center' }}>CÓD</th>
                      <th style={{ padding: '6px 8px', fontSize: 10, color: '#90afd4', fontWeight: 700, textAlign: 'left' }}>PRODUTO</th>
                      <th style={{ padding: '6px 8px', fontSize: 10, color: '#90afd4', fontWeight: 700, textAlign: 'center' }}>QTDE</th>
                      <th style={{ padding: '6px 8px', fontSize: 10, color: '#90afd4', fontWeight: 700, textAlign: 'center' }}>PESO UN.</th>
                      <th style={{ padding: '6px 8px', fontSize: 10, color: '#90afd4', fontWeight: 700, textAlign: 'center' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(function(item, i) { return (
                      <tr key={i} style={{ borderTop: '1px solid #1e3a5c' }}>
                        <td style={{ padding: '5px 8px', fontSize: 11, color: '#64B4FF', fontFamily: 'monospace', textAlign: 'center' }}>{item.item_type || '—'}</td>
                        <td style={{ padding: '5px 8px', fontSize: 11, fontWeight: 600 }}>{item.item_name || '—'}</td>
                        <td style={{ padding: '5px 8px', fontSize: 12, fontWeight: 700, color: topCor, textAlign: 'center' }}>{item.qty || 0}</td>
                        <td style={{ padding: '5px 8px', fontSize: 11, color: '#90afd4', textAlign: 'center' }}>{item.weight_unit || 0} kg</td>
                        <td style={{ padding: '5px 8px', fontSize: 12, fontWeight: 700, color: '#f59e0b', textAlign: 'center' }}>{((item.qty||0)*(item.weight_unit||0)).toFixed(0)} kg</td>
                      </tr>
                    ); })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #1e3a5c', background: '#0f2040' }}>
                      <td colSpan={2} style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#e8f0fe' }}>TOTAL</td>
                      <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: topCor, textAlign: 'center' }}>{totalQtd}</td>
                      <td></td>
                      <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#f59e0b', textAlign: 'center' }}>{totalPeso.toFixed(0)} kg</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <button className="btn btn-secondary" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [resumoItens, setResumoItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroTop, setFiltroTop] = useState('');
  const [limite, setLimite] = useState(100);
  const [selecionados, setSelecionados] = useState({});
  const [modalPedido, setModalPedido] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      getOrders({ limit: 500 }),
      supabase.from('v_resumo_itens_dia').select('*').order('item_code'),
    ])
      .then(([data, { data: itensData }]) => {
        setPedidos(Array.isArray(data) ? data : []);
        setResumoItens(itensData || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const regioes = [...new Set(pedidos.map(p => p.geo_zone || p.regiao || p.region).filter(Boolean))].sort();

  const filtrados = pedidos.filter(p => {
    if (busca) {
      const b = busca.toLowerCase();
      const match = (p.recipient_name || '').toLowerCase().includes(b) ||
        String(p.external_id || '').toLowerCase().includes(b) ||
        String(p.codparc || '').includes(b) ||
        (p.address || '').toLowerCase().includes(b);
      if (!match) return false;
    }
    if (status && p.status !== status) return false;
    if (filtroRegiao) {
      const reg = p.geo_zone || p.regiao || p.region || '';
      if (reg !== filtroRegiao) return false;
    }
    if (filtroTop) {
      const top = String(p.order_type || p.top || '');
      if (top !== filtroTop) return false;
    }
    return true;
  }).slice(0, limite);

  const pesoTotal = filtrados.reduce((s, p) => s + (parseFloat(p.weight_kg) || 0), 0);
  const capFrota = 0;
  const ocupacao = capFrota > 0 ? Math.round(pesoTotal / capFrota * 100) : 0;

  // Resumo do dia por produto
  const resumoProd = {};
  pedidos.forEach(p => {
    (p.order_items || p.items || []).forEach(item => {
      const nome = item.item_name || item.product_name || item.name || 'Produto';
      if (!resumoProd[nome]) resumoProd[nome] = { qty: 0, peso: 0 };
      resumoProd[nome].qty += parseInt(item.qty || item.quantity || 0);
      resumoProd[nome].peso += parseFloat(item.weight_unit || item.weight_kg || 0) * parseInt(item.qty || item.quantity || 1);
    });
  });
  const resumoArr = Object.entries(resumoProd);

  const toggleSel = (id) => setSelecionados(p => { const n = { ...p }; if (n[id]) delete n[id]; else n[id] = true; return n; });
  const toggleTodos = () => {
    if (Object.keys(selecionados).length === filtrados.length) setSelecionados({});
    else { const n = {}; filtrados.forEach(p => { n[p.id] = true; }); setSelecionados(n); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestão de Pedidos</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>{pedidos.length} pedidos carregados</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}>📥 Importar CSV</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}>📦 Importar Itens</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}>📋 Importar Planilha TI</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}>🔄 Sincronizar Sankhya</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }}>+ Novo Pedido</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Pendentes', value: pedidos.filter(p => p.status === 'pending').length, color: '#f59e0b', emoji: '📦', st: 'pending' },
          { label: 'Em Rota', value: pedidos.filter(p => p.status === 'routed').length, color: '#64B4FF', emoji: '🚛', st: 'routed' },
          { label: 'Entregues', value: pedidos.filter(p => p.status === 'delivered').length, color: '#10b981', emoji: '✅', st: 'delivered' },
          { label: 'Com Falha', value: pedidos.filter(p => p.status === 'failed').length, color: '#ef4444', emoji: '❌', st: 'failed' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center', cursor: 'pointer', borderTop: status === k.st ? `3px solid ${k.color}` : '3px solid transparent' }}
            onClick={() => setStatus(status === k.st ? '' : k.st)}>
            <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 2 }}>{k.emoji} {k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: '#90afd4' }}>clique para filtrar</div>
          </div>
        ))}
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 2 }}>⚖️ Peso Total</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{pesoTotal.toFixed(0)} kg</div>
          <div style={{ fontSize: 10, color: '#90afd4' }}>— da frota</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 2 }}>🚛 Ocupação Frota</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ocupacao > 100 ? '#ef4444' : ocupacao > 80 ? '#f59e0b' : '#10b981' }}>
            {capFrota > 0 ? `${ocupacao}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#90afd4' }}>Cap: {capFrota > 0 ? `${(capFrota/1000).toFixed(0)}t` : '—'}</div>
        </div>
      </div>

      {/* Resumo do dia */}
      {resumoArr.length > 0 && (
        <div style={{ background: '#0a1628', border: '1px solid #1e3a5c', borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 12, color: '#90afd4' }}>
          <span style={{ color: '#64B4FF', fontWeight: 700, marginRight: 8 }}>📦 RESUMO DIA:</span>
          {resumoArr.map(([nome, d], i) => (
            <span key={nome}>{i > 0 ? ' | ' : ''}<span style={{ color: '#e8f0fe' }}>{d.qty}x {nome} ({d.peso.toFixed(0)}kg)</span></span>
          ))}
        </div>
      )}

      {/* Resumo de itens - barra inteligente */}
      {resumoItens.length > 0 && (
        <div style={{ background: '#0a1628', border: '1px solid #1e3a5c', borderRadius: 10, padding: '10px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: '#64B4FF', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>📦 RESUMO DIA:</span>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
              {resumoItens.filter(i => (i.qty_pendente || 0) > 0).map(i => (
                <span key={i.item_code} style={{ fontSize: 12 }}>
                  <span style={{ color: '#e8f0fe', fontWeight: 700 }}>{i.qty_pendente}x {i.item_name}</span>
                  <span style={{ color: '#90afd4' }}> ({(i.peso_pendente || 0).toFixed(0)}kg)</span>
                </span>
              ))}
            </div>
            {resumoItens.some(i => (i.qty_em_rota || 0) > 0) && (
              <span style={{ fontSize: 11, color: '#64B4FF', whiteSpace: 'nowrap' }}>
                🚛 Em rota: {resumoItens.reduce((s, i) => s + (i.qty_em_rota || 0), 0)} un
              </span>
            )}
            {resumoItens.some(i => (i.qty_entregue || 0) > 0) && (
              <span style={{ fontSize: 11, color: '#10b981', whiteSpace: 'nowrap' }}>
                ✅ Entregues: {resumoItens.reduce((s, i) => s + (i.qty_entregue || 0), 0)} un
              </span>
            )}
          </div>
        </div>
      )}
      {/* Pendente por TOP */}
      {(() => {
        const pendentes = pedidos.filter(p => p.status === 'pending');
        const tops = ['1000','1009','1007','1008','1010'];
        const resumo = {};
        pendentes.forEach(p => {
          const t = p.order_type || '1000';
          if (!resumo[t]) resumo[t] = { peso: 0, qtd: 0 };
          resumo[t].peso += parseFloat(p.weight_kg) || 0;
          resumo[t].qtd += 1;
        });
        const topAtivos = tops.filter(t => resumo[t]);
        if (topAtivos.length === 0) return null;
        return (
          <div style={{ background: '#0a1628', border: '1px solid rgba(100,180,255,0.2)', borderRadius: 10, padding: '8px 16px', marginBottom: 12 }}>
            <span style={{ color: '#64B4FF', fontWeight: 700, fontSize: 11, marginRight: 12 }}>📊 PENDENTE POR TOP:</span>
            {topAtivos.map(t => (
              <span key={t} style={{ marginRight: 16, fontSize: 12 }}>
                <span style={{ color: TOP_CORES[t] || '#90afd4', fontWeight: 700 }}>{TOP_LABELS[t] || t}</span>
                <span style={{ color: '#90afd4' }}> {resumo[t].qtd} ped · {resumo[t].peso.toFixed(0)}kg</span>
              </span>
            ))}
          </div>
        );
      })()}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#90afd4' }} />
          <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Cliente, pedido, endereço..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 140 }} value={filtroRegiao} onChange={e => setFiltroRegiao(e.target.value)}>
          <option value="">Região — Todas</option>
          {regioes.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-control" style={{ width: 120 }} value={filtroTop} onChange={e => setFiltroTop(e.target.value)}>
          <option value="">TOP — Todos</option>
          {Object.entries(TOP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="form-control" style={{ width: 130 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Status — Todos</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="form-control" style={{ width: 100 }} value={limite} onChange={e => setLimite(parseInt(e.target.value))}>
          {[50, 100, 200, 500].map(l => <option key={l} value={l}>Limite {l}</option>)}
        </select>
        <span style={{ color: '#90afd4', fontSize: 12, whiteSpace: 'nowrap' }}>
          {filtrados.length} pedidos · {pesoTotal.toFixed(0)} kg
        </span>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={Object.keys(selecionados).length === filtrados.length && filtrados.length > 0}
                    onChange={toggleTodos} style={{ cursor: 'pointer', accentColor: '#e8521a' }} />
                </th>
                <th>Nº Pedido</th><th>Cliente</th><th>Endereço / Zona</th>
                <th>Peso (kg)</th><th>Valor (R$)</th><th>TOP</th><th>T. ATEND.</th><th>GPS</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Nenhum pedido encontrado</td></tr>
              ) : filtrados.map(p => {
                const topLabel = TOP_LABELS[p.order_type] || p.order_type || '—';
                const topCor = TOP_CORES[p.order_type] || '#90afd4';
                return (
                  <tr key={p.id} style={{ background: selecionados[p.id] ? 'rgba(232,82,26,.05)' : '' }}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={!!selecionados[p.id]} onChange={() => toggleSel(p.id)}
                        style={{ cursor: 'pointer', accentColor: '#e8521a' }} />
                    </td>
                    <td style={{ fontFamily: 'monospace', color: '#64B4FF', fontSize: 12 }}>{p.external_id || p.id?.slice(0, 8)}</td>
                    <td style={{ fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.recipient_name || '—'}</td>
                    <td style={{ color: '#90afd4', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address || '—'}</td>
                    <td style={{ color: '#f59e0b', fontWeight: 600 }}>{parseFloat(p.weight_kg || 0).toFixed(0)}</td>
                    <td style={{ fontSize: 12 }}>{p.total_value ? `R$ ${parseFloat(p.total_value).toFixed(2)}` : '—'}</td>
                    <td><span style={{ fontSize: 11, fontWeight: 700, color: topCor }}>{topLabel}</span></td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{p.service_time ? `${p.service_time} min` : '—'}</td>
                    <td style={{ color: p.lat && p.lng ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: 700 }}>{p.lat && p.lng ? 'OK' : '—'}</td>
                    <td><span className={`badge ${p.status || 'pending'}`}>{STATUS_LABELS[p.status] || p.status}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalPedido(p)}>Ver</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalPedido && <ModalPedido pedido={modalPedido} onFechar={() => setModalPedido(null)} />}
    </div>
  );
}
