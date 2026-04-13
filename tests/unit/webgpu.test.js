// ─── Unit Tests: WebGPU API Wrapper ───────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isWebGPUSupported,
  requestGPUAdapter,
  requestGPUDevice,
  getAdapterInfo,
} from '../../app/modules/webgpu.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockAdapter = {
  isFallbackAdapter: false,
  limits: { maxTextureDimension2D: 8192 },
  async requestDevice(_desc) {
    return { queue: {}, createBuffer() {}, destroy() {} };
  },
};

beforeEach(() => {
  globalThis.navigator.gpu = {
    async requestAdapter(opts) { return mockAdapter; },
  };
});

afterEach(() => {
  delete globalThis.navigator.gpu;
});

// ─── isWebGPUSupported ────────────────────────────────────────────────────────

describe('isWebGPUSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isWebGPUSupported(), 'boolean');
  });

  it('returns true when navigator.gpu is present', () => {
    assert.equal(isWebGPUSupported(), true);
  });

  it('returns false when navigator.gpu is absent', () => {
    delete globalThis.navigator.gpu;
    assert.equal(isWebGPUSupported(), false);
  });
});

// ─── requestGPUAdapter ────────────────────────────────────────────────────────

describe('requestGPUAdapter', () => {
  it('returns an adapter when WebGPU is supported', async () => {
    const adapter = await requestGPUAdapter();
    assert.ok(adapter !== null);
  });

  it('returns the mock adapter object', async () => {
    const adapter = await requestGPUAdapter();
    assert.equal(adapter, mockAdapter);
  });

  it('returns null when navigator.gpu is absent', async () => {
    delete globalThis.navigator.gpu;
    const adapter = await requestGPUAdapter();
    assert.equal(adapter, null);
  });

  it('returns null when requestAdapter rejects', async () => {
    globalThis.navigator.gpu = {
      async requestAdapter() { throw new Error('no adapter'); },
    };
    const adapter = await requestGPUAdapter();
    assert.equal(adapter, null);
  });

  it('passes options to requestAdapter', async () => {
    let capturedOpts = null;
    globalThis.navigator.gpu = {
      async requestAdapter(opts) { capturedOpts = opts; return mockAdapter; },
    };
    await requestGPUAdapter({ powerPreference: 'high-performance' });
    assert.deepEqual(capturedOpts, { powerPreference: 'high-performance' });
  });

  it('returns null when requestAdapter returns null', async () => {
    globalThis.navigator.gpu = {
      async requestAdapter() { return null; },
    };
    const adapter = await requestGPUAdapter();
    assert.equal(adapter, null);
  });
});

// ─── requestGPUDevice ─────────────────────────────────────────────────────────

describe('requestGPUDevice', () => {
  it('returns a device from adapter.requestDevice()', async () => {
    const device = await requestGPUDevice(mockAdapter);
    assert.ok(device !== null);
  });

  it('returns an object with expected device properties', async () => {
    const device = await requestGPUDevice(mockAdapter);
    assert.ok(typeof device === 'object' && device !== null);
    assert.ok('queue' in device);
  });

  it('returns null when requestDevice rejects', async () => {
    const badAdapter = {
      async requestDevice() { throw new Error('device lost'); },
    };
    const device = await requestGPUDevice(badAdapter);
    assert.equal(device, null);
  });

  it('passes descriptor to requestDevice', async () => {
    let capturedDesc = null;
    const adapter = {
      async requestDevice(desc) { capturedDesc = desc; return {}; },
    };
    await requestGPUDevice(adapter, { label: 'my-device' });
    assert.deepEqual(capturedDesc, { label: 'my-device' });
  });

  it('returns null when requestDevice returns null', async () => {
    const adapter = {
      async requestDevice() { return null; },
    };
    const device = await requestGPUDevice(adapter);
    assert.equal(device, null);
  });
});

// ─── getAdapterInfo ───────────────────────────────────────────────────────────

describe('getAdapterInfo', () => {
  it('returns an object', () => {
    const info = getAdapterInfo(mockAdapter);
    assert.ok(typeof info === 'object' && info !== null);
  });

  it('returns isFallbackAdapter as a boolean', () => {
    const info = getAdapterInfo(mockAdapter);
    assert.equal(typeof info.isFallbackAdapter, 'boolean');
  });

  it('returns isFallbackAdapter false from mock adapter', () => {
    const info = getAdapterInfo(mockAdapter);
    assert.equal(info.isFallbackAdapter, false);
  });

  it('returns isFallbackAdapter true when adapter has it set', () => {
    const fallbackAdapter = { isFallbackAdapter: true };
    const info = getAdapterInfo(fallbackAdapter);
    assert.equal(info.isFallbackAdapter, true);
  });

  it('returns limits as an object', () => {
    const info = getAdapterInfo(mockAdapter);
    assert.ok(typeof info.limits === 'object' && info.limits !== null);
  });

  it('returns object with exactly isFallbackAdapter and limits keys', () => {
    const info = getAdapterInfo(mockAdapter);
    const keys = Object.keys(info).sort();
    assert.deepEqual(keys, ['isFallbackAdapter', 'limits']);
  });

  it('defaults isFallbackAdapter to false when property is absent', () => {
    const info = getAdapterInfo({});
    assert.equal(info.isFallbackAdapter, false);
  });
});
