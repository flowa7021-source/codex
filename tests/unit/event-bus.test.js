// ─── Unit Tests: Event Bus ──────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  emit,
  on,
  once,
  subscribe,
  removeAllListeners,
} from '../../app/modules/event-bus.js';

beforeEach(() => {
  removeAllListeners();
});

describe('emit / on', () => {
  it('calls listener when event is emitted', () => {
    let called = false;
    on('test:fire', () => { called = true; });
    emit('test:fire');
    assert.equal(called, true);
  });

  it('passes detail payload to listener', () => {
    let received = null;
    on('test:data', (detail) => { received = detail; });
    emit('test:data', { foo: 'bar' });
    assert.deepEqual(received, { foo: 'bar' });
  });

  it('supports multiple listeners on same event', () => {
    let count = 0;
    on('test:multi', () => { count++; });
    on('test:multi', () => { count++; });
    emit('test:multi');
    assert.equal(count, 2);
  });

  it('does not call listener for different event', () => {
    let called = false;
    on('test:a', () => { called = true; });
    emit('test:b');
    assert.equal(called, false);
  });
});

describe('on – unsubscribe', () => {
  it('returns unsubscribe function that removes listener', () => {
    let count = 0;
    const unsub = on('test:unsub', () => { count++; });
    emit('test:unsub');
    assert.equal(count, 1);
    unsub();
    emit('test:unsub');
    assert.equal(count, 1);
  });
});

describe('once', () => {
  it('fires handler only once', () => {
    let count = 0;
    once('test:once', () => { count++; });
    emit('test:once');
    emit('test:once');
    assert.equal(count, 1);
  });

  it('passes detail to once handler', () => {
    let received = null;
    once('test:once-data', (detail) => { received = detail; });
    emit('test:once-data', 42);
    assert.equal(received, 42);
  });
});

describe('subscribe / removeAllListeners', () => {
  it('subscribe works like on', () => {
    let called = false;
    subscribe('test:sub', () => { called = true; });
    emit('test:sub');
    assert.equal(called, true);
  });

  it('subscribe returns unsubscribe function', () => {
    let count = 0;
    const unsub = subscribe('test:sub-unsub', () => { count++; });
    emit('test:sub-unsub');
    unsub();
    emit('test:sub-unsub');
    assert.equal(count, 1);
  });

  it('removeAllListeners removes all tracked subscriptions', () => {
    let count = 0;
    subscribe('test:rem1', () => { count++; });
    subscribe('test:rem2', () => { count++; });
    removeAllListeners();
    emit('test:rem1');
    emit('test:rem2');
    assert.equal(count, 0);
  });
});
