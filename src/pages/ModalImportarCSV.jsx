import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import * as XLSX from 'xlsx';

// Lê xlsx ou csv e retorna array de objetos
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

// Extrai código e nome do campo "CODPAR-NOME PARCEIROS" ex: "4176-UP2U MARKET"
function parseCodNome(val) {
  if (!val) return { codparc: null, nome: '' };
  const str = String(val).trim();
  const match = str.match(/^(\d+)[- ]+(.+)$/);
  if (match) return { codparc: parseInt(match[1]), nome: match[2].trim() };
  if (/^\d+$/.test(str)) return { codparc: parseInt(str), nome: '' };
  return { codparc: null, nome: str };
}

function mapearLinha(row) {
  // Suporte ao formato da planilha TI (itens com ORDEM DE CARGA = 0)
  const oc = row['ORDEM DE CARGA'] !== undefined ? row['ORDEM DE CARGA'] : null;
  // Se tiver coluna ORDEM DE CARGA, filtrar só OC=0
  if (oc !== null && oc !== '' && parseInt(oc) !== 0) return null;

  const nunota  = row['NUMERO ÚNICO']         || row['NUNOTA']       || row['Nro. Único']    || row['NRO_UNICO']   || '';
  const nf      = row['NUMERO DOCUMENTO']     || row['NUMNOTA']      || row['Nº NF']          || nunota;
  const codNome = row['CODPAR-NOME PARCEIROS']|| '';
  const { codparc, nome } = parseCodNome(codNome);
  const nomeFinal = nome || row['NOMEPARC'] || row['Nome Parceiro'] || '';
  const codparcFinal = codparc || parseInt(row['CODPARC'] || row['Cód. Parceiro'] || 0) || null;
  const data    = row['DATA']                 || row['DTNEG']        || row['Dt. Negoc.']     || '';
  const top     = row['TOP']                  || row['CODTIPOPER']   || row['Tipo Operação']  || '1000';
  const peso    = row['PESO']                 || row['PESOBRUT']     || row['Peso']           || 0;
  const vlr     = row['VLRNOTA']              || row['Vlr. Nota']    || row['VALOR']          || 0;
  const ende    = row['ENDERECO']             || row['Endereço']     || '';
  const pagto   = row['PAGAMENTO']            || row['Pagamento']    || 'A Vista';
  const volume  = row['VOLUME']               || row['VOLUMEBRUT']   || 0;
  const geo     = row['REGIAO']               || row['Região']       || row['GEO_ZONE']       || '';

  if (!nunota) return null;

  // Buscar nome do cliente na tabela clients se não veio na planilha
  const recipientName = nomeFinal || (codparcFinal ? `CODPARC ${codparcFinal}` : '—');

  return {
    id:                  'ord-' + String(nunota).replace(/\D/g, ''),
    external_id:         String(nunota).replace(/\D/g, ''),
    invoice_number:      String(nf).replace(/\D/g, '') || String(nunota).replace(/\D/g, ''),
    codparc:             codparcFinal,
    recipient_name:      recipientName,
    address:             ende,
    order_type:          String(top).replace(/\D/g, '') || '1000',
    weight_kg:           parseFloat(String(peso).replace(',', '.')) || 0,
    total_value:         parseFloat(String(vlr).replace(',', '.').replace('R$','').trim()) || 0,
    payment_description: String(pagto).trim(),
    delivery_date:       data ? String(data).split('/').reverse().join('-').slice(0,10) : new Date().toISOString().slice(0,10),
    volume_m3:           parseFloat(String(volume).replace(',', '.')) || 0,
    geo_zone:            String(geo).trim(),
    status:              'pending',
    updated_at:          new Date().toISOString(),
  };
}

export default function ModalImportarCSV({ onFechar, onImportado }) {
  const [fase, setFase]           = useState('upload');
  const [validas, setValidas]     = useState([]);
  const [erros, setErros]         = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef();

  function handleArquivo(file) {
    if (!file) return;
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();
    reader.onload = function(e) {
      const rows = parseArquivo(new Uint8Array(e.target.result), isXlsx);
      setTotalLinhas(rows.length);
      const ok = []; const err = [];
      rows.forEach((row, i) => {
        const mapped = mapearLinha(row);
        if (mapped) ok.push(mapped);
        else err.push(i + 2);
      });
      setValidas(ok);
      setErros(err);
      setFase('preview');
    };
    reader.readAsArrayBuffer(file);
  }

  async function importar() {
    setFase('importando');
    const LOTE = 50;
    let importados = 0; let falhas = 0;
    for (let i = 0; i < validas.length; i += LOTE) {
      const lote = validas.slice(i, i + LOTE);
      const { error } = await supabase.from('orders').upsert(lote, { onConflict: 'id' });
      if (error) falhas += lote.length;
      else importados += lote.length;
      setProgresso(Math.round(((i + LOTE) / validas.length) * 100));
    }

    // Atualizar recipient_name dos que vieram como CODPARC XXXX
    const semNome = validas.filter(p => p.recipient_name && p.recipient_name.startsWith('CODPARC') && p.codparc);
    if (semNome.length > 0) {
      const codparcs = semNome.map(p => p.codparc);
      const { data: clientes } = await supabase.from('clients').select('codparc, name').in('codparc', codparcs);
      if (clientes && clientes.length > 0) {
        const mapa = {};
        clientes.forEach(c => { mapa[c.codparc] = c.name; });
        for (const p of semNome) {
          if (mapa[p.codparc]) {
            await supabase.from('orders').update({ recipient_name: mapa[p.codparc] }).eq('id', p.id);
          }
        }
      }
    }

    setResultado({ importados, falhas, total: validas.length });
    setFase('resultado');
    if (onImportado) onImportado();
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background:'#0f2040', border:'1px solid #1e3a5c', borderRadius:16, width:580, maxHeight:'90vh', overflowY:'auto' }}>

        <div style={{ padding:'14px 20px', borderBottom:'1px solid #1e3a5c', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#0f2040', zIndex:1 }}>
          <span style={{ fontWeight:700, fontSize:15 }}>📥 Importar Pedidos — Sankhya</span>
          <button onClick={onFechar} style={{ background:'none', border:'none', color:'#90afd4', cursor:'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding:20 }}>

          {fase === 'upload' && (
            <div>
              <p style={{ color:'#90afd4', fontSize:13, marginBottom:16, lineHeight:1.6 }}>
                Selecione o arquivo exportado do Sankhya.<br/>
                Aceita <strong style={{ color:'#64B4FF' }}>XLSX, XLS ou CSV</strong>.
              </p>
              <div style={{ background:'#0a1628', borderRadius:8, padding:12, marginBottom:16, fontSize:11, color:'#90afd4' }}>
                <div style={{ color:'#64B4FF', fontWeight:700, marginBottom:6 }}>Colunas reconhecidas:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {['NUMERO ÚNICO', 'CODPAR-NOME PARCEIROS', 'NUMERO DOCUMENTO', 'DATA', 'TOP', 'ORDEM DE CARGA', 'PESO', 'VLRNOTA', 'NUNOTA', 'CODPARC', 'NOMEPARC'].map(c => (
                    <span key={c} style={{ background:'rgba(100,180,255,0.1)', border:'1px solid rgba(100,180,255,0.2)', borderRadius:4, padding:'2px 6px' }}>{c}</span>
                  ))}
                </div>
                <div style={{ marginTop:8, color:'rgba(255,255,255,0.4)', fontSize:10 }}>
                  ⚡ Linhas com ORDEM DE CARGA ≠ 0 são ignoradas automaticamente
                </div>
              </div>
              <div
                style={{ border:'2px dashed rgba(100,180,255,0.3)', borderRadius:12, padding:40, textAlign:'center', cursor:'pointer' }}
                onClick={() => inputRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleArquivo(e.dataTransfer.files[0]); }}>
                <Upload size={32} color="#64B4FF" style={{ marginBottom:10 }} />
                <div style={{ color:'#fff', fontWeight:700, marginBottom:4 }}>Clique ou arraste o arquivo aqui</div>
                <div style={{ color:'#90afd4', fontSize:12 }}>XLSX, XLS ou CSV do Sankhya</div>
              </div>
              <input ref={inputRef} type="file" accept=".csv,.txt,.xls,.xlsx" style={{ display:'none' }} onChange={e => handleArquivo(e.target.files[0])} />
            </div>
          )}

          {fase === 'preview' && (
            <div>
              <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                <div style={{ flex:1, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:12, textAlign:'center' }}>
                  <div style={{ color:'#10b981', fontSize:22, fontWeight:900 }}>{validas.length}</div>
                  <div style={{ color:'#90afd4', fontSize:11 }}>Pedidos válidos</div>
                </div>
                <div style={{ flex:1, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:12, textAlign:'center' }}>
                  <div style={{ color:'#ef4444', fontSize:22, fontWeight:900 }}>{erros.length}</div>
                  <div style={{ color:'#90afd4', fontSize:11 }}>Ignorados (OC≠0 ou sem ID)</div>
                </div>
                <div style={{ flex:1, background:'rgba(100,180,255,0.1)', border:'1px solid rgba(100,180,255,0.3)', borderRadius:10, padding:12, textAlign:'center' }}>
                  <div style={{ color:'#64B4FF', fontSize:22, fontWeight:900 }}>{totalLinhas}</div>
                  <div style={{ color:'#90afd4', fontSize:11 }}>Total no arquivo</div>
                </div>
              </div>

              {validas.length > 0 && (
                <div style={{ background:'#0a1628', borderRadius:10, border:'1px solid #1e3a5c', overflow:'hidden', marginBottom:16 }}>
                  <div style={{ padding:'8px 12px', borderBottom:'1px solid #1e3a5c', fontSize:11, color:'#64B4FF', fontWeight:700 }}>
                    PRÉVIA — primeiros 5 pedidos
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                      <thead>
                        <tr style={{ background:'#0f2040' }}>
                          {['Pedido', 'Cliente', 'TOP', 'Peso', 'Valor'].map(h => (
                            <th key={h} style={{ padding:'6px 8px', color:'#90afd4', textAlign:'left', fontWeight:700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {validas.slice(0, 5).map((p, i) => (
                          <tr key={i} style={{ borderTop:'1px solid #1e3a5c' }}>
                            <td style={{ padding:'5px 8px', color:'#64B4FF', fontFamily:'monospace' }}>{p.external_id}</td>
                            <td style={{ padding:'5px 8px', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.recipient_name}</td>
                            <td style={{ padding:'5px 8px', color:'#a78bfa' }}>{p.order_type}</td>
                            <td style={{ padding:'5px 8px', color:'#f59e0b' }}>{p.weight_kg}kg</td>
                            <td style={{ padding:'5px 8px', color:'#10b981' }}>R${p.total_value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setFase('upload')}>← Outro arquivo</button>
                <button className="btn btn-primary" style={{ flex:2 }} onClick={importar} disabled={validas.length === 0}>
                  ✅ Importar {validas.length} pedidos
                </button>
              </div>
            </div>
          )}

          {fase === 'importando' && (
            <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Importando pedidos...</div>
              <div style={{ color:'#90afd4', fontSize:13, marginBottom:20 }}>{Math.min(progresso,100)}% concluído</div>
              <div style={{ height:8, background:'rgba(255,255,255,0.1)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:Math.min(progresso,100)+'%', background:'#e8521a', borderRadius:4, transition:'width 0.3s' }} />
              </div>
            </div>
          )}

          {fase === 'resultado' && resultado && (
            <div style={{ textAlign:'center', padding:20 }}>
              {resultado.falhas === 0
                ? <CheckCircle size={48} color="#10b981" style={{ marginBottom:12 }} />
                : <AlertCircle size={48} color="#f59e0b" style={{ marginBottom:12 }} />
              }
              <div style={{ fontWeight:900, fontSize:20, marginBottom:8 }}>
                {resultado.falhas === 0 ? 'Importação concluída!' : 'Importação parcial'}
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:20 }}>
                <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:'10px 20px' }}>
                  <div style={{ color:'#10b981', fontSize:24, fontWeight:900 }}>{resultado.importados}</div>
                  <div style={{ color:'#90afd4', fontSize:11 }}>importados</div>
                </div>
                {resultado.falhas > 0 && (
                  <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 20px' }}>
                    <div style={{ color:'#ef4444', fontSize:24, fontWeight:900 }}>{resultado.falhas}</div>
                    <div style={{ color:'#90afd4', fontSize:11 }}>com erro</div>
                  </div>
                )}
              </div>
              <button className="btn btn-primary" style={{ width:'100%' }} onClick={onFechar}>Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
