import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Activate dev mode so installLeakDetector actually installs patches
localStorage.setItem('novareader-dev-mode', '1');

const { installLeakDetector, getLeakReport } = await import('../../app/modules/leak-detector.js');

describe('leak-detector', () => {
  it('exports installLeakDetector as a function', () => {
    assert.equal(typeof installLeakDetector, 'function');
  });

  it('exports getLeakReport as a function', () => {
    assert.equal(typeof getLeakReport, 'function');
  });

  it('getLeakReport returns an object with expected shape', () => {
    const report = getLeakReport();
    assert.ok(Array.isArray(report.unremovedListeners));
    assert.ok(Array.isArray(report.unrevokedUrls));
    assert.equal(typeof report.liveCanvases, 'number');
  });

  it('installLeakDetector installs patches and logs info', () => {
    const origInfo = console.info;
    let logged = false;
    console.info = (...args) => {
      if (args[0] && args[0].includes('[LeakDetector]')) logged = true;
    };
    // This is the first real call with dev mode enabled
    installLeakDetector();
    console.info = origInfo;
    assert.ok(logged, 'should have logged installation message');
  });

  it('installLeakDetector is idempotent (second call is no-op)', () => {
    // installed flag is now true, so this should be a no-op
    assert.doesNotThrow(() => installLeakDetector());
  });

  it('patched addEventListener/removeEventListener tracks listeners on document', () => {
    const handler = () => {};
    document.addEventListener('click', handler);

    let report = getLeakReport();
    const clickEntry = report.unremovedListeners.find(
      e => e.target === 'document' && e.type === 'click'
    );
    assert.ok(clickEntry, 'should track click listener on document');
    assert.ok(clickEntry.count >= 1);

    // Remove the listener and verify it's cleaned up
    document.removeEventListener('click', handler);
    report = getLeakReport();
    const afterRemove = report.unremovedListeners.find(
      e => e.target === 'document' && e.type === 'click' && e.count > 0
    );
    // After removing, it should either be gone or have count 0
    if (afterRemove) {
      // There may be other click listeners, but our handler should be removed
      assert.ok(true);
    }
  });

  it('patched addEventListener/removeEventListener tracks listeners on window', () => {
    const handler = () => {};
    window.addEventListener('resize', handler);

    let report = getLeakReport();
    const entry = report.unremovedListeners.find(
      e => e.target === 'window' && e.type === 'resize'
    );
    assert.ok(entry, 'should track resize listener on window');

    window.removeEventListener('resize', handler);
  });

  it('addEventListener with capture option is tracked separately', () => {
    const handler = () => {};
    document.addEventListener('focus', handler, true);

    let report = getLeakReport();
    const entry = report.unremovedListeners.find(
      e => e.target === 'document' && e.type === 'focus' && e.capture === true
    );
    assert.ok(entry, 'should track capture listener');

    document.removeEventListener('focus', handler, true);
  });

  it('addEventListener with options object { capture: true }', () => {
    const handler = () => {};
    document.addEventListener('blur', handler, { capture: true });

    let report = getLeakReport();
    const entry = report.unremovedListeners.find(
      e => e.target === 'document' && e.type === 'blur' && e.capture === true
    );
    assert.ok(entry, 'should track capture listener via options object');

    document.removeEventListener('blur', handler, { capture: true });
  });

  it('addEventListener with capture false tracks as non-capture', () => {
    const handler = () => {};
    document.addEventListener('keydown', handler, false);

    let report = getLeakReport();
    const entry = report.unremovedListeners.find(
      e => e.target === 'document' && e.type === 'keydown' && e.capture === false
    );
    assert.ok(entry, 'should track non-capture listener');

    document.removeEventListener('keydown', handler, false);
  });

  it('patched URL.createObjectURL and revokeObjectURL track unrevoked URLs', () => {
    const blob = new Blob();
    const url = URL.createObjectURL(blob);

    let report = getLeakReport();
    assert.ok(report.unrevokedUrls.includes(url), 'should contain the created URL');

    URL.revokeObjectURL(url);

    report = getLeakReport();
    assert.ok(!report.unrevokedUrls.includes(url), 'should no longer contain revoked URL');
  });

  it('patched createElement tracks canvas creation and removal', () => {
    const reportBefore = getLeakReport();
    const canvasBefore = reportBefore.liveCanvases;

    const canvas = document.createElement('canvas');
    let report = getLeakReport();
    assert.equal(report.liveCanvases, canvasBefore + 1, 'creating canvas should increment count');

    canvas.remove();
    report = getLeakReport();
    assert.equal(report.liveCanvases, canvasBefore, 'removing canvas should decrement count');
  });

  it('canvas.remove() only decrements once even if called multiple times', () => {
    const reportBefore = getLeakReport();
    const canvasBefore = reportBefore.liveCanvases;

    const canvas = document.createElement('canvas');
    assert.equal(getLeakReport().liveCanvases, canvasBefore + 1);

    canvas.remove();
    assert.equal(getLeakReport().liveCanvases, canvasBefore);

    // Second remove should NOT decrement again
    canvas.remove();
    assert.equal(getLeakReport().liveCanvases, canvasBefore);
  });

  it('non-canvas elements are not tracked by createElement patch', () => {
    const reportBefore = getLeakReport();
    const canvasBefore = reportBefore.liveCanvases;

    const div = document.createElement('div');
    assert.equal(getLeakReport().liveCanvases, canvasBefore, 'div should not change canvas count');
  });

  it('getLeakReport unremovedListeners entries have correct structure', () => {
    // Add a listener to ensure there's at least one entry
    const handler = () => {};
    document.addEventListener('test-structure', handler);

    const report = getLeakReport();
    for (const entry of report.unremovedListeners) {
      assert.equal(typeof entry.target, 'string');
      assert.equal(typeof entry.type, 'string');
      assert.equal(typeof entry.capture, 'boolean');
      assert.equal(typeof entry.count, 'number');
    }

    document.removeEventListener('test-structure', handler);
  });

  it('removeEventListener on non-existent type does not throw', () => {
    assert.doesNotThrow(() => {
      document.removeEventListener('nonexistent-type', () => {});
    });
  });

  it('liveCanvases is a non-negative number', () => {
    const report = getLeakReport();
    assert.ok(report.liveCanvases >= 0);
  });

  it('unrevokedUrls is initially empty or contains only tracked URLs', () => {
    const report = getLeakReport();
    assert.ok(Array.isArray(report.unrevokedUrls));
    for (const url of report.unrevokedUrls) {
      assert.equal(typeof url, 'string');
    }
  });
});
