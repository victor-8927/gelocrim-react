import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getRoutes, supabase } from '../services/supabase';
import { RefreshCw } from 'lucide-react';

const DEPOSITO = { lat: -3.093544, lng: -60.075812 };

export default function Monitoramento() {
  const [rotas, setRotas]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [rotaSel, setRotaSel]     = useState(null);
  const [satelite, setSatelite]   = useState(false);
  const [trafego, setTrafego]     = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [stopInfo, setStopInfo]   = useState(null); // ficha do cliente ao clicar no pin
  const mapRef       = useRef(null);
  const mapObj       = useRef(null);
  const markersRef   = useRef([]);
  const polylinesRef = useRef([]);
  const trafegoLayer = useRef(null);
  const intervalRef  = useRef(null);
  const infoWindowRef = useRef(null);

  const hojeManaus = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Converte timestamp UTC para hora de Manaus (UTC-4)
  const horaManaus = (ts) => {
    if (!ts) return '—';
    const d = new Date(new Date(ts).getTime() - 4 * 60 * 60 * 1000);
    return d.toISOString().slice(11, 16);
  };

  // Idade do GPS em minutos
  const gpsIdadeMin = (ts) => ts ? Math.round((new Date() - new Date(ts)) / 60000) : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rotasData, ativas] = await Promise.all([
        getRoutes({ date: hojeManaus() }),
        supabase.from('routes').select('*, stops(stop_id,status,recipient_name,address,sequence,lat,lng,weight_kg,ata,atd,eta,nf_url,canhoto_url,failure_reason)').eq('status', 'in_progress'),
      ]);
      const hoje = Array.isArray(rotasData) ? rotasData : [];
      const cross = (ativas.data || []).filter(r => !hoje.find(h => h.id === r.id));
      setRotas([...hoje, ...cross]);
    } catch (e) { console.error('Monitoramento load:', e); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 30000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, load]);

  // Inicializa mapa
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: DEPOSITO, zoom: 12, mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
      // Depósito
      new window.google.maps.Marker({
        position: DEPOSITO, map: mapObj.current, title: 'Depósito GELOCRIM',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#e8521a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }
  }, []);

  // Satélite
  useEffect(() => {
    if (!mapObj.current) return;
    mapObj.current.setMapTypeId(satelite ? 'satellite' : 'roadmap');
  }, [satelite]);

  // Tráfego
  useEffect(() => {
    if (!mapObj.current || !window.google) return;
    if (trafego) {
      trafegoLayer.current = new window.google.maps.TrafficLayer();
      trafegoLayer.current.setMap(mapObj.current);
    } else {
      if (trafegoLayer.current) trafegoLayer.current.setMap(null);
    }
  }, [trafego]);

  // Desenhar rotas no mapa
  useEffect(() => {
    if (!mapObj.current || !window.google) return;

    // Limpar markers e polylines anteriores
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(DEPOSITO);
    let temPontos = false;

    rotas.forEach(r => {
      const stops = (r.stops || []).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

      // ── ROTA PLANEJADA — linha azul conectando os stops em sequência ──────
      const stopsComCoord = stops.filter(s => s.lat && s.lng);
      if (stopsComCoord.length > 1) {
        const path = [DEPOSITO, ...stopsComCoord.map(s => ({ lat: parseFloat(s.lat), lng: parseFloat(s.lng) })), DEPOSITO];
        const poly = new window.google.maps.Polyline({
          path, map: mapObj.current,
          strokeColor: '#64B4FF', strokeOpacity: 0.5, strokeWeight: 2,
          geodesic: true, icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_OPEN_ARROW }, offset: '50%' }]
        });
        polylinesRef.current.push(poly);
      }

      // ── PINS DOS CLIENTES ──────────────────────────────────────────────────
      stops.forEach((stop, idx) => {
        if (!stop.lat || !stop.lng) return;
        const lat = parseFloat(stop.lat);
        const lng = parseFloat(stop.lng);
        bounds.extend({ lat, lng });
        temPontos = true;

        const cor = stop.status === 'delivered' ? '#10b981' : stop.status === 'failed' ? '#ef4444' : stop.status === 'in_progress' ? '#f97316' : '#64B4FF';
        const emoji = stop.status === 'delivered' ? '✅' : stop.status === 'failed' ? '❌' : stop.status === 'in_progress' ? '🔄' : '⏳';

        const mk = new window.google.maps.Marker({
          position: { lat, lng }, map: mapObj.current,
          title: stop.recipient_name,
          label: { text: String(stop.sequence || idx + 1), color: '#fff', fontSize: '10px', fontWeight: 'bold' },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12, fillColor: cor, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2
          }
        });

        mk.addListener('click', () => {
          setStopInfo({ stop, rota: r, emoji });
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(`
              <div style="color:#001020;font-size:12px;padding:6px;min-width:200px">
                <div style="font-weight:800;font-size:13px;margin-bottom:4px">${emoji} ${stop.recipient_name || '—'}</div>
                <div style="color:#666;margin-bottom:4px">${stop.address || '—'}</div>
                <div style="display:flex;gap:12px;font-size:11px">
                  <span><b>Peso:</b> ${parseFloat(stop.weight_kg || 0).toFixed(0)} kg</span>
                  <span><b>Seq:</b> ${stop.sequence || idx + 1}</span>
                </div>
                ${stop.ata ? `<div style="font-size:11px;margin-top:4px">🕐 Chegada: ${horaManaus(stop.ata)}</div>` : ''}
                ${stop.atd ? `<div style="font-size:11px">🚀 Saída: ${horaManaus(stop.atd)}</div>` : ''}
                ${stop.failure_reason ? `<div style="color:#ef4444;font-size:11px;margin-top:4px">❌ ${stop.failure_reason}</div>` : ''}
              </div>
            `);
            infoWindowRef.current.open(mapObj.current, mk);
          }
        });

        markersRef.current.push(mk);
      });

      // ── PIN DO CAMINHÃO — posição atual GPS ───────────────────────────────
      if (r.status === 'in_progress' && r.current_lat && r.current_lng) {
        const lat = parseFloat(r.current_lat);
        const lng = parseFloat(r.current_lng);
        bounds.extend({ lat, lng });
        temPontos = true;

        const mkTruck = new window.google.maps.Marker({
          position: { lat, lng }, map: mapObj.current,
          title: `${r.driver_name || 'Motorista'} — ${r.trip_number}`,
          zIndex: 999,
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 7, fillColor: '#e8521a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, rotation: 0
          }
        });

        mkTruck.addListener('click', () => {
          if (infoWindowRef.current) {
            const done = r.completed_stops || 0;
            const total = r.total_stops || 0;
            const gpsAge = gpsIdadeMin(r.gps_updated_at);
            infoWindowRef.current.setContent(`
              <div style="color:#001020;font-size:12px;padding:6px;min-width:200px">
                <div style="font-weight:800;font-size:13px;margin-bottom:4px">🚛 ${r.driver_name || 'Motorista'}</div>
                <div style="color:#666;margin-bottom:4px">${r.trip_number} · ${r.vehicle_name || '—'}</div>
                <div style="font-size:11px"><b>Entregas:</b> ${done}/${total}</div>
                ${gpsAge !== null ? `<div style="font-size:11px;color:${gpsAge < 2 ? 'green' : gpsAge < 5 ? 'orange' : 'red'}">📡 GPS há ${gpsAge} min</div>` : ''}
              </div>
            `);
            infoWindowRef.current.open(mapObj.current, mkTruck);
          }
        });

        markersRef.current.push(mkTruck);
      }
    });

    // Centralizar mapa
    if (temPontos) {
      mapObj.current.fitBounds(bounds);
    }
  }, [rotas]);

  // KPIs
  const emRota       = rotas.filter(r => r.status === 'in_progress').length;
  const concluidas   = rotas.filter(r => r.status === 'completed').length;
  const liberadas    = rotas.filter(r => r.status === 'planned').length;
  const totalEntregas  = rotas.reduce((s, r) => s + (r.total_stops || 0), 0);
  const entregasFeitas = rotas.reduce((s, r) => s + (r.completed_stops || 0), 0);
  const gpsAtivos    = rotas.filter(r => r.status === 'in_progress' && r.current_lat && r.current_lng).length;

  const rotaAtual = rotas.find(r => r.id === rotaSel);

  const statusLabel = (s) => {
    if (s === 'in_progress') return { label: 'Em Rota',   cor: '#f97316', dot: '🟠' };
    if (s === 'completed')   return { label: 'Concluída', cor: '#10b981', dot: '✅' };
    if (s === 'planned')     return { label: 'Liberada',  cor: '#64B4FF', dot: '🟢' };
    return { label: s || 'Pendente', cor: '#90afd4', dot: '⚪' };
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 56px - 48px)', overflow: 'hidden' }}>

      {/* Painel esquerdo */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>🗼 Torre de Controle</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 2 }}>Monitoramento ativo em tempo real</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setAutoRefresh(a => !a)}
              style={{ background: autoRefresh ? 'rgba(16,185,129,.15)' : '#1e3a5c', border: `1px solid ${autoRefresh ? '#10b981' : '#1e3a5c'}`, color: autoRefresh ? '#10b981' : '#90afd4', borderRadius: 8, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              ● {autoRefresh ? 'AUTO 30s' : 'MANUAL'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}><RefreshCw size={12} /></button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
          {[
            { emoji: '🚛', label: 'Em Rota',    value: emRota,       cor: '#f97316' },
            { emoji: '✅', label: 'Concluídas', value: concluidas,   cor: '#10b981' },
            { emoji: '🟢', label: 'Liberadas',  value: liberadas,    cor: '#64B4FF' },
            { emoji: '📦', label: 'Entregas',   value: `${entregasFeitas}/${totalEntregas}`, cor: '#a78bfa' },
            { emoji: '📡', label: 'GPS Ativo',  value: gpsAtivos,    cor: '#f59e0b' },
          ].map(k => (
            <div key={k.label} className="card" style={{ textAlign: 'center', padding: '8px 4px' }}>
              <div style={{ fontSize: 16 }}>{k.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: k.cor }}>{k.value}</div>
              <div style={{ fontSize: 9, color: '#90afd4', lineHeight: 1.2, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>ROTAS DO DIA</div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ color: '#90afd4', textAlign: 'center', padding: 20 }}>Carregando...</div>
          ) : rotas.length === 0 ? (
            <div style={{ color: '#90afd4', textAlign: 'center', padding: 20 }}>Nenhuma rota hoje</div>
          ) : rotas.map(r => {
            const st   = statusLabel(r.status);
            const stops = r.total_stops || 0;
            const done  = r.completed_stops || 0;
            const pct   = stops > 0 ? Math.round(done / stops * 100) : 0;
            const sel   = rotaSel === r.id;
            const temGps = r.status === 'in_progress' && r.current_lat && r.current_lng;
            const gpsAge = gpsIdadeMin(r.gps_updated_at);
            return (
              <div key={r.id} onClick={() => setRotaSel(sel ? null : r.id)}
                style={{ background: '#0a1628', border: `1px solid ${sel ? '#e8521a' : '#1e3a5c'}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{r.trip_number || r.id?.slice(0, 16)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.cor }}>{st.dot} {st.label}</span>
                </div>
                <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 6 }}>
                  {r.vehicle_name || '—'} · {r.driver_name || '—'}
                </div>
                <div style={{ fontSize: 10, marginBottom: 4, color: temGps ? '#10b981' : 'rgba(255,255,255,0.2)' }}>
                  {temGps ? `📡 GPS ativo${gpsAge !== null ? ` · há ${gpsAge} min` : ''}` : '📡 GPS inativo'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#64B4FF' }}>{done}/{stops} entregas</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: '#1e3a5c', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: st.cor, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Linha do tempo da rota selecionada */}
        {rotaAtual && (
          <div style={{ borderTop: '1px solid #1e3a5c', paddingTop: 10, maxHeight: 280, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>❄️ LINHA DO TEMPO</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 8 }}>{rotaAtual.trip_number} — {rotaAtual.driver_name || '—'}</div>
            {(rotaAtual.stops || []).sort((a,b)=>(a.sequence||0)-(b.sequence||0)).map((s, i) => {
              const ok      = s.status === 'delivered';
              const recusou = s.status === 'failed';
              const reagend = s.status === 'rescheduled';
              return (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(30,58,92,.5)', cursor: 'pointer' }}
                  onClick={() => setStopInfo({ stop: s, rota: rotaAtual })}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: ok ? '#10b981' : recusou ? '#ef4444' : reagend ? '#f59e0b' : '#1e3a5c', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.sequence || i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: ok ? '#10b981' : recusou ? '#ef4444' : reagend ? '#f59e0b' : '#e8f0fe' }}>
                      {ok ? '✅' : recusou ? '❌' : reagend ? '🔄' : '⏳'} {s.recipient_name || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#90afd4', display: 'flex', gap: 8 }}>
                      <span>{s.eta || horaManaus(s.ata)}</span>
                      {s.weight_kg && <span>{parseFloat(s.weight_kg).toFixed(0)} kg</span>}
                      {s.failure_reason && <span style={{ color: '#ef4444' }}>{s.failure_reason}</span>}
                    </div>
                  </div>
                  {(s.canhoto_url || s.nf_url) && (
                    <div style={{ fontSize: 10, color: '#10b981' }}>📷</div>
                  )}
                </div>
              );
            })}
            {!(rotaAtual.stops || []).length && (
              <div style={{ color: '#90afd4', fontSize: 11 }}>Sem paradas registradas</div>
            )}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>MAPA EM TEMPO REAL</div>
          <button onClick={() => setSatelite(s => !s)}
            style={{ background: satelite ? 'rgba(100,180,255,.2)' : '#1e3a5c', border: `1px solid ${satelite ? '#64B4FF' : '#1e3a5c'}`, color: satelite ? '#64B4FF' : '#90afd4', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            🛰️ Satélite
          </button>
          <button onClick={() => setTrafego(t => !t)}
            style={{ background: trafego ? 'rgba(239,68,68,.2)' : '#1e3a5c', border: `1px solid ${trafego ? '#ef4444' : '#1e3a5c'}`, color: trafego ? '#ef4444' : '#90afd4', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            🚦 Tráfego
          </button>
          {/* Legenda */}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#64B4FF' }}>── Rota planejada</span>
            <span style={{ fontSize: 10, color: '#10b981' }}>● Entregue</span>
            <span style={{ fontSize: 10, color: '#ef4444' }}>● Falha</span>
            <span style={{ fontSize: 10, color: '#64B4FF' }}>● Pendente</span>
          </div>
          <span style={{ fontSize: 11, color: gpsAtivos > 0 ? '#10b981' : '#90afd4', fontWeight: gpsAtivos > 0 ? 700 : 400 }}>
            {gpsAtivos > 0 ? `📡 ${gpsAtivos} veículo(s) em campo` : 'Nenhum GPS ativo'}
          </span>
        </div>

        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', minHeight: 300, position: 'relative' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Ficha do cliente */}
          {stopInfo && (
            <div style={{ position: 'absolute', bottom: 16, right: 16, background: '#0f2035', border: '1px solid #1e3a5c', borderRadius: 12, padding: 14, width: 260, zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f0fe', flex: 1, marginRight: 8 }}>
                  {stopInfo.stop?.recipient_name || '—'}
                </div>
                <button onClick={() => setStopInfo(null)} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 8 }}>{stopInfo.stop?.address || '—'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Sequência', value: stopInfo.stop?.sequence || '—' },
                  { label: 'Peso', value: `${parseFloat(stopInfo.stop?.weight_kg || 0).toFixed(0)} kg` },
                  { label: 'Chegada', value: horaManaus(stopInfo.stop?.ata) },
                  { label: 'Saída', value: horaManaus(stopInfo.stop?.atd) },
                ].map(f => (
                  <div key={f.label} style={{ background: '#0a1628', borderRadius: 6, padding: '5px 8px' }}>
                    <div style={{ fontSize: 9, color: '#90afd4' }}>{f.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e8f0fe' }}>{f.value}</div>
                  </div>
                ))}
              </div>
              {stopInfo.stop?.failure_reason && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,.1)', borderRadius: 6, fontSize: 11, color: '#ef4444' }}>
                  ❌ {stopInfo.stop.failure_reason}
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                {stopInfo.stop?.nf_url && <a href={stopInfo.stop.nf_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#64B4FF', textDecoration: 'none', padding: '3px 8px', border: '1px solid #64B4FF', borderRadius: 4 }}>📄 NF</a>}
                {stopInfo.stop?.canhoto_url && <a href={stopInfo.stop.canhoto_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#10b981', textDecoration: 'none', padding: '3px 8px', border: '1px solid #10b981', borderRadius: 4 }}>✅ Canhoto</a>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
