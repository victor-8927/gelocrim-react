import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../services/api';
import { RefreshCw, Zap, ChevronRight } from 'lucide-react';
import ConferenciaMaster from './ConferenciaMaster';

const DEPOSITO = { lat: -3.093544, lng: -60.075812 };
const CORES_ROTA = { '801': '#FF6B6B', '802': '#4ECDC4', '803': '#45B7D1', '804': '#96CEB4', '805': '#FFEAA7', '811': '#DDA0DD', '822': '#98D8C8' };
const PESO_POR_PALLET = 1150;

function getCorRota(rota) {
  return CORES_ROTA[String(rota)] || '#e8521a';
}

function BarraCapacidade({ label, valor, cap, unidade }) {
  const pct = cap > 0 ? (valor / cap * 100) : 0;
  const cor = pct <= 100 ? '#10b981' : pct <= 110 ? '#f59e0b' : pct <= 120 ? '#f97316' : '#ef4444';
  const alerta = pct > 120 ? ' ⚠️ ACIMA!' : pct > 110 ? ' 🟠 +20%' : pct > 100 ? ' ⚠️ +10%' : '';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#90afd4' }}>{label}</span>
        <span style={{ fontSize: 11, color: cor, fontWeight: 600 }}>
          {unidade === 'kg' ? valor.toFixed(0) : unidade === 'pallets' ? Math.ceil(valor) : valor.toFixed(2)} {unidade} / {cap} {unidade} ({pct.toFixed(0)}%){alerta}
        </span>
      </div>
      <div style={{ height: 6, background: '#1e3a5c', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: cor, borderRadius: 3, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

export default function Roteirizacao() {
  const [clientes, setClientes] = useState([]);
  const [selecionados, setSelecionados] = useState({});
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [ajudantes, setAjudantes] = useState([]);
  const [veiculo, setVeiculo] = useState('');
  const [motorista, setMotorista] = useState('');
  const [ajudante1, setAjudante1] = useState('');
  const [ajudante2, setAjudante2] = useState('');
  const [confAberta, setConfAberta] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState('Clique em Atualizar');
  const [filtroRota, setFiltroRota] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [modoSel, setModoSel] = useState('individual');
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markers = useRef([]);
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);

  const load = useCallback(async () => {
    setCarregando(true);
    setStatus('Carregando clientes...');
    try {
      const [orders, clis, veics, drivs] = await Promise.all([
        api.get('/orders?status=pending&limit=500'),
        api.get('/clientes'),
        api.get('/vehicles'),
        api.get('/drivers'),
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
            recipient_name: (cli?.name || cli?.nome) || o.recipient_name || '—',
            address: (cli?.address || cli?.endereco) || o.address || '',
            lat: cli?.lat ? parseFloat(cli.lat) : null,
            lng: cli?.lng ? parseFloat(cli.lng) : null,
            rota: cli?.route || cli?.rota || '',
            regiao: cli?.geo_zone || cli?.regiao || '',
            bairro: cli?.district || cli?.bairro || '',
            service_time: cli?.service_time || 20,
            order_ids: [],
            pedidos: [],
            weight_kg: 0,
            volume_m3: 0,
            order_type: o.order_type || '',
            total_value: 0,
          };
        }
        clienteMap[key].order_ids.push(o.id);
        clienteMap[key].pedidos.push(o.external_id || o.id);
        clienteMap[key].weight_kg += parseFloat(o.weight_kg) || 0;
        clienteMap[key].volume_m3 += parseFloat(o.volume_m3) || 0;
        clienteMap[key].total_value += parseFloat(o.total_value) || 0;
      });

      const items = Object.values(clienteMap).filter(c => c.lat && c.lng);
      setClientes(items);
      setStatus(`${items.length} clientes no mapa`);

      const veicsArr = Array.isArray(veics) ? veics : [];
      setVeiculos(veicsArr);

      const drivsArr = Array.isArray(drivs) ? drivs : [];
      setMotoristas(drivsArr.filter(d => d.type === 'driver' || d.tipo === 'motorista'));
      setAjudantes(drivsArr.filter(d => d.type === 'assistant' || d.tipo === 'ajudante'));
    } catch (e) {
      setStatus('Erro: ' + (e.detail || e.message));
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
        center: DEPOSITO, zoom: 12, mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
      new window.google.maps.Marker({
        position: DEPOSITO, map: mapObj.current, title: 'Deposito Gelocrim',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#e8521a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });

      // Drawing Manager
      if (window.google.maps.drawing) {
        const dm = new window.google.maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: false,
          polygonOptions: { fillColor: '#64B4FF', fillOpacity: 0.2, strokeColor: '#64B4FF', strokeWeight: 2 },
          rectangleOptions: { fillColor: '#64B4FF', fillOpacity: 0.2, strokeColor: '#64B4FF', strokeWeight: 2 },
          circleOptions: { fillColor: '#64B4FF', fillOpacity: 0.2, strokeColor: '#64B4FF', strokeWeight: 2 },
        });
        dm.setMap(mapObj.current);
        mapObj.current._drawingManager = dm;

        const handleShape = (shape, getPoints) => {
          const points = getPoints();
          setClientes(prev => {
            const novos = {};
            prev.forEach(c => {
              if (c.lat && c.lng) {
                const ponto = new window.google.maps.LatLng(c.lat, c.lng);
                let dentro = false;
                if (shape.type === 'polygon') {
                  dentro = window.google.maps.geometry.poly.containsLocation(ponto, shape);
                } else if (shape.type === 'rectangle') {
                  dentro = shape.getBounds().contains(ponto);
                } else if (shape.type === 'circle') {
                  dentro = window.google.maps.geometry.spherical.computeDistanceBetween(ponto, shape.getCenter()) <= shape.getRadius();
                }
                if (dentro) novos[c.id] = c;
              }
            });
            setSelecionados(prev2 => ({ ...prev2, ...novos }));
            return prev;
          });
          shape.setMap(null);
          dm.setDrawingMode(null);
          setModoSel('individual');
        };

        window.google.maps.event.addListener(dm, 'polygoncomplete', shape => { shape.type = 'polygon'; handleShape(shape, () => []); });
        window.google.maps.event.addListener(dm, 'rectanglecomplete', shape => { shape.type = 'rectangle'; handleShape(shape, () => []); });
        window.google.maps.event.addListener(dm, 'circlecomplete', shape => { shape.type = 'circle'; handleShape(shape, () => []); });
      }
    }
  }, []);

  // Renderiza markers
  useEffect(() => {
    if (!mapObj.current || !window.google) return;
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];

    const filtrados = clientes.filter(c => {
      if (filtroRota && !(c.rota || '').includes(filtroRota)) return false;
      if (filtroRegiao && (c.regiao || '') !== filtroRegiao) return false;
      if (filtroBairro && !(c.bairro || '').toLowerCase().includes(filtroBairro.toLowerCase())) return false;
      if (filtroBusca && !(c.recipient_name || '').toLowerCase().includes(filtroBusca.toLowerCase()) && !String(c.codparc || '').includes(filtroBusca)) return false;
      return true;
    });

    const bounds = new window.google.maps.LatLngBounds();
    filtrados.forEach(c => {
      const sel = !!selecionados[c.id];
      const cor = sel ? '#00FF88' : getCorRota(c.rota);
      const mk = new window.google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map: mapObj.current,
        title: c.recipient_name,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
          fillColor: cor, fillOpacity: 1, strokeColor: '#001020', strokeWeight: 1,
          scale: 1.5, anchor: new window.google.maps.Point(12, 22)
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
  }, [clientes, selecionados, filtroRota, filtroRegiao, filtroBairro, filtroBusca]);

  const selArr = Object.values(selecionados);
  const pesoTotal = selArr.reduce((s, c) => s + (c.weight_kg || 0), 0);
  const volTotal = selArr.reduce((s, c) => s + (c.volume_m3 || 0), 0);
  const palletsEst = Math.ceil(pesoTotal / PESO_POR_PALLET) || 0;

  const veiculoObj = veiculos.find(v => v.id === veiculo);
  const motoristaObj = motoristas.find(m => m.id === motorista);
  const aj1Obj = ajudantes.find(a => a.id === ajudante1);
  const aj2Obj = ajudantes.find(a => a.id === ajudante2);

  const capKg = parseFloat(veiculoObj?.capacity_kg || 0);
  const capM3 = parseFloat(veiculoObj?.capacity_m3 || 0);
  const capPallets = parseInt(veiculoObj?.cap_pallets || veiculoObj?.pallets || 0);
  const bauInfo = veiculoObj ? `${veiculoObj.box_length || '—'}×${veiculoObj.box_width || '—'}×${veiculoObj.box_height || '—'} m` : '—';

  const rotasFixas = ['801', '802', '803', '804', '805', '811', '822'];
  const regioes = [...new Set(clientes.map(c => c.regiao).filter(Boolean))].sort();
  const bairros = [...new Set(clientes.map(c => c.bairro).filter(Boolean))].sort();

  // Ativar drawing manager quando modo muda
  useEffect(() => {
    const dm = mapObj.current?._drawingManager;
    if (!dm) return;
    if (modoSel === 'poligono') dm.setDrawingMode(window.google?.maps?.drawing?.OverlayType?.POLYGON);
    else if (modoSel === 'retangulo') dm.setDrawingMode(window.google?.maps?.drawing?.OverlayType?.RECTANGLE);
    else if (modoSel === 'circulo') dm.setDrawingMode(window.google?.maps?.drawing?.OverlayType?.CIRCLE);
    else dm.setDrawingMode(null);
  }, [modoSel]);

  const roteirizar = () => {
    if (!selArr.length) return alert('Selecione ao menos um cliente no mapa');
    if (!veiculo) return alert('Selecione um veículo');
    if (!motorista) return alert('Selecione um motorista');
    setConfAberta(true);
  };

  const limparFiltros = () => { setFiltroRota(''); setFiltroRegiao(''); setFiltroBairro(''); setFiltroBusca(''); };

  return (
    <>
    <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 56px - 48px)', overflow: 'hidden' }}>

      {/* Painel esquerdo */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>⚡ Roteirização Visual</div>
            <div style={{ fontSize: 11, color: '#90afd4' }}>Selecione clientes no mapa, escolha o veículo e roteirize</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" className="form-control" style={{ width: 130, fontSize: 11 }} value={data} onChange={e => setData(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={load} disabled={carregando}><RefreshCw size={12} /></button>
          </div>
        </div>

        {/* PASSO 1 */}
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>PASSO 1 — SELECIONE CLIENTES NO MAPA</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {[
              { value: 'individual', label: '📌 Individual' },
              { value: 'poligono', label: '⬡ Polígono' },
              { value: 'retangulo', label: '⬜ Retângulo' },
              { value: 'circulo', label: '⭕ Círculo' },
            ].map(m => (
              <button key={m.value} onClick={() => setModoSel(m.value)} style={{ flex: 1, padding: '5px 4px', border: `2px solid ${modoSel === m.value ? '#64B4FF' : '#1e3a5c'}`, background: modoSel === m.value ? 'rgba(100,180,255,.15)' : 'transparent', color: modoSel === m.value ? '#64B4FF' : '#90afd4', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, minWidth: 0 }}>
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#90afd4', textAlign: 'center' }}>
            {modoSel === 'individual' ? '📌 Clique nos pins para selecionar' : `Desenhe ${modoSel === 'poligono' ? 'um polígono' : modoSel === 'retangulo' ? 'um retângulo' : 'um círculo'} no mapa`}
          </div>
        </div>

        {/* CARGA SELECIONADA */}
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>CARGA SELECIONADA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e8521a' }}>{pesoTotal.toFixed(0)}</div>
              <div style={{ fontSize: 10, color: '#90afd4' }}>kg PESO</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#64B4FF' }}>{volTotal.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: '#90afd4' }}>m³ CUBAGEM</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{palletsEst || '—'}</div>
              <div style={{ fontSize: 10, color: '#90afd4' }}>PALLETS</div>
            </div>
          </div>
        </div>

        {/* PASSO 2 - Veículo e Equipe */}
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>PASSO 2 — VEÍCULO E EQUIPE</div>

          <select className="form-control" style={{ marginBottom: 8, fontSize: 12 }} value={veiculo} onChange={e => setVeiculo(e.target.value)}>
            <option value="">-- Selecione o veículo --</option>
            {veiculos.map(v => <option key={v.id} value={v.id}>{v.name || v.plate}</option>)}
          </select>

          <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 6, fontWeight: 600 }}>EQUIPE DA ROTA</div>

          <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>👨‍💼 Motorista</div>
          <select className="form-control" style={{ marginBottom: 8, fontSize: 12 }} value={motorista} onChange={e => setMotorista(e.target.value)}>
            <option value="">-- Selecione --</option>
            {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>👷 Ajudante 1</div>
          <select className="form-control" style={{ marginBottom: 8, fontSize: 12 }} value={ajudante1} onChange={e => setAjudante1(e.target.value)}>
            <option value="">-- Nenhum --</option>
            {ajudantes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 3 }}>👷 Ajudante 2</div>
          <select className="form-control" style={{ marginBottom: 10, fontSize: 12 }} value={ajudante2} onChange={e => setAjudante2(e.target.value)}>
            <option value="">-- Nenhum --</option>
            {ajudantes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          {/* Barras de capacidade */}
          {veiculoObj && (
            <div style={{ borderTop: '1px solid #1e3a5c', paddingTop: 10 }}>
              <BarraCapacidade label="⚖️ Peso" valor={pesoTotal} cap={capKg} unidade="kg" />
              <BarraCapacidade label="📦 Volume" valor={volTotal} cap={capM3} unidade="m³" />
              {capPallets > 0 && <BarraCapacidade label="🪵 Pallets" valor={palletsEst} cap={capPallets} unidade="pallets" />}
              <div style={{ fontSize: 10, color: '#90afd4', marginTop: 4 }}>
                Cap. veículo: {capPallets || '—'} pallets | Baú: {bauInfo}
              </div>
            </div>
          )}
        </div>

        {/* Clientes selecionados */}
        <div className="card" style={{ padding: 10, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#90afd4', textTransform: 'uppercase' }}>CLIENTES SELECIONADOS ({selArr.length})</span>
            {selArr.length > 0 && <button onClick={() => setSelecionados({})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>Limpar</button>}
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {selArr.length === 0 ? (
              <div style={{ color: '#90afd4', fontSize: 12, textAlign: 'center', padding: 16 }}>Clique nos pins laranjos no mapa para selecionar clientes.</div>
            ) : selArr.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1e3a5c' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#64B4FF', color: '#002855', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.recipient_name}</div>
                  <div style={{ fontSize: 10, color: '#90afd4' }}>{c.weight_kg?.toFixed(0)} kg</div>
                </div>
                <button onClick={() => setSelecionados(prev => { const n = { ...prev }; delete n[c.id]; return n; })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Botão roteirizar */}
        <button
          className="btn btn-primary"
          style={{ justifyContent: 'center', padding: '12px', fontSize: 13, fontWeight: 700, opacity: selArr.length && veiculo && motorista ? 1 : 0.5 }}
          onClick={roteirizar}
          disabled={!selArr.length || !veiculo || !motorista}
        >
          <Zap size={14} /> Roteirizar — Conferência Master <ChevronRight size={14} />
        </button>
      </div>

      {/* Mapa e filtros */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Filtros e legenda */}
        <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Legenda status */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginRight: 8 }}>
            {[{ cor: '#e8521a', label: 'Pendente' }, { cor: '#00FF88', label: 'Selecionado' }, { cor: '#64B4FF', label: 'Roteirizado' }].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#90afd4' }}>
                <span style={{ width: 10, height: 10, background: l.cor, borderRadius: '50%', display: 'inline-block' }} />{l.label}
              </span>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: '#1e3a5c' }} />

          {/* Filtros */}
          <select style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 6, padding: '4px 8px', fontSize: 11 }} value={filtroRota} onChange={e => setFiltroRota(e.target.value)}>
            <option value="">🗺️ Todas as rotas</option>
            {rotasFixas.map(r => {
              const count = clientes.filter(c => (c.rota || '').includes(r)).length;
              return count > 0 ? <option key={r} value={r}>Rota {r} ({count})</option> : null;
            })}
          </select>

          <select style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 6, padding: '4px 8px', fontSize: 11 }} value={filtroRegiao} onChange={e => setFiltroRegiao(e.target.value)}>
            <option value="">📍 Todas regiões</option>
            {regioes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 6, padding: '4px 8px', fontSize: 11 }} value={filtroBairro} onChange={e => setFiltroBairro(e.target.value)}>
            <option value="">🏘️ Todos bairros</option>
            {bairros.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <input style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 6, padding: '4px 8px', fontSize: 11, width: 160 }} placeholder="🔍 Nome do cliente..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} />

          <button onClick={limparFiltros} style={{ background: 'none', border: '1px solid #1e3a5c', color: '#90afd4', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>✕ Limpar</button>

          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#90afd4' }}>{status}</span>
        </div>

        {/* Legenda de rotas */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {rotasFixas.map(r => (
            <span key={r} onClick={() => setFiltroRota(filtroRota === r ? '' : r)} style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: filtroRota === r ? CORES_ROTA[r] : 'rgba(255,255,255,.05)', color: filtroRota === r ? '#001020' : CORES_ROTA[r] || '#90afd4', border: `1px solid ${CORES_ROTA[r] || '#1e3a5c'}` }}>
              {r}
            </span>
          ))}
          <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'rgba(0,255,136,.1)', color: '#00FF88', border: '1px solid #00FF88' }}>Selecionado</span>
        </div>

        {/* Mapa */}
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', minHeight: 400 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
        </div>
      </div>
    </div>

    {confAberta && (
      <ConferenciaMaster
        clientes={selArr}
        veiculo={veiculoObj}
        motorista={motoristaObj}
        ajudantes={[aj1Obj, aj2Obj].filter(Boolean)}
        onFechar={() => setConfAberta(false)}
        onGravar={(res) => {
          setConfAberta(false);
          setSelecionados({});
          alert('Carga gravada! Viagem ' + (res.trip_number || res.id || ''));
        }}
      />
    )}
    </>
  );
}
