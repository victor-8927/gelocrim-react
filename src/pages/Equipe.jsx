import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Plus, X } from 'lucide-react';

const DIAS = [{ val: '', label: '— Sem folga fixa —' }, { val: 'domingo', label: 'Domingo' }, { val: 'segunda', label: 'Segunda-feira' }, { val: 'terca', label: 'Terca-feira' }, { val: 'quarta', label: 'Quarta-feira' }, { val: 'quinta', label: 'Quinta-feira' }, { val: 'sexta', label: 'Sexta-feira' }, { val: 'sabado', label: 'Sabado' }];

const FORM_VAZIO = {
  type: 'driver', name: '', cpf: '', phone: '', admission_date: '',
  license_number: '', license_category: '', fixed_vehicle: '',
  daily_cost: '', work_hours: '', lunch_break: '', day_off: '',
  notes: '', status: 'active',
  foto_funcionario: '', foto_cnh: ''
};

export default function Equipe() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/drivers');
      setDrivers(Array.isArray(d) ? d : []);
    } catch { setDrivers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const abrirNovo = () => {
    setEditId(null);
    setForm(FORM_VAZIO);
    setModal(true);
  };

  const abrirEditar = (d) => {
    setEditId(d.id);
    setForm({
      type: d.type || 'driver',
      name: d.name || '',
      cpf: d.cpf || '',
      phone: d.phone || '',
      admission_date: d.admission_date || '',
      license_number: d.license_number || '',
      license_category: d.license_category || '',
      fixed_vehicle: d.fixed_vehicle || '',
      daily_cost: d.daily_cost || '',
      work_hours: d.work_hours || '',
      lunch_break: d.lunch_break || '',
      day_off: d.day_off || '',
      notes: d.notes || '',
      status: d.status || 'active',
      foto_funcionario: d.foto_funcionario || '',
      foto_cnh: d.foto_cnh || ''
    });
    setModal(true);
  };

  const salvar = async () => {
    if (!form.name) return alert('Nome obrigatório');
    if (!form.daily_cost) return alert('Custo diário obrigatório');
    setSalvando(true);
    try {
      if (editId) await api.patch(`/drivers/${editId}`, form).catch(() => api.put(`/drivers/${editId}`, form));
      else await api.post('/drivers', form);
      setModal(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
    finally { setSalvando(false); }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir este cadastro?')) return;
    try {
      await api.delete(`/drivers/${id}`);
      load();
    } catch (e) { alert('Erro ao excluir: ' + (e.detail || e.message)); }
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const filtrados = drivers.filter(d => !filtroTipo || d.type === filtroTipo);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Equipe de Entrega</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Gestão de motoristas e ajudantes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} /> Novo Cadastro</button>
        </div>
      </div>

      {/* Filtro */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <select className="form-control" style={{ width: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos</option>
          <option value="driver">Motorista</option>
          <option value="assistant">Ajudante</option>
        </select>
        <span style={{ color: '#90afd4', fontSize: 13 }}>{filtrados.length} cadastros</span>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Tipo</th><th>Nome</th><th>CPF</th><th>CNH</th><th>Cat.</th>
                <th>Telefone</th><th>Custo/Dia</th><th>Folga</th><th>Jornada</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: '#90afd4', padding: 30 }}>Nenhum cadastro</td></tr>
              ) : filtrados.map(d => (
                <tr key={d.id}>
                  <td>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: d.type === 'driver' ? 'rgba(232,82,26,.2)' : 'rgba(100,180,255,.15)', color: d.type === 'driver' ? '#f97316' : '#64B4FF', fontWeight: 700 }}>
                      {d.type === 'driver' ? '🚛 Motorista' : '👷 Ajudante'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.cpf || '—'}</td>
                  <td style={{ fontSize: 12 }}>{d.license_number || '—'}</td>
                  <td style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>{d.license_category || '—'}</td>
                  <td style={{ fontSize: 12 }}>{d.phone || '—'}</td>
                  <td style={{ color: '#10b981', fontWeight: 600 }}>R$ {parseFloat(d.daily_cost || 0).toFixed(0)}</td>
                  <td style={{ fontSize: 12, color: '#90afd4' }}>{d.day_off || '—'}</td>
                  <td style={{ fontSize: 12, color: '#90afd4' }}>{d.work_hours || '—'}</td>
                  <td><span className={`badge ${d.status === 'inactive' ? 'inactive' : 'active'}`}>{d.status === 'inactive' ? 'Inativo' : 'Ativo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(d)}>✏️ Editar</button>
                      <button onClick={() => excluir(d.id)} style={{ background: 'rgba(239,68,68,.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
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
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 540, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header modal */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{editId ? '✏️ Editar Cadastro' : '+ Novo Cadastro'}</span>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Tipo */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>👤 TIPO DE CADASTRO</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ val: 'driver', icon: '🚛', label: 'Motorista', sub: 'Dirige o veículo' },
                    { val: 'assistant', icon: '👷', label: 'Ajudante', sub: 'Auxilia nas entregas' }].map(t => (
                    <button key={t.val} onClick={() => setForm(p => ({ ...p, type: t.val }))}
                      style={{ flex: 1, padding: '12px', border: `2px solid ${form.type === t.val ? '#e8521a' : '#1e3a5c'}`, background: form.type === t.val ? 'rgba(232,82,26,.15)' : 'transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 22 }}>{t.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: form.type === t.val ? '#e8521a' : '#e8f0fe', marginTop: 4 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: '#90afd4' }}>{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dados pessoais */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>👤 DADOS PESSOAIS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Nome Completo *</label>
                    <input className="form-control" value={form.name} onChange={f('name')} placeholder="Nome completo" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CPF</label>
                    <input className="form-control" value={form.cpf} onChange={f('cpf')} placeholder="000.000.000-00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input className="form-control" value={form.phone} onChange={f('phone')} placeholder="(92) 9 0000-0000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data de Admissão</label>
                    <input className="form-control" type="date" value={form.admission_date} onChange={f('admission_date')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Número CNH</label>
                    <input className="form-control" value={form.license_number} onChange={f('license_number')} placeholder="Número da CNH" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria CNH</label>
                    <select className="form-control" value={form.license_category} onChange={f('license_category')}>
                      <option value="">—</option>
                      {['A','B','C','D','E'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Fotos */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📷 FOTOS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Foto do Funcionário</label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, background: '#0a1628', border: '2px dashed #1e3a5c', borderRadius: 10, cursor: 'pointer', minHeight: 90 }}>
                      {form.foto_funcionario ? (
                        <img src={form.foto_funcionario} alt="foto" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <>
                          <span style={{ fontSize: 28 }}>👤</span>
                          <span style={{ fontSize: 11, color: '#90afd4' }}>Clique para adicionar foto</span>
                        </>
                      )}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setForm(p => ({ ...p, foto_funcionario: ev.target.result }));
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Foto da CNH</label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, background: '#0a1628', border: '2px dashed #1e3a5c', borderRadius: 10, cursor: 'pointer', minHeight: 90 }}>
                      {form.foto_cnh ? (
                        <span style={{ fontSize: 11, color: '#10b981' }}>✅ Arquivo carregado</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 28 }}>🪪</span>
                          <span style={{ fontSize: 11, color: '#90afd4' }}>Clique para adicionar CNH</span>
                          <span style={{ fontSize: 10, color: '#90afd4' }}>(PDF ou imagem)</span>
                        </>
                      )}
                      <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setForm(p => ({ ...p, foto_cnh: ev.target.result }));
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Custo operacional */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>💰 CUSTO OPERACIONAL</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Custo Diário (R$) *</label>
                    <input className="form-control" type="number" value={form.daily_cost} onChange={f('daily_cost')} placeholder="Ex: 192" />
                    <span style={{ fontSize: 10, color: '#90afd4' }}>Usado no cálculo da margem operacional</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Veículo Fixo</label>
                    <input className="form-control" value={form.fixed_vehicle} onChange={f('fixed_vehicle')} placeholder="Ex: VDA 01 — NOU 8H02" />
                  </div>
                </div>
              </div>

              {/* Jornada */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>🕐 JORNADA DE TRABALHO</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Carga Horária</label>
                    <input className="form-control" value={form.work_hours} onChange={f('work_hours')} placeholder="Ex: 07:00-17:00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horário de Almoço</label>
                    <input className="form-control" value={form.lunch_break} onChange={f('lunch_break')} placeholder="Ex: 12:00-13:12" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Dia de Folga</label>
                    <select className="form-control" value={form.day_off} onChange={f('day_off')}>
                      {DIAS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} placeholder="Observações adicionais..." />
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1e3a5c' }}>
                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : '💾 Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
