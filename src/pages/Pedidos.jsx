import React, { useEffect, useState } from 'react';
import { getOrders, supabase } from '../services/supabase';
import * as XLSX from 'xlsx';
import { RefreshCw, Search, X } from 'lucide-react';

const STATUS_LABELS = {
  pending: 'Pendente', routed: 'Roteirizado', delivered: 'Entregue', failed: 'Falha',
};

const TOP_LABELS = {
  '1000': 'Venda', '1007': 'Bonif.', '1008': 'Consig.', '1009': 'Troca', '1010': 'Pre-ped.',
};

const TOP_CORES = {
  '1000': '#10b981', '1009': '#64B4FF', '1007': '#a78bfa', '1010': '#f59e0b', '1008': '#f97316',
};

function ModalPedido({ pedido, onFechar, onRoteirizar }) {
  if (!pedido) return null;
  const topLabel = TOP_LABELS[pedido.order_type] || pedido.order_type || 'Venda';
  const topCor = TOP_CORES[pedido.order_type] || '#64B4FF';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
          <span style={{ fontWeight: 700 }}>Pedido {pedido.external_id || pedido.id?.slice(0, 8)}</span>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Cliente */}
          <div style={{ background: '#0a1628', borderRadius: 10, padding: 14, border: '1px solid #1e3a5c' }}>
            <div style={{ fontSize: 11, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>CLIENTE</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{pedido.recipient_name || '—'}</div>
            <div style={{ fontSize: 12, color: '#90afd4', marginTop: 2 }}>{pedido.address || '—'}</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 4 }}>COD: {pedido.codparc || '—'} | {pedido.district || '—'}</div>
          </div>

          {/* Identificação */}
          <div>
            <div style={{ fontSize: 11, color: '#64B4FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>IDENTIFICAÇÃO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Nº Pedido', value: pedido.external_id || pedido.id?.slice(0, 8), cor: '#64B4FF' },
                { label: 'Status', value: STATUS_LABELS[pedido.status] || pedido.status, cor: pedido.status === 'pending' ? '#f59e0b' : '#10b981' },
                { label: 'Entrega', value: pedido.delivery_date || pedido.date || '—', cor: '#e8f0fe' },
                { label: 'TOP', value: topLabel, cor: topCor },
              ].map(i => (
                <div key={i.label} style={{ background: '#0a1628', borderRadius: 8, padding: '8px 12px', border: '1px solid #1e3a5c' }}>
                  <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>{i.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: i.cor }}>{i.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pesos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'PESO BRUTO', value: `${parseFloat(pedido.weight_kg || 0).toFixed(0)} kg`, cor: '#f59e0b' },
              { label: 'ENTREGA', value: `${parseFloat(pedido.delivered_kg || 0).toFixed(0)} kg`, cor: '#10b981' },
              { label: 'VALOR', value: pedido.total_value ? `R$ ${parseFloat(pedido.total_value).toFixed(2)}` : '—', cor: '#a78bfa' },
            ].map(i => (
              <div key={i.label} style={{ background: '#0a1628', borderRadius: 8, padding: '10px', border: '1px solid #1e3a5c', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 4 }}>{i.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: i.cor }}>{i.value}</div>
              </div>
            ))}
          </div>

          {/* Mix por TOP */}
          <div>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>MIX POR TOP</div>
            <div style={{ background: '#0a1628', borderRadius: 10, padding: 12, border: '1px solid #1e3a5c' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                <span style={{ fontSize: 12, color: '#90afd4' }}>TOP {pedido.order_type || '1000'} — {topLabel}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: topCor }}>{parseFloat(pedido.weight_kg || 0).toFixed(0)} kg</span>
              </div>
              {(pedido.order_items || []).length > 0 ? (pedido.order_items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(30,58,92,.3)' }}>
                  <span style={{ fontSize: 12, color: '#e8f0fe' }}>{item.quantity || item.qty || 0}x {item.product_name || item.name || '—'}</span>
                  <span style={{ fontSize: 12, color: '#f59e0b' }}>{(parseFloat(item.weight_unit || 0) * parseFloat(item.qty || 1)).toFixed(0)} kg</span>
                </div>
              )) : (
                <div style={{ fontSize: 12, color: '#90afd4', padding: '6px 0' }}>Sem itens detalhados</div>
              )}
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onFechar}>Fechar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { onFechar(); onRoteirizar && onRoteirizar(pedido); }}>+ Roteirizar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroTop, setFiltroTop] = useState('');
  const [limite, setLimite] = useState(100);
  const [selecionados, setSelecionados] = useState({});
  const [modalPedido, setModalPedido] = useState(null);
  const [importando, setImportando] = useState(false);
  const [importLog, setImportLog] = useState([]);
  const [modalImportTipo, setModalImportTipo] = useState(null);

  const load = () => {
    setLoading(true);
    getOrders({ limit: 500 })
      .then(data => setPedidos(Array.isArray(data) ? data : []))
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

  const lerXLSX = async (file) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const headers = data[0].map(h => String(h).trim());
    const rows = data.slice(1).filter(r => r.some(c => c !== ''));
    return { headers, rows };
  };

  const importarCab = async (file) => {
    setImportando(true);
    setImportLog(['📋 Lendo planilha Cab...']);
    try {
      const { headers, rows } = await lerXLSX(file);
      setImportLog(prev => [...prev, `${rows.length} notas encontradas`]);
      const idx = {};
      headers.forEach((h, i) => {
        const hl = h.toLowerCase();
        if (hl.includes('nro') && hl.includes('nico')) idx.nunota = i;
        else if (hl === 'parceiro') idx.codparc = i;
        else if (hl.includes('nome parceiro')) idx.nomeparc = i;
        else if (hl === 'peso') idx.peso = i;
        else if (hl.includes('vlr')) idx.vlrnota = i;
        else if (hl.includes('tipo opera')) idx.top = i;
        else if (hl.includes('dt.')) idx.dtneg = i;
        else if (hl.includes('observa')) idx.obs = i;
      });
      setImportLog(prev => [...prev, '✅ Colunas mapeadas']);
      const codparcs = [...new Set(rows.map(r => parseInt(r[idx.codparc]) || 0).filter(c => c > 0))];
      setImportLog(prev => [...prev, `🔍 Buscando ${codparcs.length} clientes...`]);
      const { data: clientes } = await supabase.from('clients').select('codparc,name,address,district,city,lat,lng,geo_zone,route,service_time').in('codparc', codparcs);
      const cliMap = {};
      (clientes || []).forEach(c => { cliMap[c.codparc] = c; });
      setImportLog(prev => [...prev, `✅ ${Object.keys(cliMap).length} clientes encontrados`]);
      const pedidos = rows.map((row, i) => {
        const nunota = String(row[idx.nunota] || '').trim();
        const codparc = parseInt(row[idx.codparc]) || null;
        const cli = cliMap[codparc] || {};
        const topVal = String(row[idx.top] || '1000').trim();
        const topLabel = topVal === '1000' ? 'Venda' : topVal === '1010' ? 'Troca' : topVal === '1020' ? 'Bonif.' : topVal === '1030' ? 'Pre-ped.' : topVal;
        return {
          id: `ord-${nunota}-${i}`,
          external_id: nunota,
          codparc,
          recipient_name: cli.name || String(row[idx.nomeparc] || '—').trim(),
          address: cli.address ? `${cli.address}${cli.district ? ', ' + cli.district : ''}` : String(row[idx.obs] || ''),
          lat: cli.lat ? parseFloat(cli.lat) : null,
          lng: cli.lng ? parseFloat(cli.lng) : null,
          region: cli.geo_zone || '',
          weight_kg: parseFloat(String(row[idx.peso] || '0').replace(',', '.')) || 0,
          total_value: parseFloat(String(row[idx.vlrnota] || '0').replace(',', '.')) || 0,
          order_type: topLabel,
          delivery_date: new Date().toISOString().slice(0, 10),
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }).filter(p => p.external_id);
      const comGps = pedidos.filter(p => p.lat && p.lng).length;
      setImportLog(prev => [...prev, `📍 ${comGps}/${pedidos.length} com GPS`]);
      const lotes = [];
      for (let i = 0; i < pedidos.length; i += 50) lotes.push(pedidos.slice(i, i + 50));
      const resultados = await Promise.all(lotes.map(lote => supabase.from('orders').upsert(lote, { onConflict: 'external_id' })));
      const erros = resultados.filter(r => r.error);
      const totalIns = pedidos.length - (erros.length * 50);
      if (erros.length) setImportLog(prev => [...prev, `⚠️ ${erros.length} lotes com erro`]);
      setImportLog(prev => [...prev, `🎉 ${totalIns} pedidos importados!`]);
      load();
    } catch (e) {
      setImportLog(prev => [...prev, `❌ ${e.message}`]);
    } finally { setImportando(false); }
  };

  const importarItens = async (file) => {
    setImportando(true);
    setImportLog(['📦 Lendo planilha de Itens...']);
    try {
      const { headers, rows } = await lerXLSX(file);
      const idx = {};
      headers.forEach((h, i) => {
        const hl = h.toLowerCase();
        if (hl.includes('nro') && hl.includes('nico')) idx.nunota = i;
        else if (hl.includes('item')) idx.item = i;
        else if (hl.includes('quantidade')) idx.qty = i;
        else if (hl.includes('top')) idx.top = i;
        else if (hl === 'parceiro') idx.codparc = i;
      });
      setImportLog(prev => [...prev, `${rows.length} itens encontrados`]);
      const todosItens = rows.filter(r => r[idx.nunota]).map((row, i) => {
        const itemStr = String(row[idx.item] || '');
        const itemName = itemStr.includes(' - ') ? itemStr.split(' - ').slice(1).join(' - ') : itemStr;
        const codparcStr = String(row[idx.codparc] || '');
        return {
          id: `oi-${row[idx.nunota]}-${i}`,
          invoice_number: String(row[idx.nunota]).trim(),
          codparc: parseInt(codparcStr.split(' - ')[0]) || null,
          item_name: itemName.trim(),
          qty: parseInt(row[idx.qty]) || 0,
          weight_unit: 0,
          top: String(row[idx.top] || '').split(' - ')[0] || '1000',
        };
      });
      const lotes = [];
      for (let i = 0; i < todosItens.length; i += 100) lotes.push(todosItens.slice(i, i + 100));
      const resultados = await Promise.all(lotes.map(lote => supabase.from('order_items').upsert(lote, { onConflict: 'id' })));
      const erros = resultados.filter(r => r.error);
      const totalItens = todosItens.length;
      if (erros.length) setImportLog(prev => [...prev, `⚠️ ${erros.length} lotes com erro`]);
      setImportLog(prev => [...prev, `🎉 ${totalItens} itens importados!`]);
      load();
    } catch (e) {
      setImportLog(prev => [...prev, `❌ ${e.message}`]);
    } finally { setImportando(false); }
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
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setModalImportTipo('cab')}>📥 Importar Cab</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setModalImportTipo('itens')}>📦 Importar Itens</button>
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

      {modalImportTipo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 520 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{modalImportTipo === 'cab' ? '📋 Importar Pedidos — Cab Sankhya' : '📦 Importar Itens — Sankhya'}</div>
              <div style={{ fontSize: 11, color: '#90afd4', marginTop: 2 }}>{modalImportTipo === 'cab' ? 'GPS e endereço buscados automaticamente do banco de clientes' : 'Vincula automaticamente aos pedidos pelo Nro. Único'}</div>
            </div>
            <div style={{ padding: 24 }}>
              {importLog.length > 0 && (
                <div style={{ background: '#0a1628', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, marginBottom: 16 }}>
                  {importLog.map((log, i) => (
                    <div key={i} style={{ color: log.startsWith('❌') ? '#ef4444' : log.startsWith('✅') || log.startsWith('🎉') ? '#10b981' : log.startsWith('🔍') || log.startsWith('📍') ? '#64B4FF' : '#90afd4', marginBottom: 3 }}>{log}</div>
                  ))}
                  {importando && <div style={{ color: '#64B4FF' }}>⏳ Processando...</div>}
                </div>
              )}
              {!importando && importLog.length === 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px dashed #1e3a5c', borderRadius: 12, padding: 32, cursor: 'pointer', marginBottom: 16 }}>
                  <span style={{ fontSize: 32, marginBottom: 8 }}>{modalImportTipo === 'cab' ? '📊' : '📦'}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Clique para selecionar o arquivo XLSX</span>
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) modalImportTipo === 'cab' ? importarCab(e.target.files[0]) : importarItens(e.target.files[0]); }} />
                </label>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => { setModalImportTipo(null); setImportLog([]); }}>Cancelar</button>
                {!importando && importLog.length > 0 && <button className="btn btn-primary" onClick={() => { setModalImportTipo(null); setImportLog([]); }}>Fechar</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
