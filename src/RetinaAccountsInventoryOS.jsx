import BankReconciliation from './BankReconciliation.jsx';
import React, { useEffect, useMemo, useState } from "react";
import HistoricalImport from "./HistoricalImport.jsx";

/**
 * Retina Accounts + Inventory OS — STANDALONE DEMO
 *
 * The original app talks to a Google Apps Script backend via
 * window.google.script.run, backed by Google Sheets + Drive.
 * That backend doesn't exist in this environment, so this version
 * swaps `run()` for an in-memory mock API with seed data, so the
 * UI, navigation, forms, and reports all work exactly as designed.
 *
 * Everything else (layout, styles, components) is unchanged from
 * the uploaded RetinaAccountsInventory.jsx.
 */

const NAV = [
  ["dashboard", "Dashboard"],
  ["transactions", "Transactions"],
  ["sales", "Sales"],
  ["purchases", "Purchases"],
  ["inventory", "Inventory"],
  ["parties", "Parties"],
  ["projects", "Projects"],
  ["bank", "Bank & Cash"],
  ["reconciliation", "Reconciliation"],
  ["reports", "Reports"],
  ["masters", "Masters"],
  ["chart", "Chart of Accounts"],
];

const VOUCHER_TYPES = ["Expense", "Receipt", "Payment", "Contra", "Journal", "Purchase", "Sale"];
const PAYMENT_MODES = ["Cash", "Kotak", "IDFC", "FD", "UPI", "NEFT/RTGS/IMPS", "Cheque", "Other"];
const TAX_STATUS = ["GST", "Non-GST / Not Applicable", "Pending Review"];

const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));

const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-IN");
};

// ---------------------------------------------------------------------
// MOCK BACKEND (replaces google.script.run + Sheets/Drive for this demo)
// ---------------------------------------------------------------------

const seedMasters = {
  projects: [
    { id: "p1", name: "Retina Retail Fitout" },
    { id: "p2", name: "Warehouse Automation" },
    { id: "p3", name: "Brand Refresh" },
  ],
  parties: [
    { id: "party1", name: "Nova Textiles Pvt Ltd" },
    { id: "party2", name: "Kestrel Logistics" },
    { id: "party3", name: "Aarav & Sons" },
  ],
  accounts: [
    { id: "a1", name: "Sales Revenue" },
    { id: "a2", name: "Office Rent" },
    { id: "a3", name: "Raw Material Purchase" },
    { id: "a4", name: "Consultancy Fees" },
    { id: "a5", name: "Salaries & Wages" },
  ],
  bankAccounts: [
    { id: "b1", name: "Kotak - 4482" },
    { id: "b2", name: "IDFC - 1187" },
    { id: "b3", name: "Cash in Hand" },
  ],
  products: [
    { id: "sku1", name: "Steel Rack Unit" },
    { id: "sku2", name: "LED Panel 60W" },
  ],
};

let mockTxnSeq = 1006;
const mockDb = {
  transactions: [
    { id: "t1001", date: "2026-08-02", voucherType: "Expense", voucherNo: "V-1001", projectName: "Retina Retail Fitout", partyName: "Kestrel Logistics", accountName: "Office Rent", debit: 45000, credit: 0, paymentMode: "Kotak", narration: "August office rent" },
    { id: "t1002", date: "2026-08-05", voucherType: "Receipt", voucherNo: "V-1002", projectName: "Warehouse Automation", partyName: "Nova Textiles Pvt Ltd", accountName: "Sales Revenue", debit: 0, credit: 320000, paymentMode: "NEFT/RTGS/IMPS", narration: "Milestone 2 payment received" },
    { id: "t1003", date: "2026-08-09", voucherType: "Payment", voucherNo: "V-1003", projectName: "Brand Refresh", partyName: "Aarav & Sons", accountName: "Consultancy Fees", debit: 60000, credit: 0, paymentMode: "UPI", narration: "Design consultancy - phase 1" },
    { id: "t1004", date: "2026-08-14", voucherType: "Purchase", voucherNo: "V-1004", projectName: "Warehouse Automation", partyName: "Nova Textiles Pvt Ltd", accountName: "Raw Material Purchase", debit: 128000, credit: 0, paymentMode: "Cheque", narration: "Steel rack material batch" },
    { id: "t1005", date: "2026-08-18", voucherType: "Journal", voucherNo: "V-1005", projectName: "", partyName: "", accountName: "Salaries & Wages", debit: 210000, credit: 0, paymentMode: "Kotak", narration: "August payroll" },
  ],
  salesInvoices: [
    { id: "s1", date: "2026-08-06", invoiceNo: "INV-2201", projectName: "Warehouse Automation", partyName: "Nova Textiles Pvt Ltd", taxableAmount: 271186, gst: 48814, total: 320000, received: 320000, outstanding: 0 },
    { id: "s2", date: "2026-08-16", invoiceNo: "INV-2202", projectName: "Retina Retail Fitout", partyName: "Aarav & Sons", taxableAmount: 152542, gst: 27458, total: 180000, received: 90000, outstanding: 90000 },
  ],
  purchaseBills: [
    { id: "pb1", date: "2026-08-14", invoiceNo: "PB-771", partyName: "Nova Textiles Pvt Ltd", purchaseType: "Raw Material", taxableAmount: 108475, gst: 19525, total: 128000, paid: 128000, outstanding: 0 },
    { id: "pb2", date: "2026-08-19", invoiceNo: "PB-772", partyName: "Kestrel Logistics", purchaseType: "Freight", taxableAmount: 16949, gst: 3051, total: 20000, paid: 0, outstanding: 20000 },
  ],
  inventoryMovements: [
    { id: "im1", date: "2026-08-14", sku: "sku1", productName: "Steel Rack Unit", movementType: "IN", qtyIn: 200, qtyOut: 0, warehouse: "WH-Delhi", projectName: "Warehouse Automation", referenceNo: "PB-771" },
    { id: "im2", date: "2026-08-19", sku: "sku1", productName: "Steel Rack Unit", movementType: "OUT", qtyIn: 0, qtyOut: 60, warehouse: "WH-Delhi", projectName: "Retina Retail Fitout", referenceNo: "V-1004" },
    { id: "im3", date: "2026-08-20", sku: "sku2", productName: "LED Panel 60W", movementType: "IN", qtyIn: 500, qtyOut: 0, warehouse: "WH-Gurugram", projectName: "Retina Retail Fitout", referenceNo: "PB-773" },
  ],
  bankTransactions: [
    { id: "bt1", date: "2026-08-02", accountName: "Kotak - 4482", description: "Office rent - August", debit: 45000, credit: 0, balance: 812400, reference: "NEFT-8834", reconStatus: "Matched" },
    { id: "bt2", date: "2026-08-06", accountName: "Kotak - 4482", description: "Nova Textiles receipt", debit: 0, credit: 320000, balance: 1132400, reference: "NEFT-9021", reconStatus: "Matched" },
    { id: "bt3", date: "2026-08-19", accountName: "IDFC - 1187", description: "Kestrel Logistics freight", debit: 20000, credit: 0, balance: 244100, reference: "UPI-5567", reconStatus: "Unmatched" },
  ],
  parties: [
    { id: "party1", name: "Nova Textiles Pvt Ltd", type: "Supplier & Customer", city: "Ahmedabad", gstin: "24AACPN1234F1Z5" },
    { id: "party2", name: "Kestrel Logistics", type: "Vendor", city: "Delhi", gstin: "07AAKCK5678M1Z2" },
    { id: "party3", name: "Aarav & Sons", type: "Customer", city: "Jaipur", gstin: "08AAAAS1122K1Z9" },
  ],
  projects: [
    { id: "p1", name: "Retina Retail Fitout", status: "Active", budget: 900000, spent: 415000 },
    { id: "p2", name: "Warehouse Automation", status: "Active", budget: 1500000, spent: 640000 },
    { id: "p3", name: "Brand Refresh", status: "On Hold", budget: 220000, spent: 60000 },
  ],
  reconciliation: [
    { id: "r1", bankDate: "2026-08-19", bankDescription: "Kestrel Logistics freight", bankAmount: 20000, candidateVoucher: "V-1006 (draft)", candidateAmount: 20000, status: "Suggested" },
  ],
  accounts: [
    { id: "a1", name: "Sales Revenue", group: "Income" },
    { id: "a2", name: "Office Rent", group: "Indirect Expense" },
    { id: "a3", name: "Raw Material Purchase", group: "Direct Expense" },
    { id: "a4", name: "Consultancy Fees", group: "Indirect Expense" },
    { id: "a5", name: "Salaries & Wages", group: "Indirect Expense" },
  ],
};

function computeDashboard() {
  const t = mockDb.transactions;
  const monthSales = mockDb.salesInvoices.reduce((s, r) => s + r.total, 0);
  const monthPurchases = mockDb.purchaseBills.reduce((s, r) => s + r.total, 0);
  const monthExpenses = t.filter((r) => r.voucherType === "Expense" || r.voucherType === "Payment").reduce((s, r) => s + r.debit, 0);
  const receivables = mockDb.salesInvoices.reduce((s, r) => s + r.outstanding, 0);
  const payables = mockDb.purchaseBills.reduce((s, r) => s + r.outstanding, 0);
  const inventoryValue = 200 * 1400 + 500 * 650 - 60 * 1400; // rough seed valuation
  const grossProfit = monthSales - monthPurchases;
  const netProfit = grossProfit - monthExpenses;
  const reconMatched = mockDb.bankTransactions.filter((b) => b.reconStatus === "Matched").length;
  const reconUnmatched = mockDb.bankTransactions.filter((b) => b.reconStatus === "Unmatched").length;
  const reconSuggested = mockDb.reconciliation.length;

  return {
    cashBalance: 186000,
    kotakBalance: 1132400,
    idfcBalance: 244100,
    fdBalance: 500000,
    receivables,
    payables,
    inventoryValue,
    netProfit,
    monthSales,
    monthPurchases,
    monthExpenses,
    grossProfit,
    reconMatched,
    reconSuggested,
    reconUnmatched,
  };
}

function mockReport(name) {
  switch (name) {
    case "Trial Balance":
      return mockDb.accounts.map((a) => ({
        account: a.name,
        group: a.group,
        debit: a.group.includes("Expense") ? 100000 : 0,
        credit: a.group === "Income" ? 320000 : 0,
      }));
    case "Profit & Loss":
      return [
        { particulars: "Sales Revenue", amount: computeDashboard().monthSales },
        { particulars: "Cost of Purchases", amount: -computeDashboard().monthPurchases },
        { particulars: "Operating Expenses", amount: -computeDashboard().monthExpenses },
        { particulars: "Net Profit", amount: computeDashboard().netProfit },
      ];
    case "Receivables Aging":
      return mockDb.salesInvoices
        .filter((s) => s.outstanding > 0)
        .map((s) => ({ party: s.partyName, invoice: s.invoiceNo, outstanding: s.outstanding, daysOverdue: 12 }));
    case "Payables Aging":
      return mockDb.purchaseBills
        .filter((p) => p.outstanding > 0)
        .map((p) => ({ party: p.partyName, invoice: p.invoiceNo, outstanding: p.outstanding, daysOverdue: 5 }));
    case "Inventory Valuation":
      return mockDb.inventoryMovements.map((m) => ({ sku: m.sku, product: m.productName, warehouse: m.warehouse, qtyIn: m.qtyIn, qtyOut: m.qtyOut }));
    default:
      return { note: `"${name}" is a placeholder report in this demo — wire it up to apiReport() in production.` };
  }
}

function mockRun(name, ...args) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (name === "apiBootstrap") {
        resolve({ masters: seedMasters, orgName: "Retina" });
      } else if (name === "apiDashboard") {
        resolve(computeDashboard());
      } else if (name === "apiList") {
        const [entity] = args;
        resolve(mockDb[entity] ? [...mockDb[entity]] : []);
      } else if (name === "apiSave") {
        const [entity, payload] = args;
        if (entity === "transactions") {
          const acct = seedMasters.accounts.find((a) => a.id === payload.accountId);
          const proj = seedMasters.projects.find((p) => p.id === payload.projectId);
          const party = seedMasters.parties.find((p) => p.id === payload.partyId);
          const isDebitType = ["Expense", "Payment", "Purchase"].includes(payload.voucherType);
          const record = {
            id: "t" + ++mockTxnSeq,
            date: payload.date,
            voucherType: payload.voucherType,
            voucherNo: "V-" + mockTxnSeq,
            projectName: proj?.name || "",
            partyName: party?.name || "",
            accountName: acct?.name || "",
            debit: isDebitType ? Number(payload.amount || 0) : 0,
            credit: !isDebitType ? Number(payload.amount || 0) : 0,
            paymentMode: payload.paymentMode,
            narration: payload.narration,
          };
          mockDb.transactions = [record, ...mockDb.transactions];
        }
        resolve({ ok: true });
      } else if (name === "apiUploadBase64") {
        resolve({ url: "#mock-uploaded-file" });
      } else if (name === "apiReport") {
        const [reportName] = args;
        resolve(mockReport(reportName));
      } else {
        resolve(null);
      }
    }, 260); // small delay so loading states are visible
  });
}

const run = async (name, ...args) => {
  // Local demo mode is available without Google credentials; live mode uses Vercel API.
  if (import.meta.env.VITE_DEMO_MODE === "true") return mockRun(name, ...args);
  const response = await fetch("/api/retina", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Backend request failed");
  return result;
};

// ---------------------------------------------------------------------

const DIVISIONS = ["Design", "Product"];

const initialTxn = {
  date: new Date().toISOString().slice(0, 10),
  voucherType: "Expense",
  division: "Design",
  projectId: "",
  partyId: "",
  accountId: "",
  amount: "",
  paymentMode: "Cash",
  bankCashAccountId: "",
  narration: "",
  taxStatus: "GST",
  gstRate: 18,
  invoiceNo: "",
  attachmentUrl: "",
};

export default function RetinaAccountsInventoryOS() {
  const [view, setView] = useState("dashboard");
  const [showHistoricalImport, setShowHistoricalImport] = useState(false);
  const [boot, setBoot] = useState(null);
  const [rows, setRows] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ projectId: "", division: "", from: "", to: "" });
  const [transactionFilters, setTransactionFilters] = useState({ account: "", party: "", mode: "", type: "" });
  const [txn, setTxn] = useState(initialTxn);
  const [modal, setModal] = useState(null);
  const [stagingRows, setStagingRows] = useState([]);
  const [stageForm, setStageForm] = useState({ division: '', type: '', head: '', subHead: '', newAccountId: '', accountGroup: '', migrationStatus: 'Pending Review' });
  const [stageQuery, setStageQuery] = useState('');
  const [accountForm, setAccountForm] = useState({ id: "", name: "", group: "" });

  const masters = boot?.masters || {};
  const projects = masters.projects || [];
  const parties = masters.parties || [];
  const accounts = masters.accounts || [];
  const bankAccounts = masters.bankAccounts || [];
  const products = masters.products || [];

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const b = await run("apiBootstrap");
        setBoot(b);
        const d = await run("apiDashboard", filters);
        setDashboard(d);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!boot) return;
    loadView();
  }, [view]);

  async function loadView() {
    setErr("");
    try {
      setLoading(true);
      if (view === "dashboard") {
        setDashboard(await run("apiDashboard", filters));
        return;
      }
      const map = {
        transactions: "transactions",
        sales: "salesInvoices",
        purchases: "purchaseBills",
        inventory: "inventoryMovements",
        parties: "parties",
        projects: "projects",
        bank: "bankTransactions",
        reconciliation: "reconciliation",
        masters: "accounts",
        chart: "accounts",
      };
      if (view === "reports") return;
      if (view === "masters" || view === "chart") {
        const [live, staging] = await Promise.all([run("apiList", "accounts"), run("apiStagingAccounts")]);
        setRows(live);
        setStagingRows(staging);
        return;
      }
      setRows(await run("apiList", map[view], filters));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const transactionOptions = useMemo(() => {
    const distinct = (key) => [...new Set(rows.filter(r => !filters.division || r.division === filters.division).map(r => String(r[key] || "").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    return { account: distinct("accountName"), party: distinct("partyName"), mode: distinct("paymentMode"), type: distinct("voucherType") };
  }, [rows, filters.division]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.division && Object.prototype.hasOwnProperty.call(r, "division") && r.division !== filters.division) return false;
      if (view === "transactions") {
        if (filters.projectId && String(r.projectId || "") !== String(filters.projectId)) return false;
        if (transactionFilters.account && String(r.accountName || "") !== transactionFilters.account) return false;
        if (transactionFilters.party && String(r.partyName || "") !== transactionFilters.party) return false;
        if (transactionFilters.mode && String(r.paymentMode || "") !== transactionFilters.mode) return false;
        if (transactionFilters.type && String(r.voucherType || "") !== transactionFilters.type) return false;
      }
      return !q || JSON.stringify(r).toLowerCase().includes(q);
    });
  }, [rows, query, filters.division, filters.projectId, transactionFilters, view]);

  async function refreshDashboard() {
    setLoading(true);
    try {
      setDashboard(await run("apiDashboard", filters));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveTransaction(e) {
    e.preventDefault();
    setErr("");
    try {
      setLoading(true);
      await run(txn.id ? "apiUpdateTransaction" : "apiSave", ...(txn.id ? [] : ["transactions"]), {
        ...txn,
        amount: Number(txn.amount || 0),
        gstRate: Number(txn.gstRate || 0),
      });
      setTxn(initialTxn);
      setModal(null);
      await refreshDashboard();
      if (view === "transactions") await loadView();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAccount(e) {
    e.preventDefault();
    try {
      setLoading(true); setErr("");
      await run("apiSaveAccount", accountForm);
      setModal(null); setAccountForm({ id: "", name: "", group: "" });
      const live = await run("apiList", "accounts");
      setBoot(b => ({ ...b, masters: { ...b.masters, accounts: live } }));
      setRows(live);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  async function saveStage(e) {
    e.preventDefault();
    try {
      setLoading(true); setErr('');
      await run('apiSaveStagedAccount', stageForm);
      setStagingRows(await run('apiStagingAccounts'));
      setModal(null);
    } catch (e) { setErr(e.message); window.alert(e.message); } finally { setLoading(false); }
  }
  async function deleteStage(row) {
    if (!window.confirm(`Delete staged account ${row.newAccountId} — ${row.head}? This clears its Google Sheets row and cannot be undone.`)) return;
    try {
      setLoading(true); setErr('');
      await run('apiDeleteStagedAccount', row.newAccountId);
      setStagingRows(await run('apiStagingAccounts'));
    } catch (e) { setErr(e.message); window.alert(e.message); } finally { setLoading(false); }
  }
  async function deleteRow(entity, row) {
    if (!window.confirm(`Permanently delete ${entity === "accounts" ? row.name : (row.voucherNo || row.id)}? This cannot be undone.`)) return;
    try {
      setLoading(true); setErr("");
      await run("apiDeleteRecord", entity, row.id);
      const live = await run("apiList", entity);
      setRows(live);
      if (entity === "accounts") setBoot(b => ({ ...b, masters: { ...b.masters, accounts: live } }));
      if (entity === "transactions") setDashboard(await run("apiDashboard", filters));
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  async function uploadAttachment(file) {
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await run("apiUploadBase64", {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64,
        folderKey: "ACCOUNT_ATTACHMENTS",
      });
      setTxn((x) => ({ ...x, attachmentUrl: result.url }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateReport(name) {
    setLoading(true);
    try {
      const data = await run("apiReport", name, filters);
      setModal({ type: "report", title: name, data });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.brandMark}>R</div>
          <div>
            <div style={S.brandTitle}>RETINA</div>
            <div style={S.brandSub}>Accounts + Inventory OS</div>
          </div>
        </div>

        <nav style={S.nav}>
          {NAV.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{ ...S.navBtn, ...(view === id ? S.navBtnActive : {}) }}
            >
              {label}
            </button>
          ))}
        </nav>

        <button style={S.primaryBtn} onClick={() => { setTxn(initialTxn); setModal({ type: "transaction" }); }}>
          + New Transaction
        </button>
      </aside>

      <main style={S.main}>
        <header style={S.header}>
          <div>
            <h1 style={S.h1}>{NAV.find((x) => x[0] === view)?.[1] || "Retina OS"}</h1>
            <div style={S.muted}>{import.meta.env.VITE_DEMO_MODE === "true" ? "Demo mode · data resets on reload" : "Live mode · Google Sheets backend"}</div>
          </div>
          <div style={S.headerActions}>
            <select aria-label="Division filter" value={filters.division} onChange={(e) => setFilters({ ...filters, division: e.target.value })} style={S.input}>
              <option value="">All Divisions</option>
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })} style={S.input}>
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.projectName || p.id}</option>)}
            </select>
            <button style={S.secondaryBtn} onClick={view === "dashboard" ? refreshDashboard : loadView}>Refresh</button>
          </div>
        </header>

        {err && <div style={S.error}>{err}</div>}
        {loading && <div style={S.loading}>Loading…</div>}

        {!loading && view === "dashboard" && <Dashboard data={dashboard} onReport={generateReport} />}
        {view === "transactions" && <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,marginBottom:14,padding:"12px 14px",background:"#fff",border:"1px solid #e1e5e2",borderRadius:10}}>
          {[["account","All Accounts","Account"],["party","All Parties","Party"],["mode","All Modes","Mode"],["type","All Types","Type"]].map(([key,placeholder,label]) => (
            <label key={key} style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,minWidth:160,flex:"1 1 160px"}}>{label}
              <select aria-label={`${label} filter`} value={transactionFilters[key]} onChange={e=>setTransactionFilters(f=>({...f,[key]:e.target.value}))} style={S.input}>
                <option value="">{placeholder}</option>
                {transactionOptions[key].map(value=><option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          ))}
          <button type="button" style={S.secondaryBtn} onClick={()=>{setTransactionFilters({account:"",party:"",mode:"",type:""});setFilters(f=>({...f,division:"",projectId:""}));setQuery("");}}>Clear Filters</button>
          <span style={{fontSize:12,color:"#647067"}}>{filteredRows.length} transaction(s)</span>
        </div>}
        {view === "transactions" && <div style={{marginBottom:12}}><button style={S.secondaryBtn} onClick={()=>setShowHistoricalImport(v=>!v)}>{showHistoricalImport ? "Close historical import" : "Import Old Transactions (CSV)"}</button></div>}
        {view === "transactions" && showHistoricalImport && <HistoricalImport accounts={accounts} divisions={DIVISIONS} onImported={()=>{setShowHistoricalImport(false);loadView();}} />}
        {!loading && view === "transactions" && <Transactions rows={filteredRows} query={query} setQuery={setQuery} onEdit={r => { setTxn({ ...initialTxn, ...r, amount: r.amount || Number(r.debit || r.credit || 0) }); setModal({ type: "transaction" }); }} onDelete={r => deleteRow("transactions", r)} />}
        {!loading && view === "sales" && <Sales rows={filteredRows} query={query} setQuery={setQuery} />}
        {!loading && view === "purchases" && <Purchases rows={filteredRows} query={query} setQuery={setQuery} />}
        {!loading && view === "inventory" && <Inventory rows={filteredRows} query={query} setQuery={setQuery} products={products} />}
        {!loading && view === "parties" && <GenericTable title="Parties" rows={filteredRows} query={query} setQuery={setQuery} />}
        {!loading && view === "projects" && <GenericTable title="Projects" rows={filteredRows} query={query} setQuery={setQuery} />}
        {!loading && view === "bank" && <Bank rows={filteredRows} query={query} setQuery={setQuery} />}
        {!loading && view === "reconciliation" && <BankReconciliation />}
        {!loading && view === "reports" && <Reports onRun={generateReport} />}
        {!loading && (view === "masters" || view === "chart") && <>
          <p style={{ marginBottom: 12 }}>Live approved accounts (existing IDs retained). New transactions use only these accounts.</p>
          <div style={{ marginBottom: 12 }}><button style={S.primaryBtn} onClick={() => { setAccountForm({ id: "", name: "", group: "" }); setModal({ type: "account" }); }}>+ Add Account</button></div>
          <TablePage title="Live Chart of Accounts" rows={filteredRows} query={query} setQuery={setQuery} columns={[["id","ID"],["name","Account Name"],["group","Group"]]} onEdit={r => { setAccountForm({ id: r.id, name: r.name, group: r.group }); setModal({ type: "account" }); }} onDelete={r => deleteRow("accounts", r)} />
          <h3 style={{ marginTop: 28 }}>Staged Chart of Accounts — Manage Accounts</h3>
          <p>Add, edit or delete staged accounts here. Saving immediately updates the <strong>accounts_staging</strong> Google Sheet. Staged accounts are not automatically available for transaction posting.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <button style={S.primaryBtn} onClick={() => { setStageForm({ division: '', type: '', head: '', subHead: '', newAccountId: '', accountGroup: '', migrationStatus: 'Pending Review' }); setModal({ type: 'stagedAccount' }); }}>+ Add Staged Account</button>
            <input aria-label="Search staged accounts" placeholder="Search staged accounts" value={stageQuery} onChange={e => setStageQuery(e.target.value)} style={{ ...S.input, maxWidth: 280 }} />
          </div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Division', 'Type', 'Head', 'Sub Head', 'New ID', 'Group', 'Status', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>{h}</th>)}</tr></thead>
            <tbody>{stagingRows.filter(a => !stageQuery || JSON.stringify(a).toLowerCase().includes(stageQuery.toLowerCase())).map((a, i) => <tr key={a.newAccountId || i}>
              {[a.division,a.type,a.head,a.subHead,a.newAccountId,a.accountGroup,a.migrationStatus].map((v,j) => <td key={j} style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{v || '—'}</td>)}
              <td style={{ padding: 8, whiteSpace: 'nowrap', borderBottom: '1px solid #ddd' }}><button style={S.secondaryBtn} onClick={() => { setStageForm({ ...a }); setModal({ type: 'stagedAccount' }); }}>Edit</button> <button style={S.secondaryBtn} onClick={() => deleteStage(a)}>Delete</button></td>
            </tr>)}</tbody>
          </table></div>
          {!stagingRows.length && <p>No staged accounts found. Check the accounts_staging sheet.</p>}
        </>}
      </main>

      {modal?.type === "account" && (
        <Modal title={accountForm.id ? "Edit Account" : "Add Account"} onClose={() => setModal(null)}>
          <form onSubmit={saveAccount} style={S.formGrid}>
            {accountForm.id && <Field label="Account ID"><input value={accountForm.id} readOnly style={S.input} /></Field>}
            <Field label="Account Name"><input required value={accountForm.name} onChange={e => setAccountForm(x => ({ ...x, name: e.target.value }))} style={S.input} /></Field>
            <Field label="Account Group"><input required value={accountForm.group} onChange={e => setAccountForm(x => ({ ...x, group: e.target.value }))} style={S.input} placeholder="e.g. Current Asset" /></Field>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}><button type="button" style={S.secondaryBtn} onClick={() => setModal(null)}>Cancel</button><button type="submit" style={S.primaryBtn}>Save Account</button></div>
          </form>
        </Modal>
      )}
      {modal?.type === 'stagedAccount' && (
        <Modal title={stageForm.newAccountId ? 'Edit Staged Account' : 'Add Staged Account'} onClose={() => setModal(null)}>
          <form onSubmit={saveStage} style={S.formGrid}>
            {stageForm.newAccountId && <Field label="Account ID"><input readOnly value={stageForm.newAccountId} style={S.input} /></Field>}
            {[["division", "Division"], ["type", "Type"], ["head", "Head"], ["subHead", "Sub Head"], ["accountGroup", "Account Group"]].map(([key, label]) => <Field key={key} label={label}><input required={key === 'head'} value={stageForm[key] || ''} onChange={e => setStageForm(v => ({ ...v, [key]: e.target.value }))} style={S.input} /></Field>)}
            <Field label="Review Status"><select value={stageForm.migrationStatus || 'Pending Review'} onChange={e => setStageForm(v => ({ ...v, migrationStatus: e.target.value }))} style={S.input}><option>Pending Review</option><option>Approved</option><option>Rejected</option></select></Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button type="button" style={S.secondaryBtn} onClick={() => setModal(null)}>Cancel</button><button type="submit" style={S.primaryBtn}>Save to Google Sheets</button></div>
          </form>
        </Modal>
      )}
      {modal?.type === "transaction" && (
        <Modal title={txn.id ? "Edit Transaction" : "New Transaction"} onClose={() => setModal(null)}>
          <form onSubmit={saveTransaction} style={S.formGrid}>
            <Field label="Date"><input type="date" value={txn.date} onChange={(e) => setTxn({ ...txn, date: e.target.value })} style={S.input} required /></Field>
            <Field label="Voucher Type"><select value={txn.voucherType} onChange={(e) => setTxn({ ...txn, voucherType: e.target.value })} style={S.input}>{VOUCHER_TYPES.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Division"><select value={txn.division} onChange={(e) => setTxn({ ...txn, division: e.target.value })} style={S.input}>{DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></Field>
            <Field label="Project"><select value={txn.projectId} onChange={(e) => setTxn({ ...txn, projectId: e.target.value })} style={S.input}><option value="">No Project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name || p.projectName || p.id}</option>)}</select></Field>
            <Field label="Party"><select value={txn.partyId} onChange={(e) => setTxn({ ...txn, partyId: e.target.value })} style={S.input}><option value="">No Party</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name || p.partyName || p.id}</option>)}</select></Field>
            <Field label="Account / Head"><select value={txn.accountId} onChange={(e) => setTxn({ ...txn, accountId: e.target.value })} style={S.input} required><option value="">Select account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name || a.accountName || a.id}</option>)}</select><button type="button" style={{ ...S.secondaryBtn, marginTop: 8 }} onClick={() => { setModal(null); setView('chart'); }}>Manage Chart of Accounts →</button><div style={S.muted}>Only live accounts are available for posting. Staged accounts must be migrated after review.</div></Field>
            <Field label="Amount"><input type="number" min="0" step="0.01" value={txn.amount} onChange={(e) => setTxn({ ...txn, amount: e.target.value })} style={S.input} required /></Field>
            <Field label="Payment Mode"><select value={txn.paymentMode} onChange={(e) => setTxn({ ...txn, paymentMode: e.target.value })} style={S.input}>{PAYMENT_MODES.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Paid From / Received In"><select value={txn.bankCashAccountId} onChange={(e) => setTxn({ ...txn, bankCashAccountId: e.target.value })} style={S.input}><option value="">Select</option>{bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name || a.accountName || a.id}</option>)}</select></Field>
            <Field label="Tax Status"><select value={txn.taxStatus} onChange={(e) => setTxn({ ...txn, taxStatus: e.target.value })} style={S.input}>{TAX_STATUS.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="GST Rate %"><input type="number" value={txn.gstRate} onChange={(e) => setTxn({ ...txn, gstRate: e.target.value })} style={S.input} /></Field>
            <Field label="Invoice / Ref No."><input value={txn.invoiceNo} onChange={(e) => setTxn({ ...txn, invoiceNo: e.target.value })} style={S.input} /></Field>
            <Field label="Narration" wide><textarea value={txn.narration} onChange={(e) => setTxn({ ...txn, narration: e.target.value })} style={{ ...S.input, minHeight: 90 }} /></Field>
            <Field label="Google Drive attachment (one file per transaction)" wide>
              <input type="url" placeholder="Paste existing Google Drive file URL (https://drive.google.com/...)" value={txn.attachmentUrl || ""}
                onChange={(e) => setTxn(x => ({...x, attachmentUrl: e.target.value}))} style={{...S.input, width:"100%"}} />
              <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginTop:8}}>
                <label>Or upload a new file: <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => uploadAttachment(e.target.files?.[0])} /></label>
                {txn.attachmentUrl && <a href={txn.attachmentUrl} target="_blank" rel="noopener noreferrer">View attachment</a>}
                {txn.attachmentUrl && <button type="button" style={S.secondaryBtn} onClick={() => setTxn(x => ({...x, attachmentUrl:""}))}>Remove link</button>}
              </div>
              <div style={S.muted}>Saving the transaction saves this link to Google Sheets. Removing the link does not delete the Drive file.</div>
            </Field>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" style={S.secondaryBtn} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" style={S.primaryBtn}>{txn.id ? "Update Transaction" : "Save Transaction"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.type === "report" && (
        <Modal title={modal.title} onClose={() => setModal(null)} wide>
          <ReportViewer data={modal.data} />
        </Modal>
      )}
    </div>
  );
}

function Dashboard({ data, onReport }) {
  const d = data || {};
  const cards = [
    ["Cash in Hand", d.cashBalance],
    ["Kotak", d.kotakBalance],
    ["IDFC", d.idfcBalance],
    ["FD / Deposits", d.fdBalance],
    ["Receivables", d.receivables],
    ["Payables", d.payables],
    ["Inventory", d.inventoryValue],
    ["Net Profit", d.netProfit],
  ];
  return (
    <>
      <section style={S.cardGrid}>
        {cards.map(([label, value]) => (
          <div key={label} style={S.card}>
            <div style={S.cardLabel}>{label}</div>
            <div style={S.cardValue}>{money(value)}</div>
          </div>
        ))}
      </section>

      <section style={S.twoCol}>
        <div style={S.panel}>
          <h3 style={S.h3}>This Month</h3>
          <Metric label="Sales" value={d.monthSales} />
          <Metric label="Purchases" value={d.monthPurchases} />
          <Metric label="Expenses" value={d.monthExpenses} />
          <Metric label="Gross Profit" value={d.grossProfit} />
        </div>
        <div style={S.panel}>
          <h3 style={S.h3}>Bank Reconciliation</h3>
          <Metric label="Matched" value={d.reconMatched || 0} plain />
          <Metric label="Suggested" value={d.reconSuggested || 0} plain />
          <Metric label="Unmatched" value={d.reconUnmatched || 0} plain />
        </div>
      </section>

      <section style={S.panel}>
        <div style={S.panelHeader}>
          <h3 style={S.h3}>Quick Reports</h3>
        </div>
        <div style={S.actionGrid}>
          {["Trial Balance", "Profit & Loss", "Balance Sheet", "Project Profitability", "Receivables Aging", "Payables Aging", "GST Summary", "Inventory Valuation"].map((x) => (
            <button key={x} style={S.tileBtn} onClick={() => onReport(x)}>{x}</button>
          ))}
        </div>
      </section>
    </>
  );
}

function Transactions({ rows, query, setQuery, onEdit, onDelete }) {
  return <TablePage title="Journal / Transactions" rows={rows} query={query} setQuery={setQuery} onEdit={onEdit} onDelete={onDelete}
    columns={[
      ["date","Date"],["division","Division"],["voucherType","Type"],["voucherNo","Voucher"],["projectName","Project"],["partyName","Party"],
      ["accountName","Account"],["debit","Debit"],["credit","Credit"],["paymentMode","Mode"],["narration","Narration"],["attachmentUrl","Attachment"]
    ]} />;
}

function Sales({ rows, query, setQuery }) {
  return <TablePage title="Sales Invoices" rows={rows} query={query} setQuery={setQuery}
    columns={[["date","Date"],["invoiceNo","Invoice"],["projectName","Project"],["partyName","Customer"],["taxableAmount","Taxable"],["gst","GST"],["total","Total"],["received","Received"],["outstanding","Outstanding"]]} />;
}

function Purchases({ rows, query, setQuery }) {
  return <TablePage title="Purchase Bills" rows={rows} query={query} setQuery={setQuery}
    columns={[["date","Date"],["invoiceNo","Invoice"],["partyName","Supplier"],["purchaseType","Type"],["taxableAmount","Taxable"],["gst","GST"],["total","Total"],["paid","Paid"],["outstanding","Outstanding"]]} />;
}

function Inventory({ rows, query, setQuery }) {
  return <TablePage title="Inventory Movements" rows={rows} query={query} setQuery={setQuery}
    columns={[["date","Date"],["sku","SKU"],["productName","Product"],["movementType","Movement"],["qtyIn","Qty In"],["qtyOut","Qty Out"],["warehouse","Location"],["projectName","Project"],["referenceNo","Reference"]]} />;
}

function Bank({ rows, query, setQuery }) {
  return <TablePage title="Bank & Cash Transactions" rows={rows} query={query} setQuery={setQuery}
    columns={[["date","Date"],["accountName","Account"],["description","Description"],["debit","Debit"],["credit","Credit"],["balance","Balance"],["reference","Reference"],["reconStatus","Status"]]} />;
}

function Reconciliation({ rows }) {
  return (
    <div style={S.panel}>
      <h3 style={S.h3}>Reconciliation Queue</h3>
      <DataTable rows={rows} columns={[["bankDate","Bank Date"],["bankDescription","Bank Description"],["bankAmount","Bank Amount"],["candidateVoucher","Suggested Voucher"],["candidateAmount","Voucher Amount"],["status","Status"]]} />
    </div>
  );
}

function Reports({ onRun }) {
  const reports = ["Trial Balance","Profit & Loss","Balance Sheet","Cash Flow","Project Profitability","Party Ledger","Bank Book","Cash Book","Receivables Aging","Payables Aging","GST Summary","Inventory Valuation","Stock Movement"];
  return <div style={S.actionGrid}>{reports.map(r => <button key={r} style={S.tileBtn} onClick={() => onRun(r)}>{r}</button>)}</div>;
}

function GenericTable({ title, rows, query, setQuery }) {
  const keys = rows?.[0] ? Object.keys(rows[0]).slice(0, 10).map(k => [k, k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())]) : [];
  return <TablePage title={title} rows={rows} query={query} setQuery={setQuery} columns={keys} />;
}

function TablePage({ title, rows, query, setQuery, columns, onEdit, onDelete }) {
  return (
    <div style={S.panel}>
      <div style={S.panelHeader}>
        <h3 style={S.h3}>{title}</h3>
        <input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} style={S.input} />
      </div>
      <DataTable rows={rows} columns={columns} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function DataTable({ rows = [], columns = [], onEdit, onDelete }) {
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{columns.map(([k,l]) => <th style={S.th} key={k}>{l}</th>)}{(onEdit || onDelete) && <th style={S.th}>Actions</th>}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={r.id || i}>{columns.map(([k]) => <td style={S.td} key={k}>{k === "attachmentUrl" ? (r[k] ? <a href={r[k]} target="_blank" rel="noopener noreferrer">View attachment</a> : "—") : formatCell(k, r[k])}</td>)}{(onEdit || onDelete) && <td style={S.td}>{onEdit && <button style={S.secondaryBtn} onClick={() => onEdit(r)}>Edit</button>} {onDelete && <button style={S.secondaryBtn} onClick={() => onDelete(r)}>Delete</button>}</td>}</tr>)}
          {!rows.length && <tr><td style={S.td} colSpan={Math.max(1, columns.length)}>No records</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(key, v) {
  if (v == null) return "";
  if (/date/i.test(key)) return fmtDate(v);
  if (/amount|debit|credit|total|balance|gst|sales|purchase|expense|profit|received|outstanding|value/i.test(key) && !Number.isNaN(Number(v))) return money(v);
  return String(v);
}

function ReportViewer({ data }) {
  if (!data) return <div>No data</div>;
  if (Array.isArray(data)) return <GenericReportTable rows={data} />;
  if (Array.isArray(data.rows)) return <GenericReportTable rows={data.rows} />;
  return <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>;
}

function GenericReportTable({ rows }) {
  const cols = rows?.[0] ? Object.keys(rows[0]).map(k => [k,k]) : [];
  return <DataTable rows={rows} columns={cols} />;
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div style={S.overlay} onMouseDown={onClose}>
      <div style={{ ...S.modal, maxWidth: wide ? 1200 : 860 }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}><h3 style={S.h3}>{title}</h3><button style={S.iconBtn} onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, wide }) {
  return <label style={{ ...S.field, ...(wide ? { gridColumn: "1 / -1" } : {}) }}><span style={S.label}>{label}</span>{children}</label>;
}

function Metric({ label, value, plain }) {
  return <div style={S.metric}><span>{label}</span><strong>{plain ? Number(value || 0).toLocaleString("en-IN") : money(value)}</strong></div>;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const S = {
  app: { minHeight:"100vh", display:"flex", background:"#f4f4f1", color:"#1f211f", fontFamily:"Inter, Arial, sans-serif" },
  sidebar: { width:250, background:"#171a18", color:"#fff", padding:20, position:"sticky", top:0, height:"100vh", boxSizing:"border-box" },
  brand: { display:"flex", alignItems:"center", gap:12, marginBottom:26 },
  brandMark: { width:38, height:38, borderRadius:10, background:"#fff", color:"#171a18", display:"grid", placeItems:"center", fontWeight:800 },
  brandTitle: { fontWeight:800, letterSpacing:".12em" }, brandSub:{ fontSize:11, opacity:.65, marginTop:3 },
  nav:{ display:"grid", gap:6, marginBottom:20 }, navBtn:{ border:0, background:"transparent", color:"#d8ddd9", padding:"10px 12px", borderRadius:8, textAlign:"left", cursor:"pointer" },
  navBtnActive:{ background:"#2a302c", color:"#fff" },
  main:{ flex:1, padding:"24px 28px 50px", minWidth:0 },
  header:{ display:"flex", justifyContent:"space-between", gap:20, alignItems:"center", marginBottom:22 },
  headerActions:{ display:"flex", gap:10, alignItems:"center" },
  h1:{ margin:0, fontSize:26 }, h3:{ margin:"0 0 14px", fontSize:16 }, muted:{ color:"#747a76", fontSize:12 },
  error:{ background:"#ffe5e5", border:"1px solid #efb5b5", padding:12, borderRadius:8, marginBottom:16 },
  loading:{ padding:30, textAlign:"center", color:"#6d736f" },
  cardGrid:{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:14, marginBottom:14 },
  card:{ background:"#fff", border:"1px solid #e1e3df", borderRadius:12, padding:16 },
  cardLabel:{ color:"#6f756f", fontSize:12 }, cardValue:{ fontSize:22, fontWeight:750, marginTop:8 },
  twoCol:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 },
  panel:{ background:"#fff", border:"1px solid #e1e3df", borderRadius:12, padding:16, marginBottom:14 },
  panelHeader:{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:12 },
  metric:{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #eef0ec" },
  actionGrid:{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12 },
  tileBtn:{ background:"#fff", border:"1px solid #dfe2dd", borderRadius:10, padding:"16px 12px", cursor:"pointer", textAlign:"left", fontWeight:650 },
  primaryBtn:{ background:"#1f6b45", color:"#fff", border:0, padding:"10px 14px", borderRadius:8, cursor:"pointer", fontWeight:700 },
  secondaryBtn:{ background:"#fff", color:"#222", border:"1px solid #d7dad5", padding:"9px 12px", borderRadius:8, cursor:"pointer" },
  input:{ width:"100%", boxSizing:"border-box", border:"1px solid #d7dad5", borderRadius:7, padding:"9px 10px", background:"#fff" },
  tableWrap:{ overflow:"auto", maxHeight:"68vh" }, table:{ borderCollapse:"collapse", width:"100%", fontSize:12 },
  th:{ position:"sticky", top:0, background:"#f3f5f1", borderBottom:"1px solid #dfe2dd", padding:"9px 10px", textAlign:"left", whiteSpace:"nowrap" },
  td:{ borderBottom:"1px solid #edf0ec", padding:"9px 10px", verticalAlign:"top", whiteSpace:"nowrap" },
  overlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"grid", placeItems:"center", padding:20, zIndex:99 },
  modal:{ width:"100%", background:"#fff", borderRadius:14, padding:18, maxHeight:"90vh", overflow:"auto" },
  modalHeader:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  iconBtn:{ border:0, background:"transparent", fontSize:18, cursor:"pointer" },
  formGrid:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  field:{ display:"grid", gap:6 }, label:{ fontSize:12, color:"#505650", fontWeight:650 },
};
