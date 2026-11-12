// Tests for api/_utils/cronAuth.js — the one gate for scheduled jobs.
//
// Two credentials are accepted: Vercel's `Authorization: Bearer <CRON_SECRET>`
// and the /devs session cookie. Everything that used to work — a shared
// header, a query string, a hardcoded default, a cookie with no admin
// password configured — must now be refused.

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { COOKIE_NAME, sessionToken, parseCookies, authorizeCron, authorizeSession, authorizeJob, requireJobAuth } = require('../api/_utils/cronAuth');

const env = { CRON_SECRET: 'cron-secret', ADMIN_USERNAME: 'vlad', ADMIN_PASSWORD: 'pw' };
const req = (headers = {}, query = {}) => ({ headers, query });
const cookieFor = (e) => `${COOKIE_NAME}=${sessionToken(e)}`;

// A res double so the suite can assert the literal 401.
function fakeRes() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const gate = (r, e = env) => { const res = fakeRes(); const auth = requireJobAuth(r, res, e); return { auth, code: res.code }; };

// ── the four cases the handlers must exhibit ──────────────────────────────────

test('bare GET (Vercel with no CRON_SECRET, or anyone) → 401', () => {
  const { auth, code } = gate(req());
  assert.strictEqual(auth, null);
  assert.strictEqual(code, 401);
});

test('Bearer <CRON_SECRET> → passes as cron (handler proceeds to 200)', () => {
  const { auth, code } = gate(req({ authorization: 'Bearer cron-secret' }));
  assert.deepStrictEqual(auth, { ok: true, actor: 'cron' });
  assert.strictEqual(code, null, 'gate must not touch the response on success');
  assert.strictEqual(gate(req({ authorization: 'bearer cron-secret' })).auth.actor, 'cron', 'scheme is case-insensitive');
});

test('valid devs_session cookie → passes as manual:<admin> (handler proceeds to 200)', () => {
  const { auth, code } = gate(req({ cookie: cookieFor(env) }));
  assert.deepStrictEqual(auth, { ok: true, actor: 'manual:vlad' });
  assert.strictEqual(code, null);
});

test('old x-internal-secret header → 401', () => {
  for (const v of ['cron-secret', 'pw', 'phiscore-radara-2026']) {
    assert.strictEqual(gate(req({ 'x-internal-secret': v })).code, 401, `x-internal-secret: ${v}`);
  }
});

// ── fail closed ───────────────────────────────────────────────────────────────

test('missing CRON_SECRET refuses every bearer token, including the old ones', () => {
  const noCron = { ADMIN_USERNAME: 'vlad', ADMIN_PASSWORD: 'pw', INTERNAL_SECRET: 'int' };
  for (const v of ['int', 'phiscore-radara-2026', 'anything']) {
    const r = authorizeCron(req({ authorization: `Bearer ${v}` }), noCron);
    assert.strictEqual(r.ok, false, `Bearer ${v}`);
  }
  assert.match(authorizeCron(req({ authorization: 'Bearer x' }), noCron).reason, /not configured/);
});

test('no fallback: INTERNAL_SECRET and the hardcoded default are not cron credentials', () => {
  const e = { ...env, INTERNAL_SECRET: 'int' };
  assert.strictEqual(authorizeCron(req({ authorization: 'Bearer int' }), e).ok, false);
  assert.strictEqual(authorizeCron(req({ authorization: 'Bearer phiscore-radara-2026' }), e).ok, false);
});

test('legacy x-cron-secret header and ?secret= query → 401', () => {
  assert.strictEqual(gate(req({ 'x-cron-secret': 'cron-secret' })).code, 401);
  assert.strictEqual(gate(req({}, { secret: 'cron-secret' })).code, 401);
});

test('a cookie is refused when the admin credentials are not configured', () => {
  // Three handlers previously compared against HMAC('fallback','admin') with no
  // guard — a predictable constant. The shared check must never do that.
  const unset = { CRON_SECRET: 'cron-secret' };
  const forged = `${COOKIE_NAME}=${sessionToken(unset)}`;
  assert.strictEqual(authorizeSession(req({ cookie: forged }), unset).ok, false);
  assert.strictEqual(gate(req({ cookie: forged }), unset).code, 401);
  for (const partial of [{ ADMIN_USERNAME: 'vlad' }, { ADMIN_PASSWORD: 'pw' }]) {
    assert.strictEqual(authorizeSession(req({ cookie: cookieFor(partial) }), partial).ok, false, JSON.stringify(partial));
  }
});

test('wrong, empty or stale cookies → 401', () => {
  const stale = cookieFor({ ...env, ADMIN_PASSWORD: 'old-pw' }); // token from before a password change
  for (const c of [`${COOKIE_NAME}=nope`, `${COOKIE_NAME}=`, 'other=1', stale, '']) {
    assert.strictEqual(gate(req({ cookie: c })).code, 401, JSON.stringify(c));
  }
});

test('wrong bearer tokens → 401, and a near-miss is not a match', () => {
  for (const a of ['Bearer wrong', 'Bearer cron-secret ', 'Bearer cron-secre', 'Bearer ', 'Basic cron-secret', 'cron-secret']) {
    assert.strictEqual(gate(req({ authorization: a })).code, 401, JSON.stringify(a));
  }
});

// ── derivation parity with the issuer ─────────────────────────────────────────

test('sessionToken matches the HMAC /api/auth-devs has always issued', () => {
  // Pinned so a refactor cannot silently invalidate every admin session.
  const expected = crypto.createHmac('sha256', 'pw').update('vlad').digest('hex');
  assert.strictEqual(sessionToken(env), expected);
});

test('cookie header parsing: several cookies, spaces, and "=" inside a value', () => {
  const c = parseCookies(`a=1; ${COOKIE_NAME}=abc==def ;  b = 2`);
  assert.strictEqual(c[COOKIE_NAME], 'abc==def');
  assert.strictEqual(c.a, '1');
  assert.deepStrictEqual(parseCookies(undefined), {});
});

test('cron is tried before the cookie and either alone is sufficient', () => {
  const both = req({ authorization: 'Bearer cron-secret', cookie: cookieFor(env) });
  assert.strictEqual(authorizeJob(both, env).actor, 'cron');
  assert.strictEqual(authorizeJob(req({ cookie: cookieFor(env) }), env).actor, 'manual:vlad');
});

test('tolerates a missing headers/query object', () => {
  assert.strictEqual(authorizeJob({}, env).ok, false);
  assert.strictEqual(authorizeJob(undefined, env).ok, false);
});
