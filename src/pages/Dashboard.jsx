import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { RefreshCw, Zap, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEPOSITO = { lat: -3.093544, lng: -60.075812 };

export default function Dashboard() {
  const [pedidos, setPedidos] = useState([]);
  const [rotas, setRotas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hora, setHora] = useState(new Date());
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const diasSemana = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const now = new Date();
  const dataLabel = `Operação de ${diasSemana[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]}`;

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [p, r, v, d] = await Promise.all([
        api.get('/orders?status=pending&limit=500').catch(() => []),
        api.get(`/routes?date=${today}`).catch(() => []),
        api.get('/vehicles').catch(() => []),
        api.get('/drivers').catch(() => []),
      ]);
      setPedidos(Array.isArray(p) ? p : []);
      setRotas(Array.isArray(r) ? r : []);
      setVeiculos(Array.isArray(v) ? v : []);
      setMotoristas(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Inicializa mapa
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: DEPOSITO, zoom: 11, mapTypeId: 'roadmap',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
      new window.google.maps.Marker({
        position: DEPOSITO, map: mapObj.current, title: 'Deposito',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#e8521a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });
    }
  }, []);

  // Calculos
  const pendentes = pedidos.filter(p => p.status === 'pending').length;
  const emRota = pedidos.filter(p => p.status === 'routed').length;
  const entregues = pedidos.filter(p => p.status === 'delivered').length;
  const atrasados = pedidos.filter(p => p.status === 'late' || p.status === 'delayed').length;
  const devolvidos = pedidos.filter(p => p.status === 'returned').length;
  const reprogramados = pedidos.filter(p => p.status === 'rescheduled').length;
  const falhas = pedidos.filter(p => p.status === 'failed').length;
  const total = pendentes + emRota + entregues + falhas;
  const progresso = total > 0 ? Math.round(entregues / total * 100) : 0;

  const rotasHoje = rotas.length;
  const paradasHoje = rotas.reduce((s, r) => s + (r.total_stops || 0), 0);
  const kmHoje = rotas.reduce((s, r) => s + parseFloat(r.total_km || 0), 0);
  const veicAtivos = veiculos.filter(v => v.status === 'active').length;
  const motorEmCampo = motoristas.filter(m => m.type === 'driver' && m.status === 'active').length;

  const fatTotal = rotas.reduce((s, r) => s + parseFloat(r.total_value || 0), 0);
  const custoTotal = rotas.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0);
  const margem = fatTotal > 0 ? (fatTotal - custoTotal) / fatTotal * 100 : 0;
  const kmPerLiter = 3;
  const fuelPrice = 7.59;
  const custoDiesel = kmHoje / kmPerLiter * fuelPrice;
  const custoEntrega = entregues > 0 ? custoTotal / entregues : 0;

  const canhotos = rotas.reduce((s, r) => s + (r.pending_receipts || 0), 0);
  const rotasLongas = rotas.filter(r => {
    if (!r.start_time) return false;
    const [h, m] = r.start_time.split(':').map(Number);
    const start = h * 60 + m;
    const agora = now.getHours() * 60 + now.getMinutes();
    return (agora - start) > 480;
  }).length;

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
          <span style={{ fontSize: 13, color: '#64B4FF', fontWeight: 700 }}>{progresso}% concluído</span>
        </div>
        <div style={{ height: 10, background: '#1e3a5c', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${progresso}%`, background: progresso >= 80 ? '#10b981' : progresso >= 50 ? '#f59e0b' : '#64B4FF', borderRadius: 5, transition: 'width .5s' }} />
        </div>
        <div style={{ fontSize: 12, color: '#90afd4' }}>{entregues} entregues · {total} total</div>
        {margem < 10 && margem > 0 && (
          <div style={{ marginTop: 8, padding: '6px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid #ef4444', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
            ⚠️ Margem operacional abaixo de 10% — revisar custos
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Pedidos */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📦 PEDIDOS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { emoji: '📦', label: 'Pendentes', value: pendentes, sub: 'aguardando roteirização', cor: '#f59e0b' },
              { emoji: '🚛', label: 'Em Rota', value: emRota, sub: 'em trânsito agora', cor: '#64B4FF' },
              { emoji: '✅', label: 'Entregues', value: entregues, sub: 'concluídos hoje', cor: '#10b981' },
              { emoji: '⏰', label: 'Em Atraso', value: atrasados, sub: 'acima do prazo', cor: '#ef4444' },
              { emoji: '↩️', label: 'Devolvidos', value: devolvidos, sub: 'retornaram à base', cor: '#a78bfa' },
              { emoji: '📅', label: 'Reprogramados', value: reprogramados, sub: 'nova data de entrega', cor: '#90afd4' },
            ].map(k => (
              <div key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                <span style={{ fontSize: 18 }}>{k.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{k.label}</div>
                  <div style={{ fontSize: 10, color: '#90afd4' }}>{k.sub}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.cor }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Operação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>🚛 OPERAÇÃO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { emoji: '🗺️', label: 'Rotas de Hoje', value: rotasHoje, sub: `${paradasHoje} paradas`, cor: '#64B4FF' },
                { emoji: '🚐', label: 'Frotas Ativas', value: veicAtivos, sub: `${motorEmCampo} motoristas em campo`, cor: '#10b981' },
                { emoji: '📍', label: 'KM Percorridos', value: `${kmHoje.toFixed(0)} km`, sub: 'total do dia', cor: '#a78bfa' },
              ].map(k => (
                <div key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                  <span style={{ fontSize: 18 }}>{k.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{k.label}</div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>{k.sub}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: k.cor }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>💰 FINANCEIRO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { emoji: '💵', label: 'Faturamento', value: fatTotal > 0 ? `R$ ${(fatTotal/1000).toFixed(1)}k` : 'R$ 0.0k', sub: 'estimado hoje', cor: '#10b981' },
                { emoji: '📊', label: 'Margem Op.', value: `${margem.toFixed(1)}%`, sub: 'rentabilidade', cor: margem >= 20 ? '#10b981' : margem >= 10 ? '#f59e0b' : '#ef4444' },
                { emoji: '⛽', label: 'Custo Diesel', value: `R$ ${custoDiesel.toFixed(0)}`, sub: `${(kmHoje / kmPerLiter).toFixed(0)}L · R$${fuelPrice}/L`, cor: '#f59e0b' },
                { emoji: '💲', label: 'Custo/Entrega', value: custoEntrega > 0 ? `R$ ${custoEntrega.toFixed(0)}` : 'R$ —', sub: 'eficiência da operação', cor: '#64B4FF' },
              ].map(k => (
                <div key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(30,58,92,.5)' }}>
                  <span style={{ fontSize: 16 }}>{k.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{k.label}</div>
                    <div style={{ fontSize: 10, color: '#90afd4' }}>{k.sub}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: k.cor }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mapa + alertas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mapa */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, minHeight: 200 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>📍 ROTAS ATIVAS</span>
              <button onClick={() => navigate('/monitoramento')} style={{ background: 'none', border: 'none', color: '#64B4FF', fontSize: 11, cursor: 'pointer' }}>⛶ Expandir</button>
            </div>
            <div ref={mapRef} style={{ height: 180 }} />
          </div>

          {/* Alertas */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>⚡ ALERTAS PREDITIVOS</div>
            {canhotos === 0 && rotasLongas === 0 ? (
              <div style={{ fontSize: 12, color: '#10b981' }}>✅ Nenhum alerta preditivo no momento</div>
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

      {/* Rotas do dia */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64B4FF', textTransform: 'uppercase', letterSpacing: '1px' }}>🗺️ Rotas do Dia</span>
          <button onClick={() => navigate('/rotas')} style={{ background: 'none', border: 'none', color: '#64B4FF', fontSize: 12, cursor: 'pointer' }}>Ver todas</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Veículo</th><th>Motorista</th><th>Paradas</th><th>⏱️ Início</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rotas.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#90afd4', padding: 20 }}>Nenhuma rota hoje</td></tr>
            ) : rotas.slice(0, 8).map(r => {
              const done = r.completed_stops || 0;
              const total = r.total_stops || 0;
              const pct = total > 0 ? Math.round(done / total * 100) : 0;
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{r.vehicle_name || r.vehicle?.plate || '—'}</td>
                  <td style={{ fontSize: 12, color: '#90afd4' }}>{r.driver_name || r.driver?.name || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 4, background: '#1e3a5c', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 2 }} />
                      </div>
                      <span style={{ color: '#90afd4' }}>{done}/{total}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#90afd4' }}>{r.planned_start || r.start_time || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                      background: r.status === 'completed' ? 'rgba(16,185,129,.2)' : r.status === 'in_progress' ? 'rgba(249,115,22,.2)' : 'rgba(100,180,255,.2)',
                      color: r.status === 'completed' ? '#10b981' : r.status === 'in_progress' ? '#f97316' : '#64B4FF' }}>
                      {r.status === 'completed' ? 'Concluída' : r.status === 'in_progress' ? 'Em Rota' : 'Liberada'}
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
          <button style={{ background: 'none', border: 'none', color: '#64B4FF', fontSize: 12, cursor: 'pointer' }}>Detalhar</button>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: devolvidos > 0 ? '#ef4444' : '#10b981' }}>{devolvidos}</div>
            <div style={{ fontSize: 11, color: '#90afd4' }}>itens hoje</div>
          </div>
          <div style={{ fontSize: 12, color: devolvidos > 0 ? '#ef4444' : '#10b981' }}>
            {devolvidos > 0 ? `⚠️ ${devolvidos} retorno(s) registrado(s)` : '✅ Sem retornos'}
          </div>
        </div>
      </div>
    </div>
  );
}
