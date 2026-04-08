// @ts-check
// ─── Crash Telemetry ────────────────────────────────────────────────────────
// Session health monitoring, crash counting, error streaks, and health reports.
// Extracted from app.js Phase 5 as part of Q1.1 decomposition.

import { pushDiagnosticEvent } from './diagnostics.js';

const telemetry = {
  sessionId: `nr-${Date.now().toString(36)}`,
  startedAt: Date.now(),
  crashes: [],
  errors: [],
  totalErrors: 0,
  totalOperations: 0,
  recoveries: 0,
  longestStreak: 0,
  currentStreak: 0,
  lastErrorAt: 0,
};

/**
 * Collect the Error.cause chain into an array of messages (max 5 deep).
 * @param {unknown} err
 * @returns {string[]}
 */
export function collectErrorCauseChain(err) {
  const chain = [];
  let current = err;
  let depth = 0;
  while (current && depth < 5) {
    if (current instanceof Error) {
      chain.push(current.message);
      current = current.cause;
    } else {
      chain.push(String(current));
      break;
    }
    depth++;
  }
  return chain;
}

/**
 * Record a crash or error event.
 * @param {string} type - 'crash' | 'fatal' | 'error' | 'uncaught' | etc.
 * @param {string} message
 * @param {string} [context]
 * @param {{ page?: number, docName?: string, cause?: unknown }} [extra]
 */
export function recordCrashEvent(type, message, context, extra = {}) {
  const causeChain = extra.cause ? collectErrorCauseChain(extra.cause) : [];
  const event = {
    ts: new Date().toISOString(),
    type,
    message: String(message || '').slice(0, 500),
    context: String(context || ''),
    causeChain,
    uptimeMs: Math.round(performance.now()),
    page: extra.page,
    docName: extra.docName,
  };

  telemetry.errors.push(event);
  telemetry.totalErrors++;
  telemetry.totalOperations++;
  telemetry.lastErrorAt = Date.now();
  telemetry.currentStreak = 0;

  if (telemetry.errors.length > 200) {
    telemetry.errors.splice(0, telemetry.errors.length - 200);
  }

  if (type === 'crash' || type === 'fatal') {
    telemetry.crashes.push(event);
  }
}

/** Record a successful operation (grows the crash-free streak). */
export function recordSuccessfulOperation() {
  telemetry.totalOperations++;
  telemetry.currentStreak++;
  telemetry.longestStreak = Math.max(telemetry.longestStreak, telemetry.currentStreak);
}

/** Record a recovery from an error. */
export function recordRecovery() {
  telemetry.recoveries++;
}

/** @returns {number} Crash-free rate as percentage (0-100). */
export function getCrashFreeRate() {
  if (telemetry.totalOperations === 0) return 100;
  return Math.round(((telemetry.totalOperations - telemetry.totalErrors) / telemetry.totalOperations) * 10000) / 100;
}

/**
 * Get session health summary.
 * @returns {object}
 */
export function getSessionHealth() {
  const uptimeMs = Date.now() - telemetry.startedAt;
  return {
    sessionId: telemetry.sessionId,
    uptimeMs,
    uptimeMin: Math.round(uptimeMs / 60000),
    totalErrors: telemetry.totalErrors,
    crashes: telemetry.crashes.length,
    recoveries: telemetry.recoveries,
    crashFreeRate: getCrashFreeRate(),
    longestStreak: telemetry.longestStreak,
    currentStreak: telemetry.currentStreak,
    lastErrorAt: telemetry.lastErrorAt ? new Date(telemetry.lastErrorAt).toISOString() : null,
    errorsLast5min: telemetry.errors.filter(e => Date.now() - new Date(e.ts).getTime() < 300000).length,
  };
}

/**
 * Get recent errors for export.
 * @param {number} [count=20]
 * @returns {Array}
 */
export function getRecentErrors(count = 20) {
  return telemetry.errors.slice(-count);
}

/**
 * Initialize global error listeners for crash telemetry.
 */
export function initCrashTelemetry() {
  window.addEventListener('error', (event) => {
    recordCrashEvent('uncaught', event.message, event.filename + ':' + event.lineno);
    pushDiagnosticEvent('crash.uncaught', { message: event.message, file: event.filename, line: event.lineno }, 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = String(event.reason?.message || event.reason || 'unknown');
    recordCrashEvent('unhandled-rejection', message, 'promise');
    pushDiagnosticEvent('crash.unhandled-rejection', { message }, 'error');
  });
}

/** The raw telemetry object (for window.crashTelemetry exposure). */
export const crashTelemetry = telemetry;
