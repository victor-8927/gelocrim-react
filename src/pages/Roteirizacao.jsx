import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../services/api';
import { RefreshCw, Zap, MapPin, Trash2, ChevronRight } from 'lucide-react';

const DEPOSITO = { lat: -3.093544, lng: -60.075812 };
const CORES_ROTA = { '801': '#FF6B6B', '802': '#4ECDC4', '803': '#45B7D1', '804': '#96CEB4', '805': '#FFEAA7', '811': '#DDA0DD', '822': '#98D8C8' };

function getCorRota(rota) {
  return CORES_ROTA[rota] || '#e8521a';
}

export default function Roteirizacao() {
  const [clientes, setClientes] = useState([]);
  const [selecionados, setSelecionados] = useState({});
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [veiculo, setVeiculo] = useState('');
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [filtroRota, setFiltroRota] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [status, setStatus] = useState('');
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markers = useRef([]);
  const today = new Date().toISOString().slice(0,10);
  const [data, setData] = useState(today);

  const load = useCallback(async () => {
    setCarregando(true);
    try {
      const [orders, clis, veics, drivs] = await Promise.all([
        api.get('/orders?status=pending&limit=500'),
        api.get('/clientes'),
        api.get('/vehicles'),
        api.get('/drivers?type=driver'),
      ]);

      const ordersArr = Array.isArray(orders) ? orders : [];
      const clisArr = Array.isArray(clis) ? clis : [];
      const cliMap = {};
      clisArr.forEach(c => { if (c.codparc) cliMap[c.codparc] = c; });

      const clienteMap = {};
      ordersArr.forEach(o => {
        const key = o.codparc || o.recipient_name;
        if (!key) return;
        const cli = cliMap[o.codparc];
        if (!clienteMap[key]) {
          clienteMap[key] = {
            id: `cli-${o.codparc || key}`,
            codparc: o.codparc,
            name: (cli?.name || cli?.nome) || o.recipient_name || '—',
            address: (cli?.address || cli?.endereco) || o.address || '',
            lat: cli?.lat ? parseFloat(cli.lat) : null,
            lng: cli?.lng ? parseFloat(cli.lng) : null,
            rota: cli?.route || cli?.rota || '',
            regiao: cli?.geo_zone || cli?.regiao || '',
            bairro: cli?.district || cli?.bairro || '',
            service_time: cli?.service_time || 20,
            pedidos: [],
            peso: 0,
          };
        }
        clienteMap[key].pedidos.push(o.external_id || o.id);
        clienteMap[key].peso += parseFloat(o.weight_kg) || 0;
      });

      const items = Object.values(clienteMap).filter(c => c.lat && c.lng);
      setClientes(items);
      setStatus(`${items.length} clientes com GPS`);
      setVeiculos(Array.isArray(veics) ? veics : []);
      setMotoristas(Array.isArray(drivs) ? drivs : []);
    } catch (e) {
      setStatus('Erro ao carregar: ' + (e.detail || e.message));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Inicializa mapa
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: DEPOSITO,
        zoom: 12,
        mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
      // Marker depósito
      new window.google.maps.Marker({
        position: DEPOSITO,
        map: mapObj.current,
        title: 'Deposito Gelocrim',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#e8521a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });
    }
  }, []);

  // Renderiza markers
  useEffect(() => {
    if (!mapObj.current || !window.google) return;
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];

    const filtrados = clientes.filter(c => {
      if (filtroRota && !(c.rota || c.regiao || '').includes(filtroRota)) return false;
      if (filtroBairro && !(c.bairro || '').toLowerCase().includes(filtroBairro.toLowerCase())) return false;
      if (filtroBusca && !(c.name || '').toLowerCase().includes(filtroBusca.toLowerCase())) return false;
      return true;
    });

    const bounds = new window.google.maps.LatLngBounds();
    filtrados.forEach(c => {
      const sel = !!selecionados[c.id];
      const cor = sel ? '#00FF88' : getCorRota(c.rota);
      const mk = new window.google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map: mapObj.current,
        title: c.name,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
          fillColor: cor,
          fillOpacity: 1,
          strokeColor: '#001020',
          strokeWeight: 1,
          scale: 1.5,
          anchor: new window.google.maps.Point(12, 22)
        }
      });
      mk.addListener('click', () => {
        setSelecionados(prev => {
          const next = { ...prev };
          if (next[c.id]) delete next[c.id];
          else next[c.id] = c;
          return next;
        });
      });
      markers.current.push(mk);
      bounds.extend({ lat: c.lat, lng: c.lng });
    });

    if (filtrados.length > 0) mapObj.current.fitBounds(bounds);
  }, [clientes, selecionados, filtroRota, filtroBairro, filtroBusca]);

  const selArr = Object.values(selecionados);
  const pesoTotal = selArr.reduce((s, c) => s + (c.peso || 0), 0);

  const rotasFixas = ['801', '802', '803', '804', '805', '811', '822'];
  const bairros = [...new Set(clientes.map(c => c.bairro).filter(Boolean))].sort();

  const roteirizar = async () => {
    if (!selArr.length) return alert('Selecione ao menos um cliente');
    if (!veiculo) return alert('Selecione um veiculo');
    setLoading(true);
    try {
      const codparcs = selArr.map(c => parseInt(c.codparc)).filter(Boolean);
      const res = await api.post('/routes/otimizar', {
        codparcs,
        modo: 'otimizado',
        hora_saida: '07:30',
        deposito_lat: DEPOSITO.lat,
        deposito_lng: DEPOSITO.lng
      });
      alert(`Rota otimizada! ${res.total_paradas} paradas · ${res.dist_total_km} km · Retorno: ${res.hora_retorno}`);
    } catch (e) {
      alert('Erro: ' + (e.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 56px - 48px)' }}>
      {/* Painel esquerdo */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Roteirizacao Visual</h1>
            <p style={{ color: '#90afd4', fontSize: 12 }}>{status}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" className="form-control" style={{ width: 130, fontSize: 11 }} value={data} onChange={e => setData(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={load} disabled={carregando}>
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select className="form-control" style={{ fontSize: 12 }} value={filtroRota} onChange={e => setFiltroRota(e.target.value)}>
            <option value="">Todas as rotas</option>
            {rotasFixas.map(r => <option key={r} value={r}>Rota {r}</option>)}
          </select>
          <select className="form-control" style={{ fontSize: 12 }} value={filtroBairro} onChange={e => setFiltroBairro(e.target.value)}>
            <option value="">Todos os bairros</option>
            {bairros.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input className="form-control" style={{ fontSize: 12 }} placeholder="Buscar cliente..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} />
        </div>

        {/* Carga selecionada */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>Carga Selecionada</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e8521a' }}>{selArr.length}</div>
              <div style={{ fontSize: 10, color: '#90afd4' }}>Clientes</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{pesoTotal.toFixed(0)}</div>
              <div style={{ fontSize: 10, color: '#90afd4' }}>kg</div>
            </div>
          </div>
        </div>

        {/* Clientes selecionados */}
        <div className="card" style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>
            Clientes Selecionados ({selArr.length})
          </div>
          {selArr.length === 0 ? (
            <div style={{ color: '#90afd4', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Clique nos pins no mapa para selecionar
            </div>
          ) : selArr.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1e3a5c' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00FF88', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 10, color: '#90afd4' }}>{c.peso?.toFixed(0)} kg · {c.pedidos?.length} ped.</div>
              </div>
              <button onClick={() => setSelecionados(prev => { const n = {...prev}; delete n[c.id]; return n; })}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Veiculo e botao */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select className="form-control" value={veiculo} onChange={e => setVeiculo(e.target.value)}>
            <option value="">Selecione o veiculo</option>
            {veiculos.map(v => <option key={v.id} value={v.id}>{v.name || v.plate}</option>)}
          </select>
          <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={roteirizar} disabled={loading || !selArr.length || !veiculo}>
            <Zap size={14} /> {loading ? 'Otimizando...' : 'Roteirizar'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
