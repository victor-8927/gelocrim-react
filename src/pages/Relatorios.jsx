import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { RefreshCw, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ── Os 10 relatórios operacionais (um por card do Dashboard) ──────────────────
const RELATORIOS = [
  { id: 'pedidos',      label: '📦 Pedidos por Período',     cor: '#64B4FF' },
  { id: 'entregas',     label: '🚚 Entregas por Motorista',  cor: '#10b981' },
  { id: 'volumes',      label: '🧊 Volumes por Produto',     cor: '#a78bfa' },
  { id: 'km',           label: '🛣️ KM Realizado',            cor: '#f59e0b' },
  { id: 'custos',       label: '💰 Custos Operacionais',     cor: '#ef4444' },
  { id: 'trocas',       label: '🔄 Trocas Executadas',       cor: '#f97316' },
  { id: 'retornos',     label: '↩️ Retornos / Devoluções',   cor: '#ef4444' },
  { id: 'saldos',       label: '📋 Saldos em Aberto',        cor: '#f59e0b' },
  { id: 'canhotos',     label: '🧾 Gestão de Canhotos',      cor: '#64B4FF' },
  { id: 'conferencia',  label: '✅ Conferência de Retorno',  cor: '#10b981' },
];

const CORES = ['#e8521a', '#64B4FF', '#10b981', '#f59e0b', '#a78bfa', '#f97316', '#ef4444'];

export default function Relatorios() {
  const [tipo, setTipo] = useState('pedidos');
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState({ rows: [], kpis: [], chart: [] });
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');

  const hojeManaus = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const horaManaus = (ts) => { if (!ts) return '—'; return new Date(new Date(ts).getTime() - 4*60*60*1000).toISOString().slice(11,16); };

  useEffect(() => {
    const fim = hojeManaus();
    const ini = new Date(Date.now() - 30 * 86400000 - 4*60*60*1000).toISOString().slice(0, 10);
    setDataFim(fim);
    setDataIni(ini);
  }, []);

  const load = useCallback(async () => {
    if (!dataIni || !dataFim) return;
    setLoading(true);
    try {
      const fimQuery = dataFim + 'T23:59:59';
      const iniQuery = dataIni + 'T00:00:00';

      // ─── PEDIDOS POR PERÍODO ───────────────────────────────────
      if (tipo === 'pedidos') {
        const { data } = await supabase
          .from('orders')
          .select('id, order_number, client_name, status, total_weight, created_at, order_date')
          .gte('created_at', iniQuery).lte('created_at', fimQuery)
          .order('created_at', { ascending: false });
        const rows = (data || []).map(o => ({
          c1: o.order_number || o.id?.slice(0,8),
          c2: o.client_name || '—',
          c3: o.status || 'pendente',
          c4: o.total_weight ? `${parseFloat(o.total_weight).toFixed(0)} kg` : '—',
          c5: (o.order_date || o.created_at || '').slice(0,10),
        }));
        const total = rows.length;
        const entregues = (data||[]).filter(o => o.status === 'delivered' || o.status === 'completed').length;
        const pendentes = (data||[]).filter(o => !o.status || o.status === 'pending').length;
        // agrupar por dia
        const porDia = {};
        (data||[]).forEach(o => { const d=(o.order_date||o.created_at||'').slice(0,10); if(d) porDia[d]=(porDia[d]||0)+1; });
        setDados({
          cols: ['Pedido','Cliente','Status','Peso','Data'],
          rows,
          kpis: [
            { label: 'Total de Pedidos', value: total, cor: '#64B4FF' },
            { label: 'Entregues', value: entregues, cor: '#10b981' },
            { label: 'Pendentes', value: pendentes, cor: '#f59e0b' },
          ],
          chart: Object.entries(porDia).sort().slice(-14).map(([k,v]) => ({ nome: k.slice(5), valor: v })),
        });
      }

      // ─── ENTREGAS POR MOTORISTA ────────────────────────────────
      else if (tipo === 'entregas') {
        const { data: rotas } = await supabase
          .from('routes')
          .select('id, driver_name, total_stops, completed_stops, failed_stops, route_date, status')
          .gte('route_date', dataIni).lte('route_date', dataFim);
        const porMotorista = {};
        (rotas||[]).forEach(r => {
          const m = r.driver_name || '—';
          if (!porMotorista[m]) porMotorista[m] = { entregas: 0, falhas: 0, rotas: 0, paradas: 0 };
          porMotorista[m].entregas += r.completed_stops || 0;
          porMotorista[m].falhas += r.failed_stops || 0;
          porMotorista[m].paradas += r.total_stops || 0;
          porMotorista[m].rotas += 1;
        });
        const rows = Object.entries(porMotorista).map(([m,v]) => ({
          c1: m, c2: v.rotas, c3: v.entregas, c4: v.falhas,
          c5: v.paradas > 0 ? `${Math.round(v.entregas/v.paradas*100)}%` : '—',
        })).sort((a,b)=>b.c3-a.c3);
        setDados({
          cols: ['Motorista','Rotas','Entregas','Falhas','Taxa Sucesso'],
          rows,
          kpis: [
            { label: 'Motoristas Ativos', value: rows.length, cor: '#64B4FF' },
            { label: 'Total Entregas', value: rows.reduce((s,r)=>s+r.c3,0), cor: '#10b981' },
            { label: 'Total Falhas', value: rows.reduce((s,r)=>s+r.c4,0), cor: '#ef4444' },
          ],
          chart: rows.slice(0,10).map(r => ({ nome: r.c1?.split(' ')[0] || '—', valor: r.c3 })),
        });
      }

      // ─── VOLUMES POR PRODUTO ───────────────────────────────────
      else if (tipo === 'volumes') {
        const { data: rotas } = await supabase.from('routes').select('id').gte('route_date', dataIni).lte('route_date', dataFim);
        const rotaIds = (rotas||[]).map(r=>r.id);
        let items = [];
        if (rotaIds.length) {
          const { data: stops } = await supabase.from('stops').select('stop_id').in('route_id', rotaIds);
          const stopIds = (stops||[]).map(s=>s.stop_id);
          if (stopIds.length) {
            // buscar em lotes
            for (let i=0;i<stopIds.length;i+=200) {
              const lote = stopIds.slice(i,i+200);
              const { data } = await supabase.from('stop_items').select('item_name, item_type, qty_planejada, qty_entregue, qty_devolvida').in('stop_id', lote);
              items = items.concat(data||[]);
            }
          }
        }
        const porProduto = {};
        items.forEach(it => {
          const k = it.item_name || it.item_type || '—';
          if (!porProduto[k]) porProduto[k] = { planejado:0, entregue:0, devolvido:0 };
          porProduto[k].planejado += parseFloat(it.qty_planejada)||0;
          porProduto[k].entregue  += parseFloat(it.qty_entregue)||0;
          porProduto[k].devolvido += parseFloat(it.qty_devolvida)||0;
        });
        const rows = Object.entries(porProduto).map(([k,v]) => ({
          c1: k, c2: Math.round(v.planejado), c3: Math.round(v.entregue), c4: Math.round(v.devolvido),
          c5: v.planejado>0 ? `${Math.round(v.entregue/v.planejado*100)}%` : '—',
        })).sort((a,b)=>b.c3-a.c3);
        setDados({
          cols: ['Produto','Planejado','Entregue','Devolvido','% Entregue'],
          rows,
          kpis: [
            { label: 'Sacos Planejados', value: rows.reduce((s,r)=>s+r.c2,0), cor: '#64B4FF' },
            { label: 'Sacos Entregues', value: rows.reduce((s,r)=>s+r.c3,0), cor: '#10b981' },
            { label: 'Sacos Devolvidos', value: rows.reduce((s,r)=>s+r.c4,0), cor: '#ef4444' },
          ],
          chart: rows.slice(0,8).map(r => ({ nome: r.c1, valor: r.c3 })),
        });
      }

      // ─── KM REALIZADO ──────────────────────────────────────────
      else if (tipo === 'km') {
        const { data: rotas } = await supabase
          .from('routes')
          .select('trip_number, driver_name, vehicle_name, km_start, km_end, route_date, status')
          .gte('route_date', dataIni).lte('route_date', dataFim);
        const rows = (rotas||[]).map(r => {
          const km = (r.km_end && r.km_start) ? (parseFloat(r.km_end)-parseFloat(r.km_start)) : 0;
          return { c1: r.trip_number||'—', c2: r.driver_name||'—', c3: r.vehicle_name||'—', c4: km>0?`${km.toFixed(0)} km`:'—', c5: (r.route_date||'').slice(0,10) };
        });
        const totalKm = (rotas||[]).reduce((s,r)=>{ const km=(r.km_end&&r.km_start)?(parseFloat(r.km_end)-parseFloat(r.km_start)):0; return s+(km>0?km:0); },0);
        setDados({
          cols: ['Rota','Motorista','Veículo','KM Rodado','Data'],
          rows,
          kpis: [
            { label: 'Total KM', value: `${totalKm.toFixed(0)} km`, cor: '#f59e0b' },
            { label: 'Rotas', value: rows.length, cor: '#64B4FF' },
            { label: 'Média/Rota', value: rows.length?`${(totalKm/rows.length).toFixed(0)} km`:'—', cor: '#a78bfa' },
          ],
          chart: rows.filter(r=>r.c4!=='—').slice(0,12).map(r => ({ nome: r.c1?.slice(-4), valor: parseFloat(r.c4) })),
        });
      }

      // ─── CUSTOS OPERACIONAIS ───────────────────────────────────
      else if (tipo === 'custos') {
        const { data: rotas } = await supabase
          .from('routes')
          .select('trip_number, driver_name, custo_diesel, custo_equipe, custo_manutencao, route_date')
          .gte('route_date', dataIni).lte('route_date', dataFim);
        const rows = (rotas||[]).map(r => {
          const diesel=parseFloat(r.custo_diesel)||0, equipe=parseFloat(r.custo_equipe)||0, manut=parseFloat(r.custo_manutencao)||0;
          const total=diesel+equipe+manut;
          return { c1:r.trip_number||'—', c2:`R$ ${diesel.toFixed(0)}`, c3:`R$ ${equipe.toFixed(0)}`, c4:`R$ ${manut.toFixed(0)}`, c5:`R$ ${total.toFixed(0)}` };
        });
        const totDiesel=(rotas||[]).reduce((s,r)=>s+(parseFloat(r.custo_diesel)||0),0);
        const totEquipe=(rotas||[]).reduce((s,r)=>s+(parseFloat(r.custo_equipe)||0),0);
        const totManut=(rotas||[]).reduce((s,r)=>s+(parseFloat(r.custo_manutencao)||0),0);
        setDados({
          cols: ['Rota','Diesel','Equipe','Manutenção','Total'],
          rows,
          kpis: [
            { label: 'Diesel', value: `R$ ${totDiesel.toFixed(0)}`, cor: '#f59e0b' },
            { label: 'Equipe', value: `R$ ${totEquipe.toFixed(0)}`, cor: '#64B4FF' },
            { label: 'Custo Total', value: `R$ ${(totDiesel+totEquipe+totManut).toFixed(0)}`, cor: '#ef4444' },
          ],
          chart: [
            { nome: 'Diesel', valor: Math.round(totDiesel) },
            { nome: 'Equipe', valor: Math.round(totEquipe) },
            { nome: 'Manutenção', valor: Math.round(totManut) },
          ],
        });
      }

      // ─── TROCAS / RETORNOS / SALDOS / CONFERENCIA (via stop_items) ──
      else if (tipo === 'trocas' || tipo === 'retornos' || tipo === 'saldos' || tipo === 'conferencia') {
        const { data: rotas } = await supabase.from('routes').select('id, trip_number, driver_name').gte('route_date', dataIni).lte('route_date', dataFim);
        const rotaMap = {}; (rotas||[]).forEach(r => rotaMap[r.id] = r);
        const rotaIds = (rotas||[]).map(r=>r.id);
        let stopsAll = [];
        if (rotaIds.length) {
          const { data: stops } = await supabase.from('stops').select('stop_id, recipient_name, route_id, status').in('route_id', rotaIds);
          stopsAll = stops || [];
        }
        const stopMap = {}; stopsAll.forEach(s => stopMap[s.stop_id] = s);
        const stopIds = stopsAll.map(s=>s.stop_id);
        let items = [];
        for (let i=0;i<stopIds.length;i+=200) {
          const lote = stopIds.slice(i,i+200);
          if (!lote.length) break;
          const { data } = await supabase.from('stop_items')
            .select('stop_id, item_name, top_app, order_type, qty_planejada, qty_entregue, qty_devolvida, qty_trocada, motivo_devolucao, destino_retorno, status_troca')
            .in('stop_id', lote);
          items = items.concat(data||[]);
        }

        if (tipo === 'trocas') {
          const trocas = items.filter(it => (it.top_app==='1009' || it.order_type==='1009' || parseFloat(it.qty_trocada)>0));
          const rows = trocas.map(it => { const s=stopMap[it.stop_id]||{}; const r=rotaMap[s.route_id]||{}; return {
            c1: s.recipient_name||'—', c2: it.item_name||'—', c3: Math.round(parseFloat(it.qty_trocada||it.qty_planejada)||0), c4: it.status_troca||'—', c5: r.trip_number||'—' }; });
          setDados({ cols:['Cliente','Produto','Qtd Trocada','Status','Rota'], rows,
            kpis:[{label:'Trocas',value:rows.length,cor:'#f97316'},{label:'Sacos Trocados',value:rows.reduce((s,r)=>s+r.c3,0),cor:'#a78bfa'},{label:'Clientes',value:new Set(rows.map(r=>r.c1)).size,cor:'#64B4FF'}],
            chart: [] });
        }
        else if (tipo === 'retornos') {
          const ret = items.filter(it => parseFloat(it.qty_devolvida)>0);
          const rows = ret.map(it => { const s=stopMap[it.stop_id]||{}; const r=rotaMap[s.route_id]||{}; return {
            c1: s.recipient_name||'—', c2: it.item_name||'—', c3: Math.round(parseFloat(it.qty_devolvida)||0), c4: it.motivo_devolucao||'—', c5: it.destino_retorno||'—' }; });
          setDados({ cols:['Cliente','Produto','Devolvido','Motivo','Destino'], rows,
            kpis:[{label:'Retornos',value:rows.length,cor:'#ef4444'},{label:'Sacos Devolvidos',value:rows.reduce((s,r)=>s+r.c3,0),cor:'#f59e0b'},{label:'Clientes',value:new Set(rows.map(r=>r.c1)).size,cor:'#64B4FF'}],
            chart: [] });
        }
        else if (tipo === 'saldos') {
          // Saldo = planejado não entregue (qty_planejada - qty_entregue > 0) em vendas
          const saldos = items.filter(it => { const p=parseFloat(it.qty_planejada)||0, e=parseFloat(it.qty_entregue)||0; return (it.top_app==='1000'||it.order_type==='1000') && p>e && e>=0 && (p-e)>0; });
          const rows = saldos.map(it => { const s=stopMap[it.stop_id]||{}; const r=rotaMap[s.route_id]||{}; const saldo=(parseFloat(it.qty_planejada)||0)-(parseFloat(it.qty_entregue)||0); return {
            c1: s.recipient_name||'—', c2: it.item_name||'—', c3: Math.round(parseFloat(it.qty_planejada)||0), c4: Math.round(parseFloat(it.qty_entregue)||0), c5: Math.round(saldo) }; });
          setDados({ cols:['Cliente','Produto','Pedido','Entregue','Saldo'], rows,
            kpis:[{label:'Saldos em Aberto',value:rows.length,cor:'#f59e0b'},{label:'Sacos em Saldo',value:rows.reduce((s,r)=>s+r.c5,0),cor:'#ef4444'},{label:'Clientes',value:new Set(rows.map(r=>r.c1)).size,cor:'#64B4FF'}],
            chart: [] });
        }
        else if (tipo === 'conferencia') {
          // Conferência: comparar planejado vs (entregue + devolvido) — divergências
          const rows = []; let okCount=0, divCount=0;
          items.forEach(it => {
            const p=parseFloat(it.qty_planejada)||0, e=parseFloat(it.qty_entregue)||0, d=parseFloat(it.qty_devolvida)||0;
            const fechou = (e+d) === p;
            if (p>0) {
              if (fechou) okCount++; else divCount++;
              if (!fechou) { const s=stopMap[it.stop_id]||{}; const r=rotaMap[s.route_id]||{}; rows.push({
                c1: s.recipient_name||'—', c2: it.item_name||'—', c3: Math.round(p), c4: Math.round(e+d), c5: Math.round(p-(e+d)) }); }
            }
          });
          setDados({ cols:['Cliente','Produto','Planejado','Conferido','Divergência'], rows,
            kpis:[{label:'Itens OK',value:okCount,cor:'#10b981'},{label:'Divergências',value:divCount,cor:'#ef4444'},{label:'Taxa Acerto',value:(okCount+divCount)>0?`${Math.round(okCount/(okCount+divCount)*100)}%`:'—',cor:'#64B4FF'}],
            chart: [{nome:'OK',valor:okCount},{nome:'Divergência',valor:divCount}] });
        }
      }

      // ─── GESTÃO DE CANHOTOS ────────────────────────────────────
      else if (tipo === 'canhotos') {
        const { data: rotas } = await supabase.from('routes').select('id, trip_number, driver_name').gte('route_date', dataIni).lte('route_date', dataFim);
        const rotaMap = {}; (rotas||[]).forEach(r => rotaMap[r.id] = r);
        const rotaIds = (rotas||[]).map(r=>r.id);
        let stops = [];
        if (rotaIds.length) {
          const { data } = await supabase.from('stops')
            .select('recipient_name, route_id, status, canhoto_url, photo_receipt, canhoto_status, canhoto_aprovado_por')
            .in('route_id', rotaIds);
          stops = data || [];
        }
        const comCanhoto = stops.filter(s => s.canhoto_url || s.photo_receipt);
        const rows = comCanhoto.map(s => { const r=rotaMap[s.route_id]||{}; return {
          c1: s.recipient_name||'—', c2: r.trip_number||'—', c3: r.driver_name||'—',
          c4: (s.canhoto_status||'pendente'), c5: s.canhoto_aprovado_por||'—' }; });
        const aprovados = comCanhoto.filter(s => s.canhoto_status === 'aprovado').length;
        const pendentes = comCanhoto.filter(s => !s.canhoto_status || s.canhoto_status === 'pendente').length;
        const rejeitados = comCanhoto.filter(s => s.canhoto_status === 'rejeitado').length;
        setDados({
          cols: ['Cliente','Rota','Motorista','Status Canhoto','Aprovado Por'],
          rows,
          kpis: [
            { label: 'Aprovados', value: aprovados, cor: '#10b981' },
            { label: 'Pendentes', value: pendentes, cor: '#f59e0b' },
            { label: 'Rejeitados', value: rejeitados, cor: '#ef4444' },
          ],
          chart: [{nome:'Aprovados',valor:aprovados},{nome:'Pendentes',valor:pendentes},{nome:'Rejeitados',valor:rejeitados}],
        });
      }

    } catch (e) {
      console.error('Relatorio erro:', e);
      setDados({ cols: [], rows: [], kpis: [], chart: [] });
    } finally {
      setLoading(false);
    }
  }, [tipo, dataIni, dataFim]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const exportarCSV = () => {
    if (!dados.rows?.length) return;
    const header = (dados.cols||[]).join(';');
    const linhas = dados.rows.map(r => [r.c1,r.c2,r.c3,r.c4,r.c5].join(';'));
    const csv = [header, ...linhas].join('\n');
    const blob = new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio_${tipo}_${dataIni}_${dataFim}.csv`;
    a.click();
  };

  const relAtual = RELATORIOS.find(r => r.id === tipo) || RELATORIOS[0];

  const setPeriodoRapido = (dias) => {
    setDataFim(hojeManaus());
    setDataIni(new Date(Date.now() - dias*86400000 - 4*60*60*1000).toISOString().slice(0,10));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700 }}>📊 Relatórios</h1>
          <p style={{ color:'#90afd4', fontSize:13, marginTop:4 }}>Operação fechada · período selecionável · exportável</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={exportarCSV} disabled={!dados.rows?.length}><Download size={14} /> CSV</button>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {/* Seletor de relatório */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {RELATORIOS.map(r => (
          <button key={r.id} onClick={() => setTipo(r.id)}
            style={{ background: tipo===r.id ? r.cor : '#0a1628', border:`1px solid ${tipo===r.id?r.cor:'#1e3a5c'}`, color: tipo===r.id?'#06101f':'#90afd4', borderRadius:8, padding:'7px 12px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Filtros de período */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
        <input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)}
          style={{ background:'#0a1628', border:'1px solid #1e3a5c', color:'#e8f0fe', borderRadius:8, padding:'8px 12px', fontSize:12 }} />
        <span style={{ color:'#90afd4' }}>até</span>
        <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)}
          style={{ background:'#0a1628', border:'1px solid #1e3a5c', color:'#e8f0fe', borderRadius:8, padding:'8px 12px', fontSize:12 }} />
        {[['Hoje',0],['7d',7],['30d',30],['90d',90]].map(([lbl,d]) => (
          <button key={lbl} onClick={()=>setPeriodoRapido(d)}
            style={{ background:'#0a1628', border:'1px solid #1e3a5c', color:'#90afd4', borderRadius:8, padding:'8px 12px', fontSize:12, cursor:'pointer' }}>{lbl}</button>
        ))}
      </div>

      {/* KPIs */}
      {dados.kpis?.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${dados.kpis.length},1fr)`, gap:12, marginBottom:20 }}>
          {dados.kpis.map(k => (
            <div key={k.label} className="card" style={{ textAlign:'center', padding:16 }}>
              <div style={{ fontSize:26, fontWeight:800, color:k.cor }}>{loading?'...':k.value}</div>
              <div style={{ fontSize:12, color:'#90afd4', marginTop:4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Gráfico */}
      {dados.chart?.length > 0 && (
        <div className="card" style={{ marginBottom:20, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:relAtual.cor, textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>{relAtual.label}</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dados.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5c" />
              <XAxis dataKey="nome" stroke="#90afd4" fontSize={11} />
              <YAxis stroke="#90afd4" fontSize={11} />
              <Tooltip contentStyle={{ background:'#0f2040', border:'1px solid #1e3a5c', borderRadius:8, color:'#e8f0fe' }} />
              <Bar dataKey="valor" radius={[4,4,0,0]}>
                {dados.chart.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#90afd4' }}>Carregando relatório...</div>
        ) : !dados.rows?.length ? (
          <div style={{ textAlign:'center', padding:40 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#90afd4' }}>Nenhum dado no período</div>
            <div style={{ fontSize:12, color:'#1e3a5c', marginTop:4 }}>Ajuste o período ou aguarde dados da operação</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'rgba(100,180,255,.05)' }}>
                {(dados.cols||[]).map(c => (
                  <th key={c} style={{ padding:'10px 16px', textAlign:'left', color:'#90afd4', fontSize:10, textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1px solid #1e3a5c' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.rows.map((r, i) => (
                <tr key={i} style={{ borderBottom:'1px solid rgba(30,58,92,.4)' }}>
                  <td style={{ padding:'10px 16px', fontWeight:600 }}>{r.c1}</td>
                  <td style={{ padding:'10px 16px', color:'#90afd4' }}>{r.c2}</td>
                  <td style={{ padding:'10px 16px', color:'#90afd4' }}>{r.c3}</td>
                  <td style={{ padding:'10px 16px', color:'#90afd4' }}>{r.c4}</td>
                  <td style={{ padding:'10px 16px', color:'#90afd4' }}>{r.c5}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
