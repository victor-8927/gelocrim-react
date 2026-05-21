/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoute, supabase } from '../services/supabase';
import { ChevronUp, ChevronDown } from 'lucide-react';

const DEPOSITO = { lat: -3.093544, lng: -60.075812 };
const VEL_MEDIA = 35;
const ALMOCO_MIN = 12 * 60;
const ALMOCO_DUR = 72;
const FIM_NORMAL = 18 * 60;
const FIM_BANCO = 20 * 60;
const BALSA_LAT_LIMITE = -3.20;
const BALSA_TEMPO_MIN = 60;

function precisaBalsa(o) { return parseFloat(o.lat) < BALSA_LAT_LIMITE; }

function calcEtas(ordem, horaInicio, duracoesDirecoes) {
  if (!horaInicio) horaInicio = '08:00';
  if (!duracoesDirecoes) duracoesDirecoes = {};
  const [h, m] = horaInicio.split(':').map(Number);
  let minutos = h * 60 + m;
  let almocoFeito = false;
  let prev = DEPOSITO;
  let balsaIdaFeita = false;

  const result = ordem.map(function(o, idx) {
    const duracaoReal = duracoesDirecoes[idx];
    const dlat = (parseFloat(o.lat) || prev.lat) - prev.lat;
    const dlng = (parseFloat(o.lng) || prev.lng) - prev.lng;
    const distKmCalc = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    const distKm = duracoesDirecoes['dist_' + idx] || distKmCalc.toFixed(1);
    const tempoViagem = duracaoReal || Math.round(distKmCalc / VEL_MEDIA * 60);
    const tempoAtend = parseInt(o.service_time || o._tempoAtend || 20);

    if (precisaBalsa(o) && !balsaIdaFeita) {
      balsaIdaFeita = true;
      const minActual = minutos % 60;
      const espera = minActual === 0 ? 0 : 60 - minActual;
      minutos += espera + BALSA_TEMPO_MIN;
    }

    if (!almocoFeito && (minutos + tempoViagem) >= ALMOCO_MIN) {
      minutos = ALMOCO_MIN + ALMOCO_DUR;
      almocoFeito = true;
    }

    minutos += tempoViagem + tempoAtend;
    prev = o;

    const hh = Math.floor(minutos / 60) % 24;
    const mm = minutos % 60;
    const eta = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    let jornada = 'normal', jornadaCor = '#00FF88';
    if (minutos > FIM_BANCO) { jornada = 'extra'; jornadaCor = '#FF3355'; }
    else if (minutos > FIM_NORMAL) { jornada = 'banco'; jornadaCor = '#FFD700'; }
    return { ...o, _eta: eta, _minutos: minutos, _distKm: String(distKm), _tempoAtend: tempoAtend, _tDeslocMin: tempoViagem, _jornada: jornada, _jornadaCor: jornadaCor, _balsa: precisaBalsa(o) };
  });

  if (result.length > 0) {
    const ultimo = result[result.length - 1];
    let minutosRetorno = minutos;
    if (balsaIdaFeita) {
      const minActual = minutosRetorno % 60;
      const espera = minActual === 0 ? 0 : 60 - minActual;
      minutosRetorno += espera + BALSA_TEMPO_MIN;
    }
    const dlat = DEPOSITO.lat - parseFloat(ultimo.lat || DEPOSITO.lat);
    const dlng = DEPOSITO.lng - parseFloat(ultimo.lng || DEPOSITO.lng);
    const distRetorno = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    minutosRetorno += Math.round(distRetorno / VEL_MEDIA * 60);
    const hh = Math.floor(minutosRetorno / 60) % 24;
    const mm = minutosRetorno % 60;
    result.retornoEta = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    result.retornoKm = distRetorno.toFixed(1);
    result.comBalsa = balsaIdaFeita;
  }

  return result;
}

export default function ConferenciaMaster({ clientes, veiculo, motorista, ajudantes = [], onFechar, onGravar }) {
  const [ordem, setOrdem] = useState([]);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [dataSaida, setDataSaida] = useState(new Date().toISOString().slice(0, 10));
  const [escopo, setEscopo] = useState('padrao');
  const [modoOtim, setModoOtim] = useState('otimizado');
  const [confirmado, setConfirmado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  const [tipoOp, setTipoOp] = useState('1viagem');
  const [tempoEvento, setTempoEvento] = useState('');
  const [conflito, setConflito] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const polyRef = useRef(null);
  const dirRendererRef = useRef(null); // eslint-disable-line

  useEffect(() => {
    if (clientes?.length) {
      const comEta = calcEtas(clientes, horaInicio);
      setOrdem(comEta);
    }
  }, [clientes, horaInicio]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: DEPOSITO, zoom: 12, mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
    }
  }, []);

  const atualizarMapa = useCallback(() => {
    if (!mapObj.current || !window.google || !ordem.length) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polyRef.current) { if (polyRef.current.setMap) polyRef.current.setMap(null); else if (polyRef.current.setDirections) polyRef.current.setMap(null); }

    const svgDep = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#e8521a" stroke="white" stroke-width="2"/><text x="20" y="27" text-anchor="middle" fill="white" font-size="18" font-family="Arial">🏠</text></svg>';
    new window.google.maps.Marker({
      position: DEPOSITO, map: mapObj.current, title: 'Depósito Gelocrim',
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgDep), scaledSize: new window.google.maps.Size(40, 40), anchor: new window.google.maps.Point(20, 20) }
    });

    const path = [DEPOSITO];
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(DEPOSITO);

    ordem.forEach((o, i) => {
      if (!o.lat || !o.lng) return;
      const pos = { lat: parseFloat(o.lat), lng: parseFloat(o.lng) };
      path.push(pos);
      bounds.extend(pos);

      var num = String(i + 1);
      var fs = num.length > 1 ? '9' : '11';
      var svgMk = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path d="M16 1C9.4 1 4 6.4 4 13c0 9.5 12 30 12 30s12-20.5 12-30C28 6.4 22.6 1 16 1z" fill="#111827" stroke="white" stroke-width="1.5"/><circle cx="16" cy="13" r="8" fill="#111827"/><text x="16" y="18" text-anchor="middle" fill="white" font-size="' + fs + '" font-weight="bold" font-family="Arial">' + num + '</text></svg>';
      const mk = new window.google.maps.Marker({
        position: pos, map: mapObj.current, title: o.recipient_name || o.name,
        icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgMk), scaledSize: new window.google.maps.Size(32, 44), anchor: new window.google.maps.Point(16, 44) },
        zIndex: i + 1
      });
      markersRef.current.push(mk);
    });

    path.push(DEPOSITO);

    const directionsService = new window.google.maps.DirectionsService();
    const waypoints = path.slice(1, path.length - 1).map(p => ({ location: p, stopover: true }));

    if (waypoints.length > 0 && waypoints.length <= 23) {
      directionsService.route({
        origin: DEPOSITO, destination: DEPOSITO, waypoints,
        optimizeWaypoints: false, travelMode: window.google.maps.TravelMode.DRIVING
      }, function(result, status) {
        if (polyRef.current && polyRef.current.setMap) polyRef.current.setMap(null);
        if (status === 'OK') {
          const renderer = new window.google.maps.DirectionsRenderer({
            map: mapObj.current, suppressMarkers: true, preserveViewport: false,
            polylineOptions: { strokeColor: '#2563eb', strokeWeight: 5, strokeOpacity: 0.85 }
          });
          renderer.setDirections(result);
          polyRef.current = renderer;
        } else {
          polyRef.current = new window.google.maps.Polyline({ path, map: mapObj.current, strokeColor: '#64B4FF', strokeOpacity: 0.8, strokeWeight: 5 });
        }
      });
    } else {
      polyRef.current = new window.google.maps.Polyline({ path, map: mapObj.current, strokeColor: '#64B4FF', strokeOpacity: 0.8, strokeWeight: 5 });
    }

    mapObj.current.fitBounds(bounds);
  }, [ordem]);

  useEffect(() => { atualizarMapa(); }, [atualizarMapa]);

  const pesoTotal = ordem.reduce((s, o) => s + (parseFloat(o.weight_kg) || (parseFloat(o.peso) || 0)), 0);
  const volTotal = ordem.reduce((s, o) => s + (parseFloat(o.volume_m3) || (parseFloat(o.weight_kg) || 0) * 0.001), 0);
  const fatTotal = ordem.reduce((s, o) => s + (parseFloat(o.total_value) || 0), 0);
  const palletsEst = Math.ceil(pesoTotal / 1150) || 0;
  const capKg = parseFloat(veiculo?.capacity_kg || 5000);
  const capM3 = parseFloat(veiculo?.capacity_m3 || 20); // eslint-disable-line
  const pctCap = Math.round(pesoTotal / capKg * 100);
  const corPeso = pctCap <= 100 ? '#00FF88' : pctCap <= 120 ? '#FFD700' : '#FF3355';
  const distTotal = ordem.reduce((s, o) => s + parseFloat(o._distKm || 0), 0);
  const kmPerLiter = parseFloat(veiculo?.fuel_consumption || 4);
  const fuelPrice = parseFloat(veiculo?.fuel_price || 6.50);
  const custoDiesel = (distTotal / kmPerLiter) * fuelPrice;
  const custoManut = parseFloat(veiculo?.manut_mes || 0) / 22;
  const ipvaDia = parseFloat(veiculo?.ipva_anual || 0) / 365;
  const custoDia = parseFloat(motorista?.daily_cost || 0) + ajudantes.reduce((s, a) => s + parseFloat(a?.daily_cost || 0), 0);
  const custoTotal = custoDia + custoDiesel + custoManut + ipvaDia;
  const lucro = fatTotal - custoTotal;
  const margem = fatTotal > 0 ? (lucro / fatTotal * 100) : 0;
  const corMargem = margem >= 20 ? '#10b981' : margem >= 10 ? '#f59e0b' : '#ef4444';

  const ultimo = ordem[ordem.length - 1];
  const minFim = ultimo?._minutos || 0;
  const distRetorno = ultimo?.lat && ultimo?.lng ? Math.sqrt(Math.pow(-3.093544 - parseFloat(ultimo.lat), 2) + Math.pow(-60.075812 - parseFloat(ultimo.lng), 2)) * 111 : 0;
  const minRetorno = minFim + Math.round(distRetorno / VEL_MEDIA * 60);
  const hRet = Math.floor(minRetorno / 60) % 24;
  const mRet = minRetorno % 60;
  const horaFim = String(hRet).padStart(2, '0') + ':' + String(mRet).padStart(2, '0');
  const corFim = minRetorno <= FIM_NORMAL ? '#00FF88' : minRetorno <= FIM_BANCO ? '#FFD700' : '#FF3355';
  const alertaJornada = minRetorno <= FIM_NORMAL ? '✅ Previsão dentro da jornada normal (até 18:00)' : minRetorno <= FIM_BANCO ? '🕐 Previsão em banco de horas (até 20:00)' : '⚠️ Previsão em hora extra! Revisar rota.';
  const corAlerta = minRetorno <= FIM_NORMAL ? '#00FF88' : minRetorno <= FIM_BANCO ? '#FFD700' : '#FF3355';

  const equipeStr = [motorista?.name, ...ajudantes.map(a => a?.name)].filter(Boolean).join(' · ');

  const onDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const nova = [...ordem];
    const [item] = nova.splice(dragIdx, 1);
    nova.splice(idx, 0, item);
    const comEta = calcEtas(nova, horaInicio);
    setOrdem(comEta);
    setDragIdx(null);
    setConfirmado(false);
  };

  const moverItem = (idx, dir) => {
    const nova = [...ordem];
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= nova.length) return;
    [nova[idx], nova[alvo]] = [nova[alvo], nova[idx]];
    setOrdem(calcEtas(nova, horaInicio));
    setConfirmado(false);
  };

  const removerItem = (idx) => {
    const nova = ordem.filter((_, i) => i !== idx);
    setOrdem(calcEtas(nova, horaInicio));
    setConfirmado(false);
  };

  const reprocessar = async () => {
    setReprocessando(true);
    try {
      const comGps2 = ordem.filter(function(o) { return o.lat && o.lng; });
      if (comGps2.length < 2) { setReprocessando(false); setConfirmado(false); return; }
      const waypoints2 = comGps2.map(function(o) {
        return { location: { lat: parseFloat(o.lat), lng: parseFloat(o.lng) }, stopover: true };
      });
      const ds2 = new window.google.maps.DirectionsService();
      ds2.route({
        origin: DEPOSITO, destination: DEPOSITO, waypoints: waypoints2,
        optimizeWaypoints: true, travelMode: window.google.maps.TravelMode.DRIVING,
      }, function(result, status) {
        if (status === 'OK') {
          const order2 = result.routes[0].waypoint_order;
          const novaOrdem2 = order2.map(function(i) { return comGps2[i]; });
          const dur2 = {};
          result.routes[0].legs.forEach(function(leg, i) {
            if (i < novaOrdem2.length) {
              dur2[i] = Math.round(leg.duration.value / 60);
              dur2['dist_' + i] = (leg.distance.value / 1000).toFixed(1);
            }
          });
          setOrdem(calcEtas(novaOrdem2, horaInicio, dur2));
        } else {
          setOrdem(calcEtas(ordem, horaInicio));
        }
        setReprocessando(false);
        setConfirmado(false);
      });
    } catch (e) {
      setOrdem(calcEtas(ordem, horaInicio));
      setReprocessando(false);
      setConfirmado(false);
    }
  };

  const verificarConflito = async () => {
    if (!motorista?.id || !dataSaida) return null;
    const { data: rotasMotorista } = await supabase
      .from('routes').select('trip_number, planned_start, status, total_stops, route_date')
      .eq('driver_id', motorista.id).eq('route_date', dataSaida)
      .in('status', ['pending', 'planned', 'in_progress']);
    if (!rotasMotorista || rotasMotorista.length === 0) return null;
    const ultimaRota = rotasMotorista[rotasMotorista.length - 1];
    const [h, m] = (ultimaRota.planned_start || '08:00').split(':').map(Number);
    const minInicio = h * 60 + m;
    const tempoEstimado = (ultimaRota.total_stops || 3) * 40;
    const minRetornoConf = minInicio + tempoEstimado + 30;
    if (minRetornoConf > 20 * 60) return { tipo: 'erro', msg: 'Motorista ultrapassa 20h com rotas existentes!' };
    const hRetorno = Math.floor(minRetornoConf / 60);
    const mRetorno = minRetornoConf % 60;
    const horaRetorno = String(hRetorno).padStart(2,'0') + ':' + String(mRetorno).padStart(2,'0');
    return { tipo: 'aviso', msg: `Motorista já tem rota às ${ultimaRota.planned_start}. Retorno estimado: ${horaRetorno}. Hora sugerida: ${horaRetorno}.`, horaRetorno };
  };

  // ── GRAVAR — 1 stop por cliente + stop_items populado ──────────────────────
  const gravar = async () => {
    if (!confirmado) return;

    const conflitoDetectado = await verificarConflito();
    if (conflitoDetectado?.tipo === 'erro') { alert('❌ ' + conflitoDetectado.msg); return; }
    if (conflitoDetectado?.tipo === 'aviso') {
      const ok = window.confirm('⚠️ ' + conflitoDetectado.msg + ' Deseja continuar mesmo assim?');
      if (!ok) return;
    }

    setGravando(true);
    try {
      // 1. Criar a rota
      const rota = await createRoute({
        vehicle_id:    veiculo?.id,
        driver_id:     motorista?.id,
        assistant1_id: ajudantes?.[0]?.id || null,
        assistant2_id: ajudantes?.[1]?.id || null,
        date:          dataSaida,
        planned_start: horaInicio,
        trip_type:     tipoOp,
        tempo_evento:  tipoOp === 'evento' ? tempoEvento : null,
        total_stops:   ordem.length,
      });

      if (!rota?.id || ordem.length === 0) { alert('Erro ao criar rota.'); return; }

      // 2. Buscar orders e order_items de todos os clientes em 2 queries
      const todosOrderIds = ordem.flatMap(function(o) { return o.order_ids || []; }).filter(Boolean);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, external_id, order_type, invoice_number, payment_description, payment_type, total_value, weight_kg, codparc')
        .in('id', todosOrderIds);

      const invoiceNumbers = (ordersData || []).map(function(o) { return o.external_id; }).filter(Boolean);
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('invoice_number, item_type, item_name, qty, weight_unit, top_app')
        .in('invoice_number', invoiceNumbers);

      // Indexa orders por id
      const ordersById = {};
      (ordersData || []).forEach(function(o) { ordersById[o.id] = o; });

      // Indexa order_items por invoice_number
      const itemsByInvoice = {};
      (itemsData || []).forEach(function(item) {
        if (!itemsByInvoice[item.invoice_number]) itemsByInvoice[item.invoice_number] = [];
        itemsByInvoice[item.invoice_number].push(item);
      });

      // 3. Criar 1 stop por cliente
      const stopsParaInserir = ordem.map(function(o, i) {
        return {
          stop_id:        'stp-' + rota.id + '-' + i,
          route_id:       rota.id,
          sequence:       i + 1,
          codparc:        o.codparc || null,
          recipient_name: o.recipient_name || o.name || '—',
          address:        o.address || '',
          lat:            o.lat ? parseFloat(o.lat) : null,
          lng:            o.lng ? parseFloat(o.lng) : null,
          weight_kg:      parseFloat(o.weight_kg) || 0,
          status:         'pending',
          eta:            o._eta || null,
          order_id:       (o.order_ids || [])[0] || null,
          created_at:     new Date().toISOString(),
        };
      });

      await supabase.from('stops').insert(stopsParaInserir);

      // 4. Popular stop_items — todos os itens de todos os pedidos de cada cliente
      const stopItemsParaInserir = [];
      ordem.forEach(function(cliente, i) {
        var stopId = 'stp-' + rota.id + '-' + i;
        (cliente.order_ids || []).forEach(function(orderId) {
          var order = ordersById[orderId];
          if (!order) return;
          var itens = itemsByInvoice[order.external_id] || [];
          itens.forEach(function(item) {
            stopItemsParaInserir.push({
              stop_id:             stopId,
              external_id:         order.external_id,
              invoice_number:      order.invoice_number,
              order_type:          String(order.order_type || '1000'),
              item_name:           item.item_name,
              item_type:           item.item_type,
              top_app:             item.top_app || String(order.order_type),
              payment_type:        order.payment_type || null,
              payment_description: order.payment_description || null,
              qty_planejada:       parseFloat(item.qty) || 0,
              qty_entregue:        null,
              qty_devolvida:       null,
              motivo_devolucao:    null,
              destino_retorno:     null,
              status_troca:        null,
              weight_unit:         parseFloat(item.weight_unit) || 0,
            });
          });
        });
      });

      if (stopItemsParaInserir.length > 0) {
        const { error: errItems } = await supabase.from('stop_items').insert(stopItemsParaInserir);
        if (errItems) console.error('Erro stop_items:', errItems.message);
      }

      // 5. Marcar todos os pedidos como routed
      if (todosOrderIds.length > 0) {
        await supabase.from('orders')
          .update({ status: 'routed', updated_at: new Date().toISOString() })
          .in('id', todosOrderIds);
      }

      if (onGravar) onGravar(rota);
    } catch (e) {
      alert('Erro ao gravar: ' + (e.detail || e.message));
    } finally {
      setGravando(false);
    }
  };

  const escopos = [
    { value: 'padrao', label: '📍 Padrão' },
    { value: 'cidade', label: '🏙️ Cidade' },
    { value: 'praca', label: '🏢 Praça' },
    { value: 'bairro', label: '🏘️ Bairro' },
    { value: 'analista', label: '💻 Opção Analista' },
  ];

  const modos = [
    { value: 'otimizado', label: 'Otimizado' },
    { value: 'proximidade', label: 'Proximidade' },
    { value: 'distancia', label: 'Menor Distância' },
    { value: 'agrupamento', label: 'Agrupamento' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 3000, display: 'flex', alignItems: 'stretch' }}>
      <div style={{ background: '#0a1628', width: '100%', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: '#061020', borderBottom: '2px solid #1e3a5c', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e8f0fe' }}>📋 Conferência Master — Validação da Carga</div>
            <div style={{ fontSize: 12, color: '#90afd4', marginTop: 2 }}>{ordem.length} clientes · {pesoTotal.toFixed(0)}kg · {motorista?.name || '—'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select value={escopo} onChange={e => setEscopo(e.target.value)} style={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
              {escopos.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <select value={modoOtim} onChange={e => setModoOtim(e.target.value)} style={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
              {modos.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <button onClick={() => setOrdem(o => calcEtas([...o].reverse(), horaInicio))} style={{ background: '#1e3a5c', border: 'none', color: '#64B4FF', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              ↕️ Inverter
            </button>
            <button onClick={onFechar} style={{ background: '#1e3a5c', border: 'none', color: '#90afd4', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              ✕ Fechar
            </button>
            <button
              onClick={gravar}
              disabled={!confirmado || gravando || pctCap > 120}
              style={{ background: confirmado && pctCap <= 120 ? '#10b981' : '#1e3a5c', border: 'none', color: confirmado && pctCap <= 120 ? '#fff' : '#90afd4', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: confirmado && pctCap <= 120 ? 'pointer' : 'not-allowed', opacity: confirmado && pctCap <= 120 ? 1 : 0.5 }}
            >
              💾 {gravando ? 'Gravando...' : 'GRAVAR CARGA'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Coluna esquerda */}
          <div style={{ width: 280, borderRight: '1px solid #1e3a5c', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e3a5c', background: '#061020' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>SEQUÊNCIA DE ENTREGAS</div>
              <div style={{ fontSize: 10, color: '#90afd4', marginTop: 2 }}>Arraste para reordenar</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {ordem.map((o, i) => (
                <div
                  key={o.id || i}
                  draggable
                  onDragStart={e => onDragStart(e, i)}
                  onDragOver={onDragOver}
                  onDrop={e => onDrop(e, i)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: 8, marginBottom: 6, background: '#0a1628', border: `1px solid ${o._jornada === 'extra' ? '#FF3355' : o._jornada === 'banco' ? '#FFD700' : '#1e3a5c'}`, borderLeft: `3px solid ${o._jornadaCor || '#64B4FF'}`, borderRadius: 8, cursor: 'grab' }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: o._jornadaCor || '#64B4FF', color: '#002855', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e8f0fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.recipient_name || o.name || '—'}
                      {o._jornada === 'extra' && ' ⚠️'}{o._jornada === 'banco' && ' 🕐'}
                    </div>
                    <div style={{ fontSize: 10, color: '#90afd4', marginTop: 2 }}>
                      {parseFloat(o.weight_kg || o.peso || 0).toFixed(0)} kg · 🕐 {o._eta}
                    </div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>
                      ⏱ {o._tDeslocMin} min · 📍 {o._distKm} km · 🛎 {o._tempoAtend} min
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => moverItem(i, -1)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer', padding: 2 }}><ChevronUp size={12} /></button>
                    <button onClick={() => moverItem(i, 1)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer', padding: 2 }}><ChevronDown size={12} /></button>
                    <button onClick={() => removerItem(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 10, borderTop: '1px solid #1e3a5c', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={reprocessar} disabled={reprocessando} style={{ padding: '8px', background: '#1e3a5c', border: 'none', color: '#64B4FF', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                🔄 {reprocessando ? 'Otimizando...' : 'Reprocessar Sequência'}
              </button>
              <button onClick={atualizarMapa} style={{ padding: '8px', background: '#1e3a5c', border: 'none', color: '#f97316', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                🗺️ Atualizar Rota no Mapa
              </button>
              <button
                onClick={() => setConfirmado(true)}
                disabled={confirmado}
                style={{ padding: '8px', background: confirmado ? '#10b981' : '#e8521a', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, cursor: confirmado ? 'default' : 'pointer', fontWeight: 700 }}
              >
                {confirmado ? '✅ Rota Confirmada' : '✅ Confirmar Rota'}
              </button>
            </div>
          </div>

          {/* Centro - Mapa */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', background: '#061020', borderBottom: '1px solid #1e3a5c', fontSize: 11, color: '#90afd4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              MAPA DE VERIFICAÇÃO — verifique cruzamentos e bate-volta
            </div>
            <div ref={mapRef} style={{ flex: 1 }} />
          </div>

          {/* Coluna direita */}
          <div style={{ width: 280, borderLeft: '1px solid #1e3a5c', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ padding: 14 }}>

              {/* Cronograma */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📅 CRONOGRAMA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>Data saída</div>
                    <input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)} style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 4 }}>Tipo de Operação</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[
                        { key: '1viagem', label: '1ª Viagem', cor: '#10b981' },
                        { key: '2viagem', label: '2ª Viagem', cor: '#64B4FF' },
                        { key: 'evento', label: '🎉 Evento', cor: '#f59e0b' },
                      ].map(t => (
                        <button key={t.key} onClick={() => setTipoOp(t.key)}
                          style={{ flex: 1, padding: '4px 2px', borderRadius: 6, border: `1px solid ${tipoOp === t.key ? t.cor : '#1e3a5c'}`, background: tipoOp === t.key ? t.cor + '22' : 'transparent', color: tipoOp === t.key ? t.cor : '#90afd4', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {tipoOp === 'evento' && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 3 }}>⏱️ Tempo estimado fora (horas)</div>
                        <input type="number" min="1" max="12" value={tempoEvento} onChange={e => setTempoEvento(e.target.value)}
                          placeholder="Ex: 3" style={{ width: '100%', background: '#0a1628', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: 6, padding: '4px 8px', fontSize: 12 }} />
                      </div>
                    )}
                    {conflito && (
                      <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 10, color: '#f59e0b' }}>
                        ⚠️ {conflito}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>Hora início</div>
                    <input type="time" value={horaInicio} onChange={e => { setHoraInicio(e.target.value); setOrdem(o => calcEtas(o, e.target.value)); }} style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#90afd4' }}>Previsão fim</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: corFim }}>{horaFim}</span>
                  </div>
                  <div style={{ fontSize: 10, color: corAlerta }}>{alertaJornada}</div>
                </div>
              </div>

              <div style={{ height: 1, background: '#1e3a5c', margin: '12px 0' }} />

              {/* Logística */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>🚛 LOGÍSTICA</div>
                {[
                  { label: 'Veículo', value: veiculo?.name || veiculo?.plate || '—' },
                  { label: 'Motorista', value: equipeStr || '—' },
                  { label: 'Entregas', value: `${ordem.length} paradas · ${ordem.filter(o => o.lat && o.lng).length} com GPS` },
                  { label: 'Distância', value: `${(distTotal + distRetorno).toFixed(0)} km (real)` },
                  { label: 'Capacidade', value: `${capKg.toLocaleString('pt-BR')} kg / ${parseFloat(veiculo?.capacity_m3 || 0)} m³` },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                    <span style={{ fontSize: 11, color: '#90afd4' }}>{item.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#e8f0fe', textAlign: 'right', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                  <span style={{ fontSize: 11, color: '#90afd4' }}>⚖️ Peso</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: corPeso }}>{pesoTotal.toFixed(1)} kg ({pctCap}% cap.)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                  <span style={{ fontSize: 11, color: '#90afd4' }}>📦 Volume</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#e8f0fe' }}>{volTotal.toFixed(2)} m³</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                  <span style={{ fontSize: 11, color: '#90afd4' }}>🪵 Pallets</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#e8f0fe' }}>{palletsEst || '—'}</span>
                </div>
                <div style={{ height: 6, background: '#1e3a5c', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pctCap)}%`, background: corPeso, borderRadius: 3, transition: 'width .5s' }} />
                </div>
              </div>

              <div style={{ height: 1, background: '#1e3a5c', margin: '12px 0' }} />

              {/* Mix de carga por TOP */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>💰 MIX DE CARGA POR TOP</div>
                {[
                  { label: '1000 Vendas',        key: '1000' },
                  { label: '1009 Trocas',         key: '1009' },
                  { label: '1007 Bonificação',    key: '1007' },
                  { label: '1010 Pré-pedido',     key: '1010' },
                  { label: 'Saldo',               key: 'saldo' },
                ].map(top => {
                  // Calcula por pedido individual — cliente pode ter múltiplos TOPs
                  const val = ordem.reduce((s, o) => {
                    const pedidos = Array.isArray(o.pedidos) ? o.pedidos : [];
                    if (pedidos.length > 0) {
                      return s + pedidos
                        .filter(p => String(p.order_type) === top.key)
                        .reduce((ps, p) => ps + (parseFloat(p.total_value) || 0), 0);
                    }
                    const tipo = String(o.order_type || o.top || '');
                    if (tipo === top.key) return s + (parseFloat(o.total_value) || 0);
                    return s;
                  }, 0);
                  return (
                    <div key={top.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                      <span style={{ fontSize: 11, color: '#90afd4' }}>{top.label}</span>
                      <span style={{ fontSize: 11, color: val > 0 ? '#e8f0fe' : '#90afd4' }}>{val > 0 ? `R$ ${val.toFixed(2)}` : '—'}</span>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e8f0fe' }}>Total</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: fatTotal > 0 ? '#10b981' : '#f59e0b' }}>
                    {fatTotal > 0 ? `R$ ${fatTotal.toFixed(2)}` : '⚠️ Sem valor cadastrado'}
                  </span>
                </div>
              </div>

              <div style={{ height: 1, background: '#1e3a5c', margin: '12px 0' }} />

              {/* Margem Operacional */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>📊 MARGEM OPERACIONAL</div>
                {[
                  { label: 'Custo equipe',      value: custoDia > 0 ? `R$ ${custoDia.toFixed(2)}` : '⚙️ Configurar no cadastro' },
                  { label: 'Combustível',        value: custoDiesel > 0 ? `R$ ${custoDiesel.toFixed(2)}` : '⚙️ Configurar no veículo' },
                  { label: 'Manutenção/IPVA',    value: (custoManut + ipvaDia) > 0 ? `R$ ${(custoManut + ipvaDia).toFixed(2)}` : '⚙️ Configurar no veículo' },
                  { label: 'Total custos',       value: custoTotal > 0 ? `R$ ${custoTotal.toFixed(2)}` : '⚙️ Preencher cadastros' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                    <span style={{ fontSize: 11, color: '#90afd4' }}>{item.label}</span>
                    <span style={{ fontSize: 11, color: '#e8f0fe' }}>{item.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, padding: 10, background: margem >= 20 ? 'rgba(16,185,129,.15)' : margem >= 10 ? 'rgba(245,158,11,.15)' : 'rgba(248,113,113,.15)', borderRadius: 8, border: `1px solid ${corMargem}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 20 }}>{fatTotal === 0 ? '⚠️' : margem >= 20 ? '🟢' : margem >= 10 ? '🟡' : '🔴'}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: corMargem }}>{fatTotal > 0 ? `${margem.toFixed(1)}%` : '—'}</div>
                  <div style={{ fontSize: 10, color: '#90afd4' }}>{fatTotal > 0 ? 'Margem Operacional' : 'Complete os cadastros para calcular'}</div>
                </div>
                {margem < 0 && fatTotal > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 4 }}>⚠️ Margem Negativa — Justificativa Obrigatória</div>
                    <textarea placeholder="Justificativa..." style={{ width: '100%', background: '#0a1628', border: '1px solid #ef4444', color: '#e8f0fe', borderRadius: 6, padding: '6px 8px', fontSize: 11, resize: 'none' }} rows={2} />
                  </div>
                )}
              </div>

              <button onClick={() => window.print()} style={{ width: '100%', padding: '8px', background: '#1e3a5c', border: 'none', color: '#64B4FF', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                🖨️ Gerar Romaneio PDF
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
