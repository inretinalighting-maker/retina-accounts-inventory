Google Drive OAuth deployment update
Google Drive OAuth integration setup
# Retina Accounts + Inventory OS — Vercel + Google Sheets starter

## 1. Create Google Sheet
Create a spreadsheet and create tabs **exactly** named:
`transactions`, `salesInvoices`, `purchaseBills`, `inventoryMovements`, `bankTransactions`, `parties`, `projects`, `reconciliation`, `accounts`, `bankAccounts`, `products`.

Put the column headers for each tab in row 1. They are listed in `api/retina.js` in the `fields` object. The `transactions` tab MUST use the `transactions` header list in exactly the order shown because new records append in that order. Other tabs may order headers differently.

Add some accounts, parties, and projects (each with a unique `id` and `name`) so the transaction form can load dropdowns.

## 2. Configure Google Cloud
Enable Google Sheets API in a Google Cloud project. Create a service account and JSON key. Share the spreadsheet with the service account email as **Editor**. Never commit the JSON key to GitHub.

## 3. Deploy
Push this folder to a private GitHub repository. Import that repository at https://vercel.com/new (Framework: Vite). Set these Vercel environment variables:
- `GOOGLE_SHEET_ID` — from spreadsheet URL
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — from service account JSON (`client_email`)
- `GOOGLE_PRIVATE_KEY` — from service account JSON (`private_key`), preserving line breaks or using `\\n`

Deploy. Vercel serves the React frontend and `/api/retina` as a serverless function.

## 4. Local development
`npm install`

For a frontend-only demo: create `.env.local` with `VITE_DEMO_MODE=true`, then run `npm run dev`. The demo is not persistent.

For live local backend: install Vercel CLI (`npm i -g vercel`), configure the environment using `vercel env pull .env.local`, then run `vercel dev`.

## Important limitations before production
- **No authentication or role-based authorization is included.** The endpoint can expose financial data to anyone with the app URL. Protect it with a real login + server-side authorization before uploading actual business records. A private GitHub repository does not make the deployed URL private.
- Google Drive attachment upload is intentionally **not implemented**; the API returns 501 instead of pretending to save a file.
- Dashboard bank balances and inventory value are placeholders (zero), and dashboard totals are not month-filtered. Full double-entry accounting, GST, audit logs, locking, reconciliation and real reports need implementation and validation.
- Sheets is suitable for a small prototype, not a robust multi-user accounting ledger. Consider a database for production-grade concurrency and auditing.
- Use fictional/test data until authentication, authorization, accounting calculations, and backups are completed.
