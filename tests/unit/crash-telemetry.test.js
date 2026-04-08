import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const {
  recordCrashEvent,
  recordSuccessfulOperation,
  recordRecovery,
  getCrashFreeRate,
  getSessionHealth,
  getRecentErrors,
  initCrashTelemetry,
  crashTelemetry,
  collectErrorCauseChain,
} = await import('../../app/modules/crash-telemetry.js');

describe('crash-telemetry', () => {
  beforeEach(() => {
    // Reset telemetry state between tests
    crashTelemetry.errors.length = 0;
    crashTelemetry.crashes.length = 0;
    crashTelemetry.totalErrors = 0;
    crashTelemetry.recoveries = 0;
    crashTelemetry.longestStreak = 0;
    crashTelemetry.currentStreak = 0;
    crashTelemetry.lastErrorAt = 0;
  });

  it('recordCrashEvent adds an error entry', () => {
    recordCrashEvent('error', 'something broke', 'render');
    assert.equal(crashTelemetry.totalErrors, 1);
    assert.equal(crashTelemetry.errors.length, 1);
    assert.equal(crashTelemetry.errors[0].type, 'error');
    assert.equal(crashTelemetry.errors[0].message, 'something broke');
  });

  it('recordCrashEvent with crash type adds to crashes array', () => {
    recordCrashEvent('crash', 'fatal error', 'init');
    assert.equal(crashTelemetry.crashes.length, 1);
    recordCrashEvent('fatal', 'another fatal', 'render');
    assert.equal(crashTelemetry.crashes.length, 2);
  });

  it('recordCrashEvent resets currentStreak', () => {
    recordSuccessfulOperation();
    recordSuccessfulOperation();
    assert.equal(crashTelemetry.currentStreak, 2);
    recordCrashEvent('error', 'oops');
    assert.equal(crashTelemetry.currentStreak, 0);
  });

  it('recordCrashEvent truncates message to 500 chars', () => {
    const longMsg = 'x'.repeat(1000);
    recordCrashEvent('error', longMsg);
    assert.equal(crashTelemetry.errors[0].message.length, 500);
  });

  it('errors array is capped at 200 entries', () => {
    for (let i = 0; i < 210; i++) {
      recordCrashEvent('error', `err-${i}`);
    }
    assert.equal(crashTelemetry.errors.length, 200);
  });

  it('recordSuccessfulOperation increments streak', () => {
    recordSuccessfulOperation();
    recordSuccessfulOperation();
    recordSuccessfulOperation();
    assert.equal(crashTelemetry.currentStreak, 3);
    assert.equal(crashTelemetry.longestStreak, 3);
  });

  it('longestStreak is preserved after reset', () => {
    recordSuccessfulOperation();
    recordSuccessfulOperation();
    recordSuccessfulOperation();
    recordCrashEvent('error', 'break');
    recordSuccessfulOperation();
    assert.equal(crashTelemetry.longestStreak, 3);
    assert.equal(crashTelemetry.currentStreak, 1);
  });

  it('recordRecovery increments recoveries', () => {
    recordRecovery();
    recordRecovery();
    assert.equal(crashTelemetry.recoveries, 2);
  });

  it('getCrashFreeRate returns 100 when no operations', () => {
    assert.equal(getCrashFreeRate(), 100);
  });

  it('getCrashFreeRate calculates correctly', () => {
    // 5 successes, 1 error => longestStreak=5, totalErrors=1, totalOps=6
    for (let i = 0; i < 5; i++) recordSuccessfulOperation();
    recordCrashEvent('error', 'fail');
    const rate = getCrashFreeRate();
    assert.ok(rate > 0 && rate < 100);
  });

  it('getSessionHealth returns expected shape', () => {
    const health = getSessionHealth();
    assert.equal(typeof health.sessionId, 'string');
    assert.equal(typeof health.uptimeMs, 'number');
    assert.equal(typeof health.uptimeMin, 'number');
    assert.equal(typeof health.totalErrors, 'number');
    assert.equal(typeof health.crashes, 'number');
    assert.equal(typeof health.crashFreeRate, 'number');
    assert.equal(typeof health.longestStreak, 'number');
  });

  it('getRecentErrors returns last N errors', () => {
    for (let i = 0; i < 10; i++) recordCrashEvent('error', `e${i}`);
    const recent = getRecentErrors(3);
    assert.equal(recent.length, 3);
    assert.equal(recent[2].message, 'e9');
  });

  it('initCrashTelemetry does not throw', () => {
    assert.doesNotThrow(() => initCrashTelemetry());
  });
});

describe('collectErrorCauseChain', () => {
  it('returns single-entry chain for simple Error', () => {
    const chain = collectErrorCauseChain(new Error('top'));
    assert.deepStrictEqual(chain, ['top']);
  });

  it('follows nested cause chain', () => {
    const root = new Error('root');
    const mid = new Error('mid', { cause: root });
    const top = new Error('top', { cause: mid });
    const chain = collectErrorCauseChain(top);
    assert.deepStrictEqual(chain, ['top', 'mid', 'root']);
  });

  it('limits depth to 5 levels', () => {
    let err = new Error('e0');
    for (let i = 1; i <= 10; i++) err = new Error(`e${i}`, { cause: err });
    const chain = collectErrorCauseChain(err);
    assert.equal(chain.length, 5);
  });

  it('handles non-Error cause (string)', () => {
    const err = new Error('top', { cause: 'string-cause' });
    const chain = collectErrorCauseChain(err);
    assert.deepStrictEqual(chain, ['top', 'string-cause']);
  });

  it('handles null input', () => {
    const chain = collectErrorCauseChain(null);
    assert.deepStrictEqual(chain, []);
  });

  it('handles non-Error input', () => {
    const chain = collectErrorCauseChain('just a string');
    assert.deepStrictEqual(chain, ['just a string']);
  });
});

describe('recordCrashEvent with cause', () => {
  beforeEach(() => {
    crashTelemetry.errors.length = 0;
    crashTelemetry.crashes.length = 0;
    crashTelemetry.totalErrors = 0;
  });

  it('records causeChain when cause is provided', () => {
    const root = new Error('root cause');
    const wrapper = new Error('wrapper', { cause: root });
    recordCrashEvent('error', 'wrapped error', 'test', { cause: wrapper });
    assert.deepStrictEqual(crashTelemetry.errors[0].causeChain, ['wrapper', 'root cause']);
  });

  it('records empty causeChain when no cause provided', () => {
    recordCrashEvent('error', 'plain error', 'test');
    assert.deepStrictEqual(crashTelemetry.errors[0].causeChain, []);
  });
});
