# Retina — merged update against GitHub main export (24 October 2026)

This package starts from the uploaded `retina-accounts-inventory-main.zip`, retaining its `api/google-auth.js` and `api/google-callback.js` unchanged. Only `api/retina.js` and `src/RetinaAccountsInventoryOS.jsx` are replaced by the staging update; `.gitignore`, `.env.example`, and a migration reference JSON are added. No existing Google Sheet data is changed.

## Safe deployment

1. Keep your `backup-before-coa-update` branch. For additional safety, create a separate `coa-staging-preview` branch from `main` and deploy it to Vercel Preview first.
2. Upload the **contents** of this ZIP to that branch, preserving the `api/` and `src/` directories. Do not upload the ZIP as a single repository file.
3. Do not upload `.env` or credentials. Keep existing Vercel environment variables. No upload password is required. Protect the deployment with Vercel Authentication or another real sign-in system.
4. Verify Vercel builds, Google OAuth still works, Chart of Accounts shows live accounts plus read-only staging rows, and old transactions remain visible. Test upload only with a non-sensitive small test file.
5. Merge into `main` only after checks. No migration of staged accounts is performed.

## Changes and limitations

- Read-only `accounts_staging` preview using columns A:G; does not edit `accounts`.
- New transactions require a matching live `accounts.id`; staging IDs are not accepted until separately migrated.
- Existing transaction fields, account IDs, and Google Sheets data are preserved.
- Backend supports `apiUploadBase64` for private Drive attachments with same-origin browser request checks and configured Google OAuth refresh token. The two OAuth handler files from the repository are unchanged.
- Not a double-entry ledger. Dashboard and reporting remain simplified and are not suitable for statutory accounts or GST filings.
- CWIP classification is provisional. Review GST input tax credit, asset capitalization, depreciation, and proprietor capital/drawings with an Indian accountant.

## File-level changes

- MODIFIED: `api/retina.js`, `src/RetinaAccountsInventoryOS.jsx`
- UNCHANGED: `api/google-auth.js`, `api/google-callback.js`, `package.json`, `index.html`, `vite.config.js`, `src/main.jsx`, `README.md`
- ADDED: `.gitignore`, `.env.example`, `retina-sole-proprietor-migration-staging.json`, this file.
