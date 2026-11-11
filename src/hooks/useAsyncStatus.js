import { useReducer, useRef, useCallback } from 'react';
import { asyncStatusReducer, initialAsyncState } from '../asyncStatus';

// useAsyncStatus — one hook for "kick off a request, show its outcome".
//
//   const scan = useAsyncStatus();
//   scan.run(async () => { ...; return payload; });   // idle → running → success|error
//   scan.reset();                                     // → idle, and discards any in-flight result
//
// Read `scan.status` ('idle'|'running'|'success'|'error'), `scan.data`, `scan.error`,
// or the booleans `isIdle/isRunning/isSuccess/isError`.
//
// A request that resolves after reset() (or after a newer run()) is dropped,
// so a stale response can never overwrite what the user is now looking at.
export default function useAsyncStatus() {
  const [state, dispatch] = useReducer(asyncStatusReducer, initialAsyncState);
  const runId = useRef(0);

  const run = useCallback(async (fn) => {
    const id = ++runId.current;
    dispatch({ type: 'start' });
    try {
      const data = await fn();
      if (id === runId.current) dispatch({ type: 'succeed', data });
      return data;
    } catch (err) {
      if (id === runId.current) dispatch({ type: 'fail', error: err?.message || String(err) });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    dispatch({ type: 'reset' });
  }, []);

  return {
    ...state,
    run,
    reset,
    isIdle: state.status === 'idle',
    isRunning: state.status === 'running',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
  };
}
