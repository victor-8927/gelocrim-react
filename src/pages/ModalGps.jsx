import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../services/supabase';

var GOOGLE_KEY = 'AIzaSyB47DpEZW4qbU74LxcG1ZD76cYLRlJw88M';
var MANAUS = { lat: -3.1019, lng: -60.025 };

export default function ModalGps({ pedido, onFechar, onSalvo }) {
  var [pos, setPos]           = useState({ lat: parseFloat(pedido.lat) || MANAUS.lat, lng: parseFloat(pedido.lng) || MANAUS.lng });
  var [endereco, setEndereco] = useState('');
  var [busca, setBusca]       = useState('');
  var [salvando, setSalvando] = useState(false);
  var [msg, setMsg]           = useState('');
  var mapRef  = useRef(null);
  var mapObj  = useRef(null);
  var marker  = useRef(null);

  var temGps = !!(pedido.lat && pedido.lng);

  useEffect(function() {
    if (!window.google || !mapRef.current) return;
    iniciarMapa();
  }, []); // eslint-disable-line

  // Aguardar Google Maps carregar
  useEffect(function() {
    var t = setInterval(function() {
      if (window.google && mapRef.current && !mapObj.current) {
        iniciarMapa();
        clearInterval(t);
      }
    }, 300);
    return function() { clearInterval(t); };
  }, []); // eslint-disable-line

  function iniciarMapa() {
    var centro = { lat: pos.lat, lng: pos.lng };
    mapObj.current = new window.google.maps.Map(mapRef.current, {
      center: centro,
      zoom: 16,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });

    marker.current = new window.google.maps.Marker({
      position: centro,
      map: mapObj.current,
      draggable: true,
      title: pedido.recipient_name,
      animation: window.google.maps.Animation.DROP,
    });

    marker.current.addListener('dragend', function(e) {
      var novaPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setPos(novaPos);
      geocodeReverso(novaPos.lat, novaPos.lng);
    });

    // Geocodificar endereço atual se não tem GPS
    if (!temGps && pedido.address) {
      geocodificarEndereco(pedido.address + ', Manaus, AM, Brasil');
    } else {
      geocodeReverso(pos.lat, pos.lng);
    }
  }

  async function geocodificarEndereco(addr) {
    try {
      var res = await fetch('https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(addr) + '&key=' + GOOGLE_KEY + '&region=BR&language=pt-BR');
      var data = await res.json();
      if (data.results && data.results[0]) {
        var loc = data.results[0].geometry.location;
        var novaPos = { lat: loc.lat, lng: loc.lng };
        setPos(novaPos);
        setEndereco(data.results[0].formatted_address);
        if (mapObj.current) mapObj.current.setCenter(novaPos);
        if (marker.current) marker.current.setPosition(novaPos);
      }
    } catch (e) {}
  }

  async function geocodeReverso(lat, lng) {
    try {
      var res = await fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat + ',' + lng + '&key=' + GOOGLE_KEY + '&language=pt-BR');
      var data = await res.json();
      if (data.results && data.results[0]) {
        setEndereco(data.results[0].formatted_address);
      }
    } catch (e) {}
  }

  function handleBusca(e) {
    e.preventDefault();
    if (!busca.trim()) return;
    geocodificarEndereco(busca + ', Manaus, AM, Brasil');
  }

  async function salvar() {
    setSalvando(true);
    setMsg('');
    try {
      // 1. Atualizar tabela clients
      if (pedido.codparc) {
        await supabase.from('clients').update({ lat: pos.lat, lng: pos.lng }).eq('codparc', pedido.codparc);
      }
      // 2. Atualizar todos os pedidos deste cliente
      await supabase.from('orders').update({ lat: pos.lat, lng: pos.lng }).eq('codparc', pedido.codparc);

      setMsg('✅ GPS salvo com sucesso!');
      setTimeout(function() { onSalvo(pos.lat, pos.lng); }, 800);
    } catch (e) {
      setMsg('❌ Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={function(e) { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ background:'#0f2040', border:'1px solid #1e3a5c', borderRadius:16, width:640, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #1e3a5c', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>📍 Geolocalizar cliente</div>
            <div style={{ fontSize:12, color:'#90afd4', marginTop:2 }}>{pedido.recipient_name} · Cód. {pedido.codparc}</div>
          </div>
          <button onClick={onFechar} style={{ background:'none', border:'none', color:'#90afd4', cursor:'pointer' }}><X size={20} /></button>
        </div>

        {/* Info endereço cadastrado */}
        {pedido.address && (
          <div style={{ padding:'8px 20px', background:'rgba(100,180,255,0.08)', borderBottom:'1px solid #1e3a5c', fontSize:12, color:'#90afd4' }}>
            <span style={{ color:'#64B4FF', fontWeight:700 }}>Endereço cadastrado: </span>{pedido.address}
          </div>
        )}

        {/* Busca */}
        <div style={{ padding:'10px 20px', borderBottom:'1px solid #1e3a5c' }}>
          <form onSubmit={handleBusca} style={{ display:'flex', gap:8 }}>
            <input
              value={busca} onChange={function(e) { setBusca(e.target.value); }}
              placeholder="Buscar endereço no mapa..."
              style={{ flex:1, background:'#0a1628', border:'1px solid #1e3a5c', color:'#e8f0fe', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none' }}
            />
            <button type="submit" style={{ padding:'8px 16px', background:'rgba(100,180,255,0.15)', border:'1px solid #64B4FF', color:'#64B4FF', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              Buscar
            </button>
          </form>
        </div>

        {/* Mapa */}
        <div style={{ position:'relative', flex:1, minHeight:340 }}>
          <div ref={mapRef} style={{ width:'100%', height:'100%', minHeight:340 }} />

          {/* Coordenadas overlay */}
          <div style={{ position:'absolute', top:10, left:10, background:'rgba(15,32,64,0.9)', border:'1px solid #1e3a5c', borderRadius:8, padding:'4px 10px', fontSize:11, fontFamily:'monospace', color:'#64B4FF', pointerEvents:'none' }}>
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
          </div>

          {/* Instrução */}
          <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', background:'rgba(15,32,64,0.9)', border:'1px solid #1e3a5c', borderRadius:8, padding:'4px 12px', fontSize:11, color:'#90afd4', whiteSpace:'nowrap', pointerEvents:'none' }}>
            Arraste o pin para o local correto
          </div>
        </div>

        {/* Endereço geocodificado */}
        {endereco && (
          <div style={{ padding:'8px 20px', borderTop:'1px solid #1e3a5c', fontSize:12, color:'#90afd4' }}>
            <span style={{ color:'#10b981', fontWeight:700 }}>Local: </span>{endereco}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:'12px 20px', borderTop:'1px solid #1e3a5c', display:'flex', gap:10, alignItems:'center' }}>
          {msg && (
            <span style={{ flex:1, fontSize:13, color: msg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{msg}</span>
          )}
          {!msg && <span style={{ flex:1 }} />}
          <button onClick={onFechar} style={{ padding:'8px 16px', background:'transparent', border:'1px solid #1e3a5c', color:'#90afd4', borderRadius:8, cursor:'pointer', fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            style={{ padding:'8px 20px', background: salvando ? 'rgba(16,185,129,0.3)' : '#10b981', border:'none', color:'#001020', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            {salvando ? '⏳ Salvando...' : '💾 Salvar GPS'}
          </button>
        </div>
      </div>
    </div>
  );
}
