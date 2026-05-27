import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { RefreshCw } from 'lucide-react';

const MOTIVOS = {
  'camara_cheia': '🧊 Câmara Cheia',
  'cliente_ausente': '🚫 Cliente Ausente',
  'sem_data_validade': '📅 Sem Data de Validade',
  'sacos_avariados': '⚠️ Sacos Avariados',
  'recusou': '❌ Cliente Recusou',
  'falta_caminhao': '🚛 Falta no Caminhão',
  'erro_producao': '🏭 Erro de Produção',
  'erro_programacao': '💻 Erro de Programação',
  'venda_local': '🤝 Venda Local',
  'outro': '📝 Outro',
};

const DESTINOS = {
  'volta_base': '🏠 Volta Base',
  'venda_local': '🤝 Venda Local',
  'saldo_cliente': '📋 Saldo Cliente',
  'descarte': '🗑️ Descarte',
};


export default function Retornos() {
  const [loading, setLoading] = useState(true);
  const [retornos, setRetornos] = useState([]);
  const [rotas, setRotas] = useState([]);
  const [filtroRota, setFiltroRota] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoje');
  const [filtroTOP, setFiltroTOP] = useState('todos');
  const [expandido, setExpandido] = useState(null);

  const hojeManaus = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Definir período
      let dataInicio;
      const hoje = hojeManaus();
      if (filtroPeriodo === 'hoje') dataInicio = hoje;
      else if (filtroPeriodo === 'semana') {
        const d = new Date(Date.now() - 4 * 60 * 60 * 1000);
        d.setDate(d.getDate() - 7);
        dataInicio = d.toISOString().slice(0, 10);
      } else if (filtroPeriodo === 'mes') {
        dataInicio = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 7) + '-01';
      }

      // Buscar stop_items com retorno
      let query = supabase
        .from('stop_items')
        .select(`
          id, stop_id, item_name, item_type, top_app, order_type,
          qty_planejada, qty_entregue, qty_devolvida, qty_trocada,
          motivo_devolucao, destino_retorno, status_troca,
          weight_unit, created_at, updated_at,
          stops!inner(
            stop_id, recipient_name, address, status, ata, atd,
            route_id,
            routes!inner(
              id, trip_number, route_date, driver_name, vehicle_name, status
            )
          )
        `)
        .gt('qty_devolvida', 0)
        .gte('updated_at', dataInicio + 'T00:00:00');

      if (filtroRota) query = query.eq('stops.route_id', filtroRota);
      if (filtroTOP !== 'todos') query = query.eq('top_app', filtroTOP);

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      setRetornos(data || []);

      // Buscar rotas para filtro
      const { data: rotasData } = await supabase
        .from('routes')
        .select('id, trip_number, driver_name, route_date')
        .gte('route_date', dataInicio)
        .order('route_date', { ascending: false })
        .limit(30);
      setRotas(rotasData || []);

    } catch (e) {
      console.error('Retornos load:', e);
    } finally {
      setLoading(false);
    }
  }, [filtroRota, filtroPeriodo, filtroTOP]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // Consolidar por produto
  const porProduto = {};
  retornos.forEach(item => {
    const key = item.item_type + '_' + item.top_app;
    if (!porProduto[key]) {
      porProduto[key] = {
        item_name: item.item_name,
        item_type: item.item_type,
        top_app: item.top_app,
        qty_planejada: 0,
        qty_entregue: 0,
        qty_devolvida: 0,
        peso_devolvido: 0,
        clientes: [],
        motivos: {},
        destinos: {},
      };
    }
    const p = porProduto[key];
    p.qty_planejada += parseFloat(item.qty_planejada || 0);
    p.qty_entregue += parseFloat(item.qty_entregue || 0);
    p.qty_devolvida += parseFloat(item.qty_devolvida || 0);
    p.peso_devolvido += parseFloat(item.qty_devolvida || 0) * parseFloat(item.weight_unit || 0);
    if (item.motivo_devolucao) p.motivos[item.motivo_devolucao] = (p.motivos[item.motivo_devolucao] || 0) + parseFloat(item.qty_devolvida || 0);
    if (item.destino_retorno) p.destinos[item.destino_retorno] = (p.destinos[item.destino_retorno] || 0) + parseFloat(item.qty_devolvida || 0);
    const stop = item.stops;
    if (stop) p.clientes.push({ nome: stop.recipient_name, qtd: parseFloat(item.qty_devolvida || 0), motivo: item.motivo_devolucao, destino: item.destino_retorno, rota: stop.routes?.trip_number });
  });

  const linhasProduto = Object.values(porProduto).sort((a, b) => b.qty_devolvida - a.qty_devolvida);
  const totalDevolvido = linhasProduto.reduce((s, l) => s + l.qty_devolvida, 0);
  const totalPlanejado = linhasProduto.reduce((s, l) => s + l.qty_planejada, 0);
  const taxaRetorno = totalPlanejado > 0 ? (totalDevolvido / totalPlanejado * 100) : 0;

  // Agrupar por TOP
  const por1000 = linhasProduto.filter(l => l.top_app === '1000');
  const por1009 = linhasProduto.filter(l => l.top_app === '1009');
  const por1007 = linhasProduto.filter(l => l.top_app === '1007');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>↩️ Retorno de Produtos</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Controle de sacos devolvidos por produto, motivo e destino</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Atualizar</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}
          style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
          <option value="hoje">Hoje</option>
          <option value="semana">Últimos 7 dias</option>
          <option value="mes">Este mês</option>
        </select>
        <select value={filtroRota} onChange={e => setFiltroRota(e.target.value)}
          style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 200 }}>
          <option value="">Todas as rotas</option>
          {rotas.map(r => <option key={r.id} value={r.id}>{r.trip_number} — {r.driver_name}</option>)}
        </select>
        <select value={filtroTOP} onChange={e => setFiltroTOP(e.target.value)}
          style={{ background: '#0a1628', border: '1px solid #1e3a5c', color: '#e8f0fe', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
          <option value="todos">Todos os TOPs</option>
          <option value="1000">1000 — Venda</option>
          <option value="1009">1009 — Troca</option>
          <option value="1007">1007 — Bonificação</option>
        </select>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Devolvido', value: `${Math.round(totalDevolvido)} sacos`, cor: '#ef4444', sub: 'no período' },
          { label: 'Taxa de Retorno', value: `${taxaRetorno.toFixed(1)}%`, cor: taxaRetorno > 8 ? '#ef4444' : taxaRetorno > 5 ? '#f59e0b' : '#10b981', sub: 'teto: 8%' },
          { label: 'Produtos afetados', value: linhasProduto.length, cor: '#f59e0b', sub: 'tipos de saco' },
          { label: 'Clientes com retorno', value: new Set(retornos.map(r => r.stops?.stop_id)).size, cor: '#64B4FF', sub: 'paradas' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.cor }}>{loading ? '...' : k.value}</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 2 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: '#1e3a5c', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#90afd4' }}>Carregando retornos...</div>
      ) : retornos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>Nenhum retorno no período</div>
          <div style={{ fontSize: 12, color: '#90afd4', marginTop: 4 }}>Os dados aparecem automaticamente quando o motorista registrar devoluções</div>
        </div>
      ) : (
        <>
          {/* Por TOP */}
          {[
            { top: '1000', label: '🛒 VENDAS (1000)', itens: por1000, cor: '#10b981' },
            { top: '1009', label: '🔄 TROCAS (1009)', itens: por1009, cor: '#f59e0b' },
            { top: '1007', label: '🎁 BONIFICAÇÃO (1007)', itens: por1007, cor: '#a78bfa' },
          ].filter(g => g.itens.length > 0).map(grupo => (
            <div key={grupo.top} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e3a5c', background: `rgba(${grupo.cor === '#10b981' ? '16,185,129' : grupo.cor === '#f59e0b' ? '245,158,11' : '167,139,250'},.08)` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: grupo.cor, textTransform: 'uppercase', letterSpacing: '1px' }}>{grupo.label}</span>
                <span style={{ fontSize: 11, color: '#90afd4', marginLeft: 12 }}>
                  {Math.round(grupo.itens.reduce((s, i) => s + i.qty_devolvida, 0))} sacos devolvidos
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 16px', textAlign: 'left', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Produto</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Saiu</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Entregue</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Voltou</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Taxa</th>
                    <th style={{ padding: '8px 16px', textAlign: 'left', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Motivo Principal</th>
                    <th style={{ padding: '8px 16px', textAlign: 'left', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Destino</th>
                    <th style={{ padding: '8px 16px', textAlign: 'center', color: '#90afd4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e3a5c' }}>Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.itens.map(item => {
                    const taxa = item.qty_planejada > 0 ? (item.qty_devolvida / item.qty_planejada * 100) : 0;
                    const motivoPrincipal = Object.entries(item.motivos).sort(([, a], [, b]) => b - a)[0];
                    const destinoPrincipal = Object.entries(item.destinos).sort(([, a], [, b]) => b - a)[0];
                    const key = item.item_type + '_' + item.top_app;
                    return (
                      <React.Fragment key={key}>
                        <tr
                          style={{ cursor: 'pointer', background: expandido === key ? 'rgba(100,180,255,.05)' : 'transparent' }}
                          onClick={() => setExpandido(expandido === key ? null : key)}
                        >
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>{item.item_name}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64B4FF', fontWeight: 700 }}>{Math.round(item.qty_planejada)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{Math.round(item.qty_entregue)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>{Math.round(item.qty_devolvida)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <div style={{ width: 60, height: 5, background: '#1e3a5c', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(taxa, 100)}%`, background: taxa > 8 ? '#ef4444' : taxa > 5 ? '#f59e0b' : '#10b981', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 10, color: taxa > 8 ? '#ef4444' : '#90afd4' }}>{taxa.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#90afd4' }}>
                            {motivoPrincipal ? (MOTIVOS[motivoPrincipal[0]] || motivoPrincipal[0]) : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', color: '#90afd4' }}>
                            {destinoPrincipal ? (DESTINOS[destinoPrincipal[0]] || destinoPrincipal[0]) : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center', color: '#64B4FF' }}>
                            {item.clientes.length} {expandido === key ? '▲' : '▼'}
                          </td>
                        </tr>
                        {expandido === key && (
                          <tr>
                            <td colSpan={8} style={{ padding: '0 16px 12px', background: 'rgba(100,180,255,.03)' }}>
                              <div style={{ borderTop: '1px solid #1e3a5c', paddingTop: 10 }}>
                                <div style={{ fontSize: 10, color: '#90afd4', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Detalhes por cliente</div>
                                {item.clientes.map((c, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(30,58,92,.4)' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.nome}</span>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                      <span style={{ fontSize: 11, color: '#90afd4' }}>{c.rota}</span>
                                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>{Math.round(c.qtd)} sacos</span>
                                      {c.motivo && <span style={{ fontSize: 10, background: 'rgba(245,158,11,.15)', color: '#f59e0b', borderRadius: 4, padding: '1px 6px' }}>{MOTIVOS[c.motivo] || c.motivo}</span>}
                                      {c.destino && <span style={{ fontSize: 10, background: 'rgba(100,180,255,.15)', color: '#64B4FF', borderRadius: 4, padding: '1px 6px' }}>{DESTINOS[c.destino] || c.destino}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
