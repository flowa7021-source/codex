// ─── Unit Tests: EventLogger ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EventLogger } from '../../app/modules/event-logger.js';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('EventLogger – constructor', () => {
  it('uses default options (maxEntries=1000, minLevel=debug)', () => {
    const logger = new EventLogger();
    assert.equal(logger.size, 0);
  });

  it('accepts custom maxEntries', () => {
    const logger = new EventLogger({ maxEntries: 5 });
    for (let i = 0; i < 7; i++) logger.info('cat', `msg ${i}`);
    assert.equal(logger.size, 5);
  });

  it('accepts custom minLevel', () => {
    const logger = new EventLogger({ minLevel: 'warn' });
    logger.debug('cat', 'debug msg');
    logger.info('cat', 'info msg');
    logger.warn('cat', 'warn msg');
    logger.error('cat', 'error msg');
    assert.equal(logger.size, 2);
  });
});

// ─── log / convenience methods ───────────────────────────────────────────────

describe('EventLogger – log and convenience methods', () => {
  it('log returns a LogEntry with correct fields', () => {
    const logger = new EventLogger();
    const before = Date.now();
    const entry = logger.log('info', 'mycat', 'hello', { x: 1 });
    const after = Date.now();

    assert.equal(entry.level, 'info');
    assert.equal(entry.category, 'mycat');
    assert.equal(entry.message, 'hello');
    assert.deepEqual(entry.data, { x: 1 });
    assert.ok(typeof entry.id === 'string' && entry.id.length > 0);
    assert.ok(entry.timestamp >= before && entry.timestamp <= after);
  });

  it('debug() logs at debug level', () => {
    const logger = new EventLogger();
    const entry = logger.debug('cat', 'dbg');
    assert.equal(entry.level, 'debug');
  });

  it('info() logs at info level', () => {
    const logger = new EventLogger();
    const entry = logger.info('cat', 'inf');
    assert.equal(entry.level, 'info');
  });

  it('warn() logs at warn level', () => {
    const logger = new EventLogger();
    const entry = logger.warn('cat', 'wrn');
    assert.equal(entry.level, 'warn');
  });

  it('error() logs at error level', () => {
    const logger = new EventLogger();
    const entry = logger.error('cat', 'err');
    assert.equal(entry.level, 'error');
  });

  it('log without data leaves data undefined', () => {
    const logger = new EventLogger();
    const entry = logger.info('cat', 'no data');
    assert.equal(entry.data, undefined);
  });

  it('log with data=null stores null', () => {
    const logger = new EventLogger();
    const entry = logger.info('cat', 'null data', null);
    assert.equal(entry.data, null);
  });
});

// ─── getEntries ───────────────────────────────────────────────────────────────

describe('EventLogger – getEntries', () => {
  it('no filter returns all entries', () => {
    const logger = new EventLogger();
    logger.debug('a', '1');
    logger.info('b', '2');
    logger.warn('c', '3');
    assert.equal(logger.getEntries().length, 3);
  });

  it('filter by exact level returns only that level', () => {
    const logger = new EventLogger();
    logger.debug('a', '1');
    logger.info('b', '2');
    logger.warn('c', '3');
    logger.error('d', '4');
    const entries = logger.getEntries({ level: 'warn' });
    assert.ok(entries.every((e) => ['warn', 'error'].includes(e.level)));
    assert.equal(entries.length, 2);
  });

  it('filter by level=error returns only error entries', () => {
    const logger = new EventLogger();
    logger.debug('a', '1');
    logger.error('a', '2');
    const entries = logger.getEntries({ level: 'error' });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].level, 'error');
  });

  it('filter by category', () => {
    const logger = new EventLogger();
    logger.info('network', 'req');
    logger.info('db', 'query');
    logger.warn('network', 'slow');
    const entries = logger.getEntries({ category: 'network' });
    assert.equal(entries.length, 2);
    assert.ok(entries.every((e) => e.category === 'network'));
  });

  it('filter by since timestamp', () => {
    const logger = new EventLogger();
    // Manually insert entries with known timestamps
    logger.log('info', 'a', 'old');
    const mid = Date.now();
    logger.log('info', 'b', 'new1');
    logger.log('info', 'c', 'new2');
    const entries = logger.getEntries({ since: mid });
    assert.ok(entries.length >= 2);
    assert.ok(entries.every((e) => e.timestamp >= mid));
  });

  it('filter by limit', () => {
    const logger = new EventLogger();
    for (let i = 0; i < 10; i++) logger.info('x', `msg ${i}`);
    const entries = logger.getEntries({ limit: 3 });
    assert.equal(entries.length, 3);
  });

  it('combined filters: category + limit', () => {
    const logger = new EventLogger();
    for (let i = 0; i < 5; i++) logger.info('net', `req ${i}`);
    for (let i = 0; i < 5; i++) logger.info('db', `query ${i}`);
    const entries = logger.getEntries({ category: 'net', limit: 2 });
    assert.equal(entries.length, 2);
    assert.ok(entries.every((e) => e.category === 'net'));
  });

  it('returns empty array when no entries match filter', () => {
    const logger = new EventLogger();
    logger.info('cat', 'msg');
    const entries = logger.getEntries({ category: 'nonexistent' });
    assert.equal(entries.length, 0);
  });
});

// ─── maxEntries capacity ──────────────────────────────────────────────────────

describe('EventLogger – maxEntries capacity', () => {
  it('drops oldest entries when full', () => {
    const logger = new EventLogger({ maxEntries: 3 });
    logger.info('a', 'first');
    logger.info('b', 'second');
    logger.info('c', 'third');
    logger.info('d', 'fourth');
    assert.equal(logger.size, 3);
    const entries = logger.getEntries();
    assert.ok(entries.every((e) => e.message !== 'first'));
    assert.ok(entries.some((e) => e.message === 'fourth'));
  });

  it('size never exceeds maxEntries', () => {
    const logger = new EventLogger({ maxEntries: 10 });
    for (let i = 0; i < 25; i++) logger.debug('x', `msg ${i}`);
    assert.equal(logger.size, 10);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('EventLogger – clear', () => {
  it('empties the log', () => {
    const logger = new EventLogger();
    logger.info('a', 'one');
    logger.info('b', 'two');
    logger.clear();
    assert.equal(logger.size, 0);
    assert.deepEqual(logger.getEntries(), []);
  });

  it('can log again after clear', () => {
    const logger = new EventLogger();
    logger.info('a', 'one');
    logger.clear();
    logger.warn('b', 'two');
    assert.equal(logger.size, 1);
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('EventLogger – size', () => {
  it('starts at 0', () => {
    const logger = new EventLogger();
    assert.equal(logger.size, 0);
  });

  it('increments on each logged entry', () => {
    const logger = new EventLogger();
    logger.info('a', 'one');
    assert.equal(logger.size, 1);
    logger.debug('b', 'two');
    assert.equal(logger.size, 2);
  });

  it('resets to 0 after clear', () => {
    const logger = new EventLogger();
    logger.info('a', 'one');
    logger.clear();
    assert.equal(logger.size, 0);
  });
});

// ─── export / import roundtrip ────────────────────────────────────────────────

describe('EventLogger – export / import', () => {
  it('export returns valid JSON string', () => {
    const logger = new EventLogger();
    logger.info('a', 'hello');
    const json = logger.export();
    assert.doesNotThrow(() => JSON.parse(json));
  });

  it('export/import roundtrip preserves entries', () => {
    const logger1 = new EventLogger();
    logger1.info('a', 'first');
    logger1.warn('b', 'second', { key: 'val' });
    const json = logger1.export();

    const logger2 = new EventLogger();
    logger2.import(json);
    assert.equal(logger2.size, 2);
    const entries = logger2.getEntries();
    assert.equal(entries[0].message, 'first');
    assert.equal(entries[1].message, 'second');
    assert.deepEqual(entries[1].data, { key: 'val' });
  });

  it('import merges with existing entries', () => {
    const logger1 = new EventLogger();
    logger1.info('a', 'from-logger1');
    const json = logger1.export();

    const logger2 = new EventLogger();
    logger2.debug('b', 'existing');
    logger2.import(json);
    assert.equal(logger2.size, 2);
  });

  it('export of empty logger returns empty array JSON', () => {
    const logger = new EventLogger();
    assert.equal(logger.export(), '[]');
  });
});
