import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { X, Plus, Trash2, Printer } from 'lucide-react';

const PRODUTOS = [
  { code: '370', name: 'GELO 05KG', weight: 6 },
  { code: '371', name: 'GELO 10KG', weight: 11 },
  { code: '372', name: 'GELO 20KG', weight: 23 },
  { code: '373', name: 'GELO 40KG', weight: 45 },
];

function formatTaxId(taxId) {
  if (!taxId) return '—';
  const digits = taxId.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return taxId;
}

function consolidarItens(itens) {
  const mapa = {};
  itens.forEach(i => {
    const key = i.code;
    if (!mapa[key]) mapa[key] = { ...i, qty: 0 };
    mapa[key].qty += i.qty;
  });
  return Object.values(mapa);
}

function gerarHTMLDocumento(tipo, dados) {
  const { cliente, itens, refNF, refOC, rota, data } = dados;
  const itensFiltrados = consolidarItens(itens.filter(i => i.qty > 0));
  const totalPeso = itensFiltrados.reduce((s, i) => s + (i.qty * i.weight), 0);
  const totalQtd = itensFiltrados.reduce((s, i) => s + i.qty, 0);
  const taxIdLabel = cliente.tax_id && cliente.tax_id.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ';
  const taxIdFormatado = formatTaxId(cliente.tax_id);

  const via1Label = tipo === 'cliente' ? 'VIA DO CLIENTE' : 'VIA DA PRODUÇÃO';
  const via2Label = tipo === 'cliente' ? 'VIA DA GELOCRIM' : 'VIA DO ANALISTA';
  const titulo = tipo === 'cliente' ? 'COMPROVANTE DE ENTREGA — SALDO' : 'ORDEM DE SEPARAÇÃO — SALDO';

  const linhasItens = itensFiltrados.map(i => `
    <tr>
      <td style="text-align:center">${i.code}</td>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:center">${i.weight} kg</td>
      <td style="text-align:center"><strong>${(i.qty * i.weight).toFixed(0)} kg</strong></td>
    </tr>`).join('');

  const assinatura = tipo === 'cliente'
    ? `<div style="margin-top:24px">
        <p style="margin-bottom:32px">Declaro ter recebido os produtos acima em perfeitas condições.</p>
        <div style="display:flex;gap:40px">
          <div style="flex:2;border-top:1px solid #000;padding-top:4px;font-size:10px">Assinatura do Cliente</div>
          <div style="flex:1;border-top:1px solid #000;padding-top:4px;font-size:10px">Data: ___/___/______</div>
        </div>
        <div style="margin-top:16px;border-top:1px solid #000;padding-top:4px;font-size:10px;width:60%">Nome legível</div>
       </div>`
    : `<div style="margin-top:24px;display:flex;gap:40px">
        <div style="flex:1;border-top:1px solid #000;padding-top:4px;font-size:10px">Assinatura Responsável Produção</div>
        <div style="flex:1;border-top:1px solid #000;padding-top:4px;font-size:10px">Data: ___/___/______</div>
       </div>`;

  const blocoVia = (viaLabel) => `
    <div class="via">
      <div class="via-badge">${viaLabel}</div>

      <div class="header">
        <div class="empresa-nome">AMAZON INDÚSTRIA DE GELO LTDA</div>
        <div class="empresa-info">CNPJ: 02.402.867/0005-22 &nbsp;|&nbsp; Manaus - AM</div>
        <div class="doc-titulo">${titulo}</div>
      </div>

      <div class="secoes">
        <div class="secao">
          <div class="secao-titulo">${tipo === 'cliente' ? 'DADOS DO CLIENTE' : 'ROTA E REFERÊNCIA'}</div>
          ${tipo === 'cliente' ? `
          <table class="dados">
            <tr><td class="label">Nome / Razão Social</td><td><strong>${cliente.name || '—'}</strong></td></tr>
            <tr><td class="label">${taxIdLabel}</td><td>${taxIdFormatado}</td></tr>
            <tr><td class="label">Endereço</td><td>${cliente.address || '—'}${cliente.district ? ', ' + cliente.district : ''}</td></tr>
            <tr><td class="label">Cód. Parceiro</td><td>${cliente.codparc || '—'}</td></tr>
          </table>` : `
          <table class="dados">
            <tr><td class="label">Rota</td><td>${rota || '—'}</td><td class="label">Data</td><td>${data || '—'}</td></tr>
            <tr><td class="label">Ref. NF</td><td>${refNF || '—'}</td><td class="label">Ref. OC</td><td>${refOC || '—'}</td></tr>
          </table>`}
        </div>

        <div class="secao">
          <div class="secao-titulo">${tipo === 'cliente' ? 'REFERÊNCIA DA ENTREGA' : 'DADOS DO CLIENTE'}</div>
          ${tipo === 'cliente' ? `
          <table class="dados">
            <tr><td class="label">Rota</td><td>${rota || '—'}</td><td class="label">Data</td><td>${data || '—'}</td></tr>
            <tr><td class="label">Ref. NF</td><td>${refNF || '—'}</td><td class="label">Ref. OC</td><td>${refOC || '—'}</td></tr>
          </table>` : `
          <table class="dados">
            <tr><td class="label">Nome</td><td><strong>${cliente.name || '—'}</strong></td></tr>
            <tr><td class="label">${taxIdLabel}</td><td>${taxIdFormatado}</td></tr>
            <tr><td class="label">Endereço</td><td>${cliente.address || '—'}${cliente.district ? ', ' + cliente.district : ''}</td></tr>
          </table>`}
        </div>
      </div>

      <div class="secao" style="margin-top:10px">
        <div class="secao-titulo">ITENS A ENTREGAR</div>
        <table class="itens">
          <thead>
            <tr>
              <th style="width:60px">CÓD.</th>
              <th>PRODUTO</th>
              <th style="width:70px">QTDE</th>
              <th style="width:80px">PESO UNIT.</th>
              <th style="width:90px">PESO TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${linhasItens}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align:right;font-weight:bold;padding:6px 8px">TOTAL</td>
              <td style="text-align:center;font-weight:bold">${totalQtd} un</td>
              <td></td>
              <td style="text-align:center;font-weight:bold">${totalPeso.toFixed(0)} kg</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${assinatura}
    </div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>${titulo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size:11px; color:#000; background:#fff; }

  .via {
    width: 190mm;
    min-height: 135mm;
    margin: 6mm auto;
    padding: 8mm 10mm;
    border: 1px solid #999;
    page-break-inside: avoid;
  }

  .via-badge {
    text-align: right;
    font-size: 9px;
    font-weight: bold;
    color: #555;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .header {
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 2px solid #000;
    margin-bottom: 10px;
  }
  .empresa-nome { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
  .empresa-info { font-size: 9px; color: #444; margin-top: 2px; }
  .doc-titulo {
    font-size: 11px;
    font-weight: bold;
    margin-top: 6px;
    padding: 4px 20px;
    border: 1px solid #000;
    display: inline-block;
    letter-spacing: 1px;
  }

  .secoes { display: flex; gap: 10px; margin-bottom: 0; }
  .secoes .secao { flex: 1; }

  .secao { margin-bottom: 8px; }
  .secao-titulo {
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #333;
    border-bottom: 1px solid #ccc;
    padding-bottom: 2px;
    margin-bottom: 5px;
  }

  table.dados { width: 100%; border-collapse: collapse; }
  table.dados td { padding: 2px 4px; font-size: 10px; vertical-align: top; }
  table.dados td.label { color: #555; width: 90px; font-size: 9px; white-space: nowrap; }

  table.itens { width: 100%; border-collapse: collapse; }
  table.itens th {
    background: #222; color: #fff;
    padding: 5px 8px;
    text-align: left;
    font-size: 9px;
    letter-spacing: 0.5px;
  }
  table.itens td { padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
  table.itens tfoot td { border-top: 2px solid #000; background: #f5f5f5; }

  .corte {
    text-align: center;
    font-size: 9px;
    color: #999;
    margin: 0;
    padding: 2mm 0;
    border-top: 1px dashed #aaa;
    border-bottom: 1px dashed #aaa;
    letter-spacing: 2px;
  }

  @media print {
    body { margin: 0; }
    .corte { border-top: 1px dashed #aaa; border-bottom: 1px dashed #aaa; }
  }
</style>
</head>
<body>
  ${blocoVia(via1Label)}
  <div class="corte">✂ &nbsp; RECORTE AQUI &nbsp; ✂</div>
  ${blocoVia(via2Label)}
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

export default function ModalSaldo({ onFechar, onSalvo }) {
  const [codparc, setCodparc] = useState('');
  const [cliente, setCliente] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [refNF, setRefNF] = useState('');
  const [refOC, setRefOC] = useState('');
  const [obs, setObs] = useState('');
  const [itens, setItens] = useState([{ code: '370', name: 'GELO 05KG', weight: 6, qty: 0 }]);
  const [salvando, setSalvando] = useState(false);
  const [rota, setRota] = useState('');

  const data = new Date().toLocaleDateString('pt-BR');

  async function buscarCliente() {
    if (!codparc) return;
    setBuscando(true);
    try {
      const { data: clientes, error } = await supabase
        .from('clients')
        .select('codparc, name, address, district, tax_id')
        .eq('codparc', parseInt(codparc))
        .limit(1);
      if (error) { alert('Erro: ' + error.message); return; }
      if (clientes && clientes.length > 0) setCliente(clientes[0]);
      else alert('Cliente não encontrado. Verifique o codparc.');
    } catch (e) { alert('Erro ao buscar cliente'); }
    finally { setBuscando(false); }
  }

  function addItem() {
    setItens(prev => [...prev, { code: '370', name: 'GELO 05KG', weight: 6, qty: 0 }]);
  }

  function removeItem(i) {
    setItens(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i, field, value) {
    setItens(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      if (field === 'code') {
        const prod = PRODUTOS.find(p => p.code === value);
        return prod ? { ...item, code: prod.code, name: prod.name, weight: prod.weight } : item;
      }
      return { ...item, [field]: field === 'qty' ? parseInt(value) || 0 : value };
    }));
  }

  const pesoTotal = itens.reduce((s, i) => s + (i.qty * i.weight), 0);

  async function salvar() {
    if (!cliente) { alert('Selecione um cliente'); return; }
    if (!refNF) { alert('Informe a NF de referência'); return; }
    if (itens.every(i => i.qty === 0)) { alert('Informe as quantidades'); return; }
    setSalvando(true);
    try {
      const orderId = `saldo-${Date.now()}`;
      await supabase.from('orders').insert({
        id: orderId,
        external_id: `SALDO-${refNF}`,
        codparc: cliente.codparc,
        recipient_name: cliente.name,
        address: `${cliente.address || ''}${cliente.district ? ', ' + cliente.district : ''}`,
        weight_kg: pesoTotal,
        order_type: '1010',
        is_saldo: true,
        saldo_ref_nf: refNF,
        saldo_ref_oc: refOC || null,
        saldo_obs: obs || null,
        status: 'pending',
        delivery_date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await supabase.from('saldo_items').insert(
        itens.filter(i => i.qty > 0).map(i => ({
          order_id: orderId,
          codparc: cliente.codparc,
          item_code: i.code,
          item_name: i.name,
          qty: i.qty,
          weight_unit: i.weight,
        }))
      );
      if (onSalvo) onSalvo();
      alert('✅ Saldo criado com sucesso!');
      onFechar();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSalvando(false); }
  }

  function imprimirCliente() {
    const html = gerarHTMLDocumento('cliente', { cliente, itens: itens.filter(i => i.qty > 0), refNF, refOC, rota, data });
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  function imprimirProducao() {
    const html = gerarHTMLDocumento('producao', { cliente, itens: itens.filter(i => i.qty > 0), refNF, refOC, rota, data });
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 600, maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040', zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🔵 Criar Saldo — TOP 1010</div>
            <div style={{ fontSize: 11, color: '#90afd4', marginTop: 2 }}>Entrega complementar de nota anterior</div>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Busca cliente */}
          <div>
            <div style={{ fontSize: 11, color: '#64B4FF', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>CLIENTE</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-control" placeholder="Código do parceiro (codparc)"
                value={codparc} onChange={e => setCodparc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarCliente()}
                style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={buscarCliente} disabled={buscando}>
                {buscando ? '...' : '🔍 Buscar'}
              </button>
            </div>
            {cliente && (
              <div style={{ marginTop: 8, background: 'rgba(0,255,100,0.05)', border: '1px solid rgba(0,255,100,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontWeight: 700, color: '#10b981' }}>{cliente.name}</div>
                <div style={{ fontSize: 11, color: '#90afd4', marginTop: 2 }}>{cliente.address}{cliente.district ? ', ' + cliente.district : ''}</div>
                <div style={{ fontSize: 11, color: '#90afd4' }}>COD: {cliente.codparc} {cliente.cnpj ? '| CNPJ: ' + cliente.cnpj : ''}</div>
              </div>
            )}
          </div>

          {/* Referências */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>REF. NF *</div>
              <input className="form-control" placeholder="Ex: 9085" value={refNF} onChange={e => setRefNF(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>REF. OC</div>
              <input className="form-control" placeholder="Ex: 26818" value={refOC} onChange={e => setRefOC(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>ROTA (opcional)</div>
              <input className="form-control" placeholder="Ex: VGM-20260519-001" value={rota} onChange={e => setRota(e.target.value)} />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#64B4FF', fontWeight: 700, letterSpacing: 1 }}>ITENS DO SALDO</div>
              <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={12} /> Adicionar Item</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {itens.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="form-control" style={{ flex: 2 }} value={item.code}
                    onChange={e => updateItem(i, 'code', e.target.value)}>
                    {PRODUTOS.map(p => (
                      <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                  <input className="form-control" style={{ flex: 1 }} type="number" min="0"
                    placeholder="Qtde" value={item.qty || ''}
                    onChange={e => updateItem(i, 'qty', e.target.value)} />
                  <div style={{ fontSize: 11, color: '#f59e0b', whiteSpace: 'nowrap', minWidth: 60 }}>
                    {(item.qty * item.weight).toFixed(0)} kg
                  </div>
                  <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#f59e0b', fontWeight: 700 }}>PESO TOTAL DO SALDO</span>
              <span style={{ color: '#f59e0b', fontWeight: 900, fontSize: 16 }}>{pesoTotal.toFixed(0)} kg</span>
            </div>
          </div>

          {/* Observações */}
          <div>
            <div style={{ fontSize: 11, color: '#90afd4', marginBottom: 4 }}>OBSERVAÇÕES</div>
            <textarea className="form-control" rows={2} placeholder="Ex: Saldo ref. entrega parcial por falta de gelo no caminhão..."
              value={obs} onChange={e => setObs(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onFechar}>Cancelar</button>
            {cliente && itens.some(i => i.qty > 0) && (
              <>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={imprimirProducao}>
                  <Printer size={14} /> Doc. Produção
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={imprimirCliente}>
                  <Printer size={14} /> Doc. Cliente
                </button>
              </>
            )}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvar} disabled={salvando}>
              {salvando ? '...' : '✅ Salvar Saldo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
