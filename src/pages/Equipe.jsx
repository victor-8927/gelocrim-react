import React, { useEffect, useState } from 'react';
import { getDrivers, createDriver, updateDriver, deleteDriver } from '../services/api';
import { RefreshCw, Plus, Edit, Trash2, X } from 'lucide-react';

const TIPO_LABELS = { driver: 'Motorista', assistant: 'Ajudante' };

export default function Equipe() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'driver', cpf: '', phone: '',
    license_number: '', license_category: '',
    hire_date: '', daily_cost: '', day_off: '',
    work_hours: '', lunch_time: '', notes: '', fixed_vehicle: ''
  });

  const load = () => {
    setLoading(true);
    getDrivers()
      .then(data => setDrivers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtrados = drivers.filter(d =>
    !filtroTipo || d.type === filtroTipo
  );

  const abrirModal = (driver = null) => {
    if (driver) {
      setEditando(driver.id);
      setForm({
        name: driver.name || '',
        type: driver.type || 'driver',
        cpf: driver.cpf || '',
        phone: driver.phone || '',
        license_number: driver.license_number || '',
        license_category: driver.license_category || '',
        hire_date: driver.hire_date || '',
        daily_cost: driver.daily_cost || '',
        day_off: driver.day_off || '',
        work_hours: driver.work_hours || '',
        lunch_time: driver.lunch_time || '',
        notes: driver.notes || '',
        fixed_vehicle: driver.fixed_vehicle || '',
      });
    } else {
      setEditando(null);
      setForm({ name: '', type: 'driver', cpf: '', phone: '', license_number: '', license_category: '', hire_date: '', daily_cost: '', day_off: '', work_hours: '', lunch_time: '', notes: '', fixed_vehicle: '' });
    }
    setModal(true);
  };

  const salvar = async () => {
    if (!form.name) return alert('Nome obrigatório');
    try {
      if (editando) await updateDriver(editando, form);
      else await createDriver(form);
      setModal(false);
      load();
    } catch (e) { alert('Erro ao salvar: ' + (e.detail || e.message)); }
  };

  const excluir = async (id, nome) => {
    if (!window.confirm(`Excluir ${nome}?`)) return;
    await deleteDriver(id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Equipe de Entrega</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Gestão de motoristas e ajudantes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={() => abrirModal()}><Plus size={14} /> Novo Cadastro</button>
        </div>
      </div>

      {/* Filtro */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <select className="form-control" style={{ width: 180 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos</option>
          <option value="driver">Motoristas</option>
          <option value="assistant">Ajudantes</option>
        </select>
        <span style={{ color: '#90afd4', fontSize: 12, alignSelf: 'center' }}>{filtrados.length} cadastros</span>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Nome</th><th>CPF</th><th>CNH</th><th>Cat.</th>
              <th>Telefone</th><th>Custo/Dia</th><th>Folga</th><th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
            ) : filtrados.map(d => (
              <tr key={d.id}>
                <td>
                  <span className={`badge ${d.type === 'driver' ? 'routed' : 'active'}`} style={{ fontSize: 10 }}>
                    {TIPO_LABELS[d.type] || d.type}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.cpf || '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.license_number || '—'}</td>
                <td>{d.license_category || '—'}</td>
                <td>{d.phone || '—'}</td>
                <td style={{ color: '#f59e0b' }}>{d.daily_cost ? `R$ ${d.daily_cost}` : '—'}</td>
                <td>{d.day_off || '—'}</td>
                <td><span className={`badge ${d.status || 'active'}`}>{d.status || 'active'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrirModal(d)}><Edit size={12} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => excluir(d.id, d.name)}><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', borderRadius: '16px 16px 0 0', zIndex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{editando ? 'Editar Cadastro' : 'Novo Cadastro'}</span>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              {/* Tipo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[{ value: 'driver', label: '🚛 Motorista', sub: 'Dirige o veículo' }, { value: 'assistant', label: '👷 Ajudante', sub: 'Auxilia nas entregas' }].map(t => (
                  <div key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))} style={{ border: `2px solid ${form.type === t.value ? (t.value === 'driver' ? '#e8521a' : '#64B4FF') : '#1e3a5c'}`, borderRadius: 10, padding: 12, cursor: 'pointer', background: form.type === t.value ? (t.value === 'driver' ? 'rgba(232,82,26,.1)' : 'rgba(100,180,255,.1)') : 'transparent', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: '#90afd4' }}>{t.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1/-1' }} className="form-group">
                  <label className="form-label">Nome Completo *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input className="form-control" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                {form.type === 'driver' && <>
                  <div className="form-group">
                    <label className="form-label">Número CNH</label>
                    <input className="form-control" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria CNH</label>
                    <select className="form-control" value={form.license_category} onChange={e => setForm(f => ({ ...f, license_category: e.target.value }))}>
                      <option value="">—</option>
                      {['A','B','C','D','E'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </>}
                <div className="form-group">
                  <label className="form-label">Data de Admissão</label>
                  <input className="form-control" type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Custo Diário (R$)</label>
                  <input className="form-control" type="number" value={form.daily_cost} onChange={e => setForm(f => ({ ...f, daily_cost: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Jornada (ex: 07:00-17:00)</label>
                  <input className="form-control" value={form.work_hours} onChange={e => setForm(f => ({ ...f, work_hours: e.target.value }))} placeholder="07:00-17:00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Horário Almoço</label>
                  <input className="form-control" value={form.lunch_time} onChange={e => setForm(f => ({ ...f, lunch_time: e.target.value }))} placeholder="12:00-13:12" />
                </div>
                <div className="form-group">
                  <label className="form-label">Dia de Folga</label>
                  <select className="form-control" value={form.day_off} onChange={e => setForm(f => ({ ...f, day_off: e.target.value }))}>
                    <option value="">— Sem folga fixa —</option>
                    {['domingo','segunda','terca','quarta','quinta','sexta','sabado'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }} className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar}>💾 Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
