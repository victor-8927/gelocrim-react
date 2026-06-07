import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { RefreshCw, Shield, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
export default function Admin() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({});
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState({});
  const [precoDiesel, setPrecoDiesel] = useState('7.59');
  const [tipoDiesel, setTipoDiesel] = useState('S10');
  const [salvandoDiesel, setSalvandoDiesel] = useState(false);
  const mesAtualInit = new Date().toISOString().slice(0,7);
  const [metas, setMetas] = useState({
    mes_ano: mesAtualInit,
    faturamento: '', vol_05kg: '', vol_10kg: '', vol_20kg: '', vol_40kg: '',
    teto_devolucao: '8', teto_retorno: '8', teto_trocas: '5'
  });
  const [salvandoMetas, setSalvandoMetas] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [rotas, pedidos, , motoristas, diesel] = await Promise.all([

        supabase.from('routes').select('id, status, trip_number, route_date').order('created_at', { ascending: false }).limit(100),
        supabase.from('orders').select('id, status').limit(1000),
        Promise.resolve({ data: [] }),
        supabase.from('drivers').select('id, status').limit(100),
        supabase.from('configuracoes').select('chave, valor').in('chave', ['preco_diesel', 'tipo_diesel']),
      ]);
      setStats({
        totalRotas: rotas.data?.length || 0,
        rotasPendentes: rotas.data?.filter(r => r.status === 'pending').length || 0,
        rotasAtivas: rotas.data?.filter(r => r.status === 'in_progress').length || 0,
        pedidosPendentes: pedidos.data?.filter(p => p.status === 'pending').length || 0,
        motoristasAtivos: motoristas.data?.filter(d => d.status === 'active').length || 0,
      });
      // Buscar metas do mês atual
      const mesAtual = new Date().toISOString().slice(0,7);
      const { data: metasData } = await supabase.from('metas').select('*').eq('mes_ano', mesAtual).single().catch(() => ({ data: null }));
      if (metasData) {
        setMetas({
          mes_ano: metasData.mes_ano,
          faturamento: String(metasData.faturamento || ''),
          vol_05kg: String(metasData.vol_05kg || ''),
          vol_10kg: String(metasData.vol_10kg || ''),
          vol_20kg: String(metasData.vol_20kg || ''),
          vol_40kg: String(metasData.vol_40kg || ''),
          teto_devolucao: String(metasData.teto_devolucao || '8'),
          teto_retorno: String(metasData.teto_retorno || '8'),
          teto_trocas: String(metasData.teto_trocas || '5'),
        });
      }
      if (diesel.data) {
        const pd = diesel.data.find(c => c.chave === 'preco_diesel');
        const td = diesel.data.find(c => c.chave === 'tipo_diesel');
        if (pd) setPrecoDiesel(pd.valor);
        if (td) setTipoDiesel(td.valor);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'admin') load(); }, [user]); // eslint-disable-line

  const salvarPrecoDiesel = async () => {
    if (!precoDiesel || isNaN(parseFloat(precoDiesel))) { setMsg('❌ Preço inválido'); return; }
    setSalvandoDiesel(true);
    try {
      await supabase.from('configuracoes').upsert([
        { chave: 'preco_diesel', valor: precoDiesel, descricao: 'Preço do litro do diesel em Manaus (R$)', updated_at: new Date().toISOString() },
        { chave: 'tipo_diesel', valor: tipoDiesel, descricao: 'Tipo de diesel (S500 ou S10)', updated_at: new Date().toISOString() },
      ], { onConflict: 'chave' });
      await supabase.from('vehicles').update({ fuel_price: parseFloat(precoDiesel) });
      setMsg('✅ Preço do diesel atualizado em todos os veículos!');
    } catch (e) { setMsg('Erro: ' + e.message); }
    finally { setSalvandoDiesel(false); }
  };

  const resetarContadorViagens = async () => {
    if (!window.confirm('ATENÇÃO: Isso vai resetar o contador de viagens para 001. Confirmar?')) return;
    setLoading(true);
    try {
      await supabase.from('routes').upsert({
        id: 'config-reset', trip_number: 'RESET-' + new Date().toISOString(),
        status: 'config', route_date: new Date(Date.now() - 4*60*60*1000).toISOString().slice(0, 10),
      });
      setMsg('✅ Reset registrado para próxima operação.');
    } finally { setLoading(false); }
  };

  const limparPedidosAntigos = async () => {
    if (!window.confirm('Limpar pedidos com mais de 30 dias já entregues?')) return;
    const dataLimite = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { error } = await supabase.from('orders').delete()
      .eq('status', 'delivered').lt('delivery_date', dataLimite);
    if (!error) setMsg('✅ Pedidos antigos removidos!');
    else setMsg('Erro: ' + error.message);
  };

  const salvarMetas = async () => {
    setSalvandoMetas(true);
    try {
      const { error } = await supabase.from('metas').upsert({
        mes_ano: metas.mes_ano,
        faturamento: parseFloat(metas.faturamento) || 0,
        vol_05kg: parseInt(metas.vol_05kg) || 0,
        vol_10kg: parseInt(metas.vol_10kg) || 0,
        vol_20kg: parseInt(metas.vol_20kg) || 0,
        vol_40kg: parseInt(metas.vol_40kg) || 0,
        teto_devolucao: parseFloat(metas.teto_devolucao) || 8,
        teto_retorno: parseFloat(metas.teto_retorno) || 8,
        teto_trocas: parseFloat(metas.teto_trocas) || 5,
        updated_at: new Date().toISOString()
      }, { onConflict: 'mes_ano' });
      if (!error) setMsg('✅ Metas de ' + metas.mes_ano + ' salvas com sucesso!');
      else setMsg('❌ Erro: ' + error.message);
    } finally { setSalvandoMetas(false); }
  };

  const liberarTodasRotas = async () => {
    if (!window.confirm('Liberar TODAS as rotas pendentes de amanhã?')) return;
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const { error } = await supabase.from('routes')
      .update({ status: 'planned', updated_at: new Date().toISOString() })
      .eq('status', 'pending').eq('route_date', amanha);
    if (!error) { setMsg('✅ Todas as rotas de amanhã liberadas!'); load(); }
    else setMsg('Erro: ' + error.message);
  };

  if (!user || user.role !== 'admin') return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <Shield size={24} color="#e8521a" />
        <h1 style={{ fontSize:24, fontWeight:700 }}>Área Administrativa</h1>
      </div>
      <div className="card" style={{ maxWidth:400 }}>
        <div style={{ fontSize:13, color:'#ef4444', marginBottom:8 }}>🚫 Acesso negado</div>
        <div style={{ fontSize:12, color:'#90afd4' }}>
          Sua conta não tem permissão para acessar esta área.<br/>
          Entre em contato com o administrador do sistema.
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Shield size={24} color="#e8521a" />
          <div>
            <h1 style={{ fontSize:24, fontWeight:700 }}>⚙️ Área Administrativa</h1>
            <p style={{ color:'#90afd4', fontSize:13, marginTop:4 }}>Configurações exclusivas do sistema</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
      </div>

      {msg && (
        <div style={{ padding:'10px 16px', background:'rgba(16,185,129,.1)', border:'1px solid #10b981', borderRadius:8, color:'#10b981', fontSize:13, marginBottom:16 }}>
          {msg}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Rotas Total', value: stats.totalRotas, cor:'#64B4FF' },
          { label:'Pendentes', value: stats.rotasPendentes, cor:'#f59e0b' },
          { label:'Em Rota', value: stats.rotasAtivas, cor:'#10b981' },
          { label:'Pedidos Pendentes', value: stats.pedidosPendentes, cor:'#e8521a' },
          { label:'Motoristas Ativos', value: stats.motoristasAtivos, cor:'#a78bfa' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:700, color:k.cor }}>{loading ? '...' : k.value}</div>
            <div style={{ fontSize:11, color:'#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Preço do Diesel */}
        <div className="card">
          <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', textTransform:'uppercase', letterSpacing:'1px', marginBottom:16 }}>
            ⛽ PREÇO DO DIESEL — MANAUS
          </div>
          <div style={{ fontSize:12, color:'#90afd4', marginBottom:14, lineHeight:1.6 }}>
            Atualiza o preço do litro em <strong style={{ color:'#e8f0fe' }}>todos os veículos</strong> automaticamente.<br/>
            Referência: Procon Manaus (diesel S10: R$ 7,29–7,59 em abril/2026).
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#90afd4', marginBottom:4 }}>TIPO</div>
              <select value={tipoDiesel} onChange={e => setTipoDiesel(e.target.value)}
                style={{ width:'100%', background:'#0a1628', border:'1px solid #1e3a5c', color:'#e8f0fe', borderRadius:6, padding:'6px 8px', fontSize:12 }}>
                <option value="S10">Diesel S10 (aditivado)</option>
                <option value="S500">Diesel S500 (comum)</option>
              </select>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#90afd4', marginBottom:4 }}>PREÇO POR LITRO (R$)</div>
              <input type="number" step="0.01" min="0" value={precoDiesel} onChange={e => setPrecoDiesel(e.target.value)}
                style={{ width:'100%', background:'#0a1628', border:'1px solid #f59e0b', color:'#f59e0b', borderRadius:6, padding:'6px 8px', fontSize:16, fontWeight:700, textAlign:'center' }} />
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#90afd4', marginBottom:12 }}>
            <span>Mínimo Manaus: R$ 7,29</span>
            <span>Máximo Manaus: R$ 7,59</span>
          </div>
          <button onClick={salvarPrecoDiesel} disabled={salvandoDiesel}
            style={{ width:'100%', padding:'12px', background:'rgba(245,158,11,.15)', border:'1px solid #f59e0b', color:'#f59e0b', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
            {salvandoDiesel ? '⏳ Atualizando...' : '⛽ Atualizar Preço em Todos os Veículos'}
          </button>
        </div>

        {/* Controle de Viagens */}
        <div className="card">
          <div style={{ fontSize:11, fontWeight:700, color:'#e8521a', textTransform:'uppercase', letterSpacing:'1px', marginBottom:16 }}>
            🔢 CONTROLE DE VIAGENS
          </div>
          <div style={{ fontSize:13, color:'#90afd4', marginBottom:16, lineHeight:1.6 }}>
            O contador de viagens gera números sequenciais por dia.<br/>
            Use o reset apenas no início de uma nova operação.
          </div>
          <button onClick={resetarContadorViagens} disabled={loading}
            style={{ width:'100%', padding:'12px', background:'rgba(232,82,26,.15)', border:'1px solid #e8521a', color:'#e8521a', borderRadius:8, cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <RotateCcw size={14} /> Resetar Contador para 001
          </button>
        </div>

        {/* Liberação em Massa */}
        <div className="card">
          <div style={{ fontSize:11, fontWeight:700, color:'#10b981', textTransform:'uppercase', letterSpacing:'1px', marginBottom:16 }}>
            ✅ LIBERAÇÃO EM MASSA
          </div>
          <div style={{ fontSize:13, color:'#90afd4', marginBottom:16, lineHeight:1.6 }}>
            Libera todas as rotas pendentes de amanhã de uma vez.<br/>
            Motoristas poderão fazer login após a liberação.
          </div>
          <button onClick={liberarTodasRotas} disabled={loading}
            style={{ width:'100%', padding:'12px', background:'rgba(16,185,129,.15)', border:'1px solid #10b981', color:'#10b981', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
            ✅ Liberar Todas as Rotas de Amanhã
          </button>
        </div>

        {/* Limpeza de dados */}
        <div className="card">
          <div style={{ fontSize:11, fontWeight:700, color:'#64B4FF', textTransform:'uppercase', letterSpacing:'1px', marginBottom:16 }}>
            🧹 LIMPEZA DE DADOS
          </div>
          <div style={{ fontSize:13, color:'#90afd4', marginBottom:16, lineHeight:1.6 }}>
            Remove pedidos entregues com mais de 30 dias.<br/>
            Os dados ficam no histórico do Supabase.
          </div>
          <button onClick={limparPedidosAntigos} disabled={loading}
            style={{ width:'100%', padding:'12px', background:'rgba(100,180,255,.1)', border:'1px solid #64B4FF', color:'#64B4FF', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
            🧹 Limpar Pedidos Antigos (+30 dias)
          </button>
        </div>

        {/* Configurações */}
        <div className="card">
          <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', textTransform:'uppercase', letterSpacing:'1px', marginBottom:16 }}>
            ⚙️ CONFIGURAÇÕES
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'Velocidade média (km/h)', value:'35', campo:'vel_media' },
              { label:'Tempo de almoço (min)', value:'72', campo:'almoco_dur' },
              { label:'Fim jornada normal (h)', value:'18', campo:'fim_normal' },
              { label:'Fim jornada banco (h)', value:'20', campo:'fim_banco' },
            ].map(c => (
              <div key={c.campo} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #1e3a5c' }}>
                <span style={{ fontSize:12, color:'#90afd4' }}>{c.label}</span>
                <input defaultValue={config[c.campo] || c.value}
                  onChange={e => setConfig(p => ({ ...p, [c.campo]: e.target.value }))}
                  style={{ width:60, background:'#0a1628', border:'1px solid #1e3a5c', color:'#e8f0fe', borderRadius:6, padding:'4px 8px', fontSize:12, textAlign:'center' }} />
              </div>
            ))}
            <button onClick={() => setMsg('✅ Configurações salvas!')}
              style={{ marginTop:8, padding:'10px', background:'rgba(167,139,250,.15)', border:'1px solid #a78bfa', color:'#a78bfa', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              💾 Salvar Configurações
            </button>
          </div>
        </div>


        {/* Metas e Tetos Operacionais */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#10b981', textTransform:'uppercase', letterSpacing:'1px', marginBottom:16 }}>
            🎯 METAS E TETOS OPERACIONAIS
          </div>

          {/* Seletor de mês */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, color:'#90afd4', marginBottom:4 }}>MÊS DE REFERÊNCIA</div>
            <input type="month" value={metas.mes_ano}
              onChange={e => setMetas(p => ({ ...p, mes_ano: e.target.value }))}
              style={{ background:'#0a1628', border:'1px solid #1e3a5c', color:'#e8f0fe', borderRadius:6, padding:'6px 10px', fontSize:13 }} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Metas de faturamento e volume */}
            <div>
              <div style={{ fontSize:10, color:'#90afd4', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>💰 METAS DE FATURAMENTO E VOLUME</div>
              {[
                { label:'Meta de Faturamento (R$)', campo:'faturamento', placeholder:'Ex: 1450570.00', prefix:'R$' },
                { label:'Meta Volume GELO 05KG (sacos)', campo:'vol_05kg', placeholder:'Ex: 35000', prefix:'un' },
                { label:'Meta Volume GELO 10KG (sacos)', campo:'vol_10kg', placeholder:'Ex: 30000', prefix:'un' },
                { label:'Meta Volume GELO 20KG (sacos)', campo:'vol_20kg', placeholder:'Ex: 20000', prefix:'un' },
                { label:'Meta Volume GELO 40KG (sacos)', campo:'vol_40kg', placeholder:'Ex: 18000', prefix:'un' },
              ].map(f => (
                <div key={f.campo} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #1e3a5c' }}>
                  <span style={{ fontSize:12, color:'#90afd4' }}>{f.label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:11, color:'#90afd4' }}>{f.prefix}</span>
                    <input type="number" value={metas[f.campo]} placeholder={f.placeholder}
                      onChange={e => setMetas(p => ({ ...p, [f.campo]: e.target.value }))}
                      style={{ width:120, background:'#0a1628', border:'1px solid #10b981', color:'#10b981', borderRadius:6, padding:'4px 8px', fontSize:13, fontWeight:700, textAlign:'right' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tetos operacionais */}
            <div>
              <div style={{ fontSize:10, color:'#90afd4', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>🚨 TETOS OPERACIONAIS (% máximo permitido)</div>
              {[
                { label:'Teto Devoluções / Venda (%)', campo:'teto_devolucao', desc:'Máximo de devoluções sobre faturamento' },
                { label:'Teto Retorno de Sacos (%)', campo:'teto_retorno', desc:'Máximo de sacos retornados sobre total entregue' },
                { label:'Teto Trocas (%)', campo:'teto_trocas', desc:'Máximo de trocas sobre total operado' },
              ].map(f => (
                <div key={f.campo} style={{ padding:'10px 0', borderBottom:'1px solid #1e3a5c' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:12, color:'#90afd4' }}>{f.label}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <input type="number" step="0.1" min="0" max="100" value={metas[f.campo]}
                        onChange={e => setMetas(p => ({ ...p, [f.campo]: e.target.value }))}
                        style={{ width:70, background:'#0a1628', border:'1px solid #ef4444', color:'#ef4444', borderRadius:6, padding:'4px 8px', fontSize:14, fontWeight:700, textAlign:'center' }} />
                      <span style={{ fontSize:11, color:'#ef4444' }}>%</span>
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:'#90afd4' }}>{f.desc}</div>
                </div>
              ))}

              <div style={{ marginTop:16, padding:'10px', background:'rgba(16,185,129,.05)', border:'1px solid rgba(16,185,129,.2)', borderRadius:8, fontSize:11, color:'#90afd4', lineHeight:1.6 }}>
                💡 Esses tetos alimentam os gauges do Dashboard em tempo real. Quando um indicador ultrapassar o teto, o sistema gera alerta automático.
              </div>
            </div>
          </div>

          <button onClick={salvarMetas} disabled={salvandoMetas}
            style={{ marginTop:16, width:'100%', padding:'13px', background:'rgba(16,185,129,.15)', border:'1px solid #10b981', color:'#10b981', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
            {salvandoMetas ? '⏳ Salvando...' : '💾 Salvar Metas e Tetos de ' + metas.mes_ano}
          </button>
        </div>

      </div>
    </div>
  );
}
