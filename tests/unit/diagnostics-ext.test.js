// ─── Deep Unit Tests: Diagnostics Module ─────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  novaLog, withPerformanceLog, createModuleLogger,
  getLogEntries, getLogCount, getFilteredLogs, clearActivityLog,
  toggleLogViewer, renderLogViewer, initDiagnosticsDeps,
  pushDiagnosticEvent, clearDiagnostics, collectPerfBaseline,
  formatDiagnosticsForChat,
} from '../../app/modules/diagnostics.js';

describe('novaLog', () => {
  beforeEach(() => clearActivityLog());

  it('adds entry to log buffer', () => {
    const before = getLogCount();
    novaLog('test', 'test.action', { key: 'value' }, 'info');
    assert.ok(getLogCount() > before);
  });

  it('captures stack for error with Error object', () => {
    novaLog('test', 'test.error', { error: new Error('boom') }, 'error');
    const last = getLogEntries()[getLogEntries().length - 1];
    assert.equal(last.level, 'error');
    assert.ok(last.stack);
  });

  it('captures stack from data.stack', () => {
    novaLog('test', 'test.error', { stack: 'trace' }, 'error');
    const last = getLogEntries()[getLogEntries().length - 1];
    assert.equal(last.stack, 'trace');
  });

  it('handles non-object data', () => {
    assert.doesNotThrow(() => novaLog('test', 'action', null, 'info'));
  });
});

describe('withPerformanceLog', () => {
  beforeEach(() => clearActivityLog());

  it('logs start/done and returns result', async () => {
    const fn = withPerformanceLog('test', 'op', async () => 42);
    assert.equal(await fn(), 42);
    assert.ok(getLogEntries().some(e => e.action === 'op.start'));
    assert.ok(getLogEntries().some(e => e.action === 'op.done'));
  });

  it('logs errors and re-throws', async () => {
    const fn = withPerformanceLog('test', 'fail', async () => { throw new Error('boom'); });
    await assert.rejects(fn(), { message: 'boom' });
    assert.ok(getLogEntries().some(e => e.action === 'fail.error'));
  });
});

describe('createModuleLogger', () => {
  beforeEach(() => clearActivityLog());

  it('creates logger with all levels', () => {
    const log = createModuleLogger('mod');
    assert.equal(typeof log.debug, 'function');
    assert.equal(typeof log.info, 'function');
    assert.equal(typeof log.warn, 'function');
    assert.equal(typeof log.error, 'function');
    assert.equal(typeof log.timed, 'function');
  });

  it('logs with correct module and level', () => {
    const log = createModuleLogger('mod');
    log.debug('act', { x: 1 });
    const last = getLogEntries()[getLogEntries().length - 1];
    assert.equal(last.module, 'mod');
    assert.equal(last.level, 'debug');
  });

  it('timed creates a perf-tracked wrapper', async () => {
    const log = createModuleLogger('mod');
    const fn = log.timed('op', async () => 'ok');
    assert.equal(await fn(), 'ok');
  });
});

describe('getFilteredLogs', () => {
  beforeEach(() => clearActivityLog());

  it('filters by module', () => {
    novaLog('alpha', 'a', {}, 'info');
    novaLog('beta', 'b', {}, 'info');
    assert.ok(getFilteredLogs({ module: 'alpha' }).every(e => e.module === 'alpha'));
  });

  it('filters by level', () => {
    novaLog('t', 'a', {}, 'info');
    novaLog('t', 'b', {}, 'error');
    assert.ok(getFilteredLogs({ level: 'error' }).every(e => e.level === 'error'));
  });

  it('filters by search text', () => {
    novaLog('t', 'unique_xyz', {}, 'info');
    assert.ok(getFilteredLogs({ search: 'unique_xyz' }).length >= 1);
  });

  it('respects limit', () => {
    for (let i = 0; i < 10; i++) novaLog('t', `a${i}`, {}, 'info');
    assert.ok(getFilteredLogs({ limit: 3 }).length <= 3);
  });
});

describe('clearActivityLog', () => {
  it('clears all log entries', () => {
    novaLog('t', 'a', {}, 'info');
    clearActivityLog();
    assert.equal(getLogCount(), 0);
  });
});

describe('toggleLogViewer / renderLogViewer', () => {
  it('do not throw', () => {
    assert.doesNotThrow(() => toggleLogViewer());
    assert.doesNotThrow(() => renderLogViewer());
  });
});

describe('pushDiagnosticEvent / clearDiagnostics', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => pushDiagnosticEvent('test', {}));
    assert.doesNotThrow(() => pushDiagnosticEvent('test', {}, 'warn'));
    assert.doesNotThrow(() => clearDiagnostics());
  });
});

describe('collectPerfBaseline', () => {
  it('returns object with expected keys', () => {
    initDiagnosticsDeps({});
    const b = collectPerfBaseline();
    assert.ok(b.ts);
    assert.ok(typeof b.uptimeMs === 'number');
  });
});

describe('formatDiagnosticsForChat', () => {
  it('formats payload into readable text', () => {
    const text = formatDiagnosticsForChat({
      appVersion: '3.0', sessionId: 's', exportedAt: '2024', docName: 'test.pdf', page: 1, eventCount: 1,
      perf: { uptimeMs: 60000, longTask: { count: 2, maxMs: 100 }, resources: { count: 10 },
        perfMetricsSummary: {}, editHistory: { undoCount: 1, redoCount: 0, dirty: false } },
      events: [{ ts: '2024', level: 'info', type: 'ev', payload: {} }],
    });
    assert.ok(text.includes('NovaReader'));
    assert.ok(text.includes('test.pdf'));
  });

  it('handles null perf gracefully', () => {
    const text = formatDiagnosticsForChat({
      appVersion: '3', sessionId: 's', exportedAt: '2024', docName: null, page: null, eventCount: 0, perf: null, events: [],
    });
    assert.ok(text.includes('NovaReader'));
  });
});
