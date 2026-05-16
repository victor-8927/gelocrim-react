import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Plus, Edit, Trash2, X, Handshake } from 'lucide-react';

export default function Parceiros() {
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState({
    name: '', cnpj: '', phone: '', email: '', address: '',
    service_time: '', contact: '', notes: '', status: 'active'
  });

  const load = () => {
    setLoading(true);
    api.get('/parceiros').catch(() => [])
      .then(d => setParceiros(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtrados = parceiros.filter(p =>
    !busca || (p.name || '').toLowerCase().includes(busca.toLowerCase())
  );

  const abrir = (p = null) => {
    if (p) {
      setEditando(p.id);
      setForm({ name: p.name || '', cnpj: p.cnpj || '', phone: p.phone || '', email: p.email || '', address: p.address || '', service_time: p.service_time || '', contact: p.contact || '', notes: p.notes || '', status: p.status || 'active' });
    } else {
      setEditando(null);
      setForm({ name: '', cnpj: '', phone: '', email: '', address: '', service_time: '', contact: '', notes: '', status: 'active' });
    }
    setModal(true);
  };

  const salvar = async () => {
    if (!form.name) return alert('Nome obrigatorio');
    try {
      if (editando) await api.patch(`/parceiros/${editando}`, form);
      else await api.post('/parceiros', form);
      setModal(false);
      load();
    } catch (e) { alert('Erro: ' + (e.detail || e.message)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Parceiros</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>{parceiros.length} parceiros cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={() => abrir()}><Plus size={14} /> Novo Parceiro</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <input className="form-control" placeholder="Buscar parceiro..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>CNPJ</th><th>Telefone</th><th>Email</th>
              <th>T. Atend.</th><th>Contato</th><th>Status</th><th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Nenhum parceiro encontrado</td></tr>
            ) : filtrados.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.cnpj || '—'}</td>
                <td>{p.phone || '—'}</td>
                <td style={{ fontSize: 12 }}>{p.email || '—'}</td>
                <td>{p.service_time ? `${p.service_time} min` : '—'}</td>
                <td>{p.contact || '—'}</td>
                <td><span className={`badge ${p.status === 'active' ? 'active' : 'inactive'}`}>{p.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrir(p)}><Edit size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
              <span style={{ fontWeight: 700 }}>{editando ? 'Editar Parceiro' : 'Novo Parceiro'}</span>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">CNPJ</label>
                  <input className="form-control" value={form.cnpj} onChange={e => setForm(f => ({...f, cnpj: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">T. Atendimento (min)</label>
                  <input className="form-control" type="number" value={form.service_time} onChange={e => setForm(f => ({...f, service_time: e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Endereco</label>
                  <input className="form-control" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contato</label>
                  <input className="form-control" value={form.contact} onChange={e => setForm(f => ({...f, contact: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                    <option value="active">Ativo</option>
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
