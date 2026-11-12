// The investigator chat is parked: 503 before anything else unless
// INVESTIGATOR_CHAT_ENABLED is exactly 'true'; the widget is not mounted.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
process.env.COHERE_API_KEY = 'cohere-key';
process.env.RECAPTCHA_SECRET_KEY = 'secret';

const { CohereClient } = require('cohere-ai');
const { investigatorChatEnabled, PARKED_MESSAGE } = require('../api/_utils/investigatorChatGate');
const rateLimit = require('../api/_utils/rateLimit');
const recaptcha = require('../api/_utils/recaptcha');
const chat = require('../api/investigator-chat');

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }

test('gate: only the literal string "true" turns the chat on', () => {
  for (const v of [undefined, '', 'false', '1', 'TRUE', 'yes', ' true']) {
    if (v === undefined) delete process.env.INVESTIGATOR_CHAT_ENABLED; else process.env.INVESTIGATOR_CHAT_ENABLED = v;
    assert.strictEqual(investigatorChatEnabled(), false, JSON.stringify(v));
  }
  process.env.INVESTIGATOR_CHAT_ENABLED = 'true';
  assert.strictEqual(investigatorChatEnabled(), true);
  delete process.env.INVESTIGATOR_CHAT_ENABLED;
});

test('parked: 503 before the limiter, reCAPTCHA, Supabase or Cohere', async (t) => {
  delete process.env.INVESTIGATOR_CHAT_ENABLED;
  const hits = [];
  t.mock.method(globalThis, 'fetch', async (url) => { hits.push(String(url)); throw new Error('no outbound call allowed'); });
  t.mock.method(CohereClient.prototype, 'chat', async () => { hits.push('cohere'); return {}; });
  t.mock.method(recaptcha, 'verifyRecaptcha', async () => { hits.push('recaptcha'); return { ok: true }; });
  rateLimit.setRateLimitStore({ name: 'spy', hit: async () => { hits.push('limiter'); return { allowed: true, count: 1 }; } });
  for (const req of [{ method: 'POST', headers: {}, body: { message: 'hi', recaptchaToken: 'tok' } }, { method: 'GET', headers: {} }]) {
    const r = res();
    await chat(req, r);
    assert.strictEqual(r.code, 503);
    assert.deepStrictEqual(r.body, { error: PARKED_MESSAGE });
    assert.strictEqual(r.headers['Cache-Control'], 'no-store');
  }
  assert.deepStrictEqual(hits, []);
});

test('enabled: the request reaches the guarded handler as before', async (t) => {
  process.env.INVESTIGATOR_CHAT_ENABLED = 'true';
  try {
    rateLimit.setRateLimitStore(rateLimit.createMemoryStore());
    t.mock.method(recaptcha, 'verifyRecaptcha', async () => ({ ok: true }));
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => [] }));
    t.mock.method(CohereClient.prototype, 'chat', async () => ({ text: 'answer', citations: [] }));
    const r = res();
    await chat({ method: 'POST', headers: { 'x-forwarded-for': '10.30.0.1' }, body: { message: 'hi', recaptchaToken: 'tok' } }, r);
    assert.strictEqual(r.code, 200);
    assert.strictEqual(r.body.text, 'answer');
  } finally { delete process.env.INVESTIGATOR_CHAT_ENABLED; }
});

test('client: the widget is switched off and only mounted behind the flag', () => {
  const widget = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'InvestigatorChat.jsx'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');
  assert.match(widget, /export const INVESTIGATOR_CHAT_ENABLED = false;/);
  assert.match(app, /\{INVESTIGATOR_CHAT_ENABLED && <InvestigatorChat \/>\}/);
  assert.ok(!/^\s*<InvestigatorChat \/>/m.test(app), 'no unconditional mount');
});
