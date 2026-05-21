import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getRoutes, supabase } from '../services/supabase';
import { RefreshCw } from 'lucide-react';

export default function Monitoramento() {
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rotaSel, setRotaSel] = useState(null);
  const [satelite, setSatelite] = useState(false);
  const [trafego, setTrafego] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const trafegoLayer = useRef(null);
  const intervalRef = useRef(null);

  // Data de hoje em Manaus (UTC-4)
  const hojeManaus = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rotasData = await getRoutes({ date: hojeManaus() });
      setRotas(Array.isArray(rotasData) ? rotasData : []);
    } catch (e) { console.error('Monitoramento load:', e); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // Auto refresh a cada 30s
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
        center: { lat: -3.093544, lng: -60.075812 },
        zoom: 12, mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
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

  // Markers GPS das rotas em campo — lê current_lat/lng das routes
  useEffect(() => {
    if (!mapObj.current || !window.google) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const rotasAtivas = rotas.filter(r => r.status === 'in_progress' && r.current_lat && r.current_lng);

    rotasAtivas.forEach(r => {
      const mk = new window.google.maps.Marker({
        position: { lat: parseFloat(r.current_lat), lng: parseFloat(r.current_lng) },
        map: mapObj.current,
        title: `${r.driver_name || 'Motorista'} — ${r.trip_number}`,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#e8521a',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        }
      });

      // Info window ao clicar
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color:#001020;font-size:12px;font-weight:700;padding:4px">
            ${r.trip_number}<br/>
            <span style="font-weight:400">${r.driver_name || '—'} · ${r.vehicle_name || '—'}</span><br/>
            <span style="color:#e8521a">GPS: ${parseFloat(r.current_lat).toFixed(4)}, ${parseFloat(r.current_lng).toFixed(4)}</span>
          </div>
        `
      });
      mk.addListener('click', function() {
        infoWindow.open(mapObj.current, mk);
      });

      markersRef.current.push(mk);
    });

    // Se tem rotas ativas com GPS, centraliza o mapa nelas
    if (rotasAtivas.length > 0 && mapObj.current) {
      const bounds = new window.google.maps.LatLngBounds();
      rotasAtivas.forEach(r => bounds.extend({ lat: parseFloat(r.current_lat), lng: parseFloat(r.current_lng) }));
      mapObj.current.fitBounds(bounds);
      if (rotasAtivas.length === 1) mapObj.current.setZoom(14);
    }
  }, [rotas]);

  // KPIs
  const emRota    = rotas.filter(r => r.status === 'in_progress').length;
  const concluidas = rotas.filter(r => r.status === 'completed').length;
  const liberadas  = rotas.filter(r => r.status === 'planned').length;
  const totalEntregas  = rotas.reduce((s, r) => s + (r.total_stops || 0), 0);
  const entregasFeitas = rotas.reduce((s, r) => s + (r.completed_stops || 0), 0);
  const progresso = totalEntregas > 0 ? Math.round(entregasFeitas / totalEntregas * 100) : 0;
  const gpsAtivos = rotas.filter(r => r.status === 'in_progress' && r.current_lat && r.current_lng).length;

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
            { emoji: '🚛', label: 'Em Rota',    value: emRota,            cor: '#f97316' },
            { emoji: '✅', label: 'Concluídas', value: concluidas,         cor: '#10b981' },
            { emoji: '🟢', label: 'Liberadas',  value: liberadas,          cor: '#64B4FF' },
            { emoji: '📦', label: 'Entregas',   value: `${entregasFeitas}/${totalEntregas}`, cor: '#a78bfa' },
            { emoji: '📡', label: 'GPS Ativo',  value: gpsAtivos,          cor: '#f59e0b' },
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
            const st = statusLabel(r.status);
            const stops = r.total_stops || 0;
            const done  = r.completed_stops || 0;
            const pct   = stops > 0 ? Math.round(done / stops * 100) : 0;
            const sel   = rotaSel === r.id;
            const temGps = r.status === 'in_progress' && r.current_lat && r.current_lng;
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
                {/* GPS status */}
                <div style={{ fontSize: 10, marginBottom: 4, color: temGps ? '#10b981' : 'rgba(255,255,255,0.2)' }}>
                  {temGps ? `📡 GPS ativo` : '📡 GPS inativo'}
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
          <div style={{ borderTop: '1px solid #1e3a5c', paddingTop: 10, maxHeight: 260, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>❄️ LINHA DO TEMPO</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 8 }}>{rotaAtual.trip_number} — {rotaAtual.driver_name || '—'}</div>
            {(rotaAtual.stops || []).map((s, i) => {
              const ok      = s.status === 'delivered';
              const recusou = s.status === 'failed';
              const reagend = s.status === 'rescheduled';
              return (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: ok ? '#10b981' : recusou ? '#ef4444' : reagend ? '#f59e0b' : '#1e3a5c', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: ok ? '#10b981' : recusou ? '#ef4444' : reagend ? '#f59e0b' : '#e8f0fe' }}>
                      {ok ? '✅' : recusou ? '❌' : reagend ? '🔄' : '⏳'} {s.recipient_name || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>
                      {s.eta || '—'}{s.failure_reason ? ` · ${s.failure_reason}` : ''}
                    </div>
                  </div>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>MAPA EM TEMPO REAL</div>
          <button onClick={() => setSatelite(s => !s)}
            style={{ background: satelite ? 'rgba(100,180,255,.2)' : '#1e3a5c', border: `1px solid ${satelite ? '#64B4FF' : '#1e3a5c'}`, color: satelite ? '#64B4FF' : '#90afd4', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            🛰️ Satélite
          </button>
          <button onClick={() => setTrafego(t => !t)}
            style={{ background: trafego ? 'rgba(239,68,68,.2)' : '#1e3a5c', border: `1px solid ${trafego ? '#ef4444' : '#1e3a5c'}`, color: trafego ? '#ef4444' : '#90afd4', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            🚦 Tráfego
          </button>
          <span style={{ fontSize: 11, color: gpsAtivos > 0 ? '#10b981' : '#90afd4', marginLeft: 'auto', fontWeight: gpsAtivos > 0 ? 700 : 400 }}>
            {gpsAtivos > 0 ? `📡 ${gpsAtivos} veículo(s) em campo` : 'Nenhum GPS ativo'}
          </span>
        </div>
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', minHeight: 300 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}
