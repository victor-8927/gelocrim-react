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
          date:         rota.route_date,
          status:       'planned',
          trip_number:  (rota.trip_number || 'V') + '-T',
          notes:        'Transbordo de ' + (rota.trip_number || rota.id?.slice(0,8)),
          created_at:   new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        };
        const { data: rotaCriada } = await supabase.from('routes').insert([novaRota]).select().single();
        if (rotaCriada) {
          // CORREÇÃO: batch update em vez de loop serial
          const stopIds = stopsPendentes.map(s => s.stop_id).filter(Boolean);
          if (stopIds.length > 0) {
            await supabase.from('stops')
              .update({ route_id: rotaCriada.id, status: 'pending', updated_at: new Date().toISOString() })
              .in('stop_id', stopIds);
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
function ModalRota({ rota, onFechar, onAtualizar }) {
  const [paradas, setParadas] = useState(rota?.stops || rota?.orders || []);
  const [fotoZoom, setFotoZoom] = useState(null); // {url, label}
  const [itensPorStop, setItensPorStop] = useState({});
  const [aprovando, setAprovando] = useState(null);
  const [expandido, setExpandido] = useState(null);

  // Hora Manaus (UTC-4)
  const horaManaus = (ts) => {
    if (!ts) return '—';
    const d = new Date(new Date(ts).getTime() - 4 * 60 * 60 * 1000);
    return d.toISOString().slice(11, 16);
  };

  // Carregar itens (sacos) por parada
  useEffect(() => {
    const ids = paradas.map(p => p.stop_id).filter(Boolean);
    if (ids.length === 0) return;
    supabase.from('stop_items')
      .select('stop_id, item_name, item_type, top_app, order_type, qty_planejada, qty_entregue, qty_devolvida')
      .in('stop_id', ids)
      .then(({ data }) => {
        const mapa = {};
        (data || []).forEach(it => {
          if (!mapa[it.stop_id]) mapa[it.stop_id] = [];
          mapa[it.stop_id].push(it);
        });
        setItensPorStop(mapa);
      });
  }, [paradas]);

  if (!rota) return null;
  const entregues = paradas.filter(p => p.status === 'delivered' || p.status === 'completed').length;
  const falhas = paradas.filter(p => p.status === 'refused' || p.status === 'failed').length;
  const pendentes = paradas.filter(p => !p.status || p.status === 'pending').length;
  const pct = paradas.length > 0 ? Math.round(entregues / paradas.length * 100) : 0;

  const statusLabel = (s) => {
    if (s === 'delivered' || s === 'completed') return { label: '✅ Entregue', cor: '#10b981' };
    if (s === 'refused' || s === 'failed') return { label: '❌ Falhou', cor: '#ef4444' };
    if (s === 'in_progress') return { label: '🔄 Em rota', cor: '#f97316' };
    return { label: '⏳ Pendente', cor: '#f59e0b' };
  };

  // Aprovar / rejeitar canhoto
  const decidirCanhoto = async (stop, decisao, motivo) => {
    setAprovando(stop.stop_id);
    try {
      const update = {
        canhoto_status: decisao,
        canhoto_aprovado_por: 'admin',
        canhoto_aprovado_at: new Date().toISOString(),
      };
      if (decisao === 'rejeitado') update.canhoto_motivo_rejeicao = motivo || 'Canhoto ilegível';
      await supabase.from('stops').update(update).eq('stop_id', stop.stop_id);
      setParadas(prev => prev.map(p => p.stop_id === stop.stop_id ? { ...p, ...update } : p));
    } finally {
      setAprovando(null);
    }
  };

  // Mini thumbnail de foto
  const FotoThumb = ({ label, url, emoji }) => (
    url ? (
      <button onClick={() => setFotoZoom({ url, label })}
        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'#0a1628', border:'1px solid #1e3a5c', borderRadius:6, padding:'4px 6px', cursor:'pointer' }}>
        <img src={url} alt={label} style={{ width:36, height:36, objectFit:'cover', borderRadius:4 }}
          onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
        <span style={{ display:'none', fontSize:16 }}>{emoji}</span>
        <span style={{ fontSize:8, color:'#64B4FF' }}>{label}</span>
      </button>
    ) : (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, opacity:0.25, padding:'4px 6px' }}>
        <span style={{ fontSize:20 }}>{emoji}</span>
        <span style={{ fontSize:8, color:'#90afd4' }}>{label}</span>
      </div>
    )
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background:'#0f2040', border:'1px solid #1e3a5c', borderRadius:16, width:920, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto' }}>
        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #1e3a5c', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#0f2040', zIndex:2 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>🗺️ {rota.trip_number || rota.id?.slice(0,16)} — {rota.vehicle_name || '—'}</div>
            <div style={{ fontSize:12, color:'#90afd4', marginTop:2 }}>Motorista: {rota.driver_name || '—'}</div>
          </div>
          <button onClick={onFechar} style={{ background:'none', border:'none', color:'#90afd4', cursor:'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding:20 }}>
          {/* KPIs */}
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
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {paradas.sort((a,b)=>(a.sequence||0)-(b.sequence||0)).map((p, i) => {
                const st = statusLabel(p.status);
                const itens = itensPorStop[p.stop_id] || [];
                const totalSacos = itens.reduce((s,it) => s + (parseFloat(it.qty_entregue ?? it.qty_planejada) || 0), 0);
                const totalDevol = itens.reduce((s,it) => s + (parseFloat(it.qty_devolvida) || 0), 0);
                const aberto = expandido === p.stop_id;
                // tempo de atendimento
                let tempoAtend = p.tempo_atendimento_min;
                if (!tempoAtend && p.ata && p.atd) {
                  tempoAtend = Math.round((new Date(p.atd) - new Date(p.ata)) / 60000);
                }
                const temCanhoto = p.canhoto_url || p.photo_receipt;
                const canhotoStatus = p.canhoto_status || 'pendente';
                return (
                  <div key={p.stop_id || i} style={{ background:'#0a1628', border:`1px solid ${aberto ? '#64B4FF' : '#1e3a5c'}`, borderRadius:10, overflow:'hidden' }}>
                    {/* Linha principal */}
                    <div onClick={() => setExpandido(aberto ? null : p.stop_id)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', cursor:'pointer' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:st.cor, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{p.sequence || i+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.recipient_name || '—'}</div>
                        <div style={{ fontSize:11, color:'#90afd4', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.address || '—'}</div>
                      </div>
                      <div style={{ textAlign:'center', flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#f59e0b' }}>{totalSacos > 0 ? `${Math.round(totalSacos)} sacos` : (p.weight_kg ? `${parseFloat(p.weight_kg).toFixed(0)} kg` : '—')}</div>
                        {totalDevol > 0 && <div style={{ fontSize:10, color:'#ef4444' }}>↩ {Math.round(totalDevol)} devolvidos</div>}
                      </div>
                      <div style={{ textAlign:'center', flexShrink:0, minWidth:90 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:st.cor }}>{st.label}</div>
                        {temCanhoto && (
                          <div style={{ fontSize:9, marginTop:2, color: canhotoStatus==='aprovado' ? '#10b981' : canhotoStatus==='rejeitado' ? '#ef4444' : '#f59e0b' }}>
                            {canhotoStatus==='aprovado' ? '✓ Canhoto OK' : canhotoStatus==='rejeitado' ? '✗ Canhoto rejeitado' : '⏳ Canhoto pendente'}
                          </div>
                        )}
                      </div>
                      <span style={{ color:'#64B4FF', fontSize:12, flexShrink:0 }}>{aberto ? '▲' : '▼'}</span>
                    </div>

                    {/* Detalhe expandido */}
                    {aberto && (
                      <div style={{ padding:'4px 14px 14px', borderTop:'1px solid rgba(30,58,92,.5)' }}>
                        {/* Horas e tempo */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, margin:'12px 0' }}>
                          {[
                            { label:'Chegada', value: horaManaus(p.ata), emoji:'🕐' },
                            { label:'Saída', value: horaManaus(p.atd), emoji:'🚀' },
                            { label:'Atendimento', value: tempoAtend ? `${tempoAtend} min` : '—', emoji:'⏱️' },
                            { label:'Sequência', value: p.sequence || i+1, emoji:'📍' },
                          ].map(c => (
                            <div key={c.label} style={{ background:'#06101f', borderRadius:6, padding:'6px 8px' }}>
                              <div style={{ fontSize:9, color:'#90afd4' }}>{c.emoji} {c.label}</div>
                              <div style={{ fontSize:13, fontWeight:700 }}>{c.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Sacos por produto */}
                        {itens.length > 0 && (
                          <div style={{ marginBottom:12 }}>
                            <div style={{ fontSize:10, color:'#90afd4', textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>Sacos entregues</div>
                            {itens.map((it, idx) => (
                              <div key={idx} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid rgba(30,58,92,.3)' }}>
                                <span>{it.item_name}</span>
                                <span style={{ display:'flex', gap:10 }}>
                                  <span style={{ color:'#10b981' }}>{Math.round(parseFloat(it.qty_entregue ?? it.qty_planejada)||0)} entregue</span>
                                  {parseFloat(it.qty_devolvida)>0 && <span style={{ color:'#ef4444' }}>{Math.round(parseFloat(it.qty_devolvida))} devolvido</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Motivo de falha */}
                        {p.failure_reason && (
                          <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, padding:'6px 10px', marginBottom:12, fontSize:12, color:'#ef4444' }}>
                            ❌ {p.failure_reason}
                          </div>
                        )}
                        {p.notes && (
                          <div style={{ fontSize:11, color:'#90afd4', marginBottom:12 }}>📝 {p.notes}</div>
                        )}

                        {/* Fotos */}
                        <div style={{ fontSize:10, color:'#90afd4', textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>Comprovantes</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                          <FotoThumb label="NF" url={p.nf_url || p.photo_nf} emoji="📄" />
                          <FotoThumb label="Canhoto" url={p.canhoto_url || p.photo_receipt} emoji="🧾" />
                          <FotoThumb label="Assinatura" url={p.assinatura_url} emoji="✍️" />
                          <FotoThumb label="Boleto" url={p.boleto_url || p.photo_boleto} emoji="💵" />
                          <FotoThumb label="Comodato" url={p.photo_loan} emoji="🤝" />
                          <FotoThumb label="Ocorrência" url={p.ocorrencia_url} emoji="⚠️" />
                          <FotoThumb label="Outros" url={p.outros_url || p.photo_other} emoji="📷" />
                        </div>

                        {/* Aprovação de canhoto */}
                        {temCanhoto && canhotoStatus === 'pendente' && (
                          <div style={{ display:'flex', gap:8, alignItems:'center', background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'8px 12px' }}>
                            <span style={{ fontSize:12, color:'#f59e0b', flex:1 }}>Canhoto aguardando aprovação do supervisor</span>
                            <button onClick={() => decidirCanhoto(p, 'aprovado')} disabled={aprovando===p.stop_id}
                              style={{ background:'rgba(16,185,129,.2)', border:'1px solid #10b981', color:'#10b981', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                              ✓ Aprovar
                            </button>
                            <button onClick={() => { const m = window.prompt('Motivo da rejeição:'); if (m !== null) decidirCanhoto(p, 'rejeitado', m); }} disabled={aprovando===p.stop_id}
                              style={{ background:'rgba(239,68,68,.2)', border:'1px solid #ef4444', color:'#ef4444', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                              ✗ Rejeitar
                            </button>
                          </div>
                        )}
                        {canhotoStatus === 'aprovado' && (
                          <div style={{ fontSize:11, color:'#10b981', background:'rgba(16,185,129,.08)', borderRadius:6, padding:'6px 10px' }}>
                            ✓ Canhoto aprovado{p.canhoto_aprovado_por ? ` por ${p.canhoto_aprovado_por}` : ''} {p.canhoto_aprovado_at ? `· ${horaManaus(p.canhoto_aprovado_at)}` : ''}
                          </div>
                        )}
                        {canhotoStatus === 'rejeitado' && (
                          <div style={{ fontSize:11, color:'#ef4444', background:'rgba(239,68,68,.08)', borderRadius:6, padding:'6px 10px' }}>
                            ✗ Canhoto rejeitado{p.canhoto_motivo_rejeicao ? `: ${p.canhoto_motivo_rejeicao}` : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Zoom de foto */}
      {fotoZoom && (
        <div onClick={() => setFotoZoom(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.92)', zIndex:4000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:20 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{fotoZoom.label}</div>
          <img src={fotoZoom.url} alt={fotoZoom.label} style={{ maxWidth:'90vw', maxHeight:'80vh', objectFit:'contain', borderRadius:8 }} />
          <button onClick={() => setFotoZoom(null)} style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.3)', color:'#fff', borderRadius:8, padding:'8px 20px', cursor:'pointer', fontSize:13 }}>Fechar</button>
        </div>
      )}
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
  const [rotaResumo, setRotaResumo] = useState(null); // Modal resumo de carga antes de liberar
  const [resumoItens, setResumoItens] = useState([]);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [selecionados, setSelecionados] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      // CORREÇÃO: 1 query com todos os status em vez de 3 queries redundantes
      const rotasData = await getRoutes({ date: data });
      setRotas(Array.isArray(rotasData) ? rotasData : []);
    } catch(e) {
      console.error('Rotas load:', e);
      setRotas([]);
    }
    finally { setLoading(false); }
  };

  const abrirResumo = async (rota) => {
    setCarregandoResumo(true);
    setRotaResumo(rota);
    try {
      // Buscar stops da rota
      const { data: stops } = await supabase
        .from('stops')
        .select('stop_id, recipient_name, address, sequence, weight_kg, lat, lng')
        .eq('route_id', rota.id)
        .order('sequence');

      // Buscar order_items de todos os stops
      const stopIds = (stops || []).map(s => s.stop_id);
      let itens = [];
      if (stopIds.length > 0) {
        const { data: stopItems } = await supabase
          .from('stop_items')
          .select('item_name, item_type, top_app, order_type, qty_planejada, weight_unit')
          .in('stop_id', stopIds);
        itens = stopItems || [];
      }

      // Consolidar por produto
      const mapa = {};
      itens.forEach(item => {
        const key = item.item_type + '_' + (item.top_app || item.order_type || '1000');
        if (!mapa[key]) {
          mapa[key] = {
            item_name: item.item_name,
            item_type: item.item_type,
            top_app: item.top_app || item.order_type || '1000',
            qty: 0,
            peso_total: 0,
          };
        }
        mapa[key].qty += parseFloat(item.qty_planejada || 0);
        mapa[key].peso_total += parseFloat(item.qty_planejada || 0) * parseFloat(item.weight_unit || 0);
      });

      // Se não tem stop_items, usar peso dos stops como fallback
      if (itens.length === 0 && stops) {
        stops.forEach(s => {
          const key = 'fallback_1000';
          if (!mapa[key]) mapa[key] = { item_name: 'Carga total', item_type: '', top_app: '1000', qty: 0, peso_total: 0 };
          mapa[key].peso_total += parseFloat(s.weight_kg || 0);
        });
      }

      setResumoItens({ 
        produtos: Object.values(mapa).sort((a, b) => a.item_type.localeCompare(b.item_type)),
        stops: stops || [],
        totalPeso: (stops || []).reduce((s, st) => s + parseFloat(st.weight_kg || 0), 0),
        totalClientes: (stops || []).length,
        totalValor: rota.total_value || 0,
      });
    } catch(e) {
      console.error('Erro ao carregar resumo:', e);
      setResumoItens({ produtos: [], stops: [], totalPeso: 0, totalClientes: 0, totalValor: 0 });
    } finally {
      setCarregandoResumo(false);
    }
  };

  const liberarRota = async (rota) => {
    if (!window.confirm(`Liberar rota ${rota.trip_number}?`)) return;
    setLiberando(rota.id);
    try {
      // 1. Marcar rota como planned
      await supabase.from('routes').update({ status: 'planned', updated_at: new Date().toISOString() }).eq('id', rota.id);

      // 2. Buscar codparcs dos stops desta rota
      const { data: stopsData } = await supabase
        .from('stops')
        .select('codparc')
        .eq('route_id', rota.id);

      const codparcs = (stopsData || []).map(s => s.codparc).filter(Boolean);

      // 3. Marcar orders desses clientes como 'routed'
      if (codparcs.length > 0) {
        await supabase
          .from('orders')
          .update({ status: 'routed', updated_at: new Date().toISOString() })
          .in('codparc', codparcs)
          .eq('status', 'pending');
      }

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
                    <td style={{ fontSize:12, color:'#90afd4' }}>{r.route_date || data}</td>
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
                          <button onClick={() => abrirResumo(r)} disabled={liberando === r.id}
                            style={{ background:'rgba(16,185,129,.2)', border:'1px solid #10b981', color:'#10b981', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                            {liberando === r.id ? '...' : '📋 Ver Carga e Liberar'}
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

      {rotaSel    && <ModalRota    rota={rotaSel}    onFechar={() => setRotaSel(null)} onAtualizar={load} />}

      {/* Modal Resumo de Carga */}
      {rotaResumo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0f2035', border:'1px solid #1e3a5c', borderRadius:16, width:'100%', maxWidth:700, maxHeight:'90vh', overflow:'auto', padding:28 }}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'#e8521a' }}>📋 Resumo de Carga</div>
                <div style={{ fontSize:13, color:'#90afd4', marginTop:4 }}>{rotaResumo.trip_number} · {rotaResumo.driver_name} · {rotaResumo.vehicle_name}</div>
              </div>
              <button onClick={() => { setRotaResumo(null); setResumoItens([]); }}
                style={{ background:'none', border:'none', color:'#90afd4', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
            </div>

            {carregandoResumo ? (
              <div style={{ textAlign:'center', padding:40, color:'#90afd4' }}>Carregando carga...</div>
            ) : (
              <>
                {/* KPIs */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
                  {[
                    { label:'Clientes', value: resumoItens.totalClientes || 0, cor:'#64B4FF', emoji:'📍' },
                    { label:'Peso Total', value: `${((resumoItens.totalPeso || 0)/1000).toFixed(2)} t`, cor:'#f59e0b', emoji:'⚖️' },
                    { label:'Valor Total', value: `R$ ${((resumoItens.totalValor || 0)/1000).toFixed(1)}k`, cor:'#10b981', emoji:'💰' },
                  ].map(k => (
                    <div key={k.label} style={{ background:'#0a1628', border:'1px solid #1e3a5c', borderRadius:10, padding:12, textAlign:'center' }}>
                      <div style={{ fontSize:18 }}>{k.emoji}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:k.cor, marginTop:4 }}>{k.value}</div>
                      <div style={{ fontSize:11, color:'#90afd4' }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Produtos por TOP */}
                {['1000','1009','1007'].map(top => {
                  const topLabel = top === '1000' ? '🛒 Vendas' : top === '1009' ? '🔄 Trocas' : '🎁 Bonificação';
                  const topCor = top === '1000' ? '#10b981' : top === '1009' ? '#f59e0b' : '#a78bfa';
                  const itens = (resumoItens.produtos || []).filter(p => p.top_app === top);
                  if (itens.length === 0) return null;
                  return (
                    <div key={top} style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:topCor, textTransform:'uppercase', letterSpacing:'1px', marginBottom:8, paddingBottom:6, borderBottom:`1px solid rgba(${top==='1000'?'16,185,129':top==='1009'?'245,158,11':'167,139,250'},.3)` }}>
                        {topLabel} (TOP {top})
                      </div>
                      {itens.map((item, i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(30,58,92,.4)' }}>
                          <span style={{ fontSize:13, fontWeight:600 }}>{item.item_name}</span>
                          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                            <span style={{ fontSize:13, color:topCor, fontWeight:800 }}>{Math.round(item.qty)} sacos</span>
                            <span style={{ fontSize:11, color:'#90afd4' }}>{(item.peso_total/1000).toFixed(2)} t</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Fallback se não tem itens */}
                {(resumoItens.produtos || []).length === 0 && (
                  <div style={{ textAlign:'center', padding:20, color:'#90afd4', fontSize:13 }}>
                    ⚠️ Detalhes por produto não disponíveis. Peso total: {((resumoItens.totalPeso||0)/1000).toFixed(2)} t
                  </div>
                )}

                {/* Sequência de clientes */}
                <div style={{ marginTop:16, marginBottom:20 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64B4FF', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>📍 SEQUÊNCIA DE ENTREGA</div>
                  {(resumoItens.stops || []).map((stop, i) => (
                    <div key={stop.stop_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(30,58,92,.4)' }}>
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'#1e3a5c', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#64B4FF', flexShrink:0 }}>{stop.sequence || i+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stop.recipient_name}</div>
                        <div style={{ fontSize:11, color:'#90afd4' }}>{stop.address}</div>
                      </div>
                      <span style={{ fontSize:12, color:'#f59e0b', fontWeight:700, flexShrink:0 }}>{parseFloat(stop.weight_kg||0).toFixed(0)} kg</span>
                    </div>
                  ))}
                </div>

                {/* Botões */}
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => { setRotaResumo(null); setResumoItens([]); }}
                    style={{ flex:1, padding:13, background:'rgba(239,68,68,.15)', border:'1px solid #ef4444', color:'#ef4444', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13 }}>
                    ✕ Cancelar
                  </button>
                  <button onClick={() => { const r = rotaResumo; setRotaResumo(null); setResumoItens([]); liberarRota(r); }}
                    disabled={liberando === rotaResumo?.id}
                    style={{ flex:2, padding:13, background:'linear-gradient(135deg, rgba(16,185,129,.3), rgba(16,185,129,.5))', border:'1px solid #10b981', color:'#10b981', borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:14 }}>
                    {liberando === rotaResumo?.id ? '⏳ Liberando...' : '✅ CONFIRMAR E LIBERAR ROTA'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {rotaEditar && <ModalEditar  rota={rotaEditar} onFechar={() => setRotaEditar(null)} onSalvo={load} />}
    </div>
  );
}
