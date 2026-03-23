import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initErrorHandling } from '../../app/modules/init-error-handling.js';

function makeDeps(overrides = {}) {
  return {
    pushDiagnosticEvent: mock.fn(),
    recordCrashEvent: mock.fn(),
    initCrashTelemetry: mock.fn(),
    showErrorFallback: mock.fn(),
    showCriticalErrorScreen: mock.fn(),
    toastError: mock.fn(),
    els: {
      searchStatus: document.createElement('div'),
      ocrStatus: document.createElement('div'),
    },
    state: { initComplete: false },
    ...overrides,
  };
}

describe('initErrorHandling', () => {
  it('exports a function', () => {
    assert.equal(typeof initErrorHandling, 'function');
  });

  it('returns an object with withErrorBoundary', () => {
    const result = initErrorHandling(makeDeps());
    assert.equal(typeof result.withErrorBoundary, 'function');
  });

  it('calls initCrashTelemetry on init', () => {
    const deps = makeDeps();
    initErrorHandling(deps);
    assert.equal(deps.initCrashTelemetry.mock.callCount(), 1);
  });

  it('withErrorBoundary wraps a function and returns result on success', async () => {
    const { withErrorBoundary } = initErrorHandling(makeDeps());
    const fn = mock.fn(() => 42);
    const wrapped = withErrorBoundary(fn, 'test-context');
    const result = await wrapped();
    assert.equal(result, 42);
  });

  it('withErrorBoundary catches errors and calls pushDiagnosticEvent', async () => {
    const deps = makeDeps();
    const { withErrorBoundary } = initErrorHandling(deps);
    const fn = () => { throw new Error('fetch failed'); };
    const wrapped = withErrorBoundary(fn, 'file-open');
    const result = await wrapped();
    assert.equal(result, null); // default fallback
    assert.ok(deps.pushDiagnosticEvent.mock.callCount() >= 1);
  });

  it('withErrorBoundary rethrows when rethrow option is true', async () => {
    const { withErrorBoundary } = initErrorHandling(makeDeps());
    const fn = () => { throw new Error('oops'); };
    const wrapped = withErrorBoundary(fn, 'test', { rethrow: true });
    await assert.rejects(() => wrapped(), { message: 'oops' });
  });

  it('withErrorBoundary silent mode skips user error display', async () => {
    const deps = makeDeps();
    const { withErrorBoundary } = initErrorHandling(deps);
    const fn = () => { throw new Error('silent fail'); };
    const wrapped = withErrorBoundary(fn, 'test', { silent: true });
    await wrapped();
    // toastError should not be called for silent errors
    assert.equal(deps.toastError.mock.callCount(), 0);
  });
});
