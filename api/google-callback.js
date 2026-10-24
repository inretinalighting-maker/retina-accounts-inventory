
import { google } from 'googleapis';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send('Google authorization was denied');
  }

  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader
    .split(';')
    .map(x => x.trim())
    .find(x => x.startsWith('retina_oauth_state='));

  const savedState = cookie?.slice('retina_oauth_state='.length);

  res.setHeader(
    'Set-Cookie',
    'retina_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/google-callback; Max-Age=0'
  );

  if (
    typeof code !== 'string' ||
    typeof state !== 'string' ||
    !savedState
  ) {
    return res.status(400).send('Invalid OAuth callback');
  }

  const received = Buffer.from(state);
  const expected = Buffer.from(savedState);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return res.status(403).send('OAuth state verification failed');
  }

  try {
    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    const { tokens } = await oauth.getToken(code);

    if (!tokens.refresh_token) {
      return res.status(400).send(
        'No refresh token returned. Revoke the app grant and retry authorization.'
      );
    }

    // Temporary setup-only response.
    // The refresh token must be stored in Vercel environment variables.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    return res.status(200).send(`
      <!doctype html>
      <html>
      <head>
        <meta name="referrer" content="no-referrer">
        <title>Retina Drive Connected</title>
      </head>
      <body style="font-family:Arial;padding:30px">
        <h2>Google Drive authorization successful</h2>
        <p>Copy the refresh token below directly into Vercel:</p>
        <p><strong>Variable:</strong> GOOGLE_OAUTH_REFRESH_TOKEN</p>
        <textarea id="token" rows="5" cols="75" readonly></textarea>
        <p>Keep this token private. Close this page after saving it.</p>
        <script>
          document.getElementById('token').value =
            ${JSON.stringify(tokens.refresh_token)};
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth token exchange failed:', err.message);
    return res.status(500).send('Google OAuth token exchange failed');
  }
}
