import React, { useEffect, useState, useRef } from 'react';
import { getOrders, getRoutes, getVehicles, getDrivers, supabase } from '../services/supabase';
import { RefreshCw, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEPOSITO = { lat: -3.093544, lng: -60.075812 };

export default function Dashboard() {
  const [pedidos, setPedidos]     = useState([]);
  const [rotas, setRotas]         = useState([]);
  const [veiculos, setVeiculos]   = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [hora, setHora]           = useState(new Date());
  const mapRef  = useRef(null);
  const mapObj  = useRef(null);
  const markersRef = useRef([]);
  const navigate = useNavigate();

  const hojeManaus = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const diasSemana = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const now = new Date();
  const dataLabel = `Operação de ${diasSemana[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]}`;

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [configDiesel, setConfigDiesel] = useState({ kmPerLiter: 3, fuelPrice: 7.59 });

  const load = async () => {
    setLoading(true);
    try {
      const hoje = hojeManaus();

      // Busca rotas: do dia + in_progress de qualquer data
      const [rotasHojeRes, rotasAtivasRes, veiculosRes, motoristasRes, cfg] = await Promise.all([
        getRoutes({ date: hoje }).catch(() => []),
        supabase.from('routes').select('*, stops(stop_id,status,canhoto_url,nf_url,weight_kg,recipient_name,address,sequence,lat,lng,eta)').eq('status','in_progress').catch(() => ({ data: [] })),
        getVehicles().catch(() => []),
        getDrivers().catch(() => []),
        supabase.from('configuracoes').select('chave,valor').in('chave', ['preco_diesel']).catch(() => ({ data: [] })),
      ]);

      const rotasHoje = Array.isArray(rotasHojeRes) ? rotasHojeRes : [];
      const rotasAtivas = (rotasAtivasRes.data || []).filter(ra => !rotasHoje.find(rh => rh.id === ra.id));
      const todasRotas = [...rotasHoje, ...rotasAtivas];
      setRotas(todasRotas);

      // Busca pedidos das rotas ativas — independente de data
      const routeIds = todasRotas.map(r => r.id).filter(Boolean);
      let pedidosData = [];
      if (routeIds.length > 0) {
        const { data: pedRota } = await supabase
          .from('orders')
          .select('id,status,order_type,weight_kg,total_value,is_saldo,route_id')
          .in('route_id', routeIds)
          .catch(() => ({ data: [] }));
        pedidosData = pedRota || [];
      }
      // Pedidos pendentes sem rota
      const { data: pedPendentes } = await supabase
        .from('orders')
        .select('id,status,order_type,weight_kg,total_value,is_saldo,route_id')
        .eq('status', 'pending')
        .catch(() => ({ data: [] }));
      
      const todosPedidos = [...pedidosData, ...(pedPendentes || []).filter(p => !pedidosData.find(pd => pd.id === p.id))];
      setPedidos(todosPedidos);

      setVeiculos(Array.isArray(veiculosRes) ? veiculosRes : []);
      setMotoristas(Array.isArray(motoristasRes) ? motoristasRes : []);
      const pd = (cfg.data || []).find(c => c.chave === 'preco_diesel');
      if (pd) setConfigDiesel(prev => ({ ...prev, fuelPrice: parseFloat(pd.valor) || 7.59 }));
    } catch(e) { console.error('Dashboard load:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Auto-refresh a cada 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  // Mapa — inicializa
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: DEPOSITO, zoom: 11, mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
      new window.google.maps.Marker({
        position: DEPOSITO, map: mapObj.current, title: 'Depósito GELOCRIM',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#e8521a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });
    }
  }, []);

  // Mapa — pins dos clientes e caminhões
  useEffect(() => {
    if (!mapObj.current || !window.google) return;
    // Limpar markers antigos
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    rotas.forEach(r => {
      // Pin do caminhão
      if (r.current_lat && r.current_lng && r.status === 'in_progress') {
        const mk = new window.google.maps.Marker({
          position: { lat: parseFloat(r.current_lat), lng: parseFloat(r.current_lng) },
          map: mapObj.current,
          title: `${r.driver_name || 'Motorista'} — ${r.trip_number}`,
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6, fillColor: '#e8521a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2,
          }
        });
        markersRef.current.push(mk);
      }
      // Pins dos clientes
      (r.stops || []).forEach(stop => {
        if (!stop.lat || !stop.lng) return;
        const cor = stop.status === 'delivered' ? '#10b981' : stop.status === 'failed' ? '#ef4444' : '#64B4FF';
        const mk = new window.google.maps.Marker({
          position: { lat: parseFloat(stop.lat), lng: parseFloat(stop.lng) },
          map: mapObj.current,
          title: stop.recipient_name,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: cor, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1 }
        });
        markersRef.current.push(mk);
      });
    });

    // Centralizar no mapa se tem rotas ativas
    const ativas = rotas.filter(r => r.current_lat && r.current_lng);
    if (ativas.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(DEPOSITO);
      ativas.forEach(r => bounds.extend({ lat: parseFloat(r.current_lat), lng: parseFloat(r.current_lng) }));
      mapObj.current.fitBounds(bounds);
    }
  }, [rotas]);

  // ── PEDIDOS ──────────────────────────────────────────────────────────────────
  const pendentes    = pedidos.filter(p => p.status === 'pending').length;
  const emRota       = pedidos.filter(p => p.status === 'routed' || p.status === 'in_progress').length;
  const entregues    = pedidos.filter(p => p.status === 'delivered').length;
  const falhas       = pedidos.filter(p => p.status === 'failed').length;
  const reentregas   = pedidos.filter(p => p.status === 'rescheduled').length;
  const total        = pendentes + emRota + entregues + falhas + reentregas;
  const progresso    = total > 0 ? Math.round(entregues / total * 100) : 0;

  const saldoPendente  = pedidos.filter(p => (p.is_saldo || p.order_type === '1010') && p.status === 'pending').length;
  const saldoRetornado = pedidos.filter(p => (p.is_saldo || p.order_type === '1010') && p.status === 'failed').length;

  const pesoVenda  = pedidos.filter(p => p.order_type === '1000').reduce((s, p) => s + (parseFloat(p.weight_kg) || 0), 0);
  const pesoTroca  = pedidos.filter(p => p.order_type === '1009').reduce((s, p) => s + (parseFloat(p.weight_kg) || 0), 0);
  const pesoBonif  = pedidos.filter(p => p.order_type === '1007').reduce((s, p) => s + (parseFloat(p.weight_kg) || 0), 0);
  const pesoPrePed = pedidos.filter(p => p.order_type === '1010').reduce((s, p) => s + (parseFloat(p.weight_kg) || 0), 0);

  const valorVenda = pedidos.filter(p => p.order_type === '1000').reduce((s, p) => s + (parseFloat(p.total_value) || 0), 0);
  const valorTroca = pedidos.filter(p => p.order_type === '1009').reduce((s, p) => s + (parseFloat(p.total_value) || 0), 0);
  const valorBonif = pedidos.filter(p => p.order_type === '1007').reduce((s, p) => s + (parseFloat(p.total_value) || 0), 0);

  // ── ROTAS ────────────────────────────────────────────────────────────────────
  const rotasHoje   = rotas.length;
  const paradasHoje = rotas.reduce((s, r) => s + (r.total_stops || (r.stops || []).length || 0), 0);
  const veicAtivos  = veiculos.filter(v => v.status === 'active').length;
  const motoristas_ = motoristas.filter(m => m.type === 'driver' || !m.type).length || motoristas.length;

  const kmHoje = rotas.reduce((s, r) => {
    const inicio = parseFloat(r.km_start || 0);
    const fim    = parseFloat(r.km_end || 0);
    return s + (fim > inicio ? fim - inicio : 0);
  }, 0);

  const custoDiesel = kmHoje > 0 ? (kmHoje / configDiesel.kmPerLiter) * configDiesel.fuelPrice : 0;

  const canhotos = rotas.reduce((s, r) => {
    const stops = r.stops || [];
    return s + stops.filter(st => st.status === 'delivered' && !st.canhoto_url).length;
  }, 0);

  const retornos = rotas.reduce((s, r) => {
    const stops = r.stops || [];
    return s + stops.filter(st => st.status === 'failed').length;
  }, 0);

  const rotasLongas = rotas.filter(r => {
    if (!r.started_at || r.status !== 'in_progress') return false;
    return (new Date() - new Date(r.started_at)) > 8 * 60 * 60 * 1000;
  }).length;

  // Entregas concluídas nas rotas
  const entreguesRotas = rotas.reduce((s, r) => s + (r.completed_stops || (r.stops || []).filter(st => st.status === 'delivered').length || 0), 0);
  const totalParadas   = rotas.reduce((s, r) => s + (r.total_stops || (r.stops || []).length || 0), 0);
  const progressoRotas = totalParadas > 0 ? Math.round(entreguesRotas / totalParadas * 100) : 0;

  const horaStr = hora.toLocaleTimeString('pt-BR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Painel Operacional</h1>
          <div style={{ fontSize: 13, color: '#90afd4', marginTop: 2 }}>{dataLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e8521a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{horaStr}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary" onClick={() => navigate('/roteirizacao')}><Zap size={14} /> Roteirizar Agora</button>
        </div>
      </div>

      {/* Progresso */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>📊 Progresso da Operação do Dia</span>
          <span style={{ fontSize: 13, color: '#64B4FF', fontWeight: 700 }}>{progressoRotas}% concluído</span>
        </div>
        <div style={{ height: 10, background: '#1e3a5c', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${progressoRotas}%`, background: progressoRotas >= 80 ? '#10b981' : progressoRotas >= 50 ? '#f59e0b' : '#64B4FF', borderRadius: 5, transition: 'width .5s' }} />
        </div>
        <div style={{ fontSize: 12, color: '#90afd4' }}>{entreguesRotas} entregues · {totalParadas} total</div>
      </div>

      {/* Grid principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pedidos */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📦 PEDIDOS DO DIA</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { emoji: '📦', label: 'Pendentes',   value: pendentes,  cor: '#f59e0b', sub: 'aguardando rota' },
                { emoji: '🚛', label: 'Em Rota',     value: emRota,     cor: '#64B4FF', sub: 'saídos hoje' },
                { emoji: '✅', label: 'Entregues',   value: entregues,  cor: '#10b981', sub: 'concluídos' },
                { emoji: '❌', label: 'Falhas',      value: falhas,     cor: '#ef4444', sub: 'não entregues' },
                { emoji: '🔄', label: 'Reentregas',  value: reentregas, cor: '#a78bfa', sub: 'remarcados' },
                { emoji: '🔵', label: 'Saldo Pend.', value: saldoPendente, cor: '#64B4FF', sub: 'saldos abertos' },
              ].map(k => (
                <div key={k.label} style={{ background: '#0a1628', borderRadius: 10, padding: 10, border: '1px solid #1e3a5c', textAlign: 'center' }}>
                  <div style={{ fontSize: 16 }}>{k.emoji}</div>
                  <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 2 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: k.cor }}>{loading ? '...' : k.value}</div>
                  <div style={{ fontSize: 10, color: '#90afd4' }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Operação */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>🚛 OPERAÇÃO</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {[
                { emoji: '🗺️', label: 'Rotas Hoje',    value: rotasHoje,                                cor: '#64B4FF',  sub: 'criadas' },
                { emoji: '📍', label: 'Paradas',       value: paradasHoje,                               cor: '#a78bfa',  sub: 'total' },
                { emoji: '🛣️', label: 'KM Percorrido', value: kmHoje > 0 ? kmHoje.toFixed(0) + ' km' : '—', cor: '#f59e0b', sub: 'real hoje' },
                { emoji: '⛽', label: 'Custo Diesel',  value: custoDiesel > 0 ? 'R$ ' + custoDiesel.toFixed(0) : '—', cor: '#ef4444', sub: 'estimado' },
                { emoji: '🚐', label: 'Frota Ativa',   value: veicAtivos,                                cor: '#10b981',  sub: 'veículos' },
                { emoji: '👨‍💼', label: 'Motoristas',   value: motoristas_,                               cor: '#10b981',  sub: 'cadastrados' },
              ].map(k => (
                <div key={k.label} style={{ background: '#0a1628', borderRadius: 10, padding: 10, border: '1px solid #1e3a5c', textAlign: 'center' }}>
                  <div style={{ fontSize: 14 }}>{k.emoji}</div>
                  <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 2 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: k.cor }}>{loading ? '...' : k.value}</div>
                  <div style={{ fontSize: 10, color: '#90afd4' }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita — Mapa + Alertas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mapa */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, minHeight: 200 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>📍 ROTAS ATIVAS</span>
              <button onClick={() => navigate('/monitoramento')} style={{ background: 'none', border: 'none', color: '#64B4FF', fontSize: 11, cursor: 'pointer' }}>⛶ Expandir</button>
            </div>
            <div ref={mapRef} style={{ height: 320 }} />
          </div>

          {/* Alertas */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>⚡ ALERTAS PREDITIVOS</div>
            {canhotos === 0 && rotasLongas === 0 ? (
              <div style={{ fontSize: 12, color: '#10b981' }}>✅ Nenhum alerta no momento</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rotasLongas > 0 && <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,.1)', borderRadius: 6 }}>⏰ {rotasLongas} rota(s) +8h em campo</div>}
                {canhotos > 0 && <div style={{ fontSize: 12, color: '#f59e0b', padding: '6px 10px', background: 'rgba(245,158,11,.1)', borderRadius: 6 }}>📋 {canhotos} canhoto(s) pendente(s)</div>}
              </div>
            )}
          </div>

          {/* Indicadores rápidos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>📋 Canhotos Pendentes</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: canhotos > 0 ? '#f59e0b' : '#10b981' }}>{canhotos}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>⏰ Rotas +8h</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: rotasLongas > 0 ? '#ef4444' : '#10b981' }}>{rotasLongas}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mix de Carga por TOP */}
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>🧊 MIX DE CARGA POR TOP</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: '1000 Vendas',      value: pesoVenda,  cor: '#10b981', emoji: '🛒', valor: valorVenda },
            { label: '1009 Trocas',      value: pesoTroca,  cor: '#f59e0b', emoji: '🔄', valor: valorTroca },
            { label: '1007 Bonificação', value: pesoBonif,  cor: '#a78bfa', emoji: '🎁', valor: valorBonif },
            { label: '1010 Pré-pedido',  value: pesoPrePed, cor: '#64B4FF', emoji: '📋', valor: 0 },
          ].map(k => (
            <div key={k.label} style={{ background: '#0a1628', borderRadius: 10, padding: 12, border: '1px solid #1e3a5c', textAlign: 'center' }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{k.emoji}</div>
              <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.cor }}>{k.value > 0 ? k.value.toFixed(0) + ' kg' : '—'}</div>
              {k.valor > 0 && <div style={{ fontSize: 11, color: '#90afd4', marginTop: 2 }}>R$ {k.valor.toFixed(0)}</div>}
            </div>
          ))}
        </div>
        {saldoRetornado > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid #ef4444', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
            ⚠️ {saldoRetornado} saldo(s) retornaram — cliente recusou entrega complementar
          </div>
        )}
      </div>

      {/* Rotas do dia */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>🗺️ Rotas do Dia</span>
          <button onClick={() => navigate('/rotas')} style={{ background: 'none', border: 'none', color: '#64B4FF', fontSize: 12, cursor: 'pointer' }}>Ver todas</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Veículo</th><th>Motorista</th><th>Paradas</th><th>⏱️ Início</th><th>KM</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rotas.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#90afd4', padding: 20 }}>{loading ? 'Carregando...' : 'Nenhuma rota hoje'}</td></tr>
            ) : rotas.slice(0, 8).map(r => {
              const stopsArr = r.stops || [];
              const done  = r.completed_stops || stopsArr.filter(s => s.status === 'delivered').length;
              const tot   = r.total_stops || stopsArr.length;
              const pct   = tot > 0 ? Math.round(done / tot * 100) : 0;
              const kmReal = (parseFloat(r.km_end || 0) - parseFloat(r.km_start || 0));
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{r.vehicle_name || '—'}</td>
                  <td style={{ fontSize: 12, color: '#90afd4' }}>{r.driver_name || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 4, background: '#1e3a5c', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 2 }} />
                      </div>
                      <span style={{ color: '#90afd4' }}>{done}/{tot}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#90afd4' }}>{r.planned_start || r.started_at?.slice(11,16) || '—'}</td>
                  <td style={{ fontSize: 12, color: kmReal > 0 ? '#f59e0b' : '#90afd4' }}>{kmReal > 0 ? kmReal.toFixed(0) + ' km' : '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                      background: r.status === 'completed' ? 'rgba(16,185,129,.2)' : r.status === 'in_progress' ? 'rgba(249,115,22,.2)' : 'rgba(100,180,255,.2)',
                      color: r.status === 'completed' ? '#10b981' : r.status === 'in_progress' ? '#f97316' : '#64B4FF' }}>
                      {r.status === 'completed' ? '✅ Concluída' : r.status === 'in_progress' ? '🟠 Em Rota' : '🟢 Liberada'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Retorno de Produtos */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px' }}>↩️ Retorno de Produtos</span>
          <button onClick={() => navigate('/rotas')} style={{ background: 'none', border: 'none', color: '#64B4FF', fontSize: 12, cursor: 'pointer' }}>Detalhar</button>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: retornos > 0 ? '#ef4444' : '#10b981' }}>{retornos}</div>
            <div style={{ fontSize: 11, color: '#90afd4' }}>paradas recusadas hoje</div>
          </div>
          <div style={{ fontSize: 12, color: retornos > 0 ? '#ef4444' : '#10b981' }}>
            {retornos > 0 ? `⚠️ ${retornos} entrega(s) não realizadas` : '✅ Sem retornos hoje'}
          </div>
        </div>
      </div>

    </div>
  );
}
