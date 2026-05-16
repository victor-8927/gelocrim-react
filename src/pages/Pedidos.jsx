import React, { useEffect, useState } from 'react';
import { getPedidos } from '../services/api';
import { RefreshCw, Search } from 'lucide-react';

const STATUS_LABELS = {
  pending: 'Pendente',
  routed: 'Roteirizado',
  delivered: 'Entregue',
  failed: 'Falha',
};

const TOP_LABELS = {
  '1000': 'Venda',
  '1007': 'Bonif.',
  '1008': 'Consig.',
  '1009': 'Troca',
  '1010': 'Pre-ped.',
};

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');

  const load = () => {
    setLoading(true);
    getPedidos({ limit: 500 })
      .then(data => setPedidos(Array.isArray(data) ? data : data.value || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtrados = pedidos.filter(p => {
    const matchBusca = !busca ||
      (p.recipient_name || '').toLowerCase().includes(busca.toLowerCase()) ||
      (p.external_id || '').toLowerCase().includes(busca.toLowerCase()) ||
      (p.address || '').toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !status || p.status === status;
    return matchBusca && matchStatus;
  });

  const pesoTotal = filtrados.reduce((s, p) => s + (parseFloat(p.weight_kg) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestao de Pedidos</h1>
          <p style={{ color: '#90afd4', fontSize: 13, marginTop: 4 }}>{pedidos.length} pedidos carregados</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pendentes', value: pedidos.filter(p => p.status === 'pending').length, color: '#f59e0b' },
          { label: 'Roteirizados', value: pedidos.filter(p => p.status === 'routed').length, color: '#64B4FF' },
          { label: 'Entregues', value: pedidos.filter(p => p.status === 'delivered').length, color: '#10b981' },
          { label: 'Falhas', value: pedidos.filter(p => p.status === 'failed').length, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#90afd4' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#90afd4' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar por nome, pedido, endereco..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <select className="form-control" style={{ width: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="routed">Roteirizados</option>
          <option value="delivered">Entregues</option>
          <option value="failed">Falhas</option>
        </select>
        <span style={{ color: '#90afd4', fontSize: 12, whiteSpace: 'nowrap' }}>
          {filtrados.length} pedidos - {pesoTotal.toFixed(0)} kg
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Endereco</th>
                <th>Peso</th>
                <th>Valor</th>
                <th>TOP</th>
                <th>T. Atend.</th>
                <th>GPS</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#90afd4', padding: 40 }}>Nenhum pedido encontrado</td></tr>
              ) : filtrados.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', color: '#64B4FF', fontSize: 12 }}>{p.external_id || p.id?.slice(0, 8)}</td>
                  <td style={{ fontWeight: 600 }}>{p.recipient_name || '-'}</td>
                  <td style={{ color: '#90afd4', fontSize: 12 }}>{p.address || '-'}</td>
                  <td>{p.weight_kg || 0} kg</td>
                  <td>{p.total_value ? `R$ ${parseFloat(p.total_value).toFixed(2)}` : '-'}</td>
                  <td><span style={{ fontSize: 11, color: '#64B4FF' }}>{TOP_LABELS[p.order_type] || p.order_type || '-'}</span></td>
                  <td>{p.service_time ? `${p.service_time} min` : '-'}</td>
                  <td style={{ color: p.lat && p.lng ? '#10b981' : '#ef4444' }}>{p.lat && p.lng ? 'OK' : '-'}</td>
                  <td>
                    <span className={`badge ${p.status}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
