# Retina staging edit + transaction account link update

This package is based on the previous Retina CRUD update. Upload the **contents** of this extracted folder to the existing GitHub `main` branch, retaining folder paths `api/` and `src/`. Do not upload the ZIP itself. GitHub will replace files with the same paths. Do not upload secrets or .env files. Vercel should redeploy automatically.

## Features
- Staged Chart of Accounts Add/Edit/Delete/Search.
- Save and Delete write immediately to Google Sheets `accounts_staging` (columns A:G).
- Transaction form includes a Manage Chart of Accounts link.
- Only live approved accounts from `accounts` appear in the transaction dropdown; staging is **not** automatically posted or migrated.
- Existing transaction Edit/Delete and live account Add/Edit/Delete retained.
- Existing Google OAuth handlers and Google Drive attachment backend retained.

## Data cautions
- BACK UP the spreadsheet before editing or deleting staged rows.
- Deletion clears A:G on the selected staging row, rather than shifting rows. This prevents ROW()-based ID formulas in other rows from renumbering.
- Editing a staged row replaces its E-column ID formula with its current fixed ID; other IDs remain untouched.
- New staged account IDs use a unique `RET-<UUID>` value rather than row-based IDs.
- `Approved` is only a review status; it does not migrate an account to the live master.
- The existing API does not have user login/authorization controls for mutations. Restrict deployment access before storing real financial data.
- No full end-to-end Google Sheets or Vercel production test has been performed. Existing accounting reports are prototype logic, not compliant books.
