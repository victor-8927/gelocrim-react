import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Plus, X } from 'lucide-react';

const TIPOS = [
  { val: 'caminhao_toco', label: 'Caminhão Toco' },
  { val: 'caminhao_truck', label: 'Caminhão Truck' },
  { val: 'cavalo', label: 'Cavalo Mecânico' },
  { val: 'container', label: 'Container' },
  { val: 'accelo', label: 'Accelo' },
  { val: 'muck', label: 'Muck' },
  { val: 'hr', label: 'HR / Van' },
  { val: 'van', label: 'Van' },
  { val: 'carro', label: 'Carro' },
];

const FORM_VAZIO = {
  name: '', plate: '', model: '', type: 'caminhao_toco', brand: '', year: '',
  capacity_kg: '', capacity_m3: '', cap_pallets: '',
  box_length: '', box_width: '', box_height: '',
  fuel_type: 'diesel', fuel_consumption: '', fuel_price: '',
  ipva_anual: '', manut_mes: '', oil_last: '', oil_next: '', oil_cost: '',
  status: 'active', notes: ''
};

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [itensGelo, setItensGelo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [v, i] = await Promise.all([
        api.get('/vehicles'),
        api.get('/producao/itens').catch(() => [])
      ]);
      setVeiculos(Array.isArray(v) ? v : []);
      setItensGelo(Array.isArray(i) ? i : []);
    } catch { setVeiculos([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const abrirNovo = () => { setEditId(null); setForm(FORM_VAZIO); setModal(true); };

  const abrirEditar = (v) => {
    setEditId(v.id);
    setForm({
      name: v.name || '', plate: v.plate || '', model: v.model || '',
      type: v.type || 'caminhao_toco', brand: v.brand || '', year: v.year || '',
      capacity_kg: v.capacity_kg || '', capacity_m3: v.capacity_m3 || '',
      cap_pallets: v.cap_pallets || v.pallets || '',
      box_length: v.box_length || '', box_width: v.box_width || '', box_height: v.box_height || '',
      fuel_type: v.fuel_type || 'diesel', fuel_consumption: v.fuel_consumption || '',
      fuel_price: v.fuel_price || '',
      ipva_anual: v.ipva_anual || '', manut_mes: v.manut_mes || '',
      oil_last: v.oil_last || '', oil_next: v.oil_next || '', oil_cost: v.oil_cost || '',
      status: v.status || 'active', notes: v.notes || ''
    });
    setModal(true);
  };

  const salvar = async () => {
    if (!form.name || !form.plate) return alert('Nome e placa obrigatórios');
    setSalvando(true);
    // Calcular cubagem do baú automaticamente
    const payload = { ...form };
    if (form.box_length && form.box_width && form.box_height && !form.capacity_m3) {
      payload.capacity_m3 = (parseFloat(form.box_length) * parseFloat(form.box_width) * parseFloat(form.box_height)).toFixed(3);
    }
    try {
      if (editId) await api.patch(`/vehicles/${editId}`, payload).catch(() => api.put(`/vehicles/${editId}`, payload));
      else await api.post('/vehicles', payload);
      setModal(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
    finally { setSalvando(false); }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir este veículo?')) return;
    try { await api.delete(`/vehicles/${id}`); load(); }
    catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  // Calculos baú
  const cubagem = form.box_length && form.box_width && form.box_height
    ? (parseFloat(form.box_length) * parseFloat(form.box_width) * parseFloat(form.box_height)).toFixed(3)
    : form.capacity_m3 || '—';
  const pallets = parseInt(form.cap_pallets) || 0;

  // Calculos capacidade por item de gelo
  const calcItens = itensGelo.map(item => {
    const volPallet = parseFloat(form.box_length || 0) * parseFloat(form.box_width || 0) * parseFloat(item.height || item.box_height || 0);
    const volItem = parseFloat(item.length || 0) * parseFloat(item.width || 0) * parseFloat(item.height || 0);
    const unPallet = volItem > 0 ? Math.floor(volPallet / volItem) : 0;
    const pesoItem = parseFloat(item.weight_kg || item.peso_kg || 0);
    const pesoPallet = parseFloat(form.cap_pallets ? parseInt(form.cap_pallets) * 1300 : 0);
    return {
      nome: item.name || item.nome,
      unPallet,
      pallets,
      totalUn: unPallet * pallets,
      pesoTotal: Math.round(pesoPallet + (unPallet * pallets * pesoItem))
    };
  });

  // Custo dia estimado
  const ipvaDia = parseFloat(form.ipva_anual || 0) / 365;
  const manutDia = parseFloat(form.manut_mes || 0) / 22;
  const custoDia = (ipvaDia + manutDia).toFixed(2);

  const ativos = veiculos.filter(v => v.status === 'active').length;
  const manut = veiculos.filter(v => v.status === 'maintenance').length;
  const inativos = veiculos.filter(v => v.status === 'inactive').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestão de Veículos</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>{veiculos.length} veículos cadastrados · {ativos} ativos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} /> Novo Veículo</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: veiculos.length, color: '#64B4FF' },
          { label: 'Ativos', value: ativos, color: '#10b981' },
          { label: 'Manutenção', value: manut, color: '#f59e0b' },
          { label: 'Inativos', value: inativos, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>VDA</th><th>Placa</th><th>Modelo</th><th>Tipo</th>
                <th>Cap. Peso</th><th>Volume</th><th>Pallets</th>
                <th>Combustível</th><th>KM/L</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Carregando...</td></tr>
              ) : veiculos.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Nenhum veículo</td></tr>
              ) : veiculos.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700, color: '#e8521a' }}>{v.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64B4FF' }}>{v.plate}</td>
                  <td style={{ fontSize: 12 }}>{v.model || '—'}</td>
                  <td style={{ fontSize: 11, color: '#90afd4' }}>{TIPOS.find(t => t.val === v.type)?.label || v.type || '—'}</td>
                  <td style={{ color: '#f59e0b', fontWeight: 600 }}>{v.capacity_kg ? `${v.capacity_kg}kg` : '—'}</td>
                  <td style={{ fontSize: 12 }}>{v.capacity_m3 ? `${v.capacity_m3}m³` : '—'}</td>
                  <td style={{ fontSize: 12 }}>{v.cap_pallets || v.pallets || '—'}</td>
                  <td style={{ fontSize: 12 }}>{v.fuel_type || '—'}</td>
                  <td style={{ fontSize: 12 }}>{v.fuel_consumption ? `${v.fuel_consumption} km/L` : '—'}</td>
                  <td>
                    <span className={`badge ${v.status === 'active' ? 'active' : v.status === 'maintenance' ? '' : 'inactive'}`}
                      style={v.status === 'maintenance' ? { background: 'rgba(245,158,11,.2)', color: '#f59e0b' } : {}}>
                      {v.status === 'active' ? 'Ativo' : v.status === 'maintenance' ? 'Manutenção' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(v)}>✏️ Editar</button>
                      <button onClick={() => excluir(v.id)} style={{ background: 'rgba(239,68,68,.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{editId ? `✏️ Editar — ${form.name}` : '+ Novo Veículo'}</span>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Identificação */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>🚛 IDENTIFICAÇÃO</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">VDA (Nome do Veículo) *</label>
                    <input className="form-control" value={form.name} onChange={f('name')} placeholder="Ex: VDA 01" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Placa *</label>
                    <input className="form-control" value={form.plate} onChange={f('plate')} placeholder="Ex: NOU 8H02" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Modelo *</label>
                    <input className="form-control" value={form.model} onChange={f('model')} placeholder="Ex: WV.13.190 CRM 4X2" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo</label>
                    <select className="form-control" value={form.type} onChange={f('type')}>
                      {TIPOS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Marca</label>
                    <input className="form-control" value={form.brand} onChange={f('brand')} placeholder="Ex: Volkswagen" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ano</label>
                    <input className="form-control" value={form.year} onChange={f('year')} placeholder="Ex: 2020" />
                  </div>
                </div>
              </div>

              {/* Capacidade */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📦 CAPACIDADE</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Capacidade Peso (kg)</label>
                    <input className="form-control" type="number" value={form.capacity_kg} onChange={f('capacity_kg')} placeholder="Ex: 6685" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacidade Volume (m³)</label>
                    <input className="form-control" type="number" step="0.01" value={form.capacity_m3} onChange={f('capacity_m3')} placeholder="Auto-calc." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qtd. Pallets</label>
                    <input className="form-control" type="number" value={form.cap_pallets} onChange={f('cap_pallets')} placeholder="Ex: 10" />
                  </div>
                </div>
              </div>

              {/* Dimensões */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📐 DIMENSÕES DO BAÚ (metros)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Comprimento (m)</label>
                    <input className="form-control" type="number" step="0.01" value={form.box_length} onChange={f('box_length')} placeholder="Ex: 6.5" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Largura (m)</label>
                    <input className="form-control" type="number" step="0.01" value={form.box_width} onChange={f('box_width')} placeholder="Ex: 2.46" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Altura (m)</label>
                    <input className="form-control" type="number" step="0.01" value={form.box_height} onChange={f('box_height')} placeholder="Ex: 2.2" />
                  </div>
                </div>
                {form.box_length && form.box_width && form.box_height && (
                  <div style={{ fontSize: 12, color: '#64B4FF', marginTop: 6 }}>
                    Cubagem do baú: {cubagem} m³ {pallets > 0 ? `| ${pallets} pallets (1.1x1.1m cada)` : ''}
                  </div>
                )}
                {/* Tabela capacidade por item */}
                {calcItens.length > 0 && pallets > 0 && form.box_length && (
                  <div style={{ marginTop: 12, overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: '#90afd4' }}>Tipo</th>
                          <th style={{ padding: '6px 8px', color: '#90afd4' }}>Un/Pallet</th>
                          <th style={{ padding: '6px 8px', color: '#90afd4' }}>Pallets</th>
                          <th style={{ padding: '6px 8px', color: '#90afd4' }}>Total Un.</th>
                          <th style={{ padding: '6px 8px', color: '#90afd4' }}>Peso Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calcItens.map(it => (
                          <tr key={it.nome}>
                            <td style={{ padding: '5px 8px', color: '#e8f0fe' }}>{it.nome}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', color: '#64B4FF' }}>{it.unPallet} un/pallet</td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{it.pallets} pallets</td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', color: '#f59e0b' }}>{it.totalUn} un total</td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', color: '#10b981' }}>{it.pesoTotal} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Combustível */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>⛽ COMBUSTÍVEL E CONSUMO</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Tipo de Combustível</label>
                    <select className="form-control" value={form.fuel_type} onChange={f('fuel_type')}>
                      <option value="diesel">Diesel</option>
                      <option value="gasolina">Gasolina</option>
                      <option value="flex">Flex</option>
                      <option value="eletrico">Elétrico</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Consumo (KM/Litro)</label>
                    <input className="form-control" type="number" step="0.1" value={form.fuel_consumption} onChange={f('fuel_consumption')} placeholder="Ex: 3" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preço Combustível (R$/L)</label>
                    <input className="form-control" type="number" step="0.01" value={form.fuel_price} onChange={f('fuel_price')} placeholder="Ex: 7.59" />
                  </div>
                </div>
              </div>

              {/* Custos fixos */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>💰 CUSTOS FIXOS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">IPVA Anual (R$)</label>
                    <input className="form-control" type="number" step="0.01" value={form.ipva_anual} onChange={f('ipva_anual')} placeholder="Ex: 3600" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custo Manutenção/Mês (R$)</label>
                    <input className="form-control" type="number" step="0.01" value={form.manut_mes} onChange={f('manut_mes')} placeholder="Ex: 1500" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custo/Dia estimado (R$)</label>
                    <input className="form-control" value={custoDia} readOnly style={{ opacity: 0.7 }} />
                  </div>
                </div>
              </div>

              {/* Manutenção */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>🔧 MANUTENÇÃO</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Última troca de óleo</label>
                    <input className="form-control" type="date" value={form.oil_last} onChange={f('oil_last')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Próxima troca de óleo</label>
                    <input className="form-control" type="date" value={form.oil_next} onChange={f('oil_next')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custo da troca (R$)</label>
                    <input className="form-control" type="number" step="0.01" value={form.oil_cost} onChange={f('oil_cost')} placeholder="Ex: 450" />
                  </div>
                </div>
              </div>

              {/* Status e obs */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📋 STATUS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={form.status} onChange={f('status')}>
                      <option value="active">Ativo</option>
                      <option value="maintenance">Manutenção</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Observações</label>
                    <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : '💾 Salvar Veículo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
