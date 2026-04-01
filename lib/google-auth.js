// ── Google Service Account Auth Helper ───────────────────────────────────────
// Generates OAuth2 access tokens from service account credentials
// Supports both full JSON string and individual env vars

let _cachedToken = null;
let _tokenExpiry = 0;

function getCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS JSON:', e.message);
    }
  }
  // Fallback: individual vars
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return { project_id: projectId, client_email: clientEmail, private_key: privateKey };
  }
  return null;
}

// Create a JWT and exchange for an access token
async function getAccessToken(scope = 'https://www.googleapis.com/auth/cloud-platform') {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (5 min buffer)
  if (_cachedToken && _tokenExpiry > now + 300) {
    return _cachedToken;
  }

  const creds = getCredentials();
  if (!creds) throw new Error('No Google credentials configured');

  const { client_email, private_key } = creds;

  // Build JWT header + payload
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;

  // Sign with private key using Web Crypto
  const keyData = private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const keyBuffer = Buffer.from(keyData, 'base64');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signingInput)
  );

  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    console.error('Google token exchange error:', JSON.stringify(tokenData));
    throw new Error(`Token error: ${tokenData.error} — ${tokenData.error_description}`);
  }

  _cachedToken = tokenData.access_token;
  _tokenExpiry = now + (tokenData.expires_in || 3600);
  return _cachedToken;
}

module.exports = { getAccessToken, getCredentials };
