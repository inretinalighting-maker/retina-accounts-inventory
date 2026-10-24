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
  };
  await api.sheets.spreadsheets.values.append({
    spreadsheetId: api.id, range: sheetRange('transactions'),
    valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [fields.transactions.map(k => record[k] ?? '')] },
  });
  return { ok: true, id };
}

// Mutations locate records by immutable ID, never by row number supplied by the browser.
async function locateRow(entity, id, api) {
  if (!['accounts', 'transactions'].includes(entity)) throw new Error('Unsupported entity');
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
function columnLetter(n) { let out = ''; while (n) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); } return out; }
async function sheetId(entity, api) {
  const r = await api.sheets.spreadsheets.get({ spreadsheetId: api.id, fields: 'sheets(properties(sheetId,title))' });
  const sheet = r.data.sheets?.find(s => s.properties.title === entity);
  if (!sheet) throw new Error('Sheet not found');
  return sheet.properties.sheetId;
}
async function deleteRecord(entity, id, api) {
  const { row } = await locateRow(entity, id, api);
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
    amount, debit, credit: debit ? 0 : amount };
  await api.sheets.spreadsheets.values.update({ spreadsheetId: api.id, range: `'transactions'!A${row}:${columnLetter(header.length)}${row}`, valueInputOption: 'RAW', requestBody: { values: [header.map(k => record[k] ?? '')] } });
  return { ok: true, id: old.id };
}

function validUploadPassword(provided) {
  const expected = process.env.RETINA_UPLOAD_PASSWORD;
  if (!expected || typeof provided !== 'string') return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

async function uploadBase64(payload) {
  if (!validUploadPassword(payload?.uploadPassword)) {
    const err = new Error('Invalid or missing upload password');
    err.status = 401;
    throw err;
  }

  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID } = process.env;
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
    requestBody: { name: fileName, ...(GOOGLE_DRIVE_FOLDER_ID ? { parents: [GOOGLE_DRIVE_FOLDER_ID] } : {}) },
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
      const result = await uploadBase64(args[0]);
      return res.status(200).json(result);
    }
    const api = client();
    let result;
    if (name === 'apiBootstrap') {
      result = { masters: Object.fromEntries(await Promise.all(MASTER_KEYS.map(async k => [k, await read(k, api)]))), orgName: 'Retina' };
    } else if (name === 'apiStagingAccounts') {
      result = await stagingAccounts(api);
    } else if (name === 'apiDashboard') {
      result = await dashboard(api);
    } else if (name === 'apiList') {
      result = await read(args[0], api);
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
