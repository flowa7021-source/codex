// @ts-check
// ─── Diagnostics Module ─────────────────────────────────────────────────────
// Self-contained diagnostics with dependency injection for app-level functions.
// Comprehensive activity logger with ring buffer, localStorage persistence,
// performance tracking, and UI log viewer.

import { state, els as _els } from './state.js';

/** @type {Record<string, any>} */
const els = _els;
import { APP_VERSION, NOVAREADER_PLAN_PROGRESS_PERCENT } from './constants.js';
import { yieldToMainThread } from './utils.js';
import { getPerfSummary, pageRenderCache, objectUrlRegistry } from './perf.js';
import { ensurePdfJs, ensureDjVuJs } from './loaders.js';
import { isTesseractAvailable } from './tesseract-adapter.js';
import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

// ─── Ring Buffer Configuration ──────────────────────────────────────────────
const LOG_STORAGE_KEY = 'novareader-activity-log';
const LOG_MAX_ENTRIES = 5000;
const LOG_PERSIST_DEBOUNCE_MS = 2000;

// ─── Activity Log Ring Buffer ───────────────────────────────────────────────
/** @type {Array<LogEntry>} */
let _logBuffer = [];
let _persistTimer = null;

/**
 * @typedef {object} LogEntry
 * @property {string} ts - ISO timestamp
 * @property {string} module - Source module name (e.g. 'ocr', 'pdf', 'annotations')
 * @property {string} action - Action description
 * @property {'debug'|'info'|'warn'|'error'} level
 * @property {object} [data] - Optional structured payload
 * @property {number} [durationMs] - Optional operation duration
 * @property {string} [stack] - Error stack trace (for errors)
 */

/** Load persisted logs from localStorage on module init */
function _loadPersistedLogs() {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        _logBuffer = parsed.slice(-LOG_MAX_ENTRIES);
        return;
      }
    }
  } catch (_err) {
    // Corrupted data — start fresh
  }
  _logBuffer = [];
}

/** Persist log buffer to localStorage (debounced) */
function _schedulePersist() {
  if (_persistTimer) return;
  _persistTimer = safeTimeout(() => {
    _persistTimer = null;
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(_logBuffer));
    } catch (_err) {
      // Storage full — trim buffer and retry once
      _logBuffer = _logBuffer.slice(-Math.floor(LOG_MAX_ENTRIES / 2));
      try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(_logBuffer));
      } catch (_e2) {
        // Give up silently
      }
    }
  }, LOG_PERSIST_DEBOUNCE_MS);
}

// Initialize buffer from localStorage
_loadPersistedLogs();

// ─── Core Logging Function ──────────────────────────────────────────────────

/**
 * Universal activity logger. Call from anywhere to record an action.
 * @param {string} module - Module name (e.g. 'ocr', 'pdf', 'annotations', 'search', 'file')
 * @param {string} action - Action description (e.g. 'page.rendered', 'file.opened')
 * @param {object} [data] - Optional structured data
 * @param {'debug'|'info'|'warn'|'error'} [level='info'] - Log level
 */
export function novaLog(module, action, data = {}, level = 'info') {
  const entry = {
    ts: new Date().toISOString(),
    module,
    action,
    level,
  };

  // Only add data if it has content
  if (data && typeof data === 'object') {
    // Capture stack trace for errors
    if (level === 'error' && data.error instanceof Error) {
      entry.stack = data.error.stack || '';
      entry.data = { ...data, error: data.error.message };
    } else if (level === 'error' && data.stack) {
      entry.stack = data.stack;
      entry.data = data;
    } else {
      entry.data = data;
    }
  }

  _logBuffer.push(entry);

  // Ring buffer: trim when exceeding max
  if (_logBuffer.length > LOG_MAX_ENTRIES) {
    _logBuffer.splice(0, _logBuffer.length - LOG_MAX_ENTRIES);
  }

  _schedulePersist();
  _updateLogViewerBadge();
}

/**
 * Wrap an async function to automatically log its execution with timing.
 * @param {string} module - Module name
 * @param {string} action - Action description
 * @param {Function} fn - The async function to track
 * @returns {Function} Wrapped function that logs start, duration, and errors
 */
export function withPerformanceLog(module, action, fn) {
  return async function trackedFn(...args) {
    const start = performance.now();
    novaLog(module, `${action}.start`, {}, 'debug');
    try {
      const result = await fn.apply(this, args);
      const durationMs = Math.round(performance.now() - start);
      novaLog(module, `${action}.done`, { durationMs }, 'info');
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      novaLog(module, `${action}.error`, {
        durationMs,
        message: err?.message || 'unknown',
        error: err,
      }, 'error');
      throw err;
    }
  };
}

/**
 * Create a scoped logger for a specific module.
 * @param {string} module - Module name
 * @returns {{ debug, info, warn, error, timed }}
 */
export function createModuleLogger(module) {
  return {
    debug: (action, data) => novaLog(module, action, data, 'debug'),
    info: (action, data) => novaLog(module, action, data, 'info'),
    warn: (action, data) => novaLog(module, action, data, 'warn'),
    error: (action, data) => novaLog(module, action, data, 'error'),
    timed: (action, fn) => withPerformanceLog(module, action, fn),
  };
}

// ─── Console.warn Interception ──────────────────────────────────────────────
const _originalConsoleWarn = console.warn;
const _originalConsoleError = console.error;
let _consoleIntercepted = false;

function _interceptConsole() {
  if (_consoleIntercepted) return;
  _consoleIntercepted = true;
  console.warn = function interceptedWarn(...args) {
    _originalConsoleWarn.apply(console, args);
    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    novaLog('console', 'warn', { message }, 'warn');
  };
  console.error = function interceptedError(...args) {
    _originalConsoleError.apply(console, args);
    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    novaLog('console', 'error', { message }, 'error');
  };
}

// ─── Log Retrieval & Export ─────────────────────────────────────────────────

/** Get all log entries (newest last) */
export function getLogEntries() {
  return _logBuffer;
}

/** Get the total count of log entries */
export function getLogCount() {
  return _logBuffer.length;
}

/**
 * Get filtered log entries.
 * @param {object} [filters]
 * @param {string} [filters.module] - Filter by module name
 * @param {string} [filters.level] - Filter by level (debug/info/warn/error)
 * @param {string} [filters.search] - Search in action/data text
 * @param {number} [filters.limit=200] - Max entries to return
 * @returns {Array<LogEntry>}
 */
export function getFilteredLogs(filters = {}) {
  let entries = _logBuffer;

  if (filters.module) {
    entries = entries.filter((e) => e.module === filters.module);
  }
  if (filters.level) {
    entries = entries.filter((e) => e.level === filters.level);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter((e) => {
      const text = `${e.module} ${e.action} ${JSON.stringify(e.data || {})}`.toLowerCase();
      return text.includes(q);
    });
  }

  const limit = filters.limit || 200;
  return entries.slice(-limit);
}

/** Clear all logs from buffer and localStorage */
export function clearActivityLog() {
  _logBuffer = [];
  try {
    localStorage.removeItem(LOG_STORAGE_KEY);
  } catch (_err) {
    // Ignore
  }
  _updateLogViewerBadge();
}

/**
 * Export all logs as a JSON blob and trigger download.
 */
export function exportLogsAsJson() {
  const payload = {
    app: 'NovaReader',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    sessionId: state.diagnostics.sessionId,
    docName: state.docName || null,
    totalEntries: _logBuffer.length,
    entries: _logBuffer,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novareader-logs-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  novaLog('diagnostics', 'logs.exported', { count: _logBuffer.length });
}

// ─── Log Viewer UI ──────────────────────────────────────────────────────────

let _logViewerVisible = false;

function _updateLogViewerBadge() {
  const badge = document.getElementById('logViewerBadge');
  if (badge) {
    const errorCount = _logBuffer.filter((e) => e.level === 'error').length;
    const warnCount = _logBuffer.filter((e) => e.level === 'warn').length;
    if (errorCount > 0) {
      badge.textContent = String(errorCount);
      badge.className = 'log-viewer-badge log-viewer-badge--error';
    } else if (warnCount > 0) {
      badge.textContent = String(warnCount);
      badge.className = 'log-viewer-badge log-viewer-badge--warn';
    } else {
      badge.textContent = '';
      badge.className = 'log-viewer-badge';
    }
  }
}

/**
 * Toggle visibility of the log viewer panel.
 */
export function toggleLogViewer() {
  _logViewerVisible = !_logViewerVisible;
  const panel = document.getElementById('logViewerPanel');
  if (panel) {
    panel.style.display = _logViewerVisible ? 'flex' : 'none';
    if (_logViewerVisible) {
      renderLogViewer();
    }
  }
}

/**
 * Render the log viewer entries into the panel.
 */
export function renderLogViewer() {
  const list = document.getElementById('logViewerList');
  /** @type {any} */
  const filterModule = document.getElementById('logFilterModule');
  /** @type {any} */
  const filterLevel = document.getElementById('logFilterLevel');
  /** @type {any} */
  const filterSearch = document.getElementById('logFilterSearch');
  if (!list) return;

  const filters = {
    module: filterModule?.value || '',
    level: filterLevel?.value || '',
    search: filterSearch?.value || '',
    limit: 300,
  };
  const entries = getFilteredLogs(filters);

  // Populate module dropdown dynamically (only once per element)
  if (filterModule && !filterModule.dataset.initialized && filterModule.childElementCount <= 1) {
    const modules = [...new Set(_logBuffer.map((e) => e.module))].sort();
    for (const mod of modules) {
      const opt = document.createElement('option');
      opt.value = mod;
      opt.textContent = mod;
      filterModule.appendChild(opt);
    }
    filterModule.dataset.initialized = 'true';
  }

  list.innerHTML = '';
  const frag = document.createDocumentFragment();
  // Render in reverse (newest first)
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const row = document.createElement('div');
    row.className = `log-entry log-entry--${entry.level}`;

    const ts = document.createElement('span');
    ts.className = 'log-ts';
    ts.textContent = entry.ts.substring(11, 23); // HH:MM:SS.mmm

    const lvl = document.createElement('span');
    lvl.className = `log-level log-level--${entry.level}`;
    lvl.textContent = entry.level.toUpperCase();

    const mod = document.createElement('span');
    mod.className = 'log-module';
    mod.textContent = entry.module;

    const act = document.createElement('span');
    act.className = 'log-action';
    act.textContent = entry.action;

    row.appendChild(ts);
    row.appendChild(lvl);
    row.appendChild(mod);
    row.appendChild(act);

    if (entry.data && Object.keys(entry.data).length > 0) {
      const dataEl = document.createElement('span');
      dataEl.className = 'log-data';
      dataEl.textContent = JSON.stringify(entry.data);
      row.appendChild(dataEl);
    }

    if (entry.stack) {
      const stackEl = document.createElement('details');
      stackEl.className = 'log-stack';
      const summary = document.createElement('summary');
      summary.textContent = 'Stack trace';
      stackEl.appendChild(summary);
      const pre = document.createElement('pre');
      pre.textContent = entry.stack;
      stackEl.appendChild(pre);
      row.appendChild(stackEl);
    }

    frag.appendChild(row);
  }
  list.appendChild(frag);

  // Update count
  const countEl = document.getElementById('logViewerCount');
  if (countEl) {
    countEl.textContent = `${entries.length} / ${_logBuffer.length} entries`;
  }
}

/**
 * Initialize log viewer event bindings.
 * Call this after the DOM is ready.
 */
export function initLogViewer() {
  const toggleBtn = document.getElementById('toggleLogViewer');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleLogViewer);
  }

  const closeBtn = document.getElementById('closeLogViewer');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      _logViewerVisible = false;
      const panel = document.getElementById('logViewerPanel');
      if (panel) panel.style.display = 'none';
    });
  }

  const exportBtn = document.getElementById('exportLogsJson');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportLogsAsJson);
  }

  const clearBtn = document.getElementById('clearActivityLog');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearActivityLog();
      renderLogViewer();
    });
  }

  // Filter change handlers
  const filterModule = document.getElementById('logFilterModule');
  const filterLevel = document.getElementById('logFilterLevel');
  const filterSearch = document.getElementById('logFilterSearch');

  if (filterModule) filterModule.addEventListener('change', renderLogViewer);
  if (filterLevel) filterLevel.addEventListener('change', renderLogViewer);
  if (filterSearch) {
    let _searchTimer = null;
    filterSearch.addEventListener('input', () => {
      clearSafeTimeout(_searchTimer);
      _searchTimer = safeTimeout(renderLogViewer, 250);
    });
  }

  _updateLogViewerBadge();
}

// ─── Dependencies injected from app.js at runtime ───────────────────────────
const _deps = {
  getEditHistory: () => ({ undoCount: 0, redoCount: 0, editedPages: [], dirty: false }),
  getBatchOcrProgress: () => ({ completed: 0, total: 0, percent: 0, running: false, queueLength: 0, confidenceStats: {} }),
  getSessionHealth: () => ({ sessionId: '', uptimeMs: 0, totalErrors: 0, crashes: 0, crashFreeRate: 100 }),
  getOcrSearchIndexSize: () => 0,
  getToolMode: () => 'idle',
};

/** @param {any} deps @returns {any} */
export function initDiagnosticsDeps(deps) {
  Object.assign(_deps, deps);
}

/** @param {any} type @param {any} payload @param {any} level @returns {any} */
export function pushDiagnosticEvent(type, payload = {}, level = 'info') {
  const event = {
    ts: new Date().toISOString(),
    level,
    type,
    payload,
  };
  const store = state.diagnostics;
  store.events.push(event);
  if (store.events.length > store.maxEvents) {
    store.events.splice(0, store.events.length - store.maxEvents);
  }
  if (els.diagnosticsStatus) {
    els.diagnosticsStatus.textContent = `${store.events.length} событий`;
  }

  // Also record into the activity log
  novaLog('diagnostics', type, payload, level);
}

/** @returns {any} */
export function clearDiagnostics() {
  state.diagnostics.events = [];
  if (els.diagnosticsStatus) {
    els.diagnosticsStatus.textContent = '';
  }
}

/** @returns {any} */
export function collectPerfBaseline() {
  const nav = performance.getEntriesByType('navigation')?.[0] || null;
  const longTasks = performance.getEntriesByType('longtask') || [];
  const resources = performance.getEntriesByType('resource') || [];
  const memory = /** @type {any} */ (performance)?.memory
    ? {
      usedJSHeapSize: Number(/** @type {any} */ (performance).memory.usedJSHeapSize || 0),
      totalJSHeapSize: Number(/** @type {any} */ (performance).memory.totalJSHeapSize || 0),
      jsHeapSizeLimit: Number(/** @type {any} */ (performance).memory.jsHeapSizeLimit || 0),
    }
    : null;

  return {
    ts: new Date().toISOString(),
    uptimeMs: Math.round(performance.now()),
    navigation: nav
      ? {
        type: /** @type {any} */ (nav).type || 'navigate',
        domContentLoadedMs: Math.round(/** @type {any} */ (nav).domContentLoadedEventEnd || 0),
        loadEventMs: Math.round(/** @type {any} */ (nav).loadEventEnd || 0),
      }
      : null,
    longTask: {
      count: longTasks.length,
      maxMs: longTasks.length ? Math.round(Math.max(...longTasks.map((x) => x.duration || 0))) : 0,
      totalMs: longTasks.length ? Math.round(longTasks.reduce((sum, x) => sum + (x.duration || 0), 0)) : 0,
    },
    resources: {
      count: resources.length,
    },
    memory,
    perfMetricsSummary: getPerfSummary(),
    editHistory: _deps.getEditHistory(),
    batchOcrProgress: _deps.getBatchOcrProgress(),
    toolMode: _deps.getToolMode(),
    pageCacheSize: pageRenderCache.entries.size,
    trackedUrls: objectUrlRegistry.size,
    ocrSearchIndexPages: _deps.getOcrSearchIndexSize(),
    sessionHealth: _deps.getSessionHealth(),
  };
}

/** @param {any} payload @returns {any} */
export function formatDiagnosticsForChat(payload) {
  const lines = [];
  lines.push('# NovaReader diagnostics');
  lines.push(`appVersion: ${payload.appVersion}`);
  lines.push(`sessionId: ${payload.sessionId}`);
  lines.push(`exportedAt: ${payload.exportedAt}`);
  lines.push(`docName: ${payload.docName || '-'}`);
  lines.push(`page: ${payload.page ?? '-'}`);
  lines.push(`eventCount: ${payload.eventCount}`);
  lines.push(`uptimeMs: ${payload.perf?.uptimeMs ?? '-'}`);
  lines.push(`longTaskCount: ${payload.perf?.longTask?.count ?? '-'}`);
  lines.push(`longTaskMaxMs: ${payload.perf?.longTask?.maxMs ?? '-'}`);
  lines.push(`resourceCount: ${payload.perf?.resources?.count ?? '-'}`);
  lines.push('');
  lines.push('perf:');
  lines.push(JSON.stringify(payload.perf || {}, null, 0));
  lines.push('');
  if (payload.perf?.perfMetricsSummary) {
    lines.push('perfMetrics (p95):');
    lines.push(JSON.stringify(payload.perf.perfMetricsSummary, null, 0));
    lines.push('');
  }
  if (payload.perf?.editHistory) {
    lines.push(`editHistory: undo=${payload.perf.editHistory.undoCount} redo=${payload.perf.editHistory.redoCount} dirty=${payload.perf.editHistory.dirty}`);
    lines.push('');
  }
  lines.push('events:');
  payload.events.forEach((event, idx) => {
    const payloadText = JSON.stringify(event.payload || {}, null, 0);
    lines.push(`${idx + 1}. [${event.ts}] [${event.level}] ${event.type} ${payloadText}`);
  });
  return lines.join('\n');
}

/** @returns {any} */
export function exportDiagnostics() {
  const payload = {
    appVersion: APP_VERSION,
    sessionId: state.diagnostics.sessionId,
    exportedAt: new Date().toISOString(),
    docName: state.docName || null,
    page: state.currentPage || null,
    eventCount: state.diagnostics.events.length,
    events: state.diagnostics.events,
    perf: collectPerfBaseline(),
  };
  const text = formatDiagnosticsForChat(payload);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novareader-diagnostics-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  pushDiagnosticEvent('diagnostics.export', {
    eventCount: payload.eventCount,
    format: 'txt',
    uptimeMs: payload.perf?.uptimeMs || 0,
    longTaskCount: payload.perf?.longTask?.count || 0,
  });
}

/** @returns {Promise<any>} */
export async function verifyBundledAssets() {
  const assets = [
    { key: 'pdfRuntime', url: new URL('../../node_modules/pdfjs-dist/build/pdf.mjs', import.meta.url).href },
    { key: 'pdfWorker', url: new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href },
    { key: 'djvuRuntime', url: new URL('../vendor/djvu.js', import.meta.url).href },
    { key: 'ocrRuntime', url: new URL('../../node_modules/tesseract.js/dist/tesseract.esm.min.js', import.meta.url).href },
  ];

  const report = {};
  let okCount = 0;

  for (const asset of assets) {
    try {
      const res = await fetch(asset.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const size = text.length;
      report[asset.key] = { ok: size > 0, size, message: size > 0 ? 'ok' : 'empty file' };
      if (size > 0) okCount += 1;
    } catch (error) {
      report[asset.key] = { ok: false, size: 0, message: error?.message || 'fetch failed' };
    }
    await yieldToMainThread();
  }

  return {
    okCount,
    total: assets.length,
    report,
  };
}

/** @returns {Promise<any>} */
export async function runRuntimeSelfCheck() {
  const startedAt = performance.now();
  const report = {
    pdf: { ok: false, message: '' },
    djvu: { ok: false, message: '' },
    ocr: { ok: false, message: '' },
  };

  const checkOne = async (name, fn) => {
    try {
      await fn();
      report[name] = { ok: true, message: 'ok (bundled runtime loaded)' };
    } catch (error) {
      report[name] = { ok: false, message: error?.message || 'load failed' };
      pushDiagnosticEvent('runtime.selfcheck.failure', { module: name, message: report[name].message }, 'error');
    }
  };

  await checkOne('pdf', ensurePdfJs);
  await checkOne('djvu', ensureDjVuJs);
  await checkOne('ocr', async () => {
    const avail = await isTesseractAvailable();
    if (!avail) throw new Error('Tesseract.js not available');
  });

  const bundledAssets = await verifyBundledAssets();
  report.assets = {
    ok: bundledAssets.okCount === bundledAssets.total,
    message: `${bundledAssets.okCount}/${bundledAssets.total} файлов доступны`,
    details: bundledAssets.report,
  };

  const totalMs = Math.round(performance.now() - startedAt);
  const okCount = Object.values(report).filter((x) => x.ok).length;
  const statusText = `Runtime check: ${okCount}/4 проверок доступны, ${totalMs}ms`;
  if (els.runtimeCheckStatus) {
    els.runtimeCheckStatus.textContent = statusText;
  }

  pushDiagnosticEvent('runtime.selfcheck.finish', {
    okCount,
    total: 4,
    ms: totalMs,
    report,
  }, okCount === 4 ? 'info' : 'warn');
}

/** @returns {any} */
export function setupRuntimeDiagnostics() {
  // Intercept console.warn and console.error
  _interceptConsole();

  window.addEventListener('error', (event) => {
    pushDiagnosticEvent('runtime.error', {
      message: event?.message || 'Unknown error',
      source: event?.filename || null,
      line: event?.lineno || null,
      col: event?.colno || null,
    }, 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    pushDiagnosticEvent('runtime.unhandledrejection', {
      message: reason?.message || String(reason || 'Unknown rejection'),
    }, 'error');
  });

  if (typeof PerformanceObserver === 'function') {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration >= 50) {
            pushDiagnosticEvent('perf.longtask', {
              name: entry.name || 'longtask',
              duration: Math.round(entry.duration),
            }, 'warn');
          }
        });
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (err) {
      _originalConsoleWarn('[diagnostics] error:', err?.message);
      pushDiagnosticEvent('perf.observer.unavailable', {}, 'warn');
    }
  }

  pushDiagnosticEvent('runtime.diagnostics.ready', { userAgent: navigator.userAgent });
  pushDiagnosticEvent('runtime.plan.progress', { percent: NOVAREADER_PLAN_PROGRESS_PERCENT });

  // Initialize the log viewer UI
  initLogViewer();
}
