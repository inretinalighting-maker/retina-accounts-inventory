# Upload without a password popup

The browser prompt and RETINA_UPLOAD_PASSWORD check were removed. Uploads require same-origin browser requests, but this is **not user authentication**. Anyone who can access an unprotected public Retina website may still be able to upload files. **Enable Vercel Deployment Protection / Authentication or add user login before using this with private financial documents.** Do not make the Google Drive folder public.

Keep GOOGLE_DRIVE_FOLDER_ID and existing GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN configured. Deploy and test with a PDF or image. Existing division account filtering is preserved.
