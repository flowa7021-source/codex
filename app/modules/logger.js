// @ts-check
// ─── Structured Logger ──────────────────────────────────────────────────────
// Centralized logging with levels, tags, and integration with diagnostics.
// Replaces ad-hoc console.log/warn/error throughout the codebase.

/** @typedef {'debug'|'info'|'warn'|'error'} LogLevel */

const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };

/** @type {LogLevel} Minimum level to output */
let _minLevel = 'info';

/** @type {Array<(entry: LogEntry) => void>} */
const _sinks = [];

/**
 * @typedef {object} LogEntry
 * @property {string} ts - ISO timestamp
 * @property {LogLevel} level
 * @property {string} tag - Module/context tag, e.g. '[ocr]', '[render]'
 * @property {string} msg
 * @property {object} [data] - Optional structured data
 */

/**
 * Set minimum log level. In production, set to 'warn'.
 * @param {LogLevel} level
 */
export function setLogLevel(level) {
  if (LEVEL_PRIORITY[level] !== undefined) _minLevel = level;
}

/**
 * Register a log sink (e.g. diagnostics event store, remote telemetry).
 * @param {(entry: LogEntry) => void} sink
 * @returns {() => void} unsubscribe
 */
export function addLogSink(sink) {
  _sinks.push(sink);
  return () => {
    const idx = _sinks.indexOf(sink);
    if (idx >= 0) _sinks.splice(idx, 1);
  };
}

function _emit(level, tag, msg, data) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[_minLevel]) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    tag,
    msg,
    data: data ?? undefined,
  };

  // Console output
  const prefix = `[${tag}]`;
  switch (level) {
  case 'debug': console.debug(prefix, msg, data ?? ''); break;
  case 'info':  console.info(prefix, msg, data ?? '');  break;
  case 'warn':  console.warn(prefix, msg, data ?? '');  break;
  case 'error': console.error(prefix, msg, data ?? ''); break;
  }

  // Notify sinks
  for (const sink of _sinks) {
    try { sink(entry); } catch (err) { console.warn('[logger] error:', err?.message); }
  }
}

/**
 * Create a tagged logger for a specific module.
 * @param {string} tag - Module name, e.g. 'ocr', 'render', 'pdf-ops'
 * @returns {{ debug, info, warn, error }}
 */
export function createLogger(tag) {
  return {
    debug: (msg, data) => _emit('debug', tag, msg, data),
    info:  (msg, data) => _emit('info',  tag, msg, data),
    warn:  (msg, data) => _emit('warn',  tag, msg, data),
    error: (msg, data) => _emit('error', tag, msg, data),
  };
}

/** Convenience: top-level log functions with explicit tag parameter */
export const log = {
  debug: (tag, msg, data) => _emit('debug', tag, msg, data),
  info:  (tag, msg, data) => _emit('info',  tag, msg, data),
  warn:  (tag, msg, data) => _emit('warn',  tag, msg, data),
  error: (tag, msg, data) => _emit('error', tag, msg, data),
};
