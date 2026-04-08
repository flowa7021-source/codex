import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectCapabilities,
  getCapabilities,
  initModernApis,
  // Re-exports should be importable (not dead code)
  openFilePicker,
  saveFile,
  getLastHandle,
  opfsWrite,
  opfsRead,
  withWakeLock,
  shareDocument,
  downloadFallback,
  navigateToPage,
  postBackgroundTask,
  DisposableStack,
} from '../../app/modules/init-modern-apis.js';

describe('init-modern-apis — detectCapabilities', () => {
  it('returns an object with all capability flags', async () => {
    const caps = await detectCapabilities();
    const keys = Object.keys(caps);
    assert.ok(keys.includes('fsAccess'));
    assert.ok(keys.includes('opfs'));
    assert.ok(keys.includes('webCodecs'));
    assert.ok(keys.includes('compression'));
    assert.ok(keys.includes('scheduler'));
    assert.ok(keys.includes('wakeLock'));
    assert.ok(keys.includes('share'));
    assert.ok(keys.includes('fileShare'));
    assert.ok(keys.includes('viewTransitions'));
    // All values are booleans
    for (const v of Object.values(caps)) {
      assert.equal(typeof v, 'boolean');
    }
  });

  it('in Node.js env most caps are false', async () => {
    const caps = await detectCapabilities();
    // These APIs don't exist in Node.js
    assert.equal(caps.fsAccess, false);
    assert.equal(caps.webCodecs, false);
    assert.equal(caps.wakeLock, false);
  });
});

describe('init-modern-apis — getCapabilities', () => {
  it('returns a copy of capabilities', async () => {
    await detectCapabilities();
    const a = getCapabilities();
    const b = getCapabilities();
    assert.deepStrictEqual(a, b);
    // Verify it's a copy, not the same object
    assert.notEqual(a, b);
  });
});

describe('init-modern-apis — initModernApis', () => {
  it('runs without throwing and returns capabilities', async () => {
    const caps = await initModernApis();
    assert.ok(typeof caps === 'object');
    assert.equal(typeof caps.fsAccess, 'boolean');
  });
});

describe('init-modern-apis — re-exports are not dead code', () => {
  it('openFilePicker is a function', () => {
    assert.equal(typeof openFilePicker, 'function');
  });

  it('saveFile is a function', () => {
    assert.equal(typeof saveFile, 'function');
  });

  it('getLastHandle is a function', () => {
    assert.equal(typeof getLastHandle, 'function');
  });

  it('opfsWrite is a function', () => {
    assert.equal(typeof opfsWrite, 'function');
  });

  it('opfsRead is a function', () => {
    assert.equal(typeof opfsRead, 'function');
  });

  it('withWakeLock is a function', () => {
    assert.equal(typeof withWakeLock, 'function');
  });

  it('shareDocument is a function', () => {
    assert.equal(typeof shareDocument, 'function');
  });

  it('downloadFallback is a function', () => {
    assert.equal(typeof downloadFallback, 'function');
  });

  it('navigateToPage is a function', () => {
    assert.equal(typeof navigateToPage, 'function');
  });

  it('postBackgroundTask is a function', () => {
    assert.equal(typeof postBackgroundTask, 'function');
  });

  it('DisposableStack is a constructor', () => {
    assert.equal(typeof DisposableStack, 'function');
    const stack = new DisposableStack();
    assert.equal(stack.disposed, false);
    stack.dispose();
    assert.equal(stack.disposed, true);
  });
});
