import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// The leak detector checks localStorage for dev mode and import.meta.env.DEV.
// Since import.meta.env.DEV won't be set in Node, we activate via localStorage.
// But installLeakDetector is guarded by `installed` flag and only runs once per process.
// We test getLeakReport directly since the internal state is module-scoped.

const { installLeakDetector, getLeakReport } = await import('../../app/modules/leak-detector.js');

describe('leak-detector', () => {
  it('exports installLeakDetector as a function', () => {
    assert.equal(typeof installLeakDetector, 'function');
  });

  it('exports getLeakReport as a function', () => {
    assert.equal(typeof getLeakReport, 'function');
  });

  it('installLeakDetector does not throw when called', () => {
    assert.doesNotThrow(() => installLeakDetector());
  });

  it('installLeakDetector is idempotent (second call is no-op)', () => {
    assert.doesNotThrow(() => installLeakDetector());
    assert.doesNotThrow(() => installLeakDetector());
  });

  it('getLeakReport returns an object with expected shape', () => {
    const report = getLeakReport();
    assert.ok(Array.isArray(report.unremovedListeners));
    assert.ok(Array.isArray(report.unrevokedUrls));
    assert.equal(typeof report.liveCanvases, 'number');
  });

  it('getLeakReport unremovedListeners entries have correct structure', () => {
    const report = getLeakReport();
    for (const entry of report.unremovedListeners) {
      assert.equal(typeof entry.target, 'string');
      assert.equal(typeof entry.type, 'string');
      assert.equal(typeof entry.capture, 'boolean');
      assert.equal(typeof entry.count, 'number');
    }
  });

  it('liveCanvases is a non-negative number', () => {
    const report = getLeakReport();
    assert.ok(report.liveCanvases >= 0);
  });

  it('unrevokedUrls is initially empty or contains only tracked URLs', () => {
    const report = getLeakReport();
    assert.ok(Array.isArray(report.unrevokedUrls));
    // Each entry should be a string if present
    for (const url of report.unrevokedUrls) {
      assert.equal(typeof url, 'string');
    }
  });
});
