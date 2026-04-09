// ─── Unit Tests: Logger ───────────────────────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  Logger,
  logger,
  debug,
  info,
  warn,
  error,
} from '../../app/modules/logger.ts';

// ─── Console mock setup ──────────────────────────────────────────────────────

const calls = { debug: [], info: [], warn: [], error: [] };
const orig = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

beforeEach(() => {
  for (const level of Object.keys(calls)) {
    calls[level] = [];
    console[level] = (...args) => calls[level].push(args);
  }
});

afterEach(() => {
  for (const level of Object.keys(orig)) console[level] = orig[level];
});

// ─── Constructor & defaults ──────────────────────────────────────────────────

describe('new Logger() – defaults', () => {
  it('creates a logger with default config', () => {
    const log = new Logger();
    assert.equal(log.config.level, 'info');
    assert.equal(log.config.maxHistory, 100);
    assert.equal(log.config.context, undefined);
    assert.equal(log.config.onLog, undefined);
  });

  it('merges provided config with defaults', () => {
    const log = new Logger({ level: 'debug', context: 'test' });
    assert.equal(log.config.level, 'debug');
    assert.equal(log.config.context, 'test');
    assert.equal(log.config.maxHistory, 100);
  });

  it('starts with an empty history', () => {
    const log = new Logger();
    assert.deepEqual(log.getHistory(), []);
  });
});

// ─── info() ──────────────────────────────────────────────────────────────────

describe('info()', () => {
  it('logs a message to console.info', () => {
    const log = new Logger();
    log.info('hello');
    assert.equal(calls.info.length, 1);
    assert.ok(calls.info[0][0].includes('hello'));
  });

  it('includes data in console output when provided', () => {
    const log = new Logger();
    log.info('msg', { key: 'value' });
    assert.equal(calls.info.length, 1);
    assert.deepEqual(calls.info[0][1], { key: 'value' });
  });

  it('does not append data arg when data is undefined', () => {
    const log = new Logger();
    log.info('msg');
    assert.equal(calls.info[0].length, 1);
  });

  it('adds entry to history', () => {
    const log = new Logger();
    log.info('hello');
    const history = log.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].level, 'info');
    assert.equal(history[0].message, 'hello');
  });

  it('sets a timestamp on the entry', () => {
    const before = Date.now();
    const log = new Logger();
    log.info('ts test');
    const after = Date.now();
    const { timestamp } = log.getHistory()[0];
    assert.ok(timestamp >= before && timestamp <= after);
  });
});

// ─── debug() ─────────────────────────────────────────────────────────────────

describe('debug()', () => {
  it('is suppressed at default level (info)', () => {
    const log = new Logger(); // default level: 'info'
    log.debug('should not appear');
    assert.equal(calls.debug.length, 0);
  });

  it('is suppressed when level is warn', () => {
    const log = new Logger({ level: 'warn' });
    log.debug('quiet');
    assert.equal(calls.debug.length, 0);
  });

  it('is emitted when level is debug', () => {
    const log = new Logger({ level: 'debug' });
    log.debug('verbose');
    assert.equal(calls.debug.length, 1);
  });

  it('does not add to history when suppressed', () => {
    const log = new Logger(); // level: 'info'
    log.debug('hidden');
    assert.equal(log.getHistory().length, 0);
  });
});

// ─── warn() ──────────────────────────────────────────────────────────────────

describe('warn()', () => {
  it('is emitted at default level (info)', () => {
    const log = new Logger();
    log.warn('careful');
    assert.equal(calls.warn.length, 1);
  });

  it('is suppressed when level is error', () => {
    const log = new Logger({ level: 'error' });
    log.warn('ignored');
    assert.equal(calls.warn.length, 0);
  });

  it('records warn entry in history', () => {
    const log = new Logger();
    log.warn('careful');
    assert.equal(log.getHistory()[0].level, 'warn');
  });
});

// ─── error() ─────────────────────────────────────────────────────────────────

describe('error()', () => {
  it('is always emitted regardless of configured level', () => {
    for (const level of ['debug', 'info', 'warn', 'error']) {
      calls.error = [];
      const log = new Logger({ level });
      log.error('boom');
      assert.equal(calls.error.length, 1, `level=${level} should emit error`);
    }
  });

  it('records error entry in history', () => {
    const log = new Logger();
    log.error('boom');
    assert.equal(log.getHistory()[0].level, 'error');
  });
});

// ─── getHistory() ─────────────────────────────────────────────────────────────

describe('getHistory()', () => {
  it('returns a copy of the history array', () => {
    const log = new Logger();
    log.info('a');
    const h1 = log.getHistory();
    const h2 = log.getHistory();
    assert.notEqual(h1, h2); // different array references
    assert.deepEqual(h1, h2);
  });

  it('accumulates multiple entries in order', () => {
    const log = new Logger();
    log.info('first');
    log.warn('second');
    log.error('third');
    const history = log.getHistory();
    assert.equal(history.length, 3);
    assert.equal(history[0].message, 'first');
    assert.equal(history[1].message, 'second');
    assert.equal(history[2].message, 'third');
  });

  it('stores data in history entry', () => {
    const log = new Logger();
    log.info('with data', 42);
    assert.equal(log.getHistory()[0].data, 42);
  });

  it('does not set data key when data is undefined', () => {
    const log = new Logger();
    log.info('no data');
    assert.equal(Object.prototype.hasOwnProperty.call(log.getHistory()[0], 'data'), false);
  });

  it('caps history at maxHistory and drops oldest', () => {
    const log = new Logger({ maxHistory: 3 });
    log.info('a');
    log.info('b');
    log.info('c');
    log.info('d'); // should drop 'a'
    const history = log.getHistory();
    assert.equal(history.length, 3);
    assert.equal(history[0].message, 'b');
    assert.equal(history[2].message, 'd');
  });
});

// ─── clearHistory() ──────────────────────────────────────────────────────────

describe('clearHistory()', () => {
  it('empties the history', () => {
    const log = new Logger();
    log.info('a');
    log.info('b');
    log.clearHistory();
    assert.deepEqual(log.getHistory(), []);
  });

  it('allows new entries after clearing', () => {
    const log = new Logger();
    log.info('old');
    log.clearHistory();
    log.info('new');
    assert.equal(log.getHistory().length, 1);
    assert.equal(log.getHistory()[0].message, 'new');
  });
});

// ─── child() ─────────────────────────────────────────────────────────────────

describe('child()', () => {
  it('creates a new Logger instance', () => {
    const log = new Logger();
    const child = log.child('sub');
    assert.ok(child instanceof Logger);
    assert.notEqual(child, log);
  });

  it('sets context on child when parent has no context', () => {
    const log = new Logger();
    const child = log.child('module');
    assert.equal(child.config.context, 'module');
  });

  it('prefixes parent context with dot separator', () => {
    const log = new Logger({ context: 'app' });
    const child = log.child('module');
    assert.equal(child.config.context, 'app.module');
  });

  it('includes context in console output', () => {
    const log = new Logger({ context: 'app' });
    log.info('test message');
    assert.ok(calls.info[0][0].includes('[app]'));
  });

  it('inherits parent log level', () => {
    const log = new Logger({ level: 'warn' });
    const child = log.child('sub');
    assert.equal(child.config.level, 'warn');
  });

  it('does not share history with parent', () => {
    const log = new Logger();
    const child = log.child('sub');
    log.info('parent msg');
    child.info('child msg');
    assert.equal(log.getHistory().length, 1);
    assert.equal(child.getHistory().length, 1);
    assert.equal(log.getHistory()[0].message, 'parent msg');
    assert.equal(child.getHistory()[0].message, 'child msg');
  });
});

// ─── onLog callback ───────────────────────────────────────────────────────────

describe('onLog callback', () => {
  it('is called for each emitted log entry', () => {
    const logged = [];
    const log = new Logger({ onLog: (entry) => logged.push(entry) });
    log.info('one');
    log.warn('two');
    assert.equal(logged.length, 2);
    assert.equal(logged[0].message, 'one');
    assert.equal(logged[1].message, 'two');
  });

  it('receives the full entry object', () => {
    let received = null;
    const log = new Logger({ onLog: (entry) => { received = entry; } });
    log.error('oops', { detail: true });
    assert.equal(received.level, 'error');
    assert.equal(received.message, 'oops');
    assert.deepEqual(received.data, { detail: true });
    assert.equal(typeof received.timestamp, 'number');
  });

  it('is not called for suppressed levels', () => {
    const logged = [];
    const log = new Logger({ level: 'info', onLog: (entry) => logged.push(entry) });
    log.debug('silent');
    assert.equal(logged.length, 0);
  });

  it('receives context when set', () => {
    let received = null;
    const log = new Logger({ context: 'ctx', onLog: (entry) => { received = entry; } });
    log.info('hi');
    assert.equal(received.context, 'ctx');
  });
});

// ─── Global logger & convenience functions ───────────────────────────────────

describe('global logger and convenience functions', () => {
  it('logger is a Logger instance', () => {
    assert.ok(logger instanceof Logger);
  });

  it('debug() is a function', () => {
    assert.equal(typeof debug, 'function');
  });

  it('info() is a function', () => {
    assert.equal(typeof info, 'function');
  });

  it('warn() is a function', () => {
    assert.equal(typeof warn, 'function');
  });

  it('error() is a function', () => {
    assert.equal(typeof error, 'function');
  });

  it('convenience warn() writes to console.warn', () => {
    warn('global warn');
    assert.equal(calls.warn.length, 1);
  });

  it('convenience error() writes to console.error', () => {
    error('global error');
    assert.equal(calls.error.length, 1);
  });
});
