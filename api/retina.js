import { google } from 'googleapis';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';

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
  const { GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) throw new Error('Google Sheets credentials not configured');
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return { sheets: google.sheets({ version: 'v4', auth }), id: GOOGLE_SHEET_ID };
}

async function read(entity, api) {
  if (!ENTITIES.includes(entity)) throw new Error('Unknown entity');
  const r = await api.sheets.spreadsheets.values.get({ spreadsheetId: api.id, range: sheetRange(entity) });
  const [header, ...rows] = r.data.values || [];
  if (!header) return [];
  return rows.filter(r => r.some(x => String(x).trim())).map(row => Object.fromEntries(
    header.map((key, i) => [key, numeric.has(key) ? Number(row[i] || 0) : (row[i] || '')])
  ));
}

// Read-only migration preview. Staging never alters the live accounts master.
async function stagingAccounts(api) {
  let values;
  try {
    const response = await api.sheets.spreadsheets.values.get({
      spreadsheetId: api.id, range: "'accounts_staging'!A:G",
    });
    values = response.data.values || [];
  } catch (error) {
    if (error?.code === 400 || error?.code === 404) return [];
    throw error;
  }
  return values.slice(1).map((r, i) => ({
    sourceRow: i + 2, division: r[0] || '', type: r[1] || '',
    head: r[2] || '', subHead: r[3] || '', newAccountId: r[4] || '',
    accountGroup: r[5] || '', migrationStatus: r[6] || '',
  })).filter(r => r.head);
}


// Staging writes are deliberately confined to accounts_staging A:G.
// Deleting clears cells instead of removing rows, so ROW()-based IDs elsewhere do not shift.
async function stagingRowById(id, api) {
  const rows = await stagingAccounts(api);
  const found = rows.filter(r => r.newAccountId === id);
  if (found.length !== 1) throw new Error(found.length ? 'Duplicate staging IDs; operation blocked' : 'Staged account not found');
  return found[0];
}
function stageValues(p, id) {
  const val = key => String(p?.[key] ?? '').trim();
  if (!val('head')) throw new Error('Head is required');
  if (!id || !/^[A-Za-z0-9_-]{3,80}$/.test(id)) throw new Error('Invalid account ID');
  return [val('division'), val('type'), val('head'), val('subHead'), id, val('accountGroup'), val('migrationStatus') || 'Pending Review'];
}
async function saveStagedAccount(payload, api) {
  const rows = await stagingAccounts(api);
  const id = String(payload?.newAccountId || '').trim();
  if (id) {
    const old = await stagingRowById(id, api);
    const values = stageValues(payload, id);
    await api.sheets.spreadsheets.values.update({spreadsheetId: api.id, range: `'accounts_staging'!A${old.sourceRow}:G${old.sourceRow}`, valueInputOption: 'RAW', requestBody: {values: [values]}});
    return {ok:true, id};
  }
  const newId = `RET-${crypto.randomUUID()}`;
  const values = stageValues(payload, newId);
  // Find a vacant existing staging row first, to avoid formula-generated IDs shifting.
  const result = await api.sheets.spreadsheets.values.get({spreadsheetId: api.id, range: "'accounts_staging'!A:G"});
  const all = result.data.values || [];
  let row = -1;
  for (let i = 1; i < all.length; i++) if (!(all[i] || []).some(v => String(v || '').trim())) {row = i + 1; break;}
  if (row > 0) {
    await api.sheets.spreadsheets.values.update({spreadsheetId: api.id, range: `'accounts_staging'!A${row}:G${row}`, valueInputOption:'RAW', requestBody:{values:[values]}});
  } else {
    await api.sheets.spreadsheets.values.append({spreadsheetId: api.id, range:"'accounts_staging'!A:G", valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{values:[values]}});
  }
  return {ok:true, id:newId};
}
async function deleteStagedAccount(id, api) {
  const old = await stagingRowById(id, api);
  await api.sheets.spreadsheets.values.clear({spreadsheetId: api.id, range:`'accounts_staging'!A${old.sourceRow}:G${old.sourceRow}`});
  return {ok:true};
}

// Bank statement imports retain the original bankTransactions columns and append metadata.
const BANK_HEADERS = [...fields.bankTransactions, 'sourceBank', 'importKey', 'valueDate', 'direction', 'matchedTransactionId', 'matchedVoucherNo', 'matchedAt'];
async function ensureBankHeaders(api) {
  const range = "'bankTransactions'!1:1";
  const r = await api.sheets.spreadsheets.values.get({spreadsheetId:api.id,range});
  const existing = r.data.values?.[0] || [];
  if (!existing.length) throw new Error('bankTransactions sheet needs its existing header row');
  const missing = BANK_HEADERS.filter(k=>!existing.includes(k));
  if (missing.length) await api.sheets.spreadsheets.values.update({spreadsheetId:api.id,range:`'bankTransactions'!A1:${columnLetter(existing.length+missing.length)}1`,valueInputOption:'RAW',requestBody:{values:[[...existing,...missing]]}});
  return [...existing,...missing];
}
function bankName(raw) {
  const name = String(raw||'').trim().toLowerCase();
  if (name === 'kotak' || name === 'kotak bank') return 'Kotak Bank';
  if (name === 'idfc' || name === 'idfc bank' || name === 'idfc first bank') return 'IDFC Bank';
  throw new Error('Select Kotak Bank or IDFC Bank');
}
function safeBankText(v) { const x=String(v??'').trim().slice(0,500); return /^[=+@\-\t\r]/.test(x) ? "'"+x : x; }
function validBankDate(v) { const x=String(v||'').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(x) || Number.isNaN(Date.parse(x))) throw new Error('Invalid bank date: '+x); return x; }
function money(v) { const n=Number(v); if (!Number.isFinite(n)||n<0) throw new Error('Invalid bank amount'); return Math.round(n*100)/100; }
function bankFingerprint(bank,r) {
  return crypto.createHash('sha256').update(JSON.stringify([bank,r.date,r.valueDate,r.description,r.debit,r.credit,r.reference,r.balance])).digest('hex');
}
async function importBankRows(payload,api) {
  const bank=bankName(payload?.bank);
  const rows=payload?.rows;
  if (!Array.isArray(rows)||!rows.length||rows.length>500) throw new Error('Import 1–500 rows at a time');
  const header=await ensureBankHeaders(api);
  const existing=await read('bankTransactions',api);
  const seen=new Set(existing.map(r=>r.importKey).filter(Boolean));
  const batch=[]; let skipped=0;
  for (const raw of rows) {
    const date=validBankDate(raw.date);
    const debit=money(raw.debit||0),credit=money(raw.credit||0);
    if ((debit>0)===(credit>0)) throw new Error('Each bank entry must have exactly one positive debit or credit');
    const record={id:`BANK-${crypto.randomUUID()}`,date,accountName:bank,sourceBank:bank,description:safeBankText(raw.description),debit,credit,balance:raw.balance===''||raw.balance==null?'':Number(raw.balance),reference:safeBankText(raw.reference),valueDate:raw.valueDate?validBankDate(raw.valueDate):'',direction:debit>0?'Debit':'Credit',reconStatus:'Unmatched',matchedTransactionId:'',matchedVoucherNo:'',matchedAt:''};
    if (!record.description) throw new Error('Missing bank description');
    if (record.balance!==''&&!Number.isFinite(record.balance)) throw new Error('Invalid balance');
    record.importKey=bankFingerprint(bank,record);
    if (seen.has(record.importKey)) {skipped++;continue;}
    seen.add(record.importKey);
    batch.push(header.map(k=>record[k]??''));
  }
  if(batch.length) await api.sheets.spreadsheets.values.append({spreadsheetId:api.id,range:sheetRange('bankTransactions'),valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:batch}});
  return {ok:true,imported:batch.length,skipped};
}
async function reconcileBankRow(payload,api) {
  const id=String(payload?.bankRowId||'');
  const txid=String(payload?.transactionId||'');
  if(!id) throw new Error('Bank row ID required');
  const [bankRows,txns,header]=await Promise.all([read('bankTransactions',api),read('transactions',api),ensureBankHeaders(api)]);
  const row=bankRows.find(r=>String(r.id)===id);
  if(!row) throw new Error('Bank statement row not found');
  const tx=txid?txns.find(t=>String(t.id)===txid):null;
  if(txid&&!tx) throw new Error('Retina transaction not found');
  if(tx) {
    if(bankRows.some(r=>r.id!==id&&r.matchedTransactionId===txid&&r.reconStatus==='Matched')) throw new Error('Transaction is already matched to another bank row');
    const amt=Number(row.debit||row.credit||0);
    if(Math.abs(amt-Number(tx.amount||tx.debit||tx.credit||0))>0.009) throw new Error('Amounts differ; cannot confirm match');
    // A payment/expense is a bank debit; a receipt/income is a bank credit.
    const txDebit=Number(tx.debit||0)>0;
    if(txDebit !== (Number(row.debit||0)>0)) throw new Error('Bank debit/credit direction does not match the transaction');
    const bankAccounts=await read('bankAccounts',api);
    const bankAccount=bankAccounts.find(b=>String(b.id)===String(tx.bankCashAccountId));
    if(!bankAccount||bankName(bankAccount.name)!==bankName(row.accountName)) throw new Error('Transaction bank account does not match the imported statement');
  }
  const updated={...row,reconStatus:tx?'Matched':'Unmatched',matchedTransactionId:tx?.id||'',matchedVoucherNo:tx?.voucherNo||'',matchedAt:tx?new Date().toISOString():''};
  const raw=await api.sheets.spreadsheets.values.get({spreadsheetId:api.id,range:sheetRange('bankTransactions')});
  const values=raw.data.values||[]; const idx=(values[0]||[]).indexOf('id');
  const matches=values.map((r,i)=>String(r[idx]||'')===id?i+1:0).filter(Boolean);
  if(matches.length!==1) throw new Error('Duplicate or missing bank row ID');
  await api.sheets.spreadsheets.values.update({spreadsheetId:api.id,range:`'bankTransactions'!A${matches[0]}:${columnLetter(header.length)}${matches[0]}`,valueInputOption:'RAW',requestBody:{values:[header.map(k=>updated[k]??'')]}});
  return {ok:true,status:updated.reconStatus};
}

const sum = (arr, key) => arr.reduce((n, x) => n + Number(x[key] || 0), 0);

async function dashboard(api) {
  const [sales, purchases, transactions, banks, recon, inventory] = await Promise.all(
    ['salesInvoices','purchaseBills','transactions','bankTransactions','reconciliation','inventoryMovements'].map(n => read(n, api))
  );
  const monthSales = sum(sales, 'total');
  const monthPurchases = sum(purchases, 'total');
  const monthExpenses = sum(transactions.filter(t => ['Expense','Payment'].includes(t.voucherType)), 'debit');
  const grossProfit = monthSales - monthPurchases;
  return {
    cashBalance: 0, kotakBalance: 0, idfcBalance: 0, fdBalance: 0,
    receivables: sum(sales, 'outstanding'), payables: sum(purchases, 'outstanding'),
    inventoryValue: 0, netProfit: grossProfit - monthExpenses,
    monthSales, monthPurchases, monthExpenses, grossProfit,
    reconMatched: banks.filter(x => x.reconStatus === 'Matched').length,
    reconSuggested: recon.length,
    reconUnmatched: banks.filter(x => x.reconStatus === 'Unmatched').length,
  };
}

function validateAttachmentUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.length > 2048) throw new Error('Attachment link is too long');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid attachment URL'); }
  if (parsed.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(parsed.hostname)) {
    throw new Error('Use an HTTPS Google Drive or Google Docs attachment link');
  }
  return url;
}

async function saveTransaction(payload, api) {
  if (!payload || !payload.date || !payload.accountId || !(Number(payload.amount) > 0)) {
    throw new Error('Date, account and positive amount are required');
  }
  const [accounts, projects, parties] = await Promise.all(['accounts','projects','parties'].map(x => read(x, api)));
  const selectedAccount = accounts.find(x => String(x.id) === String(payload.accountId));
  if (!selectedAccount) throw new Error('Select an approved account from the live chart of accounts. Staging accounts cannot be posted.');
  const name = (arr, id) => arr.find(x => String(x.id) === String(id))?.name || '';
  const id = crypto.randomUUID();
  const amount = Number(payload.amount);
  const debit = ['Expense','Payment','Purchase'].includes(payload.voucherType) ? amount : 0;
  const record = {
    ...payload, id, voucherNo: `V-${Date.now()}`,
    projectName: name(projects, payload.projectId),
    partyName: name(parties, payload.partyId),
    accountName: name(accounts, payload.accountId),
    debit, credit: debit ? 0 : amount,
    attachmentUrl: validateAttachmentUrl(payload.attachmentUrl),
  };
  await api.sheets.spreadsheets.values.append({
    spreadsheetId: api.id, range: sheetRange('transactions'),
    valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [fields.transactions.map(k => record[k] ?? '')] },
  });
  return { ok: true, id };
}

// Historical CSV import: explicit confirmation, duplicate protection, no silent account creation.
async function importHistoricalTransactions(payload, api) {
  const input = payload?.rows;
  if (!Array.isArray(input) || !input.length || input.length > 300) throw new Error('Import 1 to 300 rows per batch');
  const [existing, accounts, projects, parties, banks] = await Promise.all(['transactions','accounts','projects','parties','bankAccounts'].map(x => read(x, api)));
  const known = new Set(existing.map(x => String(x.voucherNo || '').trim().toLowerCase()).filter(Boolean));
  const seen = new Set(); const records = []; const errors = [];
  for (let i=0; i<input.length; i++) {
    const r=input[i];
    const date=String(r.date||'').trim(); const voucherNo=String(r.voucherNo||'').trim();
    const account=accounts.find(a=>String(a.id)===String(r.accountId)) || accounts.find(a=>String(a.name).trim().toLowerCase()===String(r.accountName||'').trim().toLowerCase());
    const amount=Number(r.amount||0); const debit=Number(r.debit||0); const credit=Number(r.credit||0);
    const vtype=String(r.voucherType||'').trim();
    const division=String(r.division||'').trim();
    if(!['Design','Product'].includes(division)) { errors.push(`Row ${i+1}: division must be Design or Product`); continue; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!voucherNo||!account||!(amount>0)||!vtype||(!debit&&!credit)|| (debit>0&&credit>0)) { errors.push(`Row ${i+1}: invalid date (YYYY-MM-DD), voucher, account, type, amount or debit/credit`); continue; }
    const key=voucherNo.toLowerCase();
    if(known.has(key)||seen.has(key)){errors.push(`Row ${i+1}: duplicate voucher ${voucherNo}`);continue;}
    seen.add(key);
    const project=projects.find(x=>String(x.id)===String(r.projectId))||projects.find(x=>x.name===r.projectName);
    const party=parties.find(x=>String(x.id)===String(r.partyId))||parties.find(x=>x.name===r.partyName);
    const bank=banks.find(x=>String(x.id)===String(r.bankCashAccountId))||banks.find(x=>x.name===r.bankCashAccountName);
    records.push({id:crypto.randomUUID(),date,voucherType:vtype,voucherNo,division,projectId:project?.id||'',projectName:project?.name||'',partyId:party?.id||'',partyName:party?.name||'',accountId:account.id,accountName:account.name,amount,debit,credit,paymentMode:String(r.paymentMode||''),bankCashAccountId:bank?.id||'',narration:String(r.narration||''),taxStatus:String(r.taxStatus||''),gstRate:r.gstRate||'',invoiceNo:String(r.invoiceNo||''),attachmentUrl:validateAttachmentUrl(r.attachmentUrl)});
  }
  // All-or-nothing validation: avoid partial imports from malformed files.
  if(errors.length) return {ok:false, imported:0, errors:errors.slice(0,30)};
  await api.sheets.spreadsheets.values.append({spreadsheetId:api.id,range:sheetRange('transactions'),valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:records.map(r=>fields.transactions.map(k=>r[k]??''))}});
  return {ok:true,imported:records.length};
}

// Mutations locate records by immutable ID, never by row number supplied by the browser.
async function locateRow(entity, id, api) {
  if (!['accounts', 'transactions', 'parties', 'projects'].includes(entity)) throw new Error('Unsupported entity');
  if (!id) throw new Error('Record ID is required');
  const response = await api.sheets.spreadsheets.values.get({ spreadsheetId: api.id, range: sheetRange(entity) });
  const values = response.data.values || [];
  const header = values[0] || [];
  const index = header.indexOf('id');
  if (index < 0) throw new Error('Sheet is missing ID column');
  const matches = [];
  for (let i = 1; i < values.length; i++) if (String(values[i][index] || '') === String(id)) matches.push(i + 1);
  if (matches.length !== 1) throw new Error(matches.length ? 'Duplicate IDs detected; operation blocked' : 'Record not found');
  return { row: matches[0], header };
}
async function saveAccount(payload, api) {
  const name = String(payload?.name || '').trim();
  const group = String(payload?.group || '').trim();
  if (!name || !group) throw new Error('Account name and group are required');
  const existing = await read('accounts', api);
  if (existing.some(a => a.name.toLowerCase() === name.toLowerCase() && String(a.id) !== String(payload.id || ''))) throw new Error('Account name already exists');
  if (payload.id) {
    const { row, header } = await locateRow('accounts', payload.id, api);
    const old = existing.find(a => String(a.id) === String(payload.id));
    const updated = { ...old, name, group };
    await api.sheets.spreadsheets.values.update({ spreadsheetId: api.id, range: `'accounts'!A${row}:${columnLetter(header.length)}${row}`, valueInputOption: 'RAW', requestBody: { values: [header.map(k => updated[k] ?? '')] } });
    return { ok: true, id: payload.id };
  }
  const id = `ACC-${crypto.randomUUID()}`;
  await api.sheets.spreadsheets.values.append({ spreadsheetId: api.id, range: sheetRange('accounts'), valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [fields.accounts.map(k => ({id,name,group})[k] ?? '')] } });
  return { ok: true, id };
}
async function saveMaster(entity, payload, api) {
  if (!['parties', 'projects'].includes(entity)) throw new Error('Unsupported master');
  const name = String(payload?.name || '').trim();
  if (!name) throw new Error('Name is required');
  const records = await read(entity, api);
  if (records.some(r => String(r.name || '').trim().toLowerCase() === name.toLowerCase() && String(r.id) !== String(payload.id || ''))) throw new Error('A record with this name already exists');
  const id = payload.id ? String(payload.id) : `${entity === 'parties' ? 'PTY' : 'PRJ'}-${crypto.randomUUID()}`;
  const record = { ...(records.find(r => String(r.id) === id) || {}), ...payload, id, name };
  if (entity === 'projects') {
    if (!Number.isFinite(Number(record.budget)) || Number(record.budget) < 0) throw new Error('Budget must be zero or greater');
    record.budget = Number(record.budget || 0);
    record.spent = Number(record.spent || 0);
  }
  if (payload.id) {
    const { row, header } = await locateRow(entity, id, api);
    await api.sheets.spreadsheets.values.update({ spreadsheetId: api.id, range: `'${entity}'!A${row}:${columnLetter(header.length)}${row}`, valueInputOption: 'RAW', requestBody: { values: [header.map(k => record[k] ?? '')] } });
  } else {
    const sheet = await api.sheets.spreadsheets.values.get({ spreadsheetId: api.id, range: `'${entity}'!1:1` });
    const header = sheet.data.values?.[0] || fields[entity];
    await api.sheets.spreadsheets.values.append({ spreadsheetId: api.id, range: sheetRange(entity), valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [header.map(k => record[k] ?? '')] } });
  }
  return { ok: true, id };
}
async function masterReferences(entity, record, api) {
  const [transactions, sales, purchases, inventory] = await Promise.all(['transactions','salesInvoices','purchaseBills','inventoryMovements'].map(e => read(e, api)));
  const idKey = entity === 'parties' ? 'partyId' : 'projectId';
  const nameKey = entity === 'parties' ? 'partyName' : 'projectName';
  const all = [...transactions, ...sales, ...purchases, ...inventory];
  return all.some(r => (r[idKey] && String(r[idKey]) === String(record.id)) || (r[nameKey] && String(r[nameKey]).trim().toLowerCase() === String(record.name).trim().toLowerCase()));
}
function columnLetter(n) { let out = ''; while (n) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); } return out; }
async function sheetId(entity, api) {
  const r = await api.sheets.spreadsheets.get({ spreadsheetId: api.id, fields: 'sheets(properties(sheetId,title))' });
  const sheet = r.data.sheets?.find(s => s.properties.title === entity);
  if (!sheet) throw new Error('Sheet not found');
  return sheet.properties.sheetId;
}
async function deleteRecord(entity, id, api) {
  const { row } = await locateRow(entity, id, api);
  if (entity === 'parties' || entity === 'projects') {
    const records = await read(entity, api);
    const record = records.find(r => String(r.id) === String(id));
    if (record && await masterReferences(entity, record, api)) throw new Error('This record is referenced by transactions, invoices, bills or inventory. It cannot be deleted.');
  }
  if (entity === 'accounts') {
    const txns = await read('transactions', api);
    if (txns.some(t => String(t.accountId) === String(id))) throw new Error('Account is used by transactions. Delete those test transactions first or keep the account.');
  }
  const sid = await sheetId(entity, api);
  await api.sheets.spreadsheets.batchUpdate({ spreadsheetId: api.id, requestBody: { requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }] } });
  return { ok: true };
}
async function updateTransaction(payload, api) {
  if (!payload?.id) throw new Error('Transaction ID required');
  if (!payload.date || !payload.accountId || !(Number(payload.amount) > 0)) throw new Error('Date, account and positive amount are required');
  const { row, header } = await locateRow('transactions', payload.id, api);
  const [accounts, projects, parties, oldRecords] = await Promise.all(['accounts','projects','parties','transactions'].map(k => read(k,api)));
  const account = accounts.find(a => String(a.id) === String(payload.accountId));
  if (!account) throw new Error('Select a live account');
  const old = oldRecords.find(t => String(t.id) === String(payload.id));
  const amount = Number(payload.amount);
  const debit = ['Expense','Payment','Purchase'].includes(payload.voucherType) ? amount : 0;
  const record = { ...old, ...payload, id: old.id, voucherNo: old.voucherNo, accountName: account.name,
    projectName: projects.find(p => String(p.id) === String(payload.projectId))?.name || '',
    partyName: parties.find(p => String(p.id) === String(payload.partyId))?.name || '',
    amount, debit, credit: debit ? 0 : amount, attachmentUrl: validateAttachmentUrl(payload.attachmentUrl) };
  await api.sheets.spreadsheets.values.update({ spreadsheetId: api.id, range: `'transactions'!A${row}:${columnLetter(header.length)}${row}`, valueInputOption: 'RAW', requestBody: { values: [header.map(k => record[k] ?? '')] } });
  return { ok: true, id: old.id };
}

// Reject cross-site browser uploads. This is not a substitute for app authentication.
function verifyUploadRequest(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const site = req.headers['sec-fetch-site'];
  if (!origin || !host || !['same-origin', 'none'].includes(site)) {
    const err = new Error('Upload must originate from the Retina website');
    err.status = 403;
    throw err;
  }
  let originUrl;
  try { originUrl = new URL(origin); } catch { /* rejected below */ }
  if (!originUrl || originUrl.protocol !== 'https:' || originUrl.host !== host) {
    const err = new Error('Cross-origin upload is not allowed');
    err.status = 403;
    throw err;
  }
}

async function uploadBase64(payload, req) {
  verifyUploadRequest(req);

  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID } = process.env;
  if (!GOOGLE_DRIVE_FOLDER_ID) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID in Vercel before uploading attachments');
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error('Google Drive OAuth environment variables are incomplete');
  }

  const fileName = String(payload?.fileName || '').trim();
  const mimeType = String(payload?.mimeType || '').trim().toLowerCase();
  const allowed = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
  if (!fileName || fileName.length > 150 || /[\\/\x00-\x1f]/.test(fileName)) throw new Error('Invalid file name');
  if (!allowed.has(mimeType)) throw new Error('Only PDF, JPG, PNG and WEBP attachments are allowed');

  const raw = String(payload?.base64 || '').replace(/^data:[^,]*;base64,/, '');
  if (!raw || raw.length > 6_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
    throw new Error('Invalid file data or file too large (maximum 4 MB)');
  }
  const bytes = Buffer.from(raw, 'base64');
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new Error('File must be 4 MB or smaller');
  const isPdf = mimeType === 'application/pdf' && bytes.subarray(0, 5).toString() === '%PDF-';
  const isJpeg = mimeType === 'image/jpeg' && bytes.subarray(0, 3).equals(Buffer.from([0xff,0xd8,0xff]));
  const isPng = mimeType === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp = mimeType === 'image/webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!(isPdf || isJpeg || isPng || isWebp)) throw new Error('File content does not match its type');

  const oauth = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth: oauth });
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [GOOGLE_DRIVE_FOLDER_ID] },
    media: { mimeType, body: Readable.from(bytes) },
    fields: 'id,webViewLink',
  });
  const id = created.data.id;
  if (!id) throw new Error('Google Drive did not return a file ID');
  // File remains private. Access is controlled by the Google Drive folder permissions.
  return { url: created.data.webViewLink || `https://drive.google.com/file/d/${id}/view` };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, args = [] } = req.body || {};
    // Do not initialize Google Sheets credentials when only uploading a file.
    if (name === 'apiUploadBase64') {
      const result = await uploadBase64(args[0], req);
      return res.status(200).json(result);
    }
    const api = client();
    let result;
    if (name === 'apiBootstrap') {
      result = { masters: Object.fromEntries(await Promise.all(MASTER_KEYS.map(async k => [k, await read(k, api)]))), orgName: 'Retina' };
    } else if (name === 'apiStagingAccounts') {
      result = await stagingAccounts(api);
    } else if (name === 'apiSaveStagedAccount') {
      result = await saveStagedAccount(args[0], api);
    } else if (name === 'apiDeleteStagedAccount') {
      result = await deleteStagedAccount(args[0], api);
    } else if (name === 'apiImportHistoricalTransactions') {
      result = await importHistoricalTransactions(args[0], api);
    } else if (name === 'apiImportBankRows') {
      result = await importBankRows(args[0], api);
    } else if (name === 'apiReconcileBankRow') {
      result = await reconcileBankRow(args[0], api);
    } else if (name === 'apiDashboard') {
      result = await dashboard(api);
    } else if (name === 'apiList') {
      result = await read(args[0], api);
    } else if (name === 'apiSaveMaster') {
      result = await saveMaster(args[0], args[1], api);
    } else if (name === 'apiSaveAccount') {
      result = await saveAccount(args[0], api);
    } else if (name === 'apiUpdateTransaction') {
      result = await updateTransaction(args[0], api);
    } else if (name === 'apiDeleteRecord') {
      result = await deleteRecord(args[0], args[1], api);
    } else if (name === 'apiSave' && args[0] === 'transactions') {
      result = await saveTransaction(args[1], api);
    } else if (name === 'apiReport') {
      const [sales, purchases] = await Promise.all(['salesInvoices','purchaseBills'].map(k => read(k, api)));
      if (args[0] === 'Receivables Aging') result = sales.filter(x => Number(x.outstanding) > 0);
      else if (args[0] === 'Payables Aging') result = purchases.filter(x => Number(x.outstanding) > 0);
      else if (args[0] === 'Inventory Valuation') result = await read('inventoryMovements', api);
      else result = { note: `${args[0]} report needs accounting logic before production use.` };
    } else {
      return res.status(400).json({ error: 'Unsupported operation' });
    }
    return res.status(200).json(result);
  } catch (e) {
    console.error('Retina API error:', e?.message || e);
    return res.status(e?.status || 500).json({ error: e?.status === 401 ? e.message : (e?.message || 'Server error') });
  }
}
