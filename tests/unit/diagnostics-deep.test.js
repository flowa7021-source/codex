// ─── Deep Unit Tests: Diagnostics Module ────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  pushDiagnosticEvent,
  clearDiagnostics,
  exportDiagnostics,
  novaLog,
  getLogEntries,
  getLogCount,
  clearActivityLog,
  exportLogsAsJson,
  toggleLogViewer,
  renderLogViewer,
  initLogViewer,
  initDiagnosticsDeps,
  collectPerfBaseline,
  formatDiagnosticsForChat,
  setupRuntimeDiagnostics,
} from '../../app/modules/diagnostics.js';

import { state } from '../../app/modules/state.js';

// Patch mock createElement to include click()
const _origCreate = document.createElement;
document.createElement = (tag) => {
  const el = _origCreate(tag);
  if (!el.click) el.click = () => {};
  return el;
};

beforeEach(() => {
  clearDiagnostics();
  clearActivityLog();
});

describe('exportDiagnostics', () => {
  it('does not throw when called', () => {
    pushDiagnosticEvent('pre.event', { x: 1 });
    assert.doesNotThrow(() => exportDiagnostics());
  });

  it('pushes a diagnostics.export event after running', () => {
    clearDiagnostics();
    exportDiagnostics();
    const ev = state.diagnostics.events.find(e => e.type === 'diagnostics.export');
    assert.ok(ev, 'should push a diagnostics.export event');
    assert.equal(ev.payload.format, 'txt');
  });
});

describe('exportLogsAsJson', () => {
  it('does not throw when called', () => {
    novaLog('test', 'action');
    assert.doesNotThrow(() => exportLogsAsJson());
  });
});

describe('toggleLogViewer', () => {
  it('does not throw when panel element is missing', () => {
    assert.doesNotThrow(() => toggleLogViewer());
  });

  it('toggles twice without error', () => {
    assert.doesNotThrow(() => {
      toggleLogViewer();
      toggleLogViewer();
    });
  });
});

describe('renderLogViewer', () => {
  it('does not throw when DOM elements are missing', () => {
    assert.doesNotThrow(() => renderLogViewer());
  });
});

describe('initLogViewer', () => {
  it('does not throw when DOM elements are missing', () => {
    assert.doesNotThrow(() => initLogViewer());
  });
});

describe('initDiagnosticsDeps', () => {
  it('accepts and applies dependencies', () => {
    const mockDeps = {
      getEditHistory: () => ({ undoCount: 5, redoCount: 2, editedPages: [], dirty: true }),
      getToolMode: () => 'annotate',
    };
    assert.doesNotThrow(() => initDiagnosticsDeps(mockDeps));
    const baseline = collectPerfBaseline();
    assert.equal(baseline.editHistory.undoCount, 5);
    assert.equal(baseline.toolMode, 'annotate');
  });
});

describe('novaLog error stack capture', () => {
  it('captures stack from data.stack string', () => {
    clearActivityLog();
    novaLog('m', 'action', { stack: 'Error at test.js:1' }, 'error');
    const entries = getLogEntries();
    const last = entries[entries.length - 1];
    assert.equal(last.stack, 'Error at test.js:1');
  });

  it('captures Error instance stack', () => {
    clearActivityLog();
    const err = new Error('fail');
    novaLog('m', 'action', { error: err }, 'error');
    const entries = getLogEntries();
    const last = entries[entries.length - 1];
    assert.ok(last.stack);
    assert.equal(last.data.error, 'fail');
  });
});

describe('setupRuntimeDiagnostics', () => {
  it('does not throw', () => {
    if (typeof globalThis.PerformanceObserver === 'undefined') {
      globalThis.PerformanceObserver = class {
        constructor() {}
        observe() {}
      };
    }
    assert.doesNotThrow(() => setupRuntimeDiagnostics());
  });
});

describe('activity log ring buffer', () => {
  it('trims log buffer beyond max entries', () => {
    clearActivityLog();
    for (let i = 0; i < 5010; i++) {
      novaLog('m', 'a-' + i);
    }
    assert.ok(getLogCount() <= 5000);
  });
});

describe('formatDiagnosticsForChat edge cases', () => {
  it('handles perf with editHistory', () => {
    const payload = {
      appVersion: '1.0', sessionId: 's', exportedAt: 'now', docName: null, page: null,
      eventCount: 0, events: [],
      perf: { uptimeMs: 50, longTask: { count: 0, maxMs: 0 }, resources: { count: 0 },
        editHistory: { undoCount: 3, redoCount: 1, dirty: false } },
    };
    const text = formatDiagnosticsForChat(payload);
    assert.ok(text.includes('undo=3'));
    assert.ok(text.includes('redo=1'));
  });
});
