// ─── Unit Tests: Logger ─────────────────────────────────────────────────────
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  setLogLevel,
  addLogSink,
  createLogger,
  log,
} from '../../app/modules/logger.js';

// Capture console output for assertions
let captured = { debug: [], info: [], warn: [], error: [] };
const origConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

beforeEach(() => {
  captured = { debug: [], info: [], warn: [], error: [] };
  console.debug = (...args) => captured.debug.push(args);
  console.info = (...args) => captured.info.push(args);
  console.warn = (...args) => captured.warn.push(args);
  console.error = (...args) => captured.error.push(args);
  // Reset to default level
  setLogLevel('info');
});

afterEach(() => {
  console.debug = origConsole.debug;
  console.info = origConsole.info;
  console.warn = origConsole.warn;
  console.error = origConsole.error;
});

describe('log – level methods', () => {
  it('log.info outputs to console.info', () => {
    log.info('test', 'hello');
    assert.equal(captured.info.length, 1);
    assert.equal(captured.info[0][0], '[test]');
    assert.equal(captured.info[0][1], 'hello');
  });

  it('log.warn outputs to console.warn', () => {
    log.warn('mod', 'warning msg');
    assert.equal(captured.warn.length, 1);
    assert.equal(captured.warn[0][0], '[mod]');
    assert.equal(captured.warn[0][1], 'warning msg');
  });

  it('log.error outputs to console.error', () => {
    log.error('mod', 'error msg');
    assert.equal(captured.error.length, 1);
    assert.equal(captured.error[0][0], '[mod]');
    assert.equal(captured.error[0][1], 'error msg');
  });

  it('log.debug is suppressed at default info level', () => {
    log.debug('mod', 'debug msg');
    assert.equal(captured.debug.length, 0);
  });
});

describe('setLogLevel', () => {
  it('setting level to debug enables debug output', () => {
    setLogLevel('debug');
    log.debug('mod', 'visible');
    assert.equal(captured.debug.length, 1);
  });

  it('setting level to warn suppresses info', () => {
    setLogLevel('warn');
    log.info('mod', 'suppressed');
    assert.equal(captured.info.length, 0);
  });

  it('setting level to error suppresses warn', () => {
    setLogLevel('error');
    log.warn('mod', 'suppressed');
    assert.equal(captured.warn.length, 0);
  });

  it('ignores invalid level', () => {
    setLogLevel('info');
    setLogLevel('invalid-level');
    // info should still work
    log.info('mod', 'still works');
    assert.equal(captured.info.length, 1);
  });
});

describe('createLogger', () => {
  it('returns object with debug, info, warn, error methods', () => {
    const logger = createLogger('ocr');
    assert.equal(typeof logger.debug, 'function');
    assert.equal(typeof logger.info, 'function');
    assert.equal(typeof logger.warn, 'function');
    assert.equal(typeof logger.error, 'function');
  });

  it('tagged logger prefixes output with [tag]', () => {
    const logger = createLogger('render');
    logger.info('page loaded');
    assert.equal(captured.info[0][0], '[render]');
    assert.equal(captured.info[0][1], 'page loaded');
  });

  it('tagged logger passes data argument', () => {
    const logger = createLogger('pdf');
    logger.warn('issue', { page: 5 });
    assert.equal(captured.warn[0][0], '[pdf]');
    assert.equal(captured.warn[0][1], 'issue');
    assert.deepEqual(captured.warn[0][2], { page: 5 });
  });

  it('tagged logger respects log level', () => {
    setLogLevel('error');
    const logger = createLogger('mod');
    logger.info('suppressed');
    logger.warn('suppressed');
    logger.error('visible');
    assert.equal(captured.info.length, 0);
    assert.equal(captured.warn.length, 0);
    assert.equal(captured.error.length, 1);
  });
});

describe('addLogSink', () => {
  it('sink receives log entries', () => {
    const entries = [];
    const unsub = addLogSink((entry) => entries.push(entry));
    log.info('test', 'hello');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].level, 'info');
    assert.equal(entries[0].tag, 'test');
    assert.equal(entries[0].msg, 'hello');
    assert.ok(entries[0].ts); // ISO timestamp
    unsub();
  });

  it('sink receives data payload', () => {
    const entries = [];
    const unsub = addLogSink((entry) => entries.push(entry));
    log.warn('mod', 'msg', { count: 3 });
    assert.deepEqual(entries[0].data, { count: 3 });
    unsub();
  });

  it('unsubscribe removes sink', () => {
    const entries = [];
    const unsub = addLogSink((entry) => entries.push(entry));
    log.info('x', 'a');
    unsub();
    log.info('x', 'b');
    assert.equal(entries.length, 1);
  });

  it('sink errors do not crash logger', () => {
    const unsub = addLogSink(() => { throw new Error('boom'); });
    // Should not throw
    log.info('mod', 'test');
    assert.equal(captured.info.length, 1);
    unsub();
  });

  it('multiple sinks all receive entries', () => {
    const e1 = [], e2 = [];
    const u1 = addLogSink((entry) => e1.push(entry));
    const u2 = addLogSink((entry) => e2.push(entry));
    log.error('mod', 'err');
    assert.equal(e1.length, 1);
    assert.equal(e2.length, 1);
    u1();
    u2();
  });
});
