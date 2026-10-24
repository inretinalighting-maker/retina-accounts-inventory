import { google } from 'googleapis';

const ENTITIES = ['transactions','salesInvoices','purchaseBills','inventoryMovements','bankTransactions','parties','projects','reconciliation','accounts','bankAccounts','products'];
const MASTER_KEYS = ['projects','parties','accounts','bankAccounts','products'];
const fields = {
  transactions: ['id','date','voucherType','voucherNo','division','projectId','projectName','partyId','partyName','accountId','accountName','amount','debit','credit','paymentMode','bankCashAccountId','narration','taxStatus','gstRate','invoiceNo','attachmentUrl'],
  salesInvoices:['id','date','invoiceNo','projectName','partyName','taxableAmount','gst','total','received','outstanding'],
  purchaseBills:['id','date','invoiceNo','partyName','purchaseType','taxableAmount','gst','total','paid','outstanding'],
  inventoryMovements:['id','date','sku','productName','movementType','qtyIn','qtyOut','warehouse','projectName','referenceNo'],
  bankTransactions:['id','date','accountName','description','debit','credit','balance','reference','reconStatus'],
  parties:['id','name','type','city','gstin'],
  projects:['id','name','status','budget','spent'],
  reconciliation:['id','bankDate','bankDescription','bankAmount','candidateVoucher','candidateAmount','status'],
  accounts:['id','name','group'],
  bankAccounts:['id','name'],
  products:['id','name'],
};
const numeric = new Set(['amount','debit','credit','taxableAmount','gst','total','received','outstanding','paid','qtyIn','qtyOut','balance','budget','spent','bankAmount','candidateAmount']);
const sheetRange = name => `'${name}'!A:AZ`;
function client() {
  const {GOOGLE_SHEET_ID,GOOGLE_SERVICE_ACCOUNT_EMAIL,GOOGLE_PRIVATE_KEY} = process.env;
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) throw new Error('Google Sheets credentials not configured');
  const auth = new google.auth.JWT({email:GOOGLE_SERVICE_ACCOUNT_EMAIL,key:GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),scopes:['https://www.googleapis.com/auth/spreadsheets']});
  return {sheets:google.sheets({version:'v4',auth}),id:GOOGLE_SHEET_ID};
}
async function read(entity, api) {
  if (!ENTITIES.includes(entity)) throw new Error('Unknown entity');
  const r = await api.sheets.spreadsheets.values.get({spreadsheetId:api.id,range:sheetRange(entity)});
  const [header,...rows] = r.data.values || [];
  if (!header) return [];
  return rows.filter(r=>r.some(x=>String(x).trim())).map(row=>Object.fromEntries(header.map((key,i)=>[key,numeric.has(key)?Number(row[i]||0):(row[i]||'')])));
}
const sum=(arr,key)=>arr.reduce((n,x)=>n+Number(x[key]||0),0);
async function dashboard(api) {
  const [sales,purchases,transactions,banks,recon,inventory]=await Promise.all(['salesInvoices','purchaseBills','transactions','bankTransactions','reconciliation','inventoryMovements'].map(n=>read(n,api)));
  const monthSales=sum(sales,'total'),monthPurchases=sum(purchases,'total');
  const monthExpenses=sum(transactions.filter(t=>['Expense','Payment'].includes(t.voucherType)),'debit');
  const grossProfit=monthSales-monthPurchases;
  return {cashBalance:0,kotakBalance:0,idfcBalance:0,fdBalance:0,receivables:sum(sales,'outstanding'),payables:sum(purchases,'outstanding'),inventoryValue:0,netProfit:grossProfit-monthExpenses,monthSales,monthPurchases,monthExpenses,grossProfit,reconMatched:banks.filter(x=>x.reconStatus==='Matched').length,reconSuggested:recon.length,reconUnmatched:banks.filter(x=>x.reconStatus==='Unmatched').length};
}
async function saveTransaction(payload,api) {
  if (!payload || !payload.date || !payload.accountId || !(Number(payload.amount)>0)) throw new Error('Date, account and positive amount are required');
  const [accounts,projects,parties] = await Promise.all(['accounts','projects','parties'].map(x=>read(x,api)));
  const name=(arr,id)=>arr.find(x=>x.id===id)?.name||'';
  const id=crypto.randomUUID(); const amount=Number(payload.amount);
  const debit=['Expense','Payment','Purchase'].includes(payload.voucherType)?amount:0;
  const record={...payload,id,voucherNo:`V-${Date.now()}`,projectName:name(projects,payload.projectId),partyName:name(parties,payload.partyId),accountName:name(accounts,payload.accountId),debit,credit:debit?0:amount};
  await api.sheets.spreadsheets.values.append({spreadsheetId:api.id,range:sheetRange('transactions'),valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[fields.transactions.map(k=>record[k]??'')]}});
  return {ok:true,id};
}
export default async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const {name,args=[]}=req.body||{}; const api=client(); let result;
    if(name==='apiBootstrap') result={masters:Object.fromEntries(await Promise.all(MASTER_KEYS.map(async k=>[k,await read(k,api)]))),orgName:'Retina'};
    else if(name==='apiDashboard') result=await dashboard(api);
    else if(name==='apiList') result=await read(args[0],api);
    else if(name==='apiSave' && args[0]==='transactions') result=await saveTransaction(args[1],api);
    else if(name==='apiReport') {
      const [sales,purchases,txns]=await Promise.all(['salesInvoices','purchaseBills','transactions'].map(k=>read(k,api)));
      if(args[0]==='Receivables Aging') result=sales.filter(x=>Number(x.outstanding)>0);
      else if(args[0]==='Payables Aging') result=purchases.filter(x=>Number(x.outstanding)>0);
      else if(args[0]==='Inventory Valuation') result=await read('inventoryMovements',api);
      else result={note:`${args[0]} report needs accounting logic before production use.`};
    } else if(name==='apiUploadBase64') return res.status(501).json({error:'Attachment uploads are not configured. Add a secure Drive upload endpoint.'});
    else return res.status(400).json({error:'Unsupported operation'});
    return res.status(200).json(result);
  }catch(e){console.error(e);return res.status(500).json({error:e.message||'Server error'});}
}
