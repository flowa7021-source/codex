// ─── Unit Tests: Logger ────────────────────────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { Logger, createMemoryLogger } from '../../app/modules/logger.ts';

// ─── Console suppression setup ────────────────────────────────────────────────

const orig = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

beforeEach(() => {
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
});

afterEach(() => {
  console.debug = orig.debug;
  console.info = orig.info;
  console.warn = orig.warn;
  console.error = orig.error;
});

// ─── Level filtering ──────────────────────────────────────────────────────────

describe('Logger – level filtering', () => {
  it('debug is suppressed at default level (info)', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    logger.debug('hidden');
    assert.equal(captured.length, 0);
  });

  it('info is emitted at default level (info)', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    logger.info('visible');
    assert.equal(captured.length, 1);
  });

  it('debug is emitted when level is debug', () => {
    const captured = [];
    const logger = new Logger({ level: 'debug', transports: [(e) => captured.push(e)] });
    logger.debug('verbose');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].level, 'debug');
  });

  it('warn is suppressed when level is error', () => {
    const captured = [];
    const logger = new Logger({ level: 'error', transports: [(e) => captured.push(e)] });
    logger.warn('skipped');
    assert.equal(captured.length, 0);
  });

  it('error is emitted at any level below error', () => {
    for (const level of ['debug', 'info', 'warn', 'error']) {
      const captured = [];
      const logger = new Logger({ level, transports: [(e) => captured.push(e)] });
      logger.error('always');
      assert.equal(captured.length, 1, `error should emit at level=${level}`);
    }
  });

  it('nothing is emitted at level silent', () => {
    const captured = [];
    const logger = new Logger({ level: 'silent', transports: [(e) => captured.push(e)] });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    assert.equal(captured.length, 0);
  });
});

// ─── Memory transport ─────────────────────────────────────────────────────────

describe('Logger – memory transport captures entries', () => {
  it('getEntries returns empty array with no memory transport', () => {
    const logger = new Logger({ transports: [] });
    logger.info('ignored');
    assert.deepEqual(logger.getEntries(), []);
  });

  it('createMemoryLogger captures all emitted entries', () => {
    const logger = createMemoryLogger({ level: 'debug' });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e', undefined, { ctx: 1 });
    const entries = logger.getEntries();
    assert.equal(entries.length, 4);
    assert.equal(entries[0].level, 'debug');
    assert.equal(entries[1].level, 'info');
    assert.equal(entries[2].level, 'warn');
    assert.equal(entries[3].level, 'error');
  });

  it('getEntries returns a copy (mutation does not affect internal state)', () => {
    const logger = createMemoryLogger();
    logger.info('one');
    const entries = logger.getEntries();
    entries.push({ level: 'warn', message: 'injected', timestamp: 0 });
    assert.equal(logger.getEntries().length, 1);
  });

  it('suppressed entries are not captured', () => {
    const logger = createMemoryLogger({ level: 'warn' });
    logger.debug('no');
    logger.info('no');
    logger.warn('yes');
    assert.equal(logger.getEntries().length, 1);
  });
});

// ─── createMemoryLogger ───────────────────────────────────────────────────────

describe('createMemoryLogger', () => {
  it('creates a Logger instance', () => {
    const logger = createMemoryLogger();
    assert.ok(logger instanceof Logger);
  });

  it('default level is info', () => {
    const logger = createMemoryLogger();
    logger.debug('no');
    logger.info('yes');
    assert.equal(logger.getEntries().length, 1);
    assert.equal(logger.getEntries()[0].level, 'info');
  });

  it('respects level option', () => {
    const logger = createMemoryLogger({ level: 'error' });
    logger.info('no');
    logger.warn('no');
    logger.error('yes');
    assert.equal(logger.getEntries().length, 1);
  });

  it('entry has correct message and timestamp', () => {
    const logger = createMemoryLogger();
    const before = Date.now();
    logger.info('hello');
    const after = Date.now();
    const entry = logger.getEntries()[0];
    assert.equal(entry.message, 'hello');
    assert.ok(entry.timestamp >= before && entry.timestamp <= after);
  });
});

// ─── child() ─────────────────────────────────────────────────────────────────

describe('Logger – child()', () => {
  it('child entries include parent context', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    const child = logger.child({ requestId: 'abc' });
    child.info('from child');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].context?.requestId, 'abc');
  });

  it('child context is merged with call-time context', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    const child = logger.child({ service: 'api' });
    child.info('msg', { userId: 42 });
    const ctx = captured[0].context;
    assert.equal(ctx?.service, 'api');
    assert.equal(ctx?.userId, 42);
  });

  it('call-time context overrides child context', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    const child = logger.child({ key: 'parent-val' });
    child.info('msg', { key: 'override' });
    assert.equal(captured[0].context?.key, 'override');
  });

  it('grandchild merges contexts transitively', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    const child = logger.child({ a: 1 });
    const grandchild = child.child({ b: 2 });
    grandchild.info('deep');
    const ctx = captured[0].context;
    assert.equal(ctx?.a, 1);
    assert.equal(ctx?.b, 2);
  });

  it('child shares memory store with parent when parent is memory logger', () => {
    const logger = createMemoryLogger({ level: 'debug' });
    const child = logger.child({ tag: 'child' });
    logger.info('from parent');
    child.debug('from child');
    assert.equal(logger.getEntries().length, 2);
  });
});

// ─── addTransport ─────────────────────────────────────────────────────────────

describe('Logger – addTransport', () => {
  it('custom transport receives entries', () => {
    const received = [];
    const logger = new Logger({ transports: [] });
    logger.addTransport((e) => received.push(e));
    logger.info('hello');
    assert.equal(received.length, 1);
    assert.equal(received[0].message, 'hello');
  });

  it('multiple transports all receive entries', () => {
    const t1 = [];
    const t2 = [];
    const logger = new Logger({ transports: [(e) => t1.push(e)] });
    logger.addTransport((e) => t2.push(e));
    logger.warn('multi');
    assert.equal(t1.length, 1);
    assert.equal(t2.length, 1);
  });

  it('transport is not called for suppressed entries', () => {
    const received = [];
    const logger = new Logger({ level: 'warn', transports: [(e) => received.push(e)] });
    logger.debug('no');
    logger.info('no');
    assert.equal(received.length, 0);
  });
});

// ─── error() with Error object ───────────────────────────────────────────────

describe('Logger – error() captures Error object', () => {
  it('error field is set on the entry', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    const err = new Error('boom');
    logger.error('something failed', err);
    assert.equal(captured[0].error, err);
  });

  it('error field is undefined when no Error passed', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    logger.error('oops');
    assert.equal(captured[0].error, undefined);
  });

  it('context is included alongside error', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    const err = new Error('fail');
    logger.error('msg', err, { detail: 'extra' });
    assert.equal(captured[0].error, err);
    assert.equal(captured[0].context?.detail, 'extra');
  });
});

// ─── setLevel ─────────────────────────────────────────────────────────────────

describe('Logger – setLevel', () => {
  it('changes filtering behavior', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    logger.debug('before setLevel – suppressed');
    assert.equal(captured.length, 0);

    logger.setLevel('debug');
    logger.debug('after setLevel – emitted');
    assert.equal(captured.length, 1);
  });

  it('setting silent suppresses everything', () => {
    const captured = [];
    const logger = new Logger({ level: 'debug', transports: [(e) => captured.push(e)] });
    logger.info('before silent');
    assert.equal(captured.length, 1);

    logger.setLevel('silent');
    logger.error('silenced');
    assert.equal(captured.length, 1);
  });

  it('can change from silent back to info', () => {
    const captured = [];
    const logger = new Logger({ level: 'silent', transports: [(e) => captured.push(e)] });
    logger.error('silenced');
    assert.equal(captured.length, 0);

    logger.setLevel('info');
    logger.info('active');
    assert.equal(captured.length, 1);
  });
});

// ─── silent option ────────────────────────────────────────────────────────────

describe('Logger – silent option', () => {
  it('silent: true suppresses all output', () => {
    const captured = [];
    const logger = new Logger({
      silent: true,
      transports: [(e) => captured.push(e)],
    });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    assert.equal(captured.length, 0);
  });

  it('silent: false behaves like default (info level)', () => {
    const captured = [];
    const logger = new Logger({
      silent: false,
      transports: [(e) => captured.push(e)],
    });
    logger.debug('no');
    logger.info('yes');
    assert.equal(captured.length, 1);
  });
});

// ─── prefix ───────────────────────────────────────────────────────────────────

describe('Logger – prefix', () => {
  it('prefix is prepended to messages', () => {
    const captured = [];
    const logger = new Logger({ prefix: '[APP]', transports: [(e) => captured.push(e)] });
    logger.info('hello');
    assert.ok(captured[0].message.startsWith('[APP]'));
    assert.ok(captured[0].message.includes('hello'));
  });

  it('no prefix when not set', () => {
    const captured = [];
    const logger = new Logger({ transports: [(e) => captured.push(e)] });
    logger.info('plain');
    assert.equal(captured[0].message, 'plain');
  });
});
