// @ts-check
// ─── Error Handling & Crash Telemetry Setup ─────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

/**
 * Initialise error boundaries, error classification, user-facing error
 * display, crash telemetry and the global unhandled-error / rejection
 * handlers.
 *
 * @param {object} deps  All external references needed by this init block.
 * @returns {{ withErrorBoundary: Function }}  Public helpers consumed by
 *   other init modules or wiring code.
 */
export function initErrorHandling(deps) {
  const {
    pushDiagnosticEvent,
    recordCrashEvent,
    initCrashTelemetry,
    showErrorFallback,
    showCriticalErrorScreen,
    toastError,
    els,
    state,
  } = deps;

  // ── helpers ──────────────────────────────────────────────────────────────

  function classifyAppError(message) {
    const m = String(message || '').toLowerCase();
    if (m.includes('runtime') || m.includes('module')) return 'runtime';
    if (m.includes('fetch') || m.includes('http') || m.includes('load') || m.includes('network')) return 'asset-load';
    if (m.includes('memory') || m.includes('out of memory') || m.includes('allocation')) return 'memory';
    if (m.includes('timeout') || m.includes('timed out')) return 'timeout';
    if (m.includes('parse') || m.includes('json') || m.includes('syntax')) return 'parse';
    if (m.includes('permission') || m.includes('security') || m.includes('cors')) return 'security';
    if (m.includes('storage') || m.includes('quota')) return 'storage';
    return 'processing';
  }

  function showUserError(context, errorType, message) {
    const contextLabels = {
      'file-open': 'Открытие файла',
      'page-render': 'Рендер страницы',
      'export-word': 'Экспорт в Word',
      'export-png': 'Экспорт PNG',
      'export-annotations': 'Экспорт аннотаций',
      'import-annotations': 'Импорт аннотаций',
      'search': 'Поиск',
      'ocr': 'Распознавание',
      'workspace-export': 'Экспорт рабочей области',
      'workspace-import': 'Импорт рабочей области',
    };
    const label = contextLabels[context] || context;
    const statusEl = els.searchStatus || els.ocrStatus || els.workspaceStatus;
    if (statusEl) {
      statusEl.textContent = `Ошибка [${label}]: ${errorType} — ${message}`;
    }
    try { toastError(`${label}: ${message}`); } catch (err) { console.warn('[app] toast in error boundary failed:', err?.message); }
    try { showErrorFallback(label, message); } catch (err) { console.warn('[app] error fallback banner failed:', err?.message); }
  }

  function withErrorBoundary(fn, context, options = {}) {
    const { silent = false, fallback = null, rethrow = false } = options;
    return async function boundaryWrapped(...args) {
      const startedAt = performance.now();
      try {
        return await fn.apply(this, args);
      } catch (error) {
        const ms = Math.round(performance.now() - startedAt);
        const message = String(error?.message || 'unknown error');
        const errorType = classifyAppError(message);
        pushDiagnosticEvent(`error-boundary.${context}`, { message, errorType, ms, context }, 'error');
        if (typeof recordCrashEvent === 'function') recordCrashEvent(errorType, message, context);
        if (!silent) {
          showUserError(context, errorType, message);
        }
        if (rethrow) throw error;
        return typeof fallback === 'function' ? fallback(error) : fallback;
      }
    };
  }

  // ── crash telemetry bootstrap ────────────────────────────────────────────
  initCrashTelemetry();

  // ── global error handlers ────────────────────────────────────────────────
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason);
    pushDiagnosticEvent('unhandled-rejection', { message: msg }, 'error');
    if (typeof recordCrashEvent === 'function') recordCrashEvent('unhandled-rejection', msg, 'global');
    if (!state.initComplete) {
      try { showCriticalErrorScreen(msg); } catch (_) { /* last resort */ }
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || 'Unknown error';
    pushDiagnosticEvent('uncaught-error', { message: msg, filename: event.filename, line: event.lineno }, 'error');
    if (typeof recordCrashEvent === 'function') recordCrashEvent('uncaught-error', msg, 'global');
    if (!state.initComplete) {
      try { showCriticalErrorScreen(msg); } catch (_) { /* last resort */ }
    }
  });

  return { withErrorBoundary };
}
