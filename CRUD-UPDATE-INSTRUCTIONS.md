# Retina CRUD update — existing production repository

This package adds a sidebar Chart of Accounts view, Add/Edit/Delete for live accounts, and Edit/Delete for transactions. It keeps OAuth handlers and the staging preview.

Upload the **contents** of this folder to the root of the existing GitHub repository on main (not the ZIP or enclosing folder). Confirm paths api/retina.js and src/RetinaAccountsInventoryOS.jsx. Do not upload .env secrets. Commit only after reviewing the changed-file list. Vercel redeploys automatically.

IMPORTANT: Deletion is permanent in Google Sheets and is not an audit trail. Download a Google Sheets backup before deleting test records. Account deletion is blocked when a transaction references its ID. Historical transaction IDs and voucher numbers remain unchanged during edits. The live accounts sheet remains 3 columns: id,name,group; staging remains separate and read-only. No double-entry ledger or statutory accounting claims.
