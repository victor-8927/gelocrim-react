import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { RefreshCw, Radio, MapPin, Clock, Truck, AlertTriangle } from 'lucide-react';

const GMAPS_KEY = process.env.REACT_APP_GMAPS_KEY || 'AIzaSyB47DpEZW4qbU74LxcG1ZD76cYLRlJw88M';

export default function Monitoramento() {
  const [rotas, setRotas] = useState([]);
  const [gps, setGps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rotaSel, setRotaSel] = useState(null);
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markers = useRef([]);
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    try {
      const [r, g] = await Promise.all([
        api.get(`/routes?date=${today}`),
        api.get('/routes/gps/todos').catch(() => [])
      ]);
      setRotas(Array.isArray(r) ? r : []);
      setGps(Array.isArray(g) ? g : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: -3.093544, lng: -60.075812 },
        zoom: 12,
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ]
      });
    }
    // Limpa markers
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];

    // Adiciona pins de GPS
    gps.forEach(g => {
      if (!g.lat || !g.lng) return;
      const mk = new window.google.maps.Marker({
        position: { lat: parseFloat(g.lat), lng: parseFloat(g.lng) },
        map: mapObj.current,
        title: g.driver_name || 'Motorista',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#e8521a',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2
        }
      });
      markers.current.push(mk);
    });
  }, [gps]);

  const emRota = rotas.filter(r => r.status === 'in_progress').length;
  const concluidas = rotas.filter(r => r.status === 'completed').length;

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 56px - 48px)' }}>
      {/* Painel esquerdo */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Torre de Controle</h1>
            <p style={{ color: '#90afd4', fontSize: 12 }}>{rotas.length} rotas hoje</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={12} /></button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Em Rota', value: emRota, color: '#f97316', icon: Truck },
            { label: 'Concluidas', value: concluidas, color: '#10b981', icon: MapPin },
          ].map(k => (
            <div key={k.label} className="card" style={{ textAlign: 'center', padding: 12 }}>
              <k.icon size={18} color={k.color} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#90afd4' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Lista rotas */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ color: '#90afd4', textAlign: 'center', padding: 20 }}>Carregando...</div>
          ) : rotas.map(r => (
            <div
              key={r.id}
              className="card"
              style={{ cursor: 'pointer', border: rotaSel === r.id ? '1px solid #e8521a' : '1px solid #1e3a5c', padding: 12 }}
              onClick={() => setRotaSel(rotaSel === r.id ? null : r.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Truck size={14} color="#e8521a" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{r.vehicle_name || 'Veiculo'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: r.status === 'in_progress' ? '#f97316' : r.status === 'completed' ? '#10b981' : '#90afd4' }}>
                  {r.status === 'in_progress' ? '🟠 Em rota' : r.status === 'completed' ? '✅ Concluida' : r.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#90afd4' }}>
                {r.driver_name || '—'} · {r.total_stops || 0} paradas
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11 }}>
                <span style={{ color: '#64B4FF' }}>⏱ {r.start_time || '—'}</span>
                <span style={{ color: '#10b981' }}>🏁 {r.end_time || '—'}</span>
                <span style={{ color: '#a78bfa' }}>📍 {r.total_km || 0} km</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!window.google && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f2040', flexDirection: 'column', gap: 12 }}>
            <Radio size={40} color="#90afd4" />
            <div style={{ color: '#90afd4' }}>Carregando mapa...</div>
          </div>
        )}
        {gps.length === 0 && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,32,64,.9)', padding: '8px 16px', borderRadius: 8, fontSize: 12, color: '#90afd4' }}>
            Nenhum GPS ativo no momento
          </div>
        )}
      </div>
    </div>
  );
}
