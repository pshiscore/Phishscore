// Tests for normalizeDomainAge in lib/ipqs.js.
//
// The original bug: IPQS returns a populated shell, {human:"N/A",timestamp:null,
// iso:null}, when it has no creation date. That object is truthy, so `|| null`
// kept it and the "Unknown" branch downstream was unreachable — the literal
// string "N/A" reached the model, which narrated it as a new domain.

const test = require('node:test');
const assert = require('node:assert');
const { normalizeDomainAge } = require('../lib/ipqs');

// The exact payload IPQS returned for mycontent.academy.
const NA_SHELL = { human: 'N/A', timestamp: null, iso: null };

test('the truthy "N/A" shell collapses to unknown', () => {
  assert.ok(NA_SHELL, 'precondition: the shell is truthy, which is what broke the guard');
  const r = normalizeDomainAge(NA_SHELL);
  assert.strictEqual(r.status, 'unknown');
  assert.strictEqual(r.days, null);
});

test('a real IPQS timestamp resolves to a known age', () => {
  // google.com, as returned live by IPQS. Seconds, not milliseconds.
  const r = normalizeDomainAge({
    human: '29 years ago',
    timestamp: 874296000,
    iso: '1997-09-15T00:00:00-04:00',
  });
  assert.strictEqual(r.status, 'known');
  assert.ok(r.days > 10000, `expected a very old domain, got ${r.days}`);
});

test('treats the timestamp as seconds, not milliseconds', () => {
  const secs = Math.floor(Date.now() / 1000) - 86400 * 10; // 10 days ago
  const r = normalizeDomainAge({ timestamp: secs, iso: null, human: null });
  assert.strictEqual(r.status, 'known');
  assert.strictEqual(r.days, 10, 'a ms/s mix-up would give ~0 or a wild number');
});

test('rejects missing, zero, negative and non-numeric timestamps', () => {
  for (const bad of [null, undefined, {}, { timestamp: null }, { timestamp: 0 },
                     { timestamp: -1 }, { timestamp: 'abc' }, { timestamp: NaN }]) {
    assert.strictEqual(normalizeDomainAge(bad).status, 'unknown', `input ${JSON.stringify(bad)}`);
  }
});

test('a future timestamp is bad data, not a brand-new domain', () => {
  const future = Math.floor(Date.now() / 1000) + 86400 * 365;
  const r = normalizeDomainAge({ timestamp: future, iso: null, human: null });
  assert.strictEqual(r.status, 'unknown', 'must not report a negative age as "new"');
  assert.strictEqual(r.days, null);
});

test('an unknown result never carries a numeric age that could read as recent', () => {
  for (const input of [NA_SHELL, null, { timestamp: 0 }]) {
    const r = normalizeDomainAge(input);
    assert.strictEqual(r.days, null);
    assert.notStrictEqual(r.days, 0, '0 days would be indistinguishable from a new domain');
  }
});
