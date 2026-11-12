// Tests for api/_utils/cronAuth.js — the one gate for scheduled jobs.

const test = require('node:test');
const assert = require('node:assert');
const { authorizeCron, DEFAULT_SECRET } = require('../api/_utils/cronAuth');

const env = { INTERNAL_SECRET: 'int-secret', CRON_SECRET: 'cron-secret' };
const req = (headers = {}, query = {}) => ({ headers, query });

test('a bare GET — exactly what Vercel sends with no CRON_SECRET — is refused', () => {
  // This is the request that has been failing every day.
  assert.deepStrictEqual(authorizeCron(req(), env), { ok: false, actor: null });
});

test('Vercel cron: Authorization: Bearer <CRON_SECRET> is accepted as cron', () => {
  assert.deepStrictEqual(authorizeCron(req({ authorization: 'Bearer cron-secret' }), env), { ok: true, actor: 'cron' });
  assert.strictEqual(authorizeCron(req({ authorization: 'bearer cron-secret' }), env).ok, true, 'scheme is case-insensitive');
});

test('CRON_SECRET falls back to INTERNAL_SECRET so one env var is enough', () => {
  const only = { INTERNAL_SECRET: 'int-secret' };
  assert.strictEqual(authorizeCron(req({ authorization: 'Bearer int-secret' }), only).actor, 'cron');
});

test('dev-dashboard manual trigger via x-internal-secret still works', () => {
  assert.deepStrictEqual(authorizeCron(req({ 'x-internal-secret': 'int-secret' }), env), { ok: true, actor: 'manual' });
});

test('legacy call sites (x-cron-secret, ?secret=) still work', () => {
  assert.strictEqual(authorizeCron(req({ 'x-cron-secret': 'int-secret' }), env).actor, 'legacy');
  assert.strictEqual(authorizeCron(req({}, { secret: 'int-secret' }), env).actor, 'legacy');
});

test('wrong, empty, or cross-wired secrets are refused', () => {
  for (const r of [
    req({ authorization: 'Bearer int-secret' }),          // internal secret is not the cron secret
    req({ authorization: 'Bearer ' }),
    req({ authorization: 'Bearer wrong' }),
    req({ 'x-internal-secret': 'cron-secret' }),          // cron secret is not the manual one
    req({ 'x-internal-secret': '' }),
    req({}, { secret: 'nope' }),
  ]) assert.strictEqual(authorizeCron(r, env).ok, false, JSON.stringify(r));
});

test('the hardcoded default is only used when INTERNAL_SECRET is unset', () => {
  assert.strictEqual(authorizeCron(req({ 'x-internal-secret': DEFAULT_SECRET }), {}).ok, true);
  assert.strictEqual(authorizeCron(req({ 'x-internal-secret': DEFAULT_SECRET }), env).ok, false,
    'a configured secret must disable the public default');
});

test('tolerates a missing headers/query object', () => {
  assert.strictEqual(authorizeCron({}, env).ok, false);
  assert.strictEqual(authorizeCron(undefined, env).ok, false);
});
