import React, { useEffect, useState } from 'react';
import { getRoutes, supabase } from '../services/supabase';
import { RefreshCw, X, Eye, Edit2, AlertTriangle } from 'lucide-react';

// ── MODAL EDITAR ROTA ─────────────────────────────────────────────────────────
function ModalEditar({ rota, onFechar, onSalvo }) {
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    driver_id:    rota.driver_id    || '',
    vehicle_id:   rota.vehicle_id   || '',
    assistant1_id: rota.assistant1_id || '',
    assistant2_id: rota.assistant2_id || '',
  });
  const [transbordo, setTransbordo] = useState(false);
  const [vdaTransbordo, setVdaTransbordo] = useState('');
  const [motoristaTransbordo, setMotoristaTransbordo] = useState('');

  useEffect(() => {
    supabase.from('drivers').select('id,name').eq('active', true).order('name').then(({ data }) => setMotoristas(data || []));
    supabase.from('vehicles').select('id,name,plate').eq('active', true).order('name').then(({ data }) => setVeiculos(data || []));
  }, []);

  const salvar = async () => {
    setSalvando(true);
    try {
      if (transbordo) {
        // Transbordo — criar nova rota com stops pendentes
        const stopsPendentes = (rota.stops || []).filter(s => s.status === 'pending' || s.status === 'in_progress');
        if (stopsPendentes.length === 0) { alert('Não há paradas pendentes para transbordo.'); return; }
        if (!vdaTransbordo || !motoristaTransbordo) { alert('Selecione o veículo e motorista para o transbordo.'); return; }

        // Atualizar rota original como cancelada
        await supabase.from('routes').update({
          status: 'cancelled',
          notes: 'Transbordo realizado — veículo avariado',
          updated_at: new Date().toISOString()
        }).eq('id', rota.id);

        // Criar nova rota com os stops pendentes
        const novaRota = {
          driver_id:    motoristaTransbordo,
          vehicle_id:   vdaTransbordo,
          date:         rota.date,
          status:       'planned',
          trip_number:  (rota.trip_number || 'V') + '-T',
          notes:        'Transbordo de ' + (rota.trip_number || rota.id?.slice(0,8)),
          created_at:   new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        };
        const { data: rotaCriada } = await supabase.from('routes').insert([novaRota]).select().single();
        if (rotaCriada) {
          // Transferir stops pendentes
          for (const stop of stopsPendentes) {
            await supabase.from('stops').update({ route_id: rotaCriada.id, status: 'pending', updated_at: new Date().toISOString() }).eq('id', stop.id);
          }
        }
        alert('Transbordo realizado! Nova rota ' + novaRota.trip_number + ' criada com ' + stopsPendentes.length + ' paradas.');
      } else {
        // Edição simples — trocar motorista/VDA/ajudante
        const mot = motoristas.find(m => m.id === form.driver_id);
        const vei = veiculos.find(v => v.id === form.vehicle_id);
        await supabase.from('routes').update({
          driver_id:     form.driver_id    || null,
          vehicle_id:    form.vehicle_id   || null,
          assistant1_id: form.assistant1_id || null,
          assistant2_id: form.assistant2_id || null,
          driver_name:   mot ? mot.name : rota.driver_name,
          vehicle_name:  vei ? (vei.name || vei.plate) : rota.vehicle_name,
          updated_at:    new Date().toISOString(),
        }).eq('id', rota.id);
        alert('Rota atualizada com sucesso!');
      }
      onSalvo();
      onFechar();
    } catch(e) {
      alert('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const stopsPendentes = (rota.stops || []).filter(s => s.status === 'pending' || s.status === 'in_progress').length;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background:'#0f2040', border:'1px solid #1e3a5c', borderRadius:16, width:520, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #1e3a5c', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>✏️ Editar Rota — {rota.trip_number}</div>
            <div style={{ fontSize:12, color:'#90afd4', marginTop:2 }}>Status atual: {rota.status}</div>
          </div>
          <button onClick={onFechar} style={{ background:'none', border:'none', color:'#90afd4', cursor:'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Toggle Transbordo */}
          {rota.status === 'in_progress' && (
            <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ color:'#ef4444', fontWeight:700, fontSize:13 }}>Transbordo de Emergência</span>
              </div>
              <div style={{ fontSize:12, color:'#90afd4', marginBottom:10 }}>
                Veículo avariado? Transfira as {stopsPendentes} paradas pendentes para outro VDA.
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input type="checkbox" checked={transbordo} onChange={e => setTransbordo(e.target.checked)}
                  style={{ accentColor:'#ef4444', width:16, height:16 }} />
                <span style={{ color:'#ef4444', fontWeight:700, fontSize:13 }}>Realizar Transbordo</span>
              </label>
            </div>
          )}

          {transbordo ? (
            <>
              <div>
                <label style={{ fontSize:12, color:'#90afd4', marginBottom:6, display:'block' }}>VDA para Transbordo</label>
                <select className="form-control" value={vdaTransbordo} onChange={e => setVdaTransbordo(e.target.value)}>
                  <option value="">Selecione o veículo</option>
                  {veiculos.filter(v => v.id !== rota.vehicle_id).map(v => (
                    <option key={v.id} value={v.id}>{v.name || v.plate}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:'#90afd4', marginBottom:6, display:'block' }}>Motorista para Transbordo</label>
                <select className="form-control" value={motoristaTransbordo} onChange={e => setMotoristaTransbordo(e.target.value)}>
                  <option value="">Selecione o motorista</option>
                  {motoristas.filter(m => m.id !== rota.driver_id).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.3)', borderRadius:8, padding:12, fontSize:12, color:'#f97316' }}>
                ⚠️ A rota original será cancelada e uma nova rota será criada com as {stopsPendentes} paradas pendentes.
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize:12, color:'#90afd4', marginBottom:6, display:'block' }}>Motorista</label>
                <select className="form-control" value={form.driver_id} onChange={e => setForm(p => ({ ...p, driver_id: e.target.value }))}>
                  <option value="">Selecione o motorista</option>
                  {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:'#90afd4', marginBottom:6, display:'block' }}>VDA (Veículo)</label>
                <select className="form-control" value={form.vehicle_id} onChange={e => setForm(p => ({ ...p, vehicle_id: e.target.value }))}>
                  <option value="">Selecione o veículo</option>
                  {veiculos.map(v => <option key={v.id} value={v.id}>{v.name || v.plate}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:'#90afd4', marginBottom:6, display:'block' }}>Ajudante 1</label>
                <select className="form-control" value={form.assistant1_id} onChange={e => setForm(p => ({ ...p, assistant1_id: e.target.value }))}>
                  <option value="">Nenhum</option>
                  {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:'#90afd4', marginBottom:6, display:'block' }}>Ajudante 2</label>
                <select className="form-control" value={form.assistant2_id} onChange={e => setForm(p => ({ ...p, assistant2_id: e.target.value }))}>
                  <option value="">Nenhum</option>
                  {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <button onClick={onFechar} style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid #1e3a5c', background:'transparent', color:'#90afd4', cursor:'pointer', fontWeight:700 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{ flex:2, padding:'12px', borderRadius:10, border:'none', background: transbordo ? '#ef4444' : '#e8521a', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:14 }}>
              {salvando ? 'Salvando...' : transbordo ? '🔄 Confirmar Transbordo' : '💾 Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MODAL VER ROTA ────────────────────────────────────────────────────────────
function ModalRota({ rota, onFechar }) {
  if (!rota) return null;
  const paradas = rota.stops || rota.orders || [];
  const entregues = paradas.filter(p => p.status === 'delivered' || p.status === 'completed').length;
  const falhas = paradas.filter(p => p.status === 'refused' || p.status === 'failed').length;
  const pendentes = paradas.filter(p => !p.status || p.status === 'pending').length;
  const pct = paradas.length > 0 ? Math.round(entregues / paradas.length * 100) : 0;

  const statusLabel = (s) => {
    if (s === 'delivered' || s === 'completed') return { label: '✅ Entregue', cor: '#10b981' };
    if (s === 'refused' || s === 'failed') return { label: '❌ Falhou', cor: '#ef4444' };
    return { label: '⏳ Pendente', cor: '#f59e0b' };
  };

  const FotoBtn = ({ label, url }) => (
    <div style={{ textAlign:'center' }}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, color:'#64B4FF', textDecoration:'none', fontSize:10 }}>
          <span>Ver {label}</span><span style={{ fontSize:16 }}>📄</span>
        </a>
      ) : (
        <span style={{ color:'rgba(144,175,212,.3)', fontSize:10 }}>—</span>
      )}
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background:'#0f2040', border:'1px solid #1e3a5c', borderRadius:16, width:720, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #1e3a5c', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#0f2040', zIndex:1 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>🗺️ {rota.trip_number || rota.id?.slice(0,16)} — {rota.vehicle_name || '—'}</div>
            <div style={{ fontSize:12, color:'#90afd4', marginTop:2 }}>Motorista: {rota.driver_name || '—'}</div>
          </div>
          <button onClick={onFechar} style={{ background:'none', border:'none', color:'#90afd4', cursor:'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Entregues', value:entregues, cor:'#10b981' },
              { label:'Falhas', value:falhas, cor:'#ef4444' },
              { label:'Pendentes', value:pendentes, cor:'#f59e0b' },
              { label:'Progresso', value:`${pct}%`, cor:'#64B4FF' },
            ].map(k => (
              <div key={k.label} style={{ background:'#0a1628', borderRadius:10, padding:12, textAlign:'center', border:'1px solid #1e3a5c' }}>
                <div style={{ fontSize:22, fontWeight:700, color:k.cor }}>{k.value}</div>
                <div style={{ fontSize:11, color:'#90afd4' }}>{k.label}</div>
              </div>
            ))}
          </div>
          {paradas.length === 0 ? (
            <div style={{ textAlign:'center', color:'#90afd4', padding:30 }}>Sem paradas registradas</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1e3a5c' }}>
                  {['#','Cliente','Peso','Status','Hora','NF','Canhoto','Outros'].map(h => (
                    <th key={h} style={{ padding:'8px 6px', fontSize:10, color:'#90afd4', textAlign:'left', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paradas.map((p, i) => {
                  const st = statusLabel(p.status);
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(30,58,92,.5)' }}>
                      <td style={{ padding:'10px 6px', fontSize:12, fontWeight:700, color:'#64B4FF' }}>{i+1}</td>
                      <td style={{ padding:'10px 6px' }}>
                        <div style={{ fontWeight:600, fontSize:12 }}>{p.recipient_name || '—'}</div>
                        {p.district && <div style={{ fontSize:10, color:'#90afd4' }}>{p.district}</div>}
                      </td>
                      <td style={{ padding:'10px 6px', fontSize:12, color:'#f59e0b' }}>{p.weight_kg ? `${parseFloat(p.weight_kg).toFixed(0)} kg` : '—'}</td>
                      <td style={{ padding:'10px 6px' }}><span style={{ fontSize:11, fontWeight:700, color:st.cor }}>{st.label}</span></td>
                      <td style={{ padding:'10px 6px', fontSize:12, color:'#90afd4' }}>{p.arrival_time || '—'}</td>
                      <td style={{ padding:'6px' }}><FotoBtn label="NF" url={p.nf_url} /></td>
                      <td style={{ padding:'6px' }}><FotoBtn label="Canhoto" url={p.canhoto_url} /></td>
                      <td style={{ padding:'6px' }}><FotoBtn label="Outros" url={p.outros_url} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TELA PRINCIPAL ────────────────────────────────────────────────────────────
export default function Rotas() {
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [filtroStatus, setFiltroStatus] = useState('');
  const [rotaSel, setRotaSel] = useState(null);
  const [rotaEditar, setRotaEditar] = useState(null);
  const [aba, setAba] = useState('pendentes');
  const [liberando, setLiberando] = useState(null);
  const [selecionados, setSelecionados] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [rotasData, rotasPendentes, rotasPlanned] = await Promise.all([
        getRoutes({ date: data }),
        getRoutes({ status: 'pending' }),
        getRoutes({ status: 'planned' }),
      ]);
      const todas = [];
      [...(rotasPendentes || []), ...(rotasPlanned || []), ...(rotasData || [])].forEach(r => {
        if (!todas.find(t => t.id === r.id)) todas.push(r);
      });
      setRotas(todas);
    } catch(e) { setRotas([]); }
    finally { setLoading(false); }
  };

  const liberarRota = async (rota) => {
    if (!window.confirm(`Liberar rota ${rota.trip_number}?`)) return;
    setLiberando(rota.id);
    try {
      await supabase.from('routes').update({ status: 'planned', updated_at: new Date().toISOString() }).eq('id', rota.id);
      load();
    } catch(e) { alert('Erro: ' + e.message); }
    finally { setLiberando(null); }
  };

  const bloquearRota = async (rota) => {
    if (!window.confirm(`Bloquear rota ${rota.trip_number}?`)) return;
    try {
      await supabase.from('routes').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', rota.id);
      load();
    } catch(e) { alert('Erro: ' + e.message); }
  };

  useEffect(() => { load(); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotasPendentes  = rotas.filter(r => r.status === 'pending');
  const rotasLiberadas  = rotas.filter(r => r.status === 'planned' || r.status === 'in_progress');
  const rotasConcluidas = rotas.filter(r => r.status === 'completed' || r.status === 'done');
  const filtradas = aba === 'pendentes' ? rotasPendentes : aba === 'liberadas' ? rotasLiberadas : aba === 'concluidas' ? rotasConcluidas : rotas.filter(r => !filtroStatus || r.status === filtroStatus);

  const totalParadas = rotas.reduce((s, r) => s + (r.total_stops || 0), 0);
  const entregues    = rotas.reduce((s, r) => s + (r.completed_stops || 0), 0);
  const falhas       = rotas.reduce((s, r) => s + (r.failed_stops || 0), 0);
  const taxaSucesso  = totalParadas > 0 ? Math.round((entregues / (entregues + falhas || 1)) * 100) : 0;
  const veicAtivos   = rotas.filter(r => r.status === 'in_progress').length;
  const kmTotal      = rotas.reduce((s, r) => s + parseFloat(r.total_km || 0), 0);
  const kmPlan       = rotas.reduce((s, r) => s + parseFloat(r.planned_km || 0), 0);
  const desvio       = kmPlan > 0 ? Math.round((kmTotal - kmPlan) / kmPlan * 100) : 0;
  const progGeral    = totalParadas > 0 ? Math.round(entregues / totalParadas * 100) : 0;

  const toggleSel    = (id) => setSelecionados(p => { const n = { ...p }; if (n[id]) delete n[id]; else n[id] = true; return n; });
  const todosSelArr  = Object.keys(selecionados);

  const statusLabel = (s) => {
    if (s === 'in_progress') return { label:'Em Rota',   cor:'#f97316' };
    if (s === 'completed')   return { label:'Concluída', cor:'#10b981' };
    if (s === 'planned')     return { label:'Liberada',  cor:'#64B4FF' };
    if (s === 'cancelled')   return { label:'Cancelada', cor:'#ef4444' };
    return { label: s || 'Pendente', cor:'#90afd4' };
  };

  const podeEditar = (status) => ['pending','planned','in_progress'].includes(status);

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700 }}>Gestão de Rotas</h1>
          <p style={{ color:'#90afd4', fontSize:13, marginTop:4 }}>Visão panorâmica da execução do dia</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[
          { key:'pendentes',  label:`⏳ Pendentes (${rotasPendentes.length})`,          cor:'#f59e0b' },
          { key:'liberadas',  label:`✅ Liberadas / Em Rota (${rotasLiberadas.length})`, cor:'#10b981' },
          { key:'concluidas', label:`🏁 Concluídas (${rotasConcluidas.length})`,         cor:'#64B4FF' },
        ].map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${aba === a.key ? a.cor : '#1e3a5c'}`, background: aba === a.key ? `${a.cor}22` : 'transparent', color: aba === a.key ? a.cor : '#90afd4', fontWeight:700, cursor:'pointer', fontSize:12 }}>
            {a.label}
          </button>
        ))}
        <div style={{ flex:1 }} />
        {todosSelArr.length > 0 && (
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Imprimir ({todosSelArr.length})</button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { emoji:'📊', label:'Taxa de Sucesso (SLA)', value: totalParadas > 0 ? `${taxaSucesso}%` : '—', sub:'entregas no prazo',    cor: taxaSucesso >= 90 ? '#10b981' : taxaSucesso >= 70 ? '#f59e0b' : '#ef4444' },
          { emoji:'🚛', label:'Saúde da Frota',        value: veicAtivos > 0 ? `${veicAtivos} ativos` : '—', sub:'veículos em rota', cor:'#64B4FF' },
          { emoji:'📍', label:'KM Real vs Planejado',  value: kmPlan > 0 ? `${desvio > 0 ? '+' : ''}${desvio}%` : '—', sub:'desvio médio',  cor: desvio > 10 ? '#ef4444' : desvio > 5 ? '#f59e0b' : '#10b981' },
          { emoji:'✅', label:'Progresso Geral',        value: totalParadas > 0 ? `${progGeral}%` : '—', sub:'do dia concluído',          cor:'#a78bfa' },
        ].map(k => (
          <div key={k.label} className="card">
            <div style={{ fontSize:11, color:'#90afd4', marginBottom:4 }}>{k.emoji} {k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:k.cor }}>{k.value}</div>
            <div style={{ fontSize:11, color:'#90afd4' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom:16, display:'flex', gap:12, alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, color:'#90afd4' }}>Data</span>
          <input type="date" className="form-control" style={{ width:160 }} value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, color:'#90afd4' }}>Status</span>
          <select className="form-control" style={{ width:150 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="planned">Liberada</option>
            <option value="in_progress">Em Rota</option>
            <option value="completed">Concluída</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <span style={{ color:'#90afd4', fontSize:12, marginLeft:'auto' }}>{filtradas.length} rotas</span>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width:40 }}></th>
                <th>Nº Viagem</th><th>VDA</th><th>Motorista</th><th>Data</th>
                <th>Progresso</th><th>Distância</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign:'center', color:'#90afd4', padding:40 }}>Carregando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign:'center', color:'#90afd4', padding:40 }}>
                    <div style={{ fontSize:32, marginBottom:12 }}>🗺️</div>
                    <div>Nenhuma rota para esta data</div>
                    <div style={{ fontSize:12, marginTop:6 }}>Use a Roteirização para criar rotas</div>
                  </td>
                </tr>
              ) : filtradas.map(r => {
                const st   = statusLabel(r.status);
                const stops = r.total_stops || 0;
                const done  = r.completed_stops || 0;
                const pct   = stops > 0 ? Math.round(done / stops * 100) : 0;
                return (
                  <tr key={r.id}>
                    <td style={{ textAlign:'center' }}>
                      <input type="checkbox" checked={!!selecionados[r.id]} onChange={() => toggleSel(r.id)} style={{ cursor:'pointer', accentColor:'#e8521a' }} />
                    </td>
                    <td style={{ fontWeight:700, color:'#64B4FF', fontSize:12 }}>{r.trip_number || r.id?.slice(0,16)}</td>
                    <td style={{ fontSize:12 }}>{r.vehicle_name || '—'}</td>
                    <td style={{ fontSize:12 }}>{r.driver_name || '—'}</td>
                    <td style={{ fontSize:12, color:'#90afd4' }}>{r.date || data}</td>
                    <td style={{ minWidth:140 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:6, background:'#1e3a5c', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: pct >= 100 ? '#10b981' : '#64B4FF', borderRadius:3 }} />
                        </div>
                        <span style={{ fontSize:11, color:'#90afd4', whiteSpace:'nowrap' }}>{pct}% ({stops})</span>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:'#90afd4' }}>{r.total_km ? `${parseFloat(r.total_km).toFixed(0)} km` : '—'}</td>
                    <td>
                      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:700, background:`${st.cor}22`, color:st.cor }}>{st.label}</span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setRotaSel(r)}>
                          <Eye size={12} /> Ver
                        </button>
                        {podeEditar(r.status) && (
                          <button onClick={() => setRotaEditar(r)}
                            style={{ background:'rgba(100,180,255,.15)', border:'1px solid #64B4FF', color:'#64B4FF', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                            <Edit2 size={11} /> Editar
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button onClick={() => liberarRota(r)} disabled={liberando === r.id}
                            style={{ background:'rgba(16,185,129,.2)', border:'1px solid #10b981', color:'#10b981', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                            {liberando === r.id ? '...' : '✅ Liberar'}
                          </button>
                        )}
                        {r.status === 'planned' && (
                          <button onClick={() => bloquearRota(r)}
                            style={{ background:'rgba(239,68,68,.15)', border:'1px solid #ef4444', color:'#ef4444', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                            🔒 Bloquear
                          </button>
                        )}
                        {r.status === 'in_progress' && (
                          <button onClick={() => setRotaEditar(r)}
                            style={{ background:'rgba(239,68,68,.15)', border:'1px solid #ef4444', color:'#ef4444', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                            🔄 Transbordo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rotaSel    && <ModalRota    rota={rotaSel}    onFechar={() => setRotaSel(null)} />}
      {rotaEditar && <ModalEditar  rota={rotaEditar} onFechar={() => setRotaEditar(null)} onSalvo={load} />}
    </div>
  );
}
