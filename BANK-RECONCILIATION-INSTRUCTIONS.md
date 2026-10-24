# Retina Bank Reconciliation update

Based on the previously supplied `chart_of_accounts.xlsx` workbook, `Kotak` and `IDFC` sheets.

- Kotak: Transaction Date, Value Date, Particulars, Cheque No., Debit/Credit amount, adjacent DR/CR indicator, Balance.
- IDFC: Transaction Date, Value Date, Particulars, Cheque No., Debit, Credit, Balance.
- Export statements as CSV preserving the original column order.
- Open Reconciliation, choose bank, upload CSV, review preview, Confirm Import.
- Imports append to existing `bankTransactions` Google Sheet, adding metadata columns to its header.
- Match to a Retina transaction with matching bank, direction and amount; manually review date and reference.
- Match and Undo save immediately to Google Sheets.
- The `reconciliation` tab remains unchanged; matching status is saved to `bankTransactions`.
- Existing OAuth files and other modules remain untouched.

**Before production:** back up your spreadsheet and repository. The first import extends the bankTransactions header. This is not a double-entry ledger. No automatic journal posting, reconciliation statement, or bank API connectivity is provided.

**Limitations:** duplicate detection uses statement content and may collapse two genuinely identical rows. Check repeated equal-value transactions. CSV dates are interpreted as DD/MM/YYYY or ISO YYYY-MM-DD. A bank balance ending CR/DR in an adjacent column is not signed; displayed balance magnitude is retained. Import batches are not atomic; retry skips identical imported rows. The existing API has no application-user authentication; add access control before exposing financial data to untrusted users.
