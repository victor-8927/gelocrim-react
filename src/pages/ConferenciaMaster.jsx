import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { createRoute, supabase } from '../services/supabase';
import { ChevronUp, ChevronDown } from 'lucide-react';

const DEPOSITO = { lat: -3.093544, lng: -60.075812 };
const VEL_MEDIA = 35;
const ALMOCO_MIN = 12 * 60;
const ALMOCO_DUR = 72;
const FIM_NORMAL = 18 * 60;
const FIM_BANCO = 20 * 60;

// Detecta se cliente está do lado do Careiro (sul do Amazonas)
const BALSA_LAT_LIMITE = -3.20; // clientes abaixo desta lat precisam de balsa
const BALSA_TEMPO_MIN = 60; // 1 hora de travessia
const PORTO_CEASA = { lat: -3.1307, lng: -60.0233 };

function precisaBalsa(o) {
  return parseFloat(o.lat) < BALSA_LAT_LIMITE;
}

function calcEtas(ordem, horaInicio = '08:00', duracoesDirecoes = {}) {
  const [h, m] = horaInicio.split(':').map(Number);
  let minutos = h * 60 + m;
  let almocoFeito = false;
  let prev = DEPOSITO;
  let balsaIdaFeita = false;
  let balsaVoltaFeita = false;

  const result = ordem.map((o, idx) => {
    // Usar tempo real do Google Directions se disponível
    const duracaoReal = duracoesDirecoes[idx];
    const dlat = (parseFloat(o.lat) || prev.lat) - prev.lat;
    const dlng = (parseFloat(o.lng) || prev.lng) - prev.lng;
    const distKm = duracoesDirecoes[`dist_${idx}`] || parseFloat((Math.sqrt(dlat * dlat + dlng * dlng) * 111).toFixed(1));
    const tempoViagem = duracaoReal || Math.round(distKm / VEL_MEDIA * 60);
    const tempoAtend = parseInt(o.service_time || o._tempoAtend || 20);

    // Balsa ida — primeira vez que encontra cliente do Careiro
    if (precisaBalsa(o) && !balsaIdaFeita) {
      balsaIdaFeita = true;
      // Espera pela próxima saída (balsas de hora em hora)
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

    return { ...o, _eta: eta, _minutos: minutos, _distKm: distKm, _tempoAtend: tempoAtend, _tDeslocMin: tempoViagem, _jornada: jornada, _jornadaCor: jornadaCor, _balsa: precisaBalsa(o) };
  });

  // Calcular retorno ao depósito
  const ultimo = result[result.length - 1];
  if (ultimo) {
    let minutosRetorno = minutos;
    // Balsa volta se necessário
    if (balsaIdaFeita && !balsaVoltaFeita) {
      const minActual = minutosRetorno % 60;
      const espera = minActual === 0 ? 0 : 60 - minActual;
      minutosRetorno += espera + BALSA_TEMPO_MIN;
      balsaVoltaFeita = true;
    }
    const dlat = DEPOSITO.lat - parseFloat(ultimo.lat || DEPOSITO.lat);
    const dlng = DEPOSITO.lng - parseFloat(ultimo.lng || DEPOSITO.lng);
    const distRetorno = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    const tempoRetorno = Math.round(distRetorno / VEL_MEDIA * 60);
    minutosRetorno += tempoRetorno;
    const hh = Math.floor(minutosRetorno / 60) % 24;
    const mm = minutosRetorno % 60;
    result._retorno = {
      eta: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
      distKm: distRetorno.toFixed(1),
      tempoMin: tempoRetorno,
      comBalsa: balsaIdaFeita,
    };
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
  const [dragIdx, setDragIdx] = useState(null);
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const polyRef = useRef(null);
  const dirRendererRef = useRef(null);

  // Inicializa ordem com ETAs
  useEffect(() => {
    if (clientes?.length) {
      const comEta = calcEtas(clientes, horaInicio);
      setOrdem(comEta);
    }
  }, [clientes, horaInicio]);

  // Inicializa mapa
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: DEPOSITO, zoom: 12, mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
    }
  }, []);

  // Atualiza mapa quando ordem muda
  const atualizarMapa = useCallback(() => {
    if (!mapObj.current || !window.google || !ordem.length) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polyRef.current) { if (polyRef.current.setMap) polyRef.current.setMap(null); else if (polyRef.current.setDirections) polyRef.current.setMap(null); }

    // Depósito
    // Ícone casa laranja para o depósito
    const svgDeposito = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#e8521a" stroke="white" stroke-width="2"/>
      <text x="20" y="26" text-anchor="middle" fill="white" font-size="18">🏠</text>
    </svg>`;
    new window.google.maps.Marker({
      position: DEPOSITO, map: mapObj.current, title: 'Depósito Gelocrim',
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgDeposito), scaledSize: new window.google.maps.Size(40, 40), anchor: new window.google.maps.Point(20, 20) }
    });

    const path = [DEPOSITO];
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(DEPOSITO);

    ordem.forEach((o, i) => {
      if (!o.lat || !o.lng) return;
      const pos = { lat: parseFloat(o.lat), lng: parseFloat(o.lng) };
      path.push(pos);
      bounds.extend(pos);

      // Pin gota SVG preto com número branco
      const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
        <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 30 12 30s12-21 12-30C28 5.37 22.63 0 16 0z" fill="#111827" stroke="#fff" stroke-width="1.5"/>
        <circle cx="16" cy="12" r="8" fill="#111827"/>
        <text x="16" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">${i + 1}</text>
      </svg>`;
      const mk = new window.google.maps.Marker({
        position: pos, map: mapObj.current, title: o.recipient_name || o.name,
        icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgPin), scaledSize: new window.google.maps.Size(32, 42), anchor: new window.google.maps.Point(16, 42) },
      });
      markersRef.current.push(mk);
    });

    path.push(DEPOSITO);
    
    // Tentar usar Directions API para rota real
    const directionsService = new window.google.maps.DirectionsService();
    const waypoints = path.slice(1, path.length - 1).map(p => ({ location: p, stopover: true }));
    
    if (waypoints.length > 0 && waypoints.length <= 23) {
      directionsService.route({
        origin: DEPOSITO,
        destination: DEPOSITO,
        waypoints: waypoints,
        optimizeWaypoints: false,
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result, status) => {
        if (status === 'OK') {
          const renderer = new window.google.maps.DirectionsRenderer({
            map: mapObj.current, suppressMarkers: true,
            polylineOptions: { strokeColor: '#64B4FF', strokeWeight: 3, strokeOpacity: 0.8 }
          });
          renderer.setDirections(result);
          polyRef.current = renderer;
        } else {
          polyRef.current = new window.google.maps.Polyline({
            path, map: mapObj.current, strokeColor: '#64B4FF', strokeOpacity: 0.9, strokeWeight: 5
          });
        }
      });
    } else {
      polyRef.current = new window.google.maps.Polyline({
        path, map: mapObj.current, strokeColor: '#64B4FF', strokeOpacity: 0.9, strokeWeight: 5
      });
    }

    mapObj.current.fitBounds(bounds);
  }, [ordem]);

  useEffect(() => { atualizarMapa(); }, [atualizarMapa]);

  // Calculos
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

  // ETA fim
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

  // Drag & Drop
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
      const codparcs = ordem.map(o => parseInt(o.codparc)).filter(Boolean);
      if (codparcs.length) {
        // Usar Google Directions API com optimizeWaypoints
        const comGps = ordem.filter(o => o.lat && o.lng);
        if (comGps.length < 2) { alert('Mínimo 2 clientes com GPS para otimizar'); setOtimizando(false); return; }
        
        const waypoints = comGps.map(o => ({ location: { lat: parseFloat(o.lat), lng: parseFloat(o.lng) }, stopover: true }));
        
        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route({
          origin: DEPOSITO,
          destination: DEPOSITO,
          waypoints,
          optimizeWaypoints: true,
          travelMode: window.google.maps.TravelMode.DRIVING,
        }, (result, status) => {
          if (status === 'OK') {
            const waypointOrder = result.routes[0].waypoint_order;
            const novaOrdem = waypointOrder.map(idx => comGps[idx]);
            const duracoes = {};
            result.routes[0].legs.forEach((leg, i) => {
              if (i < novaOrdem.length) {
                duracoes[i] = Math.round(leg.duration.value / 60);
                duracoes[`dist_${i}`] = (leg.distance.value / 1000).toFixed(1);
              }
            });
            setOrdem(calcEtas(novaOrdem, horaInicio, duracoes));
            // Desenhar rota real no mapa
            if (dirRendererRef.current) dirRendererRef.current.setMap(null);
            if (!dirRendererRef.current) dirRendererRef.current = new window.google.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: '#64B4FF', strokeOpacity: 0.9, strokeWeight: 5 } });
            dirRendererRef.current.setMap(mapObj.current);
            dirRendererRef.current.setDirections(result);
          } else {
            // Fallback para Railway se Google falhar
            api.post('/routes/otimizar', {
              codparcs, modo: modoOtim, escopo,
              hora_saida: horaInicio,
              deposito_lat: DEPOSITO.lat, deposito_lng: DEPOSITO.lng
            }).then(res => {
              if (res.sequencia?.length) {
                const novaOrdem = [];
                res.sequencia.forEach(s => {
                  const encontrado = ordem.find(o => parseInt(o.codparc) === parseInt(s.codparc));
                  if (encontrado) novaOrdem.push({ ...encontrado, _eta: s.eta, _distKm: (s.dist_m / 1000).toFixed(1) });
                });
                ordem.forEach(o => { if (!o.codparc) novaOrdem.push(o); });
                setOrdem(calcEtas(novaOrdem, horaInicio));
              }
            }).catch(() => setOrdem(calcEtas(ordem, horaInicio)));
          }
          setOtimizando(false);
        });
      } catch (e) {
      setOrdem(calcEtas(ordem, horaInicio));
    } finally {
      setReprocessando(false);
      setConfirmado(false);
    }
  };

  const gravar = async () => {
    if (!confirmado) return;
    setGravando(true);
    try {
      // 1. Criar rota no Supabase
      const rota = await createRoute({
        vehicle_id: veiculo?.id,
        driver_id: motorista?.id,
        assistant1_id: ajudantes?.[0]?.id || null,
        assistant2_id: ajudantes?.[1]?.id || null,
        date: dataSaida,
        planned_start: horaInicio,
        total_stops: ordem.length,
      });

      // 2. Criar stops no Supabase
      if (rota?.id && ordem.length > 0) {
        const stops = ordem.map((o, i) => ({
          stop_id: `stp-${rota.id}-${i}`,
          route_id: rota.id,
          order_id: o.order_ids?.[0] || o.id || null,
          sequence: i + 1,
          recipient_name: o.recipient_name || o.name || '—',
          address: o.address || '',
          lat: parseFloat(o.lat) || null,
          lng: parseFloat(o.lng) || null,
          weight_kg: parseFloat(o.weight_kg) || 0,
          status: 'pending',
          eta: o._eta || null,
          codparc: o.codparc || null,
          created_at: new Date().toISOString(),
        }));
        await supabase.from('stops').insert(stops);

        // 3. Atualizar status dos pedidos para 'routed'
        const orderIds = ordem.flatMap(o => o.order_ids || []).filter(Boolean);
        if (orderIds.length > 0) {
          await supabase.from('orders').update({ status: 'routed', updated_at: new Date().toISOString() }).in('id', orderIds);
        }
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
            {/* Escopo */}
            <select value={escopo} onChange={e => setEscopo(e.target.value)} style={{ background: '#0f2040', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
              {escopos.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            {/* Modo otimização */}
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

          {/* Coluna esquerda - Sequência */}
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
            {/* Botões */}
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

          {/* Coluna direita - Indicadores */}
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
                {/* Peso */}
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
                {/* Barra de peso */}
                <div style={{ height: 6, background: '#1e3a5c', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pctCap)}%`, background: corPeso, borderRadius: 3, transition: 'width .5s' }} />
                </div>
              </div>

              <div style={{ height: 1, background: '#1e3a5c', margin: '12px 0' }} />

              {/* Mix de carga por TOP */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>💰 MIX DE CARGA POR TOP</div>
                {[
                  { label: '1000 Vendas', key: '1000' },
                  { label: '1009 Trocas', key: '1009' },
                  { label: '1007 Bonif.', key: '1007' },
                  { label: '1010 Pré-ped.', key: '1010' },
                  { label: '1008 Consig.', key: '1008' },
                ].map(top => {
                  const val = ordem.reduce((s, o) => {
                    const tipo = String(o.order_type || o.top || '');
                    if (tipo === top.key || tipo.includes(top.key)) return s + (parseFloat(o.total_value) || 0);
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
                  { label: 'Custo equipe', value: custoDia > 0 ? `R$ ${custoDia.toFixed(2)}` : '⚙️ Configurar no cadastro' },
                  { label: 'Combustível', value: custoDiesel > 0 ? `R$ ${custoDiesel.toFixed(2)}` : '⚙️ Configurar no veículo' },
                  { label: 'Manutenção/IPVA', value: (custoManut + ipvaDia) > 0 ? `R$ ${(custoManut + ipvaDia).toFixed(2)}` : '⚙️ Configurar no veículo' },
                  { label: 'Total custos', value: custoTotal > 0 ? `R$ ${custoTotal.toFixed(2)}` : '⚙️ Preencher cadastros' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                    <span style={{ fontSize: 11, color: '#90afd4' }}>{item.label}</span>
                    <span style={{ fontSize: 11, color: '#e8f0fe' }}>{item.value}</span>
                  </div>
                ))}

                {/* Semáforo margem */}
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

              {/* Romaneio */}
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
