import React, { useEffect, useState } from 'react';
import { getPallets, upsertPallet, getProductionItems, upsertProductionItem } from '../services/supabase';
import { RefreshCw, Plus, X, Edit } from 'lucide-react';

export default function Producao() {
  const [tab, setTab] = useState('pallet');
  const [pallets, setPallets] = useState([]);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPallet, setModalPallet] = useState(false);
  const [modalItem, setModalItem] = useState(false);
  const [editPallet, setEditPallet] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [formPallet, setFormPallet] = useState({ name: '', length: '', width: '', height: '', max_weight: '', cubagem: '', notes: '' });
  const [formItem, setFormItem] = useState({ name: '', weight_kg: '', length: '', width: '', height: '', cubagem: '', notes: '' });
  const [palletSel, setPalletSel] = useState('');
  const [itemSel, setItemSel] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([
        getPallets(),
        getProductionItems()
      ]);
      setPallets(Array.isArray(p) ? p : []);
      setItens(Array.isArray(i) ? i : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const abrirModalPallet = (p = null) => {
    setEditPallet(p);
    setFormPallet(p ? {
      name: p.name || '',
      length: p.length || p.box_length || '',
      width: p.width || p.box_width || '',
      height: p.height || p.box_height || '',
      max_weight: p.max_weight || p.capacity_kg || '',
      cubagem: p.cubagem || '',
      notes: p.notes || ''
    } : { name: '', length: '', width: '', height: '', max_weight: '', cubagem: '', notes: '' });
    setModalPallet(true);
  };

  const abrirModalItem = (i = null) => {
    setEditItem(i);
    setFormItem(i ? {
      name: i.name || i.nome || '',
      weight_kg: i.weight_kg || i.peso_kg || '',
      length: i.length || '',
      width: i.width || '',
      height: i.height || '',
      cubagem: i.cubagem || '',
      notes: i.notes || i.observacao || ''
    } : { name: '', weight_kg: '', length: '', width: '', height: '', cubagem: '', notes: '' });
    setModalItem(true);
  };

  const salvarPallet = async () => {
    if (!formPallet.name) return alert('Nome obrigatorio');
    // Calcular cubagem automaticamente se não informada
    const payload = { ...formPallet };
    if (!payload.cubagem && payload.length && payload.width && payload.height) {
      payload.cubagem = (parseFloat(payload.length) * parseFloat(payload.width) * parseFloat(payload.height)).toFixed(4);
    }
    try {
      if (editPallet) payload.id = editPallet.id;
      await upsertPallet(payload);
      setModalPallet(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  const salvarItem = async () => {
    if (!formItem.name || !formItem.weight_kg) return alert('Nome e peso obrigatorios');
    const payload = { ...formItem };
    if (!payload.cubagem && payload.length && payload.width && payload.height) {
      payload.cubagem = (parseFloat(payload.length) * parseFloat(payload.width) * parseFloat(payload.height)).toFixed(4);
    }
    try {
      if (editItem) payload.id = editItem.id;
      // Mapear campos para o banco
      payload.weight = parseFloat(payload.weight_kg || payload.weight || 0);
      await upsertProductionItem(payload);
      setModalItem(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  // Calculos pallet carregado
  const palletObj = pallets.find(p => p.id === palletSel);
  const itemObj = itens.find(i => i.id === itemSel);

  const calcUnidades = () => {
    if (!palletObj || !itemObj) return 0;
    const volPallet = parseFloat(palletObj.cubagem) || 0;
    const volItem = parseFloat(itemObj.cubagem) || 0;
    if (volItem <= 0) return 0;
    return Math.floor(volPallet / volItem);
  };

  const unidades = calcUnidades();
  const pesoPallet = parseFloat(palletObj?.max_weight || palletObj?.capacity_kg || 0);
  const pesoItem = parseFloat(itemObj?.weight || itemObj?.weight_kg || itemObj?.peso_kg || 0);
  const pesoTotal = pesoPallet + (unidades * pesoItem);
  const volPallet = parseFloat(palletObj?.cubagem || 0);
  const volItem = parseFloat(itemObj?.cubagem || 0);
  const volTotal = volPallet + (unidades * volItem);
  const altPallet = parseFloat(palletObj?.height || palletObj?.box_height || 0);
  const altItem = parseFloat(itemObj?.height || 0);
  const altTotal = altPallet + (unidades > 0 ? altItem : 0);

  const tabStyle = (t) => ({
    padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: tab === t ? '#e8521a' : '#1e3a5c', color: tab === t ? '#fff' : '#90afd4'
  });

  const getField = (obj, ...keys) => {
    for (const k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]; }
    return '—';
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Producao</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Cadastro de pallets e itens de gelo</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          {tab === 'pallet' && <button className="btn btn-primary" onClick={() => abrirModalPallet()}><Plus size={14} /> Novo Pallet</button>}
          {tab === 'gelo' && <button className="btn btn-primary" onClick={() => abrirModalItem()}><Plus size={14} /> Novo Item</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabStyle('pallet')} onClick={() => setTab('pallet')}>🪵 Pallets</button>
        <button style={tabStyle('gelo')} onClick={() => setTab('gelo')}>🧊 Itens de Gelo</button>
        <button style={tabStyle('carregado')} onClick={() => setTab('carregado')}>📦 Pallet Carregado</button>
      </div>

      {/* Tab Pallets */}
      {tab === 'pallet' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e3a5c', fontWeight: 700, fontSize: 13, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>
            🪵 PALLETS CADASTRADOS
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Comprimento (m)</th><th>Largura (m)</th><th>Altura (m)</th>
                <th>Cubagem (m³)</th><th>Peso Max. (kg)</th><th>Status</th><th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Carregando...</td></tr>
              ) : pallets.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Nenhum pallet cadastrado</td></tr>
              ) : pallets.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{getField(p, 'name', 'nome')}</td>
                  <td>{getField(p, 'length', 'box_length', 'comprimento')}</td>
                  <td>{getField(p, 'width', 'box_width', 'largura')}</td>
                  <td>{getField(p, 'height', 'box_height', 'altura')}</td>
                  <td style={{ color: '#64B4FF' }}>{getField(p, 'cubagem')} m³</td>
                  <td style={{ color: '#f59e0b' }}>{getField(p, 'max_weight', 'capacity_kg', 'peso_max')} kg</td>
                  <td><span className="badge active">Ativo</span></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => abrirModalPallet(p)}><Edit size={12} /> Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Itens de Gelo */}
      {tab === 'gelo' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e3a5c', fontWeight: 700, fontSize: 13, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>
            🧊 ITENS DE GELO
          </div>
          <table>
            <thead>
              <tr><th>Item</th><th>Peso (kg)</th><th>Dimensoes (m)</th><th>Cubagem (m³)</th><th>Observacao</th><th>Acoes</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Carregando...</td></tr>
              ) : itens.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Nenhum item cadastrado</td></tr>
              ) : itens.map(i => {
                const l = getField(i, 'length', 'comprimento');
                const w = getField(i, 'width', 'largura');
                const h = getField(i, 'height', 'altura');
                const dims = l !== '—' && w !== '—' && h !== '—' ? `${l}x${w}x${h} m` : '—';
                return (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{getField(i, 'name', 'nome')}</td>
                    <td style={{ color: '#f59e0b' }}>{getField(i, 'weight_kg', 'peso_kg', 'peso')} kg</td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{dims}</td>
                    <td style={{ color: '#64B4FF' }}>{getField(i, 'cubagem')} m³</td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{getField(i, 'notes', 'observacao')}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => abrirModalItem(i)}><Edit size={12} /> Editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Pallet Carregado */}
      {tab === 'carregado' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Configurar</div>
              <div className="form-group">
                <label className="form-label">Pallet Base</label>
                <select className="form-control" value={palletSel} onChange={e => setPalletSel(e.target.value)}>
                  <option value="">— Selecione o pallet —</option>
                  {pallets.map(p => <option key={p.id} value={p.id}>{getField(p, 'name', 'nome')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Item de Gelo</label>
                <select className="form-control" value={itemSel} onChange={e => setItemSel(e.target.value)}>
                  <option value="">— Selecione o item —</option>
                  {itens.map(i => <option key={i.id} value={i.id}>{getField(i, 'name', 'nome')}</option>)}
                </select>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📊 Calculos Automaticos</div>
              {[
                { label: 'Unidades/Pallet', value: unidades || '—', color: '#f97316' },
                { label: 'Peso Total (kg)', value: pesoTotal > 0 ? `${pesoTotal.toFixed(0)} kg` : '—', color: '#f59e0b' },
                { label: 'Cubagem Total (m³)', value: volTotal > 0 ? `${volTotal.toFixed(3)} m³` : '—', color: '#64B4FF' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e3a5c' }}>
                  <span style={{ color: '#90afd4', fontSize: 13 }}>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: 700, fontSize: 16 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cards de pallets carregados */}
          {palletObj && itemObj && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              <div className="card" style={{ borderTop: '3px solid #64B4FF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>🧊</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{getField(itemObj, 'name', 'nome')}</div>
                    <div style={{ fontSize: 11, color: '#90afd4' }}>PALLET + {unidades} unidades</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12, textAlign: 'center' }}>
                  <div style={{ background: '#0a1628', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#64B4FF' }}>{unidades}</div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>un/pallet</div>
                  </div>
                  <div style={{ background: '#0a1628', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{pesoTotal.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>kg total</div>
                  </div>
                  <div style={{ background: '#0a1628', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>{volTotal.toFixed(3)}</div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>m³ total</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#90afd4', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>📦 Pallet: {getField(palletObj, 'length', 'box_length')}x{getField(palletObj, 'width', 'box_width')}x{getField(palletObj, 'height', 'box_height')} m</span>
                  <span>🧊 Item: {getField(itemObj, 'length')}x{getField(itemObj, 'width')}x{getField(itemObj, 'height')} m</span>
                  <span>⚖️ Peso unit.: {getField(itemObj, 'weight_kg', 'peso_kg')} kg</span>
                  <span>📐 Alt total: {altTotal.toFixed(2)} m</span>
                </div>
              </div>
            </div>
          )}

          {(!palletObj || !itemObj) && (
            <div className="card" style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>
              Selecione um pallet e um item para ver os calculos
            </div>
          )}
        </div>
      )}

      {/* Modal Pallet */}
      {modalPallet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModalPallet(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 480 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>🪵 {editPallet ? 'Editar Pallet' : 'Novo Pallet'}</span>
              <button onClick={() => setModalPallet(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome *</label>
                  <input className="form-control" value={formPallet.name} onChange={e => setFormPallet(f => ({...f, name: e.target.value}))} placeholder="Ex: Pallet PBR" />
                </div>
                <div className="form-group">
                  <label className="form-label">Comprimento (m)</label>
                  <input className="form-control" type="number" step="0.01" value={formPallet.length} onChange={e => setFormPallet(f => ({...f, length: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Largura (m)</label>
                  <input className="form-control" type="number" step="0.01" value={formPallet.width} onChange={e => setFormPallet(f => ({...f, width: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Altura (m)</label>
                  <input className="form-control" type="number" step="0.01" value={formPallet.height} onChange={e => setFormPallet(f => ({...f, height: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Peso Maximo (kg)</label>
                  <input className="form-control" type="number" value={formPallet.max_weight} onChange={e => setFormPallet(f => ({...f, max_weight: e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Cubagem (m³) — calculada automaticamente se vazio</label>
                  <input className="form-control" type="number" step="0.0001" value={formPallet.cubagem} onChange={e => setFormPallet(f => ({...f, cubagem: e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observacoes</label>
                  <textarea className="form-control" rows={2} value={formPallet.notes} onChange={e => setFormPallet(f => ({...f, notes: e.target.value}))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModalPallet(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarPallet}>💾 Salvar Pallet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Item */}
      {modalItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModalItem(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 480 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>🧊 {editItem ? 'Editar Item' : 'Novo Item de Gelo'}</span>
              <button onClick={() => setModalItem(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome do Item *</label>
                  <input className="form-control" value={formItem.name} onChange={e => setFormItem(f => ({...f, name: e.target.value}))} placeholder="Ex: Gelo 5kg" />
                </div>
                <div className="form-group">
                  <label className="form-label">Peso (kg) *</label>
                  <input className="form-control" type="number" step="0.1" value={formItem.weight_kg} onChange={e => setFormItem(f => ({...f, weight_kg: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cubagem (m³)</label>
                  <input className="form-control" type="number" step="0.0001" value={formItem.cubagem} onChange={e => setFormItem(f => ({...f, cubagem: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Comprimento (m)</label>
                  <input className="form-control" type="number" step="0.01" value={formItem.length} onChange={e => setFormItem(f => ({...f, length: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Largura (m)</label>
                  <input className="form-control" type="number" step="0.01" value={formItem.width} onChange={e => setFormItem(f => ({...f, width: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Altura (m)</label>
                  <input className="form-control" type="number" step="0.01" value={formItem.height} onChange={e => setFormItem(f => ({...f, height: e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observacao</label>
                  <textarea className="form-control" rows={2} value={formItem.notes} onChange={e => setFormItem(f => ({...f, notes: e.target.value}))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModalItem(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarItem}>💾 Salvar Item</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
