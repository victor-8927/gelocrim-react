import React, { useEffect, useState } from 'react';
import { getVeiculos, createVeiculo, updateVeiculo, deleteVeiculo } from '../services/api';
import { RefreshCw, Plus, Edit, Trash2, X, Truck } from 'lucide-react';

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    name: '', plate: '', type: 'truck', capacity_kg: '', capacity_m3: '',
    fuel_type: 'diesel', fuel_consumption: '', year: '', brand: '', model: '',
    box_length: '', box_width: '', box_height: '', status: 'active', notes: ''
  });

  const load = () => {
    setLoading(true);
    getVeiculos()
      .then(d => setVeiculos(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const abrir = (v = null) => {
    if (v) {
      setEditando(v.id);
      setForm({
        name: v.name || '', plate: v.plate || '', type: v.type || 'truck',
        capacity_kg: v.capacity_kg || '', capacity_m3: v.capacity_m3 || '',
        fuel_type: v.fuel_type || 'diesel', fuel_consumption: v.fuel_consumption || '',
        year: v.year || '', brand: v.brand || '', model: v.model || '',
        box_length: v.box_length || '', box_width: v.box_width || '', box_height: v.box_height || '',
        status: v.status || 'active', notes: v.notes || ''
      });
    } else {
      setEditando(null);
      setForm({ name: '', plate: '', type: 'truck', capacity_kg: '', capacity_m3: '', fuel_type: 'diesel', fuel_consumption: '', year: '', brand: '', model: '', box_length: '', box_width: '', box_height: '', status: 'active', notes: '' });
    }
    setModal(true);
  };

  const salvar = async () => {
    if (!form.name || !form.plate) return alert('Nome e placa obrigatorios');
    try {
      if (editando) await updateVeiculo(editando, form);
      else await createVeiculo(form);
      setModal(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  const excluir = async (id, nome) => {
    if (!window.confirm(`Excluir ${nome}?`)) return;
    await deleteVeiculo(id);
    load();
  };

  const ativos = veiculos.filter(v => v.status === 'active').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestao de Veiculos</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>{veiculos.length} veiculos cadastrados · {ativos} ativos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={() => abrir()}><Plus size={14} /> Novo Veiculo</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: veiculos.length, color: '#64B4FF' },
          { label: 'Ativos', value: ativos, color: '#10b981' },
          { label: 'Manutencao', value: veiculos.filter(v => v.status === 'maintenance').length, color: '#f59e0b' },
          { label: 'Inativos', value: veiculos.filter(v => v.status === 'inactive').length, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Grid de veiculos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {loading ? (
          <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</div>
        ) : veiculos.map(v => (
          <div key={v.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, background: 'rgba(232,82,26,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Truck size={22} color="#e8521a" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{v.name || v.plate}</div>
                <div style={{ fontSize: 12, color: '#90afd4' }}>{v.brand} {v.model} {v.year}</div>
              </div>
              <span style={{ fontSize: 11, color: v.status === 'active' ? '#10b981' : '#f59e0b', background: v.status === 'active' ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)', padding: '2px 8px', borderRadius: 4 }}>
                {v.status === 'active' ? 'Ativo' : v.status === 'maintenance' ? 'Manutencao' : 'Inativo'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Placa', value: v.plate },
                { label: 'Capacidade', value: v.capacity_kg ? `${v.capacity_kg} kg` : '—' },
                { label: 'Volume', value: v.capacity_m3 ? `${v.capacity_m3} m³` : '—' },
                { label: 'Combustivel', value: v.fuel_type || '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 10, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.value || '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => abrir(v)}><Edit size={12} /> Editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => excluir(v.id, v.name)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{editando ? 'Editar Veiculo' : 'Novo Veiculo'}</span>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome / Identificacao *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ex: VDA 01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa *</label>
                  <input className="form-control" value={form.plate} onChange={e => setForm(f => ({...f, plate: e.target.value}))} placeholder="ABC-1234" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-control" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                    <option value="truck">Caminhao</option>
                    <option value="van">Van</option>
                    <option value="car">Carro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Marca</label>
                  <input className="form-control" value={form.brand} onChange={e => setForm(f => ({...f, brand: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Modelo</label>
                  <input className="form-control" value={form.model} onChange={e => setForm(f => ({...f, model: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ano</label>
                  <input className="form-control" type="number" value={form.year} onChange={e => setForm(f => ({...f, year: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacidade (kg)</label>
                  <input className="form-control" type="number" value={form.capacity_kg} onChange={e => setForm(f => ({...f, capacity_kg: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Volume (m³)</label>
                  <input className="form-control" type="number" value={form.capacity_m3} onChange={e => setForm(f => ({...f, capacity_m3: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Comp. Bau (m)</label>
                  <input className="form-control" type="number" value={form.box_length} onChange={e => setForm(f => ({...f, box_length: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Larg. Bau (m)</label>
                  <input className="form-control" type="number" value={form.box_width} onChange={e => setForm(f => ({...f, box_width: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Alt. Bau (m)</label>
                  <input className="form-control" type="number" value={form.box_height} onChange={e => setForm(f => ({...f, box_height: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Combustivel</label>
                  <select className="form-control" value={form.fuel_type} onChange={e => setForm(f => ({...f, fuel_type: e.target.value}))}>
                    <option value="diesel">Diesel</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="flex">Flex</option>
                    <option value="eletrico">Eletrico</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Consumo (km/L)</label>
                  <input className="form-control" type="number" value={form.fuel_consumption} onChange={e => setForm(f => ({...f, fuel_consumption: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                    <option value="active">Ativo</option>
                    <option value="maintenance">Manutencao</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observacoes</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
