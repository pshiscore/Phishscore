// Tests for src/asyncStatus.js — the shared async-request machine.

const test = require('node:test');
const assert = require('node:assert');
const { STATUS, initialAsyncState, asyncStatusReducer: r } = require('../src/asyncStatus');

test('starts idle with no data and no error', () => {
  assert.deepStrictEqual(initialAsyncState, { status: 'idle', data: null, error: null });
});

test('idle → running → success carries data and clears error', () => {
  const running = r(initialAsyncState, { type: 'start' });
  assert.strictEqual(running.status, STATUS.RUNNING);
  const done = r(running, { type: 'succeed', data: { score: 40 } });
  assert.deepStrictEqual(done, { status: 'success', data: { score: 40 }, error: null });
});

test('idle → running → error carries message and clears data', () => {
  const running = r(initialAsyncState, { type: 'start' });
  const failed = r(running, { type: 'fail', error: 'Scan failed' });
  assert.deepStrictEqual(failed, { status: 'error', data: null, error: 'Scan failed' });
});

test('impossible combinations cannot be produced by any transition', () => {
  // Walk every state through every action and check the invariant each time.
  const states = [
    initialAsyncState,
    { status: 'running', data: null, error: null },
    { status: 'success', data: 1, error: null },
    { status: 'error', data: null, error: 'x' },
  ];
  const actions = [
    { type: 'start' }, { type: 'succeed', data: 2 }, { type: 'fail', error: 'y' }, { type: 'reset' },
  ];
  for (const s of states) for (const a of actions) {
    const n = r(s, a);
    if (n.status === 'running' || n.status === 'idle') {
      assert.strictEqual(n.data, null, `${s.status} +${a.type}: ${n.status} must not carry data`);
      assert.strictEqual(n.error, null, `${s.status} +${a.type}: ${n.status} must not carry error`);
    }
    if (n.status === 'success') assert.strictEqual(n.error, null, 'success must not carry error');
    if (n.status === 'error') {
      assert.strictEqual(n.data, null, 'error must not carry data');
      assert.ok(n.error, 'error must carry a message');
    }
  }
});

test('starting a new request clears a previous result', () => {
  const done = { status: 'success', data: 'old', error: null };
  assert.strictEqual(r(done, { type: 'start' }).data, null);
});

test('reset returns to the exact initial state from anywhere', () => {
  for (const s of [{ status: 'running', data: null, error: null }, { status: 'error', data: null, error: 'x' }]) {
    assert.strictEqual(r(s, { type: 'reset' }), initialAsyncState);
  }
});

test('fail without a message still yields a non-empty error', () => {
  assert.ok(r(initialAsyncState, { type: 'fail' }).error);
});

test('unknown actions are ignored', () => {
  const s = { status: 'success', data: 1, error: null };
  assert.strictEqual(r(s, { type: 'nope' }), s);
});
