import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabase';

function parseArquivo(buffer, isXlsx) {
  if (isXlsx) {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }
  const text = new TextDecoder('latin1').decode(buffer);
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

function mapearItem(row) {
  const nunota   = row['NUNOTA']      || row['Nro. Único']    || row['NRO_UNICO']  || '';
  const codparc  = row['CODPARC']     || row['Cód. Parceiro'] || row['COD_PARC']   || '';
  const codprod  = row['CODPROD']     || row['Cód. Produto']  || row['TOP']        || '';
  const descr    = row['DESCRPROD']   || row['Descrição']     || row['PRODUTO']    || '';
  const qty      = row['QTDNEG']      || row['Qtd. Negoc.']   || row['QTD']       || 0;
  const peso     = row['PESO']        || row['Peso Un.']      || row['PESOUNIT']  || 0;
  const vlr      = row['VLRTOT']      || row['Vlr. Total']    || row['VALOR']     || 0;
  const vlricms  = row['VLRICMS']     || row['Vlr. ICMS']     || 0;
  const nf       = row['NUMNOTA']     || row['Nº NF']         || nunota;
  const top      = row['CODTIPOPER']  || row['Tipo Operação'] || '1000';

  if (!nunota || !codprod) return null;

  return {
    id:             'item-' + String(nunota).replace(/\D/g, '') + '-' + String(codprod),
    order_id:       'ord-' + String(nunota).replace(/\D/g, ''),
    codparc:        parseInt(codparc) || null,
    invoice_number: String(nf).replace(/\D/g, '') || String(nunota).replace(/\D/g, ''),
    item_type:      String(codprod).trim(),
    item_name:      String(descr).trim(),
    qty:            parseFloat(String(qty).replace(',', '.')) || 0,
    weight_unit:    parseFloat(String(peso).replace(',', '.')) || 0,
    vlr_total:      parseFloat(String(vlr).replace(',', '.').replace('R$', '').trim()) || 0,
    vlr_icms:       parseFloat(String(vlricms).replace(',', '.')) || 0,
    top_app:        String(top).replace(/\D/g, '') || '1000',
    updated_at:     new Date().toISOString(),
  };
}

export default function ModalImportarItens({ onFechar, onImportado }) {
  const [fase, setFase]           = useState('upload');
  const [arquivo, setArquivo]     = useState(null);
  const [validos, setValidos]     = useState([]);
  const [erros, setErros]         = useState([]);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef();

  function handleArquivo(file) {
    if (!file) return;
    setArquivo(file);
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();
    reader.onload = function(e) {
      const rows = parseArquivo(new Uint8Array(e.target.result), isXlsx);
      const ok = []; const err = [];
      rows.forEach((row, i) => {
        const mapped = mapearItem(row);
        if (mapped) ok.push(mapped);
        else err.push(i + 2);
      });
      setValidos(ok);
      setErros(err);
      setFase('preview');
    };
    reader.readAsArrayBuffer(file);
  }

  async function importar() {
    setFase('importando');
    const LOTE = 100;
    let importados = 0; let falhas = 0;
    for (let i = 0; i < validos.length; i += LOTE) {
      const lote = validos.slice(i, i + LOTE);
      const { error } = await supabase.from('order_items').upsert(lote, { onConflict: 'id' });
      if (error) falhas += lote.length;
      else importados += lote.length;
      setProgresso(Math.round(((i + LOTE) / validos.length) * 100));
    }
    setResultado({ importados, falhas });
    setFase('resultado');
    if (onImportado) onImportado();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: '#0f2040', border: '1px solid #1e3a5c', borderRadius: 16, width: 560, maxHeight: '85vh', overflowY: 'auto' }}>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0f2040' }}>
          <span style={{ fontWeight: 700 }}>📦 Importar Itens — TGFITE</span>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#90afd4', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20 }}>

          {fase === 'upload' && (
            <div>
              <p style={{ color: '#90afd4', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Importe o CSV de itens exportado do Sankhya (TGFITE).<br />
                Os itens serão vinculados automaticamente aos pedidos pelo NUNOTA.
              </p>
              <div style={{ background: '#0a1628', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 11, color: '#90afd4' }}>
                <div style={{ color: '#64B4FF', fontWeight: 700, marginBottom: 6 }}>Colunas reconhecidas:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['NUNOTA', 'CODPARC', 'CODPROD', 'DESCRPROD', 'QTDNEG', 'PESO', 'VLRTOT', 'VLRICMS', 'CODTIPOPER'].map(c => (
                    <span key={c} style={{ background: 'rgba(100,180,255,0.1)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: 4, padding: '2px 6px' }}>{c}</span>
                  ))}
                </div>
              </div>
              <div
                style={{ border: '2px dashed rgba(100,180,255,0.3)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => inputRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleArquivo(e.dataTransfer.files[0]); }}>
                <Upload size={32} color="#64B4FF" style={{ marginBottom: 10 }} />
                <div style={{ color: '#fff', fontWeight: 700 }}>Clique ou arraste o arquivo CSV</div>
                <div style={{ color: '#90afd4', fontSize: 12 }}>CSV ou Excel (.xlsx) — TGFITE do Sankhya</div>
              </div>
              <input ref={inputRef} type="file" accept=".csv,.txt,.xls,.xlsx" style={{ display: 'none' }} onChange={e => handleArquivo(e.target.files[0])} />
            </div>
          )}

          {fase === 'preview' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: '#10b981', fontSize: 22, fontWeight: 900 }}>{validos.length}</div>
                  <div style={{ color: '#90afd4', fontSize: 11 }}>Itens válidos</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: '#ef4444', fontSize: 22, fontWeight: 900 }}>{erros.length}</div>
                  <div style={{ color: '#90afd4', fontSize: 11 }}>Ignorados</div>
                </div>
              </div>
              {validos.length > 0 && (
                <div style={{ background: '#0a1628', borderRadius: 10, border: '1px solid #1e3a5c', overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: '#0f2040' }}>
                          {['Pedido', 'Produto', 'Qtde', 'Peso Un.', 'Valor'].map(h => (
                            <th key={h} style={{ padding: '6px 8px', color: '#90afd4', fontWeight: 700, textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {validos.slice(0, 5).map((item, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #1e3a5c' }}>
                            <td style={{ padding: '5px 8px', color: '#64B4FF', fontFamily: 'monospace' }}>{item.order_id}</td>
                            <td style={{ padding: '5px 8px' }}>{item.item_type} — {item.item_name}</td>
                            <td style={{ padding: '5px 8px', color: '#10b981', fontWeight: 700 }}>{item.qty}</td>
                            <td style={{ padding: '5px 8px', color: '#f59e0b' }}>{item.weight_unit}kg</td>
                            <td style={{ padding: '5px 8px', color: '#a78bfa' }}>R${item.vlr_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setFase('upload')}>← Voltar</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={importar} disabled={validos.length === 0}>
                  ✅ Importar {validos.length} itens
                </button>
              </div>
            </div>
          )}

          {fase === 'importando' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Importando itens...</div>
              <div style={{ color: '#90afd4', fontSize: 13, marginBottom: 20 }}>{progresso}%</div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: progresso + '%', background: '#e8521a', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {fase === 'resultado' && resultado && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <CheckCircle size={48} color="#10b981" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 16 }}>
                {resultado.importados} itens importados!
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={onFechar}>Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
