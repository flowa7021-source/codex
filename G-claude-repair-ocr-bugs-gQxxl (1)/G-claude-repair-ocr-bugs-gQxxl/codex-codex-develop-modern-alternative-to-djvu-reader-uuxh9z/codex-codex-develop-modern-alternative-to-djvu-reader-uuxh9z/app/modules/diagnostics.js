// ─── Diagnostics Module ─────────────────────────────────────────────────────
// Self-contained diagnostics with dependency injection for app-level functions.

import { state, els } from './state.js';
import { APP_VERSION, NOVAREADER_PLAN_PROGRESS_PERCENT } from './constants.js';
import { yieldToMainThread } from './utils.js';
import { getPerfSummary, pageRenderCache, objectUrlRegistry } from './perf.js';
import { ensurePdfJs, ensureDjVuJs } from './loaders.js';
import { isTesseractAvailable } from './tesseract-adapter.js';

// Dependencies injected from app.js at runtime
const _deps = {
  getEditHistory: () => ({ undoCount: 0, redoCount: 0, editedPages: [], dirty: false }),
  getBatchOcrProgress: () => ({ completed: 0, total: 0, percent: 0, running: false, queueLength: 0, confidenceStats: {} }),
  getSessionHealth: () => ({ sessionId: '', uptimeMs: 0, totalErrors: 0, crashes: 0, crashFreeRate: 100 }),
  getOcrSearchIndexSize: () => 0,
  getToolMode: () => 'idle',
};

export function initDiagnosticsDeps(deps) {
  Object.assign(_deps, deps);
}

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
}

export function clearDiagnostics() {
  state.diagnostics.events = [];
  if (els.diagnosticsStatus) {
    els.diagnosticsStatus.textContent = '';
  }
}

export function collectPerfBaseline() {
  const nav = performance.getEntriesByType('navigation')?.[0] || null;
  const longTasks = performance.getEntriesByType('longtask') || [];
  const resources = performance.getEntriesByType('resource') || [];
  const memory = performance?.memory
    ? {
      usedJSHeapSize: Number(performance.memory.usedJSHeapSize || 0),
      totalJSHeapSize: Number(performance.memory.totalJSHeapSize || 0),
      jsHeapSizeLimit: Number(performance.memory.jsHeapSizeLimit || 0),
    }
    : null;

  return {
    ts: new Date().toISOString(),
    uptimeMs: Math.round(performance.now()),
    navigation: nav
      ? {
        type: nav.type || 'navigate',
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
        loadEventMs: Math.round(nav.loadEventEnd || 0),
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

export async function verifyBundledAssets() {
  const assets = [
    { key: 'pdfRuntime', url: new URL('../vendor/pdf.min.mjs', import.meta.url).href },
    { key: 'pdfWorker', url: new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href },
    { key: 'djvuRuntime', url: new URL('../vendor/djvu.js', import.meta.url).href },
    { key: 'ocrRuntime', url: new URL('../vendor/tesseract/tesseract.esm.min.js', import.meta.url).href },
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
  const status = `Runtime check: ${okCount}/4 проверок доступны, ${totalMs}ms`;
  if (els.runtimeCheckStatus) {
    els.runtimeCheckStatus.textContent = status;
  }

  pushDiagnosticEvent('runtime.selfcheck.finish', {
    okCount,
    total: 4,
    ms: totalMs,
    report,
  }, okCount === 4 ? 'info' : 'warn');
}

export function setupRuntimeDiagnostics() {
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
      console.warn('[diagnostics] error:', err?.message);
      pushDiagnosticEvent('perf.observer.unavailable', {}, 'warn');
    }
  }

  pushDiagnosticEvent('runtime.diagnostics.ready', { userAgent: navigator.userAgent });
  pushDiagnosticEvent('runtime.plan.progress', { percent: NOVAREADER_PLAN_PROGRESS_PERCENT });
}
