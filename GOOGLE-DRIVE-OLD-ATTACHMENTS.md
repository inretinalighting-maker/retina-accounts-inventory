# Linking existing Google Drive documents to Retina transactions

This update is based on the uploaded current GitHub ZIP, not an earlier starter.

- Transactions > Edit: paste an existing Google Drive file URL into the new attachment link field, then click Update Transaction. The URL is saved to the `attachmentUrl` column of the `transactions` tab.
- Transactions > New Transaction: the same link field is available. The existing upload-file option remains.
- Transactions table: click View attachment to open the stored URL (Google Drive access permissions still apply).
- Transactions > Import Old Transactions (CSV): download the new template, add a Google Drive URL under `attachmentUrl` for each row, preview and confirm import. Existing CSVs without this optional column still work.
- One attachment URL per transaction. Removing the link only removes the reference; it does not delete the Google Drive document.
- Only HTTPS drive.google.com and docs.google.com links are accepted; do not change Drive file sharing to public just for this feature.

## Deployment
Back up your Sheet and GitHub repository. Upload the contents of this project folder to your existing GitHub `main` branch (not the outer folder or ZIP). Keep Vercel environment variables unchanged. Verify the latest Vercel deployment is Ready, then test on a disposable transaction before linking historical documents.

## Limitations
The link is saved on pressing Save/Update or Confirm Import, not with every keystroke. Existing Google Drive files are not copied or reuploaded. A successful deployment does not guarantee that a private Drive link can be opened by every user.
