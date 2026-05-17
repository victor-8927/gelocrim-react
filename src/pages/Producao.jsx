import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Plus, X } from 'lucide-react';

const GELO_TIPOS = [
  { nome: '5 kg', un_pallet: 180 },
  { nome: '10 kg', un_pallet: 110 },
  { nome: '20 kg', un_pallet: 50 },
  { nome: '40 kg', un_pallet: 27 },
];

export default function Producao() {
  const [tab, setTab] = useState('pallet');
  const [pallets, setPallets] = useState([]);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPallet, setModalPallet] = useState(false);
  const [modalItem, setModalItem] = useState(false);
  const [modalCarregado, setModalCarregado] = useState(false);
  const [formPallet, setFormPallet] = useState({ name: '', length: '', width: '', height: '', max_weight: '', cubagem: '', notes: '' });
  const [formItem, setFormItem] = useState({ name: '', weight_kg: '', length: '', width: '', height: '', cubagem: '', notes: '' });
  const [palletSel, setPalletSel] = useState('');
  const [itemSel, setItemSel] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([
        api.get('/producao/pallets').catch(() => []),
        api.get('/producao/itens').catch(() => [])
      ]);
      setPallets(Array.isArray(p) ? p : []);
      setItens(Array.isArray(i) ? i : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const salvarPallet = async () => {
    if (!formPallet.name) return alert('Nome obrigatorio');
    try {
      await api.post('/producao/pallets', formPallet);
      setModalPallet(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  const salvarItem = async () => {
    if (!formItem.name || !formItem.weight_kg) return alert('Nome e peso obrigatorios');
    try {
      await api.post('/producao/itens', formItem);
      setModalItem(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  // Calculos automaticos do pallet carregado
  const palletObj = pallets.find(p => p.id === palletSel);
  const itemObj = itens.find(i => i.id === itemSel);
  const calcUn = palletObj && itemObj ? Math.floor((parseFloat(palletObj.cubagem) || 0) / (parseFloat(itemObj.cubagem) || 1)) : 0;
  const calcPeso = palletObj && itemObj ? ((parseFloat(palletObj.max_weight) || 0) + calcUn * (parseFloat(itemObj.weight_kg) || 0)).toFixed(1) : 0;
  const calcCub = palletObj && itemObj ? ((parseFloat(palletObj.cubagem) || 0) + calcUn * (parseFloat(itemObj.cubagem) || 0)).toFixed(3) : 0;

  const tabStyle = (t) => ({
    padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: tab === t ? '#e8521a' : '#1e3a5c', color: tab === t ? '#fff' : '#90afd4'
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Producao</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Cadastro de pallets e itens de gelo</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={() => { setModalPallet(true); setFormPallet({ name: '', length: '', width: '', height: '', max_weight: '', cubagem: '', notes: '' }); }}>
            <Plus size={14} /> Novo Pallet
          </button>
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
            🪵 Pallets Cadastrados
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Comp. (m)</th><th>Larg. (m)</th><th>Alt. (m)</th>
                <th>Cubagem (m³)</th><th>Peso Max. (kg)</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Carregando...</td></tr>
              ) : pallets.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Nenhum pallet cadastrado</td></tr>
              ) : pallets.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.length || p.box_length || '—'}</td>
                  <td>{p.width || p.box_width || '—'}</td>
                  <td>{p.height || p.box_height || '—'}</td>
                  <td style={{ color: '#64B4FF' }}>{p.cubagem || '—'} m³</td>
                  <td style={{ color: '#f59e0b' }}>{p.max_weight || '—'} kg</td>
                  <td><span className="badge active">Ativo</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Itens de Gelo */}
      {tab === 'gelo' && (
        <div>
          {/* Tipos fixos de gelo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {GELO_TIPOS.map(g => (
              <div key={g.nome} className="card" style={{ textAlign: 'center', borderTop: '3px solid #64B4FF' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🧊</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{g.nome}</div>
                <div style={{ color: '#64B4FF', fontSize: 14, marginTop: 4 }}>{g.un_pallet} un/pallet</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>🧊 Itens de Gelo</span>
              <button className="btn btn-primary btn-sm" onClick={() => { setModalItem(true); setFormItem({ name: '', weight_kg: '', length: '', width: '', height: '', cubagem: '', notes: '' }); }}>
                <Plus size={12} /> Novo Item
              </button>
            </div>
            <table>
              <thead>
                <tr><th>Item</th><th>Peso (kg)</th><th>Dimensoes (m)</th><th>Cubagem (m³)</th><th>Observacao</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Carregando...</td></tr>
                ) : itens.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Nenhum item cadastrado</td></tr>
                ) : itens.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.name || i.nome}</td>
                    <td style={{ color: '#f59e0b' }}>{i.weight_kg || i.peso_kg || '—'} kg</td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{i.length && i.width && i.height ? `${i.length}x${i.width}x${i.height}` : '—'}</td>
                    <td style={{ color: '#64B4FF' }}>{i.cubagem || '—'} m³</td>
                    <td style={{ fontSize: 12, color: '#90afd4' }}>{i.notes || i.observacao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Pallet Carregado */}
      {tab === 'carregado' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f97316', marginBottom: 16, textTransform: 'uppercase' }}>Configurar Pallet Carregado</h3>
            <div className="form-group">
              <label className="form-label">Pallet Base</label>
              <select className="form-control" value={palletSel} onChange={e => setPalletSel(e.target.value)}>
                <option value="">— Selecione o pallet —</option>
                {pallets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Item de Gelo</label>
              <select className="form-control" value={itemSel} onChange={e => setItemSel(e.target.value)}>
                <option value="">— Selecione o item —</option>
                {itens.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64B4FF', marginBottom: 16, textTransform: 'uppercase' }}>Calculos Automaticos</h3>
            {[
              { label: 'Unidades/Pallet', value: calcUn || '—', color: '#f97316' },
              { label: 'Peso Total (kg)', value: calcPeso ? `${calcPeso} kg` : '—', color: '#f59e0b' },
              { label: 'Cubagem Total (m³)', value: calcCub ? `${calcCub} m³` : '—', color: '#64B4FF' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e3a5c' }}>
                <span style={{ color: '#90afd4', fontSize: 13 }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700, fontSize: 16 }}>{item.value}</span>
              </div>
            ))}
            {palletSel && itemSel && (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
                Salvar Configuracao
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Pallet */}
      {modalPallet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModalPallet(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 480 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>🪵 Novo Pallet</span>
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
                <div className="form-group">
                  <label className="form-label">Cubagem (m³)</label>
                  <input className="form-control" type="number" step="0.001" value={formPallet.cubagem} onChange={e => setFormPallet(f => ({...f, cubagem: e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observacoes</label>
                  <textarea className="form-control" rows={2} value={formPallet.notes} onChange={e => setFormPallet(f => ({...f, notes: e.target.value}))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModalPallet(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarPallet}>Salvar Pallet</button>
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
              <span style={{ fontWeight: 700 }}>🧊 Novo Item de Gelo</span>
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
                  <input className="form-control" type="number" step="0.001" value={formItem.cubagem} onChange={e => setFormItem(f => ({...f, cubagem: e.target.value}))} />
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
                <button className="btn btn-primary" onClick={salvarItem}>Salvar Item</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
