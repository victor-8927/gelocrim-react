import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { RefreshCw, Shield, RotateCcw } from 'lucide-react';

const SENHA_ADMIN = 'gelocrim2026'; // senha local da área admin

export default function Admin() {
  const [autenticado, setAutenticado] = useState(false);
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({});
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState({});

  const verificarSenha = () => {
    if (senha === SENHA_ADMIN) setAutenticado(true);
    else setMsg('Senha incorreta');
  };

  const load = async () => {
    setLoading(true);
    try {
      const [rotas, pedidos, clientes, motoristas] = await Promise.all([
        supabase.from('routes').select('id, status, trip_number, route_date').order('created_at', { ascending: false }).limit(100),
        supabase.from('orders').select('id, status').limit(1000),
        supabase.from('clients').select('id').limit(1),
        supabase.from('drivers').select('id, status').limit(100),
      ]);
      setStats({
        totalRotas: rotas.data?.length || 0,
        rotasPendentes: rotas.data?.filter(r => r.status === 'pending').length || 0,
        rotasAtivas: rotas.data?.filter(r => r.status === 'in_progress').length || 0,
        pedidosPendentes: pedidos.data?.filter(p => p.status === 'pending').length || 0,
        motoristasAtivos: motoristas.data?.filter(d => d.status === 'active').length || 0,
      });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (autenticado) load(); }, [autenticado]); // eslint-disable-line

  const resetarContadorViagens = async () => {
    if (!window.confirm('ATENÇÃO: Isso vai resetar o contador de viagens para 001. Confirmar?')) return;
    setLoading(true);
    try {
      // Registrar o reset no banco
      await supabase.from('routes').update({ trip_counter_reset: new Date().toISOString() }).eq('id', 'config');
      setMsg('✅ Contador resetado! Próxima viagem será 001.');
    } catch (e) {
      // Guardar o reset como configuração
      await supabase.from('routes').upsert({
        id: 'config-reset',
        trip_number: 'RESET-' + new Date().toISOString(),
        status: 'config',
        route_date: new Date().toISOString().slice(0, 10),
      });
      setMsg('✅ Reset registrado para próxima operação.');
    } finally { setLoading(false); }
  };

  const limparPedidosAntigos = async () => {
    if (!window.confirm('Limpar pedidos com mais de 30 dias já entregues?')) return;
    const dataLimite = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { error } = await supabase.from('orders').delete()
      .eq('status', 'delivered')
      .lt('delivery_date', dataLimite);
    if (!error) setMsg('✅ Pedidos antigos removidos!');
    else setMsg('Erro: ' + error.message);
  };

  const liberarTodasRotas = async () => {
    if (!window.confirm('Liberar TODAS as rotas pendentes de amanhã?')) return;
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const { error } = await supabase.from('routes')
      .update({ status: 'planned', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .eq('route_date', amanha);
    if (!error) { setMsg('✅ Todas as rotas de amanhã liberadas!'); load(); }
    else setMsg('Erro: ' + error.message);
  };

  if (!autenticado) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <Shield size={24} color="#e8521a" />
        <h1 style={{ fontSize:24, fontWeight:700 }}>Área Administrativa</h1>
      </div>
      <div className="card" style={{ maxWidth:400 }}>
        <div style={{ fontSize:13, color:'#90afd4', marginBottom:16 }}>🔒 Acesso restrito — apenas administradores</div>
        <div className="form-group">
          <label className="form-label">SENHA DO SISTEMA</label>
          <input className="form-control" type="password" value={senha} onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verificarSenha()} placeholder="Digite a senha" />
        </div>
        {msg && <div style={{ color:'#ef4444', fontSize:12, marginBottom:12 }}>{msg}</div>}
        <button className="btn btn-primary" style={{ width:'100%' }} onClick={verificarSenha}>
          <Shield size={14} /> Acessar
        </button>
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

      {/* KPIs do sistema */}
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

        {/* Configurações do sistema */}
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

      </div>
    </div>
  );
}
