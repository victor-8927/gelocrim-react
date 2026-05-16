import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Package } from 'lucide-react';

export default function Producao() {
  const [pallets, setPallets] = useState([]);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([
        api.get('/producao/pallets').catch(() => []),
        api.get('/producao/itens').catch(() => [])
      ]);
      setPallets(Array.isArray(p) ? p : []);
      setItens(Array.isArray(i) ? i : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalPeso = itens.reduce((s, i) => s + (parseFloat(i.peso_total) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Producao</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>Controle de pallets e itens produzidos</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pallets', value: pallets.length, color: '#64B4FF' },
          { label: 'Itens', value: itens.length, color: '#f97316' },
          { label: 'Peso Total', value: `${totalPeso.toFixed(0)} kg`, color: '#10b981' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64B4FF', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>Pallets</h3>
          {loading ? <div style={{ color: '#90afd4', textAlign: 'center', padding: 20 }}>Carregando...</div> :
            pallets.length === 0 ? <div style={{ color: '#90afd4', textAlign: 'center', padding: 20 }}>Nenhum pallet registrado</div> :
            pallets.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e3a5c' }}>
                <span style={{ fontSize: 13 }}>{p.name || p.codigo || `Pallet ${i+1}`}</span>
                <span style={{ color: '#64B4FF', fontWeight: 600 }}>{p.quantidade || p.qty || 0} un</span>
              </div>
            ))
          }
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f97316', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>Itens Produzidos</h3>
          {loading ? <div style={{ color: '#90afd4', textAlign: 'center', padding: 20 }}>Carregando...</div> :
            itens.length === 0 ? <div style={{ color: '#90afd4', textAlign: 'center', padding: 20 }}>Nenhum item registrado</div> :
            itens.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e3a5c' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name || item.nome || `Item ${i+1}`}</div>
                  <div style={{ fontSize: 11, color: '#90afd4' }}>{item.peso_unit ? `${item.peso_unit} kg/un` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f97316', fontWeight: 700 }}>{item.quantidade || item.qty || 0} un</div>
                  <div style={{ fontSize: 11, color: '#90afd4' }}>{item.peso_total ? `${item.peso_total} kg` : ''}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
