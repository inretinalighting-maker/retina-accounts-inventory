# Retina update: Drive attachments + division-specific accounts

## Vercel environment variables (server only)

- `GOOGLE_DRIVE_FOLDER_ID` = `1aAK5wVrGey94pfn68AMEvjTQ3Ee--ndg`
- Existing `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` must remain configured.

Redeploy after adding the environment variables. The OAuth account must have Editor access to the InRetina Images folder and the token must include a Google Drive upload-capable scope. If upload returns `insufficientPermissions`, the OAuth consent/refresh token must be renewed with an appropriate scope. Keep the folder private.

## How to test

1. Create or edit a test transaction, select Design, and confirm Product-only accounts do not appear. Change to Product and check the inverse. Blank-division legacy accounts appear in both.
2. Choose a PDF/JPG/PNG/WEBP (max 4 MB) in the attachment field, wait for a View attachment link.
3. Save/Update Transaction, refresh, and verify the link appears in the Attachment column and in Google Sheets `transactions.attachmentUrl`.
4. Verify the file is in the designated Google Drive folder.

Existing attachments, account IDs and transaction data are not migrated or deleted. An uploaded file is not attached to the transaction until Save/Update Transaction succeeds. This update does not implement user login or full role-based authorization; do not expose the application publicly without access controls.
