# Opening Balances Update

- Navigate to **Masters → Opening Balances**.
- Default date is 2025-04-01, but it is editable. Post balanced debit/credit lines by Design, Product, or Shared division.
- A new Google Sheets tab named `openingBalances` is created automatically on first use. Google Sheets service account must have edit permission.
- Saved batches cannot be silently overwritten for the same date and division. Check existing balances before posting. Back up the spreadsheet first.
- Dashboard Cash, Kotak, IDFC, and FD cards currently show **opening amounts only**, not reconciled running balances. The selected As-of/To date controls which opening balances are eligible.
- Trial Balance, Balance Sheet, Cash Flow, Bank Book and Cash Book show provisional **opening-only** schedules, not complete accounting reports.
- Profit & Loss excludes opening balances by design; other reports with unimplemented accounting logic retain their warnings.
- The app does not yet calculate a statutory balance sheet or accurate running cash/bank balances. A complete double-entry ledger and transaction reconciliation are required for that.
- Verify your Vercel deployment and test in a copy of the spreadsheet before entering real financial figures.
