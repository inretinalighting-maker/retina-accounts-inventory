# Historical transaction CSV import + Kotak/IDFC reconciliation

This update adds an optional **Import Old Transactions (CSV)** button to Transactions. No data is uploaded when opening the page or selecting a file. The user must review and click **Confirm Import to Google Sheets**. The existing Kotak/IDFC CSV reconciliation page is preserved.

## Steps
1. Back up your Google Sheet and GitHub repository.
2. Upload the contents of this folder (not the ZIP) to the repository root on `main`, keeping the `api/` and `src/` paths.
3. Check Vercel deployment status.
4. Open Transactions > Import Old Transactions (CSV) > Download CSV template.
5. Fill a small sample with existing live Chart of Accounts names; dates must be `YYYY-MM-DD`, voucher numbers must be unique, amount must equal either debit or credit, and only one of debit/credit may be positive.
6. Select the CSV, review the preview, then confirm. The import writes to `transactions` in Google Sheets.
7. Open Reconciliation for Kotak or IDFC bank CSV imports and matching.

## Important limitations
- This importer accepts CSV (not XLSX) for historical accounting transactions. Export Excel to CSV first.
- Historical transactions are not double-entry journals; the existing simplified Retina transaction schema is retained.
- Import rejects the entire batch if any row has an invalid or duplicate voucher number. It does not import staged account names; only approved live account names are accepted.
- The frontend validates values and the backend validates account existence and duplicates. Back up the Sheet before testing with real data.
- A production build and live Google Sheets import have not been verified in this environment.
