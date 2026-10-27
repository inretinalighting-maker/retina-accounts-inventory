import React, {useState} from 'react';

const columns=['date','voucherType','voucherNo','division','projectName','partyName','accountName','amount','debit','credit','paymentMode','bankCashAccountName','narration','taxStatus','gstRate','invoiceNo'];
function parseCSV(text){
  const rows=[];let row=[],cell='',quote=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"') {if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}
    else if(c===','&&!quote){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quote)throw new Error('CSV contains an unclosed quoted field');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw new Error('CSV needs a header and at least one transaction');
  const headers=rows.shift().map(v=>v.trim());
  for(const required of ['date','voucherType','voucherNo','accountName','amount','debit','credit'])if(!headers.includes(required))throw new Error('Missing required column: '+required);
  return rows.map((r)=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));
}
const fmt = v=>/^\d+(\.\d+)?$/.test(String(v||'').replace(/,/g,'')) ? Number(String(v).replace(/,/g,'')) : NaN;
export default function HistoricalImport({accounts,onImported}){
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState('');
  async function choose(e){
    setError('');setResult('');setRows([]);
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(!file.name.toLowerCase().endsWith('.csv')||file.size>2_000_000)throw new Error('Choose a CSV file smaller than 2 MB');
      const parsed=parseCSV(await file.text());if(parsed.length>300)throw new Error('Import a maximum of 300 rows per file');
      const names=new Set(accounts.map(a=>String(a.name).trim().toLowerCase()));
      const errors=[];
      parsed.forEach((r,i)=>{
        const amount=fmt(r.amount),debit=fmt(r.debit||'0'),credit=fmt(r.credit||'0');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!r.voucherNo||!r.voucherType||!names.has(String(r.accountName).toLowerCase())||!(amount>0)||!Number.isFinite(debit)||!Number.isFinite(credit)||((debit>0)===(credit>0))||Math.abs(amount-(debit||credit))>.01)errors.push('Row '+(i+2)+' needs valid date, voucher, live account and amount/debit/credit');
      });
      if(errors.length)throw new Error(errors.slice(0,8).join('; '));
      setRows(parsed.map(r=>({...r,amount:fmt(r.amount),debit:fmt(r.debit||'0'),credit:fmt(r.credit||'0')})));
    }catch(ex){setError(ex.message);}
  }
  async function confirm(){
    if(!rows.length||busy)return;
    if(!window.confirm(`Import ${rows.length} historical transactions into Google Sheets? This writes real records.`))return;
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/retina',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'apiImportHistoricalTransactions',args:[{rows}]})});
      const data=await res.json();if(!res.ok||!data.ok)throw new Error((data.errors||[]).join('; ')||data.error||'Import failed');
      setResult(`Imported ${data.imported} transactions to Google Sheets`);setRows([]);onImported?.();
    }catch(ex){setError(ex.message);}finally{setBusy(false);}
  }
  function template(){const csv=columns.join(',')+'\n';const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='retina-historical-transactions-template.csv';a.click();URL.revokeObjectURL(url);}
  return <section style={{padding:16,background:'#fff',border:'1px solid #ddd',borderRadius:10,marginBottom:16}}>
    <h3>Import historical transactions (optional)</h3>
    <p>Upload whenever you're ready. Selecting a file only previews it; Google Sheets is updated <b>only after Confirm Import</b>. Use YYYY-MM-DD dates and exact live Chart of Accounts names. One bank debit/credit direction per row.</p>
    <button onClick={template}>Download CSV template</button>{' '}<input type="file" accept=".csv,text/csv" onChange={choose}/>
    {error&&<p role="alert" style={{color:'#a00'}}>{error}</p>}{result&&<p>{result}</p>}
    {rows.length>0&&<><p><b>{rows.length} rows ready for review</b> (showing first 10)</p><div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:12}}><thead><tr>{['date','voucherNo','voucherType','accountName','debit','credit'].map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.slice(0,10).map((r,i)=><tr key={i}>{['date','voucherNo','voucherType','accountName','debit','credit'].map(k=><td key={k}>{r[k]}</td>)}</tr>)}</tbody></table></div><button disabled={busy} onClick={confirm}>{busy?'Importing…':'Confirm Import to Google Sheets'}</button></>}
    <p style={{fontSize:12,color:'#666'}}>Kotak and IDFC CSV imports remain available separately under Reconciliation. Importing bank statements does not create accounting vouchers.</p>
  </section>;
}
