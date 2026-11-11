// Tests for src/views.js — view ↔ URL path mapping.

const test = require('node:test');
const assert = require('node:assert');
const { VIEWS, VIEW_PATHS, DEFAULT_VIEW, RESERVED_PATHS, viewFromPath, pathForView, isView } = require('../src/views');

test('every view round-trips through its path', () => {
  for (const view of VIEWS) {
    assert.strictEqual(viewFromPath(pathForView(view)), view, view);
  }
});

test('the root path is the dashboard', () => {
  assert.strictEqual(viewFromPath('/'), 'dashboard');
  assert.strictEqual(pathForView('dashboard'), '/');
});

test('unknown paths fall back to the dashboard instead of a blank screen', () => {
  for (const p of ['/nope', '/radar/extra', '', null, undefined, '/.well-known/x']) {
    assert.strictEqual(viewFromPath(p), DEFAULT_VIEW, JSON.stringify(p));
  }
});

test('trailing slashes, case and query strings do not change the view', () => {
  assert.strictEqual(viewFromPath('/radar/'), 'radar');
  assert.strictEqual(viewFromPath('/Radar'), 'radar');
  assert.strictEqual(viewFromPath('/glossary?utm=x'), 'glossary');
  assert.strictEqual(viewFromPath('/news#top'), 'news');
});

test('reserved routes owned by index.js and the report modal are never views', () => {
  for (const p of RESERVED_PATHS) {
    assert.ok(!Object.values(VIEW_PATHS).includes(p), `${p} must not be a view path`);
    assert.strictEqual(viewFromPath(p), DEFAULT_VIEW, `${p} must not resolve to a view`);
  }
});

test('public/llms.txt already advertises /glossary — it must be a real view', () => {
  assert.strictEqual(viewFromPath('/glossary'), 'glossary');
});

test('isView rejects garbage and unknown-but-plausible names', () => {
  for (const v of [null, '', 'Dashboard', 'report', 'beta', 42]) assert.strictEqual(isView(v), false, String(v));
  for (const v of VIEWS) assert.strictEqual(isView(v), true, v);
});
