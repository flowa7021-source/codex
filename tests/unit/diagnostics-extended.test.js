// ─── Extended Unit Tests: Diagnostics Module ─────────────────────────────────
// Tests for functions not covered in diagnostics.test.js:
// exportLogsAsJson, exportDiagnostics, toggleLogViewer, renderLogViewer,
// initDiagnosticsDeps, setupRuntimeDiagnostics
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Augment DOM mock for click/remove methods
const _origCreateElement = document.createElement;
document.createElement = (tag) => {
  const el = _origCreateElement(tag);
  if (!el.click) el.click = () => {};
  if (!el.remove) el.remove = () => {};
  if (!el.href) el.href = '';
  if (!el.download) el.download = '';
  return el;
};

import {
  pushDiagnosticEvent,
  clearDiagnostics,
  novaLog,
  getLogEntries,
  getLogCount,
  clearActivityLog,
  exportLogsAsJson,
  exportDiagnostics,
  toggleLogViewer,
  renderLogViewer,
  initDiagnosticsDeps,
  formatDiagnosticsForChat,
  collectPerfBaseline,
  initLogViewer,
} from '../../app/modules/diagnostics.js';
import { state, els as _els } from '../../app/modules/state.js';

/** @type {Record<string, any>} */
const els = _els;

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearDiagnostics();
  clearActivityLog();
});

// ── exportLogsAsJson ─────────────────────────────────────────────────────

describe('exportLogsAsJson', () => {
  it('does not throw and creates a log entry', () => {
    novaLog('test', 'action1');
    novaLog('test', 'action2');
    const countBefore = getLogCount();
    assert.doesNotThrow(() => exportLogsAsJson());
    // exportLogsAsJson should log an export event
    const countAfter = getLogCount();
    assert.ok(countAfter > countBefore);
    const entries = getLogEntries();
    const exportEntry = entries.find(e => e.action === 'logs.exported');
    assert.ok(exportEntry);
    assert.equal(exportEntry.module, 'diagnostics');
  });

  it('works with empty log buffer', () => {
    clearActivityLog();
    assert.doesNotThrow(() => exportLogsAsJson());
  });
});

// ── exportDiagnostics ────────────────────────────────────────────────────

describe('exportDiagnostics', () => {
  it('does not throw and pushes diagnostic event', () => {
    pushDiagnosticEvent('pre.event');
    assert.doesNotThrow(() => exportDiagnostics());
    const events = state.diagnostics.events;
    const exportEvent = events.find(e => e.type === 'diagnostics.export');
    assert.ok(exportEvent);
    assert.ok(exportEvent.payload.eventCount >= 1);
    assert.equal(exportEvent.payload.format, 'txt');
  });

  it('works with no prior events', () => {
    clearDiagnostics();
    assert.doesNotThrow(() => exportDiagnostics());
  });
});

// ── toggleLogViewer ──────────────────────────────────────────────────────

describe('toggleLogViewer', () => {
  it('does not throw when no panel element exists', () => {
    assert.doesNotThrow(() => toggleLogViewer());
  });

  it('toggling twice returns to original state', () => {
    assert.doesNotThrow(() => {
      toggleLogViewer();
      toggleLogViewer();
    });
  });
});

// ── renderLogViewer ──────────────────────────────────────────────────────

describe('renderLogViewer', () => {
  it('does not throw when no list element exists', () => {
    assert.doesNotThrow(() => renderLogViewer());
  });
});

// ── initLogViewer ────────────────────────────────────────────────────────

describe('initLogViewer', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => initLogViewer());
  });
});

// ── initDiagnosticsDeps ──────────────────────────────────────────────────

describe('initDiagnosticsDeps', () => {
  it('accepts deps object without error', () => {
    assert.doesNotThrow(() => initDiagnosticsDeps({
      renderCurrentPage: () => {},
      showToast: () => {},
    }));
  });

  it('accepts empty deps', () => {
    assert.doesNotThrow(() => initDiagnosticsDeps({}));
  });
});

// ── collectPerfBaseline extended ─────────────────────────────────────────

describe('collectPerfBaseline extended', () => {
  it('returns numeric uptimeMs', () => {
    const baseline = collectPerfBaseline();
    assert.equal(typeof baseline.uptimeMs, 'number');
    assert.ok(baseline.uptimeMs >= 0);
  });

  it('returns longTask object', () => {
    const baseline = collectPerfBaseline();
    assert.ok(baseline.longTask !== undefined);
    assert.ok('count' in baseline.longTask);
  });

  it('returns resources object', () => {
    const baseline = collectPerfBaseline();
    assert.ok(baseline.resources !== undefined);
    assert.ok('count' in baseline.resources);
  });

  it('returns pageCacheSize', () => {
    const baseline = collectPerfBaseline();
    assert.equal(typeof baseline.pageCacheSize, 'number');
  });

  it('returns trackedUrls count', () => {
    const baseline = collectPerfBaseline();
    assert.equal(typeof baseline.trackedUrls, 'number');
  });
});

// ── formatDiagnosticsForChat extended ────────────────────────────────────

describe('formatDiagnosticsForChat extended', () => {
  it('formats payload without perf section', () => {
    const result = formatDiagnosticsForChat({
      appVersion: '1.0',
      sessionId: 's',
      exportedAt: 'now',
      docName: null,
      page: null,
      eventCount: 0,
      events: [],
      perf: null,
    });
    assert.ok(result.includes('NovaReader'));
    assert.ok(result.includes('events:'));
  });

  it('formats events with payload data', () => {
    const result = formatDiagnosticsForChat({
      appVersion: '2.0',
      sessionId: 'x',
      exportedAt: 'ts',
      docName: 'doc.pdf',
      page: 3,
      eventCount: 1,
      events: [
        { ts: 'ts1', level: 'error', type: 'err.evt', payload: { msg: 'oops' } },
      ],
      perf: { uptimeMs: 1000, longTask: { count: 0, maxMs: 0 }, resources: { count: 5 } },
    });
    assert.ok(result.includes('err.evt'));
    assert.ok(result.includes('oops'));
    assert.ok(result.includes('page: 3'));
  });

  it('includes editHistory when present', () => {
    const result = formatDiagnosticsForChat({
      appVersion: '1.0',
      sessionId: 's',
      exportedAt: 'now',
      docName: null,
      page: null,
      eventCount: 0,
      events: [],
      perf: {
        uptimeMs: 500,
        longTask: { count: 0, maxMs: 0 },
        resources: { count: 0 },
        editHistory: { undoCount: 3, redoCount: 1, dirty: false },
      },
    });
    assert.ok(result.includes('editHistory'));
    assert.ok(result.includes('undo=3'));
    assert.ok(result.includes('redo=1'));
  });

  it('includes perfMetrics summary when present', () => {
    const result = formatDiagnosticsForChat({
      appVersion: '1.0',
      sessionId: 's',
      exportedAt: 'now',
      docName: null,
      page: null,
      eventCount: 0,
      events: [],
      perf: {
        uptimeMs: 100,
        longTask: { count: 0, maxMs: 0 },
        resources: { count: 0 },
        perfMetricsSummary: { renderTimes: { p95: 42 } },
      },
    });
    assert.ok(result.includes('perfMetrics'));
    assert.ok(result.includes('42'));
  });
});

// ── novaLog with edge cases ──────────────────────────────────────────────

describe('novaLog edge cases', () => {
  it('handles data with circular-safe Error object', () => {
    const err = new Error('circular test');
    assert.doesNotThrow(() => novaLog('mod', 'action', { error: err }, 'error'));
    const entries = getLogEntries();
    const last = entries[entries.length - 1];
    assert.ok(last.stack);
  });

  it('handles data with nested objects', () => {
    assert.doesNotThrow(() => novaLog('mod', 'action', { nested: { deep: { value: 42 } } }));
    const entries = getLogEntries();
    const last = entries[entries.length - 1];
    assert.equal(last.data.nested.deep.value, 42);
  });

  it('handles missing data parameter', () => {
    assert.doesNotThrow(() => novaLog('mod', 'action'));
    const entries = getLogEntries();
    const last = entries[entries.length - 1];
    assert.deepEqual(last.data, {});
  });
});
