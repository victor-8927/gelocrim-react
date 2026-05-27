import React, { useEffect, useState, useRef } from 'react';
import { getRoutes, getVehicles, getDrivers, supabase } from '../services/supabase';
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
  const [meta, setMeta]               = useState(null);
  const [fatMes, setFatMes]           = useState(0);
  const [volMes05, setVolMes05]       = useState(0);
  const [volMes10, setVolMes10]       = useState(0);
  const [volMes20, setVolMes20]       = useState(0);
  const [volMes40, setVolMes40]       = useState(0);
  const [pctDevolucao, setPctDevolucao] = useState(0);
  const [pctRetorno]                  = useState(0);
  const [pctTrocas, setPctTrocas]     = useState(0);
  const [tendencia, setTendencia]     = useState([]);

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
      // Buscar meta do mês
      const mesAno = new Date().toISOString().slice(0,7);
      const { data: metaData } = await supabase.from('metas').select('*').eq('mes_ano', mesAno).single().catch(() => ({ data: null }));
      if (metaData) setMeta(metaData);

      // Buscar faturamento e volume do mês
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      // Buscar order_items do mês para volume por produto
      const { data: itemsMes } = await supabase
        .from('stop_items')
        .select('item_type, qty_planejada, qty_entregue, qty_devolvida, top_app, order_type')
        .gte('created_at', inicioMes)
        .catch(() => ({ data: [] }));

      if (itemsMes) {
        const i1000 = itemsMes.filter(i => i.top_app === '1000' || i.order_type === '1000');
        setVolMes05(i1000.filter(i => i.item_type === '370').reduce((s, i) => s + (parseFloat(i.qty_entregue) || 0), 0));
        setVolMes10(i1000.filter(i => i.item_type === '371').reduce((s, i) => s + (parseFloat(i.qty_entregue) || 0), 0));
        setVolMes20(i1000.filter(i => i.item_type === '372').reduce((s, i) => s + (parseFloat(i.qty_entregue) || 0), 0));
        setVolMes40(i1000.filter(i => i.item_type === '373').reduce((s, i) => s + (parseFloat(i.qty_entregue) || 0), 0));
        // Tetos
        const totalEntregue = itemsMes.reduce((s, i) => s + (parseFloat(i.qty_entregue) || 0), 0);
        const totalDevolvido = itemsMes.filter(i => i.order_type === '1000').reduce((s, i) => s + (parseFloat(i.qty_devolvida) || 0), 0);
        const totalTroca = itemsMes.filter(i => i.order_type === '1009').reduce((s, i) => s + (parseFloat(i.qty_entregue) || 0), 0);
        if (totalEntregue > 0) {
          setPctDevolucao((totalDevolvido / totalEntregue) * 100);
          setPctTrocas((totalTroca / totalEntregue) * 100);
        }
      }

      // Buscar faturamento do mês por dia para tendência
      // Agrupa por data — peso entregue por dia
      const { data: stopsPorDia } = await supabase
        .from('stops')
        .select('weight_kg, created_at')
        .eq('status', 'delivered')
        .gte('created_at', inicioMes)
        .catch(() => ({ data: [] }));

      if (stopsPorDia) {
        const porDia = {};
        stopsPorDia.forEach(s => {
          const dia = s.created_at?.slice(0,10);
          if (!dia) return;
          porDia[dia] = (porDia[dia] || 0) + (parseFloat(s.weight_kg) || 0) * 30; // estimativa R$ por kg
        });
        const tend = Object.entries(porDia).sort(([a],[b]) => a.localeCompare(b)).map(([data, valor]) => ({ data, valor }));
        setTendencia(tend);
        setFatMes(tend.reduce((s, t) => s + t.valor, 0));
      }

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
  const motoristas_ = motoristas.filter(m => m.type === 'driver').length;

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


      {/* ═══════════════════════════════════════════════════════════ */}
      {/* INDICADORES DO MÊS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📊</span> INDICADORES DO MÊS — {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
        </div>

        {/* Velocímetro Faturamento + Volume */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Faturamento vs Meta */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>💰 FATURAMENTO vs META</div>
            {meta ? (() => {
              const pct = Math.min((fatMes / parseFloat(meta.faturamento)) * 100, 100);
              const diasMes = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
              const diaAtual = now.getDate();
              const ritmoAtual = fatMes / diaAtual;
              const projecao = ritmoAtual * diasMes;
              const faltam = parseFloat(meta.faturamento) - fatMes;
              const diasRestantes = diasMes - diaAtual;
              const precisaPorDia = diasRestantes > 0 ? faltam / diasRestantes : 0;
              const cor = pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444';
              // SVG velocímetro
              const angulo = -135 + (pct / 100) * 270;
              const rad = (angulo * Math.PI) / 180;
              const cx = 80, cy = 80, r = 60;
              const x = cx + r * Math.cos(rad);
              const y = cy + r * Math.sin(rad);
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <svg width="160" height="100" viewBox="0 0 160 100">
                      {/* Arco fundo */}
                      <path d="M 20 90 A 60 60 0 0 1 140 90" fill="none" stroke="#1e3a5c" strokeWidth="12" strokeLinecap="round"/>
                      {/* Arco progresso */}
                      <path d="M 20 90 A 60 60 0 0 1 140 90" fill="none" stroke={cor} strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${(pct/100)*188} 188`}/>
                      {/* Agulha */}
                      <line x1="80" y1="90" x2={x} y2={y} stroke="#e8f0fe" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="80" cy="90" r="4" fill="#e8f0fe"/>
                      {/* Labels */}
                      <text x="18" y="105" fill="#90afd4" fontSize="9">0%</text>
                      <text x="125" y="105" fill="#90afd4" fontSize="9">100%</text>
                      <text x="80" y="72" fill={cor} fontSize="14" fontWeight="800" textAnchor="middle">{pct.toFixed(1)}%</text>
                    </svg>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: cor }}>R$ {(fatMes/1000).toFixed(1)}k</div>
                    <div style={{ fontSize: 11, color: '#90afd4' }}>de R$ {(parseFloat(meta.faturamento)/1000).toFixed(1)}k</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ background: '#0a1628', borderRadius: 8, padding: '6px 8px', border: '1px solid #1e3a5c' }}>
                      <div style={{ fontSize: 9, color: '#90afd4' }}>Ritmo atual/dia</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64B4FF' }}>R$ {(ritmoAtual/1000).toFixed(1)}k</div>
                    </div>
                    <div style={{ background: '#0a1628', borderRadius: 8, padding: '6px 8px', border: '1px solid #1e3a5c' }}>
                      <div style={{ fontSize: 9, color: '#90afd4' }}>Precisa/dia</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: precisaPorDia > ritmoAtual ? '#ef4444' : '#10b981' }}>R$ {(precisaPorDia/1000).toFixed(1)}k</div>
                    </div>
                    <div style={{ background: '#0a1628', borderRadius: 8, padding: '6px 8px', border: '1px solid #1e3a5c' }}>
                      <div style={{ fontSize: 9, color: '#90afd4' }}>Projeção mês</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: projecao >= parseFloat(meta.faturamento) ? '#10b981' : '#ef4444' }}>R$ {(projecao/1000).toFixed(1)}k</div>
                    </div>
                    <div style={{ background: '#0a1628', borderRadius: 8, padding: '6px 8px', border: '1px solid #1e3a5c' }}>
                      <div style={{ fontSize: 9, color: '#90afd4' }}>Dias restantes</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{diasRestantes} dias</div>
                    </div>
                  </div>
                </div>
              );
            })() : <div style={{ color: '#90afd4', fontSize: 12 }}>Sem meta cadastrada para o mês</div>}
          </div>

          {/* Volume por Produto */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>🧊 VOLUME vs META (sacos)</div>
            {meta ? [
              { label: 'GELO 05KG', real: volMes05, meta_: parseFloat(meta.vol_05kg), cor: '#10b981' },
              { label: 'GELO 10KG', real: volMes10, meta_: parseFloat(meta.vol_10kg), cor: '#64B4FF' },
              { label: 'GELO 20KG', real: volMes20, meta_: parseFloat(meta.vol_20kg), cor: '#f59e0b' },
              { label: 'GELO 40KG', real: volMes40, meta_: parseFloat(meta.vol_40kg), cor: '#a78bfa' },
            ].map(v => {
              const pct = v.meta_ > 0 ? Math.min((v.real / v.meta_) * 100, 100) : 0;
              const diasMes = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
              const projecao = Math.round((v.real / now.getDate()) * diasMes);
              return (
                <div key={v.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{v.label}</span>
                    <span style={{ fontSize: 11, color: pct >= 100 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#1e3a5c', borderRadius: 4, overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: v.cor, borderRadius: 4, transition: 'width .5s' }}/>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#90afd4' }}>
                    <span>{v.real.toLocaleString()} / {v.meta_.toLocaleString()}</span>
                    <span style={{ color: projecao >= v.meta_ ? '#10b981' : '#ef4444' }}>proj: {projecao.toLocaleString()}</span>
                  </div>
                </div>
              );
            }) : <div style={{ color: '#90afd4', fontSize: 12 }}>Sem meta cadastrada</div>}
          </div>
        </div>

        {/* Tetos operacionais */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>🚨 TETOS OPERACIONAIS — Não pode ultrapassar</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Devoluções / Venda', real: pctDevolucao, teto: meta ? parseFloat(meta.teto_devolucao) : 8, unidade: '%' },
              { label: 'Retorno de Sacos',  real: pctRetorno,   teto: meta ? parseFloat(meta.teto_retorno) : 8,   unidade: '%' },
              { label: 'Trocas / Total',    real: pctTrocas,    teto: meta ? parseFloat(meta.teto_trocas) : 5,    unidade: '%' },
            ].map(t => {
              const pct = t.teto > 0 ? Math.min((t.real / t.teto) * 100, 100) : 0;
              const cor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
              const emoji = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
              // SVG gauge circular
              const circum = 2 * Math.PI * 35;
              const dash = (pct / 100) * circum;
              return (
                <div key={t.label} style={{ background: '#0a1628', border: `1px solid ${pct >= 100 ? 'rgba(239,68,68,.4)' : pct >= 80 ? 'rgba(245,158,11,.3)' : '#1e3a5c'}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <svg width="90" height="90" viewBox="0 0 90 90" style={{ marginBottom: 4 }}>
                    <circle cx="45" cy="45" r="35" fill="none" stroke="#1e3a5c" strokeWidth="8"/>
                    <circle cx="45" cy="45" r="35" fill="none" stroke={cor} strokeWidth="8"
                      strokeDasharray={`${dash} ${circum}`} strokeLinecap="round"
                      transform="rotate(-90 45 45)"/>
                    <text x="45" y="42" fill={cor} fontSize="14" fontWeight="800" textAnchor="middle">{t.real.toFixed(1)}%</text>
                    <text x="45" y="56" fill="#90afd4" fontSize="9" textAnchor="middle">teto {t.teto}%</text>
                    <text x="45" y="68" fontSize="12" textAnchor="middle">{emoji}</text>
                  </svg>
                  <div style={{ fontSize: 10, color: '#90afd4', fontWeight: 600 }}>{t.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linha de tendência — faturamento diário */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📈 TENDÊNCIA DE FATURAMENTO — Últimos 30 dias</div>
          {tendencia.length > 0 ? (() => {
            const max = Math.max(...tendencia.map(t => t.valor), 1);
            const w = 520, h = 120, pad = 30;
            const pts = tendencia.map((t, i) => {
              const x = pad + (i / (tendencia.length - 1)) * (w - pad*2);
              const y = h - pad - ((t.valor / max) * (h - pad*2));
              return { x, y, ...t };
            });
            const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const area = `${path} L ${pts[pts.length-1].x} ${h-pad} L ${pts[0].x} ${h-pad} Z`;
            return (
              <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                {/* Grid lines */}
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <line key={f} x1={pad} y1={h-pad-(f*(h-pad*2))} x2={w-pad} y2={h-pad-(f*(h-pad*2))} stroke="#1e3a5c" strokeWidth="1" strokeDasharray="4,4"/>
                ))}
                {/* Area */}
                <path d={area} fill="rgba(100,180,255,.08)"/>
                {/* Line */}
                <path d={path} fill="none" stroke="#64B4FF" strokeWidth="2" strokeLinejoin="round"/>
                {/* Points */}
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3" fill="#64B4FF"/>
                ))}
                {/* Labels eixo X */}
                {pts.filter((_, i) => i % 5 === 0).map((p, i) => (
                  <text key={i} x={p.x} y={h-2} fill="#90afd4" fontSize="8" textAnchor="middle">{p.data?.slice(5)}</text>
                ))}
                {/* Labels eixo Y */}
                {[0.5, 1].map(f => (
                  <text key={f} x={pad-4} y={h-pad-(f*(h-pad*2))+3} fill="#90afd4" fontSize="8" textAnchor="end">
                    R${((max*f)/1000).toFixed(0)}k
                  </text>
                ))}
              </svg>
            );
          })() : (
            <div style={{ textAlign: 'center', color: '#90afd4', fontSize: 12, padding: 20 }}>
              Dados insuficientes para tendência — acumula após alguns dias de operação
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
