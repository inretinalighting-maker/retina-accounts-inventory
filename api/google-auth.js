
import { google } from 'googleapis';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const {
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_SETUP_KEY
  } = process.env;

  if (
    !GOOGLE_OAUTH_CLIENT_ID ||
    !GOOGLE_OAUTH_CLIENT_SECRET ||
    !GOOGLE_OAUTH_REDIRECT_URI ||
    !GOOGLE_OAUTH_SETUP_KEY
  ) {
    return res.status(500).send('OAuth configuration is incomplete');
  }

  // Restrict setup to the administrator.
  const authHeader = req.headers.authorization || '';
  const expected = `Basic ${Buffer.from(
    `admin:${GOOGLE_OAUTH_SETUP_KEY}`
  ).toString('base64')}`;

  const provided = Buffer.from(authHeader);
  const required = Buffer.from(expected);

  if (
    provided.length !== required.length ||
    !crypto.timingSafeEqual(provided, required)
  ) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Retina Drive Setup"');
    return res.status(401).send('Administrator authentication required');
  }

  const state = crypto.randomBytes(32).toString('hex');

  res.setHeader(
    'Set-Cookie',
    `retina_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/google-callback; Max-Age=600`
  );

  const oauth = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI
  );

  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    state
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, url);
}
