// The one async-request state machine for the client.
//
// Before this, five components each hand-rolled the same machine with their own
// vocabulary: `loading/result/error` booleans in one place, `'done'|'failed'`
// strings in another, `'submitting'` in a third. Booleans let a component sit in
// states that cannot happen (loading AND error); divergent strings mean every
// reader has to learn each component's dialect.
//
// Invariant: exactly one of these holds at any time.
//   idle     — nothing requested          data=null  error=null
//   running  — request in flight          data=null  error=null
//   success  — request resolved           data=any   error=null
//   error    — request rejected           data=null  error=string
//
// CommonJS so `node --test` can require it directly; CRA imports it fine.

const STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
});

const initialAsyncState = Object.freeze({ status: STATUS.IDLE, data: null, error: null });

function asyncStatusReducer(state, action) {
  switch (action.type) {
    case 'start':
      return { status: STATUS.RUNNING, data: null, error: null };
    case 'succeed':
      return { status: STATUS.SUCCESS, data: action.data === undefined ? null : action.data, error: null };
    case 'fail':
      return { status: STATUS.ERROR, data: null, error: action.error || 'Unknown error' };
    case 'reset':
      return initialAsyncState;
    default:
      return state;
  }
}

module.exports = { STATUS, initialAsyncState, asyncStatusReducer };
