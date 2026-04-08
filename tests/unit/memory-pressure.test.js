// ─── Unit Tests: Memory Pressure API ────────────────────────────────────────
import './setup-dom.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mock navigator.deviceMemory before importing the module ─────────────────
// setup-dom.js defines navigator without deviceMemory; we add it here.
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = {};
}
// Set a default value; individual tests may override via Object.defineProperty.
Object.defineProperty(globalThis.navigator, 'deviceMemory', {
  configurable: true,
  writable: true,
  value: 8,
});

const M = await import('../../app/modules/memory-pressure.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setDeviceMemory(gb) {
  Object.defineProperty(globalThis.navigator, 'deviceMemory', {
    configurable: true,
    writable: true,
    value: gb,
  });
}

// ─── getMemoryInfo ────────────────────────────────────────────────────────────

describe('getMemoryInfo()', () => {
  it('returns an object with the correct shape', () => {
    const info = M.getMemoryInfo();
    assert.ok(typeof info === 'object' && info !== null, 'should be an object');
    assert.ok('deviceMemoryGb' in info, 'should have deviceMemoryGb');
    assert.ok('usedJsHeapMb' in info, 'should have usedJsHeapMb');
    assert.ok('totalJsHeapMb' in info, 'should have totalJsHeapMb');
    assert.ok('pressure' in info, 'should have pressure');
  });

  it('returns deviceMemoryGb >= 0', () => {
    const info = M.getMemoryInfo();
    assert.ok(info.deviceMemoryGb >= 0, `deviceMemoryGb should be >= 0, got ${info.deviceMemoryGb}`);
  });

  it('returns a valid pressure enum value', () => {
    const info = M.getMemoryInfo();
    const valid = ['nominal', 'fair', 'serious', 'critical'];
    assert.ok(valid.includes(info.pressure), `pressure "${info.pressure}" is not a valid enum value`);
  });

  it('usedJsHeapMb is null or a number', () => {
    const info = M.getMemoryInfo();
    assert.ok(
      info.usedJsHeapMb === null || typeof info.usedJsHeapMb === 'number',
      'usedJsHeapMb should be null or number'
    );
  });

  it('totalJsHeapMb is null or a number', () => {
    const info = M.getMemoryInfo();
    assert.ok(
      info.totalJsHeapMb === null || typeof info.totalJsHeapMb === 'number',
      'totalJsHeapMb should be null or number'
    );
  });
});

// ─── getCacheLimits ───────────────────────────────────────────────────────────

describe('getCacheLimits()', () => {
  it('returns all 4 fields as positive numbers', () => {
    const limits = M.getCacheLimits();
    assert.ok(typeof limits.maxRenderCachePages === 'number' && limits.maxRenderCachePages > 0,
      'maxRenderCachePages should be a positive number');
    assert.ok(typeof limits.maxThumbnailCachePages === 'number' && limits.maxThumbnailCachePages > 0,
      'maxThumbnailCachePages should be a positive number');
    assert.ok(typeof limits.maxCanvasPoolSize === 'number' && limits.maxCanvasPoolSize > 0,
      'maxCanvasPoolSize should be a positive number');
    assert.ok(typeof limits.maxMemoryMb === 'number' && limits.maxMemoryMb > 0,
      'maxMemoryMb should be a positive number');
  });

  it('returns larger limits for 8 GB device than for 1 GB device', () => {
    setDeviceMemory(8);
    const high = M.getCacheLimits();

    setDeviceMemory(1);
    const low = M.getCacheLimits();

    assert.ok(high.maxRenderCachePages > low.maxRenderCachePages,
      `8 GB render cache (${high.maxRenderCachePages}) should exceed 1 GB (${low.maxRenderCachePages})`);
    assert.ok(high.maxThumbnailCachePages > low.maxThumbnailCachePages,
      'thumbnail cache should be larger for high-memory device');
    assert.ok(high.maxCanvasPoolSize > low.maxCanvasPoolSize,
      'canvas pool should be larger for high-memory device');
    assert.ok(high.maxMemoryMb > low.maxMemoryMb,
      'memory budget should be larger for high-memory device');

    // Restore to 8 GB for subsequent tests
    setDeviceMemory(8);
  });

  it('returns minimal limits for < 2 GB device', () => {
    setDeviceMemory(0.5);
    const limits = M.getCacheLimits();
    assert.equal(limits.maxRenderCachePages, 10);
    assert.equal(limits.maxThumbnailCachePages, 20);
    assert.equal(limits.maxCanvasPoolSize, 4);
    assert.equal(limits.maxMemoryMb, 64);

    setDeviceMemory(8); // restore
  });

  it('returns max limits for >= 8 GB device (no pressure)', () => {
    setDeviceMemory(8);
    const limits = M.getCacheLimits();
    assert.equal(limits.maxRenderCachePages, 50);
    assert.equal(limits.maxThumbnailCachePages, 100);
    assert.equal(limits.maxCanvasPoolSize, 20);
    assert.equal(limits.maxMemoryMb, 512);
  });
});

// ─── onMemoryPressure ─────────────────────────────────────────────────────────

describe('onMemoryPressure()', () => {
  it('returns an unsubscribe function', () => {
    const unsubscribe = M.onMemoryPressure(() => {});
    assert.equal(typeof unsubscribe, 'function', 'should return a function');
    unsubscribe(); // should not throw
  });

  it('unsubscribe can be called multiple times safely', () => {
    const unsubscribe = M.onMemoryPressure(() => {});
    assert.doesNotThrow(() => {
      unsubscribe();
      unsubscribe();
    });
  });
});

// ─── startMemoryMonitor ───────────────────────────────────────────────────────

describe('startMemoryMonitor()', () => {
  it('returns a stop function', () => {
    const stop = M.startMemoryMonitor();
    assert.equal(typeof stop, 'function', 'should return a function');
    stop(); // should not throw
  });

  it('stop can be called safely without error', () => {
    const stop = M.startMemoryMonitor();
    assert.doesNotThrow(() => stop());
  });
});

// ─── estimateObjectSize ───────────────────────────────────────────────────────

describe('estimateObjectSize()', () => {
  it('returns a number >= 0 for an empty object', () => {
    const size = M.estimateObjectSize({});
    assert.ok(typeof size === 'number', 'result should be a number');
    assert.ok(size >= 0, `size should be >= 0, got ${size}`);
  });

  it('returns a number >= 0 for null', () => {
    const size = M.estimateObjectSize(null);
    assert.ok(size >= 0);
  });

  it('returns a larger size for a bigger object', () => {
    const small = M.estimateObjectSize({ a: 1 });
    const large = M.estimateObjectSize({ a: 1, b: 2, c: 'hello world this is a longer string' });
    assert.ok(large >= small, `larger object (${large}) should be >= smaller (${small})`);
  });

  it('handles circular references gracefully (no throw)', () => {
    const obj = {};
    // @ts-ignore
    obj.self = obj;
    assert.doesNotThrow(() => M.estimateObjectSize(obj));
    const size = M.estimateObjectSize(obj);
    assert.ok(typeof size === 'number' && size >= 0);
  });

  it('handles primitive values', () => {
    assert.ok(M.estimateObjectSize(42) >= 0);
    assert.ok(M.estimateObjectSize('hello') >= 0);
    assert.ok(M.estimateObjectSize(true) >= 0);
  });
});
