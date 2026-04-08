// ─── Unit Tests: Diagnostics Module ─────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  pushDiagnosticEvent,
  clearDiagnostics,
  exportDiagnostics,
  novaLog,
  getLogEntries,
  getLogCount,
  getFilteredLogs,
  clearActivityLog,
  createModuleLogger,
  withPerformanceLog,
  formatDiagnosticsForChat,
  collectPerfBaseline,
  setupRuntimeDiagnostics,
} from '../../app/modules/diagnostics.js';

// Access state.diagnostics to verify events
import { state } from '../../app/modules/state.js';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearDiagnostics();
  clearActivityLog();
});

// ─── pushDiagnosticEvent ────────────────────────────────────────────────────

describe('pushDiagnosticEvent', () => {
  it('adds an event to state.diagnostics.events', () => {
    pushDiagnosticEvent('test.event', { foo: 'bar' });
    assert.equal(state.diagnostics.events.length, 1);
    const event = state.diagnostics.events[0];
    assert.equal(event.type, 'test.event');
    assert.equal(event.level, 'info');
    assert.deepEqual(event.payload, { foo: 'bar' });
    assert.ok(event.ts, 'should have a timestamp');
  });

  it('supports custom log level', () => {
    pushDiagnosticEvent('warning.event', {}, 'warn');
    assert.equal(state.diagnostics.events[0].level, 'warn');
  });

  it('trims events beyond maxEvents', () => {
    const max = state.diagnostics.maxEvents;
    for (let i = 0; i < max + 10; i++) {
      pushDiagnosticEvent(`event-${i}`, { idx: i });
    }
    assert.equal(state.diagnostics.events.length, max);
  });

  it('defaults payload to empty object', () => {
    pushDiagnosticEvent('simple.event');
    assert.deepEqual(state.diagnostics.events[0].payload, {});
  });
});

// ─── clearDiagnostics ───────────────────────────────────────────────────────

describe('clearDiagnostics', () => {
  it('removes all diagnostic events', () => {
    pushDiagnosticEvent('a');
    pushDiagnosticEvent('b');
    assert.ok(state.diagnostics.events.length > 0);
    clearDiagnostics();
    assert.equal(state.diagnostics.events.length, 0);
  });

  it('is safe to call on empty events array', () => {
    assert.doesNotThrow(() => clearDiagnostics());
    assert.equal(state.diagnostics.events.length, 0);
  });
});

// ─── novaLog / getLogEntries / getLogCount / clearActivityLog ──────────────

describe('novaLog', () => {
  it('adds a log entry to the buffer', () => {
    novaLog('test-module', 'test.action', { key: 'value' });
    const entries = getLogEntries();
    assert.ok(entries.length > 0);
    const last = entries[entries.length - 1];
    assert.equal(last.module, 'test-module');
    assert.equal(last.action, 'test.action');
    assert.equal(last.level, 'info');
    assert.deepEqual(last.data, { key: 'value' });
    assert.ok(last.ts);
  });

  it('supports all log levels', () => {
    novaLog('m', 'a1', {}, 'debug');
    novaLog('m', 'a2', {}, 'info');
    novaLog('m', 'a3', {}, 'warn');
    novaLog('m', 'a4', {}, 'error');
    const entries = getLogEntries();
    const levels = entries.slice(-4).map((e) => e.level);
    assert.deepEqual(levels, ['debug', 'info', 'warn', 'error']);
  });

  it('captures error stack when data contains Error object', () => {
    const err = new Error('test error');
    novaLog('m', 'err.action', { error: err }, 'error');
    const entries = getLogEntries();
    const last = entries[entries.length - 1];
    assert.ok(last.stack, 'should capture stack');
    assert.equal(last.data.error, 'test error');
  });
});

describe('getLogCount', () => {
  it('returns the number of log entries', () => {
    const before = getLogCount();
    novaLog('m', 'a');
    assert.equal(getLogCount(), before + 1);
  });
});

describe('getFilteredLogs', () => {
  beforeEach(() => {
    clearActivityLog();
    novaLog('pdf', 'open', {}, 'info');
    novaLog('ocr', 'run', {}, 'debug');
    novaLog('pdf', 'render', {}, 'warn');
    novaLog('search', 'query', { q: 'hello' }, 'info');
  });

  it('returns all entries when no filter', () => {
    const entries = getFilteredLogs();
    assert.ok(entries.length >= 4);
  });

  it('filters by module', () => {
    const entries = getFilteredLogs({ module: 'pdf' });
    assert.ok(entries.length >= 2);
    assert.ok(entries.every((e) => e.module === 'pdf'));
  });

  it('filters by level', () => {
    const entries = getFilteredLogs({ level: 'warn' });
    assert.ok(entries.length >= 1);
    assert.ok(entries.every((e) => e.level === 'warn'));
  });

  it('filters by search text', () => {
    const entries = getFilteredLogs({ search: 'hello' });
    assert.ok(entries.length >= 1);
  });

  it('respects limit parameter', () => {
    const entries = getFilteredLogs({ limit: 2 });
    assert.ok(entries.length <= 2);
  });
});

describe('clearActivityLog', () => {
  it('clears all log entries', () => {
    novaLog('m', 'a');
    assert.ok(getLogCount() > 0);
    clearActivityLog();
    assert.equal(getLogCount(), 0);
  });

  it('removes persisted log from localStorage', () => {
    novaLog('m', 'a');
    clearActivityLog();
    const stored = localStorage.getItem('novareader-activity-log');
    assert.equal(stored, null);
  });
});

// ─── createModuleLogger ─────────────────────────────────────────────────────

describe('createModuleLogger', () => {
  it('returns logger with debug, info, warn, error, timed', () => {
    const log = createModuleLogger('test');
    assert.equal(typeof log.debug, 'function');
    assert.equal(typeof log.info, 'function');
    assert.equal(typeof log.warn, 'function');
    assert.equal(typeof log.error, 'function');
    assert.equal(typeof log.timed, 'function');
  });

  it('logs with the correct module name', () => {
    clearActivityLog();
    const log = createModuleLogger('mymod');
    log.info('action1', { x: 1 });
    const entries = getLogEntries();
    const last = entries[entries.length - 1];
    assert.equal(last.module, 'mymod');
    assert.equal(last.action, 'action1');
    assert.equal(last.level, 'info');
  });

  it('timed returns a wrapped function', () => {
    const log = createModuleLogger('mymod');
    const fn = log.timed('op', async () => 42);
    assert.equal(typeof fn, 'function');
  });
});

// ─── withPerformanceLog ─────────────────────────────────────────────────────

describe('withPerformanceLog', () => {
  it('wraps async function and returns its result', async () => {
    const wrapped = withPerformanceLog('test', 'op', async () => 'result');
    const result = await wrapped();
    assert.equal(result, 'result');
  });

  it('logs start and done entries', async () => {
    clearActivityLog();
    const wrapped = withPerformanceLog('test', 'myop', async () => 123);
    await wrapped();
    const entries = getLogEntries();
    const startEntry = entries.find((e) => e.action === 'myop.start');
    const doneEntry = entries.find((e) => e.action === 'myop.done');
    assert.ok(startEntry, 'should log start');
    assert.ok(doneEntry, 'should log done');
    assert.ok(doneEntry.data.durationMs >= 0, 'should record duration');
  });

  it('logs error entry on throw', async () => {
    clearActivityLog();
    const wrapped = withPerformanceLog('test', 'failing', async () => {
      throw new Error('boom');
    });
    await assert.rejects(wrapped, { message: 'boom' });
    const entries = getLogEntries();
    const errEntry = entries.find((e) => e.action === 'failing.error');
    assert.ok(errEntry, 'should log error');
    assert.equal(errEntry.level, 'error');
  });
});

// ─── formatDiagnosticsForChat ───────────────────────────────────────────────

describe('formatDiagnosticsForChat', () => {
  it('returns formatted string with all expected fields', () => {
    const payload = {
      appVersion: '4.0.0',
      sessionId: 'test-session',
      exportedAt: '2026-01-01T00:00:00Z',
      docName: 'test.pdf',
      page: 1,
      eventCount: 2,
      events: [
        { ts: '2026-01-01T00:00:00Z', level: 'info', type: 'test.event', payload: { x: 1 } },
        { ts: '2026-01-01T00:00:01Z', level: 'warn', type: 'test.warn', payload: {} },
      ],
      perf: {
        uptimeMs: 5000,
        longTask: { count: 1, maxMs: 60 },
        resources: { count: 10 },
        perfMetricsSummary: { renderTimes: { p95: 100 } },
        editHistory: { undoCount: 2, redoCount: 1, dirty: true },
      },
    };
    const text = formatDiagnosticsForChat(payload);
    assert.ok(text.includes('NovaReader diagnostics'));
    assert.ok(text.includes('appVersion: 4.0.0'));
    assert.ok(text.includes('sessionId: test-session'));
    assert.ok(text.includes('test.pdf'));
    assert.ok(text.includes('events:'));
    assert.ok(text.includes('test.event'));
    assert.ok(text.includes('test.warn'));
  });

  it('handles missing perf fields gracefully', () => {
    const payload = {
      appVersion: '1.0',
      sessionId: 's',
      exportedAt: 'now',
      docName: null,
      page: null,
      eventCount: 0,
      events: [],
      perf: null,
    };
    assert.doesNotThrow(() => formatDiagnosticsForChat(payload));
  });
});

// ─── collectPerfBaseline ────────────────────────────────────────────────────

describe('collectPerfBaseline', () => {
  it('returns object with expected keys', () => {
    const baseline = collectPerfBaseline();
    assert.ok(baseline.ts);
    assert.equal(typeof baseline.uptimeMs, 'number');
    assert.ok('longTask' in baseline);
    assert.ok('resources' in baseline);
    assert.ok('perfMetricsSummary' in baseline);
    assert.ok('pageCacheSize' in baseline);
    assert.ok('trackedUrls' in baseline);
  });
});

// ─── setupRuntimeDiagnostics ────────────────────────────────────────────────

describe('setupRuntimeDiagnostics — window error/unhandledrejection handlers', () => {
  it('handles window error event and pushes runtime.error diagnostic', () => {
    clearDiagnostics();
    setupRuntimeDiagnostics();

    const e = new Event('error');
    Object.defineProperty(e, 'message', { value: 'Test error message' });
    Object.defineProperty(e, 'filename', { value: 'test.js' });
    Object.defineProperty(e, 'lineno', { value: 42 });
    Object.defineProperty(e, 'colno', { value: 7 });
    window.dispatchEvent(e);

    const events = state.diagnostics.events;
    const errEvent = events.find(ev => ev.type === 'runtime.error');
    assert.ok(errEvent, 'runtime.error event should be pushed');
    assert.equal(errEvent.payload.message, 'Test error message');
  });

  it('handles unhandledrejection event and pushes diagnostic', () => {
    clearDiagnostics();
    setupRuntimeDiagnostics();

    const e = new Event('unhandledrejection');
    const reason = new Error('rejection reason');
    Object.defineProperty(e, 'reason', { value: reason });
    window.dispatchEvent(e);

    const events = state.diagnostics.events;
    const rejEvent = events.find(ev => ev.type === 'runtime.unhandledrejection');
    assert.ok(rejEvent, 'runtime.unhandledrejection event should be pushed');
    assert.ok(rejEvent.payload.message.includes('rejection reason'));
  });

  it('handles unhandledrejection with non-Error reason', () => {
    clearDiagnostics();
    setupRuntimeDiagnostics();

    const e = new Event('unhandledrejection');
    Object.defineProperty(e, 'reason', { value: 'string reason' });
    window.dispatchEvent(e);

    const events = state.diagnostics.events;
    const rejEvent = events.find(ev => ev.type === 'runtime.unhandledrejection');
    assert.ok(rejEvent);
    assert.ok(rejEvent.payload.message.includes('string reason'));
  });
});

describe('setupRuntimeDiagnostics — PerformanceObserver setup', () => {
  it('exercises PerformanceObserver callback with longtask entry >= 50ms', () => {
    clearDiagnostics();
    let observerCallback = null;
    const origPO = globalThis.PerformanceObserver;

    globalThis.PerformanceObserver = function (cb) {
      observerCallback = cb;
      this.observe = () => {};
    };

    try {
      setupRuntimeDiagnostics();

      // Simulate the observer callback with a longtask entry
      if (observerCallback) {
        observerCallback({
          getEntries: () => [{ name: 'longtask', duration: 80 }],
        });
        const events = state.diagnostics.events;
        const ltEvent = events.find(ev => ev.type === 'perf.longtask');
        assert.ok(ltEvent, 'perf.longtask should be pushed for duration >= 50ms');
        assert.equal(ltEvent.payload.duration, 80);
      }
    } finally {
      if (origPO === undefined) delete globalThis.PerformanceObserver;
      else globalThis.PerformanceObserver = origPO;
    }
  });

  it('handles PerformanceObserver constructor throwing', () => {
    clearDiagnostics();
    const origPO = globalThis.PerformanceObserver;

    globalThis.PerformanceObserver = function () {
      throw new Error('PerformanceObserver not supported');
    };

    try {
      // Should not throw; catch block handles observer setup failure
      assert.doesNotThrow(() => setupRuntimeDiagnostics());

      const events = state.diagnostics.events;
      const unavailable = events.find(ev => ev.type === 'perf.observer.unavailable');
      assert.ok(unavailable, 'perf.observer.unavailable should be pushed on error');
    } finally {
      if (origPO === undefined) delete globalThis.PerformanceObserver;
      else globalThis.PerformanceObserver = origPO;
    }
  });

  it('does not crash when PerformanceObserver is not a function', () => {
    clearDiagnostics();
    const origPO = globalThis.PerformanceObserver;
    delete globalThis.PerformanceObserver;

    try {
      // Should not throw; if-guard skips the PerformanceObserver block
      assert.doesNotThrow(() => setupRuntimeDiagnostics());
    } finally {
      if (origPO !== undefined) globalThis.PerformanceObserver = origPO;
    }
  });
});
