// ─── Unit Tests: AssetManager ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AssetManager } from '../../app/modules/asset-manager.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a mock loader that resolves with a given value for each url.
 * If a url is mapped to an Error, the loader rejects with that error.
 *
 * @param {Record<string, unknown>} responses - url → data (or Error)
 * @param {{ delay?: number }} [opts]
 */
function mockLoader(responses, { delay = 0 } = {}) {
  return async (url) => {
    const response = responses[url];
    if (response instanceof Error) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      throw response;
    }
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    if (response === undefined) throw new Error(`No mock response for: ${url}`);
    return response;
  };
}

// ─── register / get ───────────────────────────────────────────────────────────

describe('AssetManager – register', () => {
  it('registers an asset in idle state', () => {
    const manager = new AssetManager({ load: mockLoader({ '/a.js': 'data' }) });
    manager.register('a', '/a.js');
    const asset = manager.get('a');
    assert.ok(asset !== undefined);
    assert.equal(asset.id, 'a');
    assert.equal(asset.url, '/a.js');
    assert.equal(asset.status, 'idle');
    assert.equal(asset.data, undefined);
  });

  it('register is idempotent (second call is no-op)', () => {
    const manager = new AssetManager({ load: mockLoader({ '/a.js': 'data' }) });
    manager.register('a', '/a.js');
    manager.register('a', '/changed.js'); // should not change anything
    assert.equal(manager.get('a')?.url, '/a.js');
  });

  it('get returns undefined for unknown id', () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    assert.equal(manager.get('unknown'), undefined);
  });
});

// ─── loadAsset ────────────────────────────────────────────────────────────────

describe('AssetManager – loadAsset', () => {
  it('loads a registered asset and returns it in loaded state', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/img.png': 'image-data' }),
    });
    manager.register('img', '/img.png');
    const asset = await manager.loadAsset('img');
    assert.equal(asset.id, 'img');
    assert.equal(asset.status, 'loaded');
    assert.equal(asset.data, 'image-data');
    assert.ok(typeof asset.loadedAt === 'number');
  });

  it('rejects for an unregistered id', async () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    await assert.rejects(
      () => manager.loadAsset('missing'),
      /not registered/,
    );
  });

  it('calling loadAsset on an already-loaded asset resolves immediately', async () => {
    let calls = 0;
    const manager = new AssetManager({
      load: async (url) => { calls += 1; return url + '_data'; },
    });
    manager.register('x', '/x');
    await manager.loadAsset('x');
    await manager.loadAsset('x');
    assert.equal(calls, 1);
  });

  it('records size for string data', async () => {
    const data = 'hello world';
    const manager = new AssetManager({ load: mockLoader({ '/f': data }) });
    manager.register('f', '/f');
    const asset = await manager.loadAsset('f');
    assert.equal(asset.size, data.length);
  });

  it('records size for ArrayBuffer data', async () => {
    const buf = new ArrayBuffer(64);
    const manager = new AssetManager({ load: mockLoader({ '/buf': buf }) });
    manager.register('buf', '/buf');
    const asset = await manager.loadAsset('buf');
    assert.equal(asset.size, 64);
  });
});

// ─── error handling ───────────────────────────────────────────────────────────

describe('AssetManager – error handling', () => {
  it('sets status to error when load throws', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/bad': new Error('network fail') }),
    });
    manager.register('bad', '/bad');
    const asset = await manager.loadAsset('bad');
    assert.equal(asset.status, 'error');
    assert.ok(asset.error instanceof Error);
    assert.equal(asset.error.message, 'network fail');
  });

  it('wraps non-Error throws in an Error', async () => {
    const manager = new AssetManager({
      load: async () => { throw 'string error'; },
    });
    manager.register('x', '/x');
    const asset = await manager.loadAsset('x');
    assert.equal(asset.status, 'error');
    assert.ok(asset.error instanceof Error);
  });

  it('does not throw from loadAsset on load failure', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/bad': new Error('fail') }),
    });
    manager.register('bad', '/bad');
    await assert.doesNotReject(() => manager.loadAsset('bad'));
  });
});

// ─── preload ──────────────────────────────────────────────────────────────────

describe('AssetManager – preload', () => {
  it('loads multiple assets and returns them all', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/a': 'A', '/b': 'B', '/c': 'C' }),
    });
    manager.register('a', '/a');
    manager.register('b', '/b');
    manager.register('c', '/c');

    const assets = await manager.preload(['a', 'b', 'c']);
    assert.equal(assets.length, 3);
    assert.ok(assets.every((a) => a.status === 'loaded'));
  });

  it('resolves even if some assets error', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/ok': 'data', '/fail': new Error('oops') }),
    });
    manager.register('ok', '/ok');
    manager.register('fail', '/fail');

    const assets = await manager.preload(['ok', 'fail']);
    assert.equal(assets.find((a) => a.id === 'ok')?.status, 'loaded');
    assert.equal(assets.find((a) => a.id === 'fail')?.status, 'error');
  });

  it('preloading empty array resolves immediately with []', async () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    const result = await manager.preload([]);
    assert.deepEqual(result, []);
  });
});

// ─── isLoaded / getAll ────────────────────────────────────────────────────────

describe('AssetManager – isLoaded', () => {
  it('returns false before loading', () => {
    const manager = new AssetManager({ load: mockLoader({ '/x': 'v' }) });
    manager.register('x', '/x');
    assert.equal(manager.isLoaded('x'), false);
  });

  it('returns true after successful load', async () => {
    const manager = new AssetManager({ load: mockLoader({ '/x': 'v' }) });
    manager.register('x', '/x');
    await manager.loadAsset('x');
    assert.equal(manager.isLoaded('x'), true);
  });

  it('returns false for an errored asset', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/x': new Error('fail') }),
    });
    manager.register('x', '/x');
    await manager.loadAsset('x');
    assert.equal(manager.isLoaded('x'), false);
  });

  it('returns false for an unknown id', () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    assert.equal(manager.isLoaded('ghost'), false);
  });
});

describe('AssetManager – getAll', () => {
  it('returns empty array when no assets registered', () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    assert.deepEqual(manager.getAll(), []);
  });

  it('returns all registered assets', () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    manager.register('a', '/a');
    manager.register('b', '/b');
    const all = manager.getAll();
    assert.equal(all.length, 2);
    assert.ok(all.some((a) => a.id === 'a'));
    assert.ok(all.some((a) => a.id === 'b'));
  });
});

// ─── unload ───────────────────────────────────────────────────────────────────

describe('AssetManager – unload', () => {
  it('resets a loaded asset to idle and removes data', async () => {
    const manager = new AssetManager({ load: mockLoader({ '/x': 'payload' }) });
    manager.register('x', '/x');
    await manager.loadAsset('x');
    assert.equal(manager.isLoaded('x'), true);

    manager.unload('x');
    const asset = manager.get('x');
    assert.equal(asset?.status, 'idle');
    assert.equal(asset?.data, undefined);
  });

  it('unloading a non-existent id is safe', () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    assert.doesNotThrow(() => manager.unload('ghost'));
  });

  it('can reload an unloaded asset', async () => {
    let calls = 0;
    const manager = new AssetManager({
      load: async (url) => { calls += 1; return url; },
    });
    manager.register('x', '/x');
    await manager.loadAsset('x');
    manager.unload('x');
    await manager.loadAsset('x');
    assert.equal(calls, 2);
    assert.equal(manager.isLoaded('x'), true);
  });
});

// ─── loadedCount ──────────────────────────────────────────────────────────────

describe('AssetManager – loadedCount', () => {
  it('starts at 0', () => {
    const manager = new AssetManager({ load: mockLoader({}) });
    assert.equal(manager.loadedCount, 0);
  });

  it('increments as assets are loaded', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/a': 'A', '/b': 'B' }),
    });
    manager.register('a', '/a');
    manager.register('b', '/b');
    assert.equal(manager.loadedCount, 0);
    await manager.loadAsset('a');
    assert.equal(manager.loadedCount, 1);
    await manager.loadAsset('b');
    assert.equal(manager.loadedCount, 2);
  });

  it('decrements after unload', async () => {
    const manager = new AssetManager({ load: mockLoader({ '/a': 'A' }) });
    manager.register('a', '/a');
    await manager.loadAsset('a');
    assert.equal(manager.loadedCount, 1);
    manager.unload('a');
    assert.equal(manager.loadedCount, 0);
  });

  it('errored assets do not count', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/bad': new Error('fail') }),
    });
    manager.register('bad', '/bad');
    await manager.loadAsset('bad');
    assert.equal(manager.loadedCount, 0);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('AssetManager – subscribe', () => {
  it('callback is called when asset status changes to loading then loaded', async () => {
    const manager = new AssetManager({ load: mockLoader({ '/x': 'data' }) });
    manager.register('x', '/x');

    const statuses = [];
    manager.subscribe('x', (asset) => statuses.push(asset.status));

    await manager.loadAsset('x');
    assert.ok(statuses.includes('loading'), 'should have loading status');
    assert.ok(statuses.includes('loaded'), 'should have loaded status');
  });

  it('callback is called with error status on failure', async () => {
    const manager = new AssetManager({
      load: mockLoader({ '/bad': new Error('fail') }),
    });
    manager.register('bad', '/bad');

    const statuses = [];
    manager.subscribe('bad', (asset) => statuses.push(asset.status));

    await manager.loadAsset('bad');
    assert.ok(statuses.includes('loading'));
    assert.ok(statuses.includes('error'));
  });

  it('unsubscribe stops future callbacks', async () => {
    const manager = new AssetManager({ load: mockLoader({ '/x': 'data' }) });
    manager.register('x', '/x');

    let count = 0;
    const unsub = manager.subscribe('x', () => { count += 1; });
    unsub();

    await manager.loadAsset('x');
    assert.equal(count, 0);
  });

  it('multiple subscribers each receive callbacks', async () => {
    const manager = new AssetManager({ load: mockLoader({ '/x': 'val' }) });
    manager.register('x', '/x');

    const calls1 = [];
    const calls2 = [];
    manager.subscribe('x', (a) => calls1.push(a.status));
    manager.subscribe('x', (a) => calls2.push(a.status));

    await manager.loadAsset('x');
    assert.ok(calls1.length > 0);
    assert.ok(calls2.length > 0);
  });

  it('callback is called on unload', async () => {
    const manager = new AssetManager({ load: mockLoader({ '/x': 'data' }) });
    manager.register('x', '/x');
    await manager.loadAsset('x');

    const statuses = [];
    manager.subscribe('x', (a) => statuses.push(a.status));
    manager.unload('x');

    assert.ok(statuses.includes('idle'));
  });
});

// ─── concurrency ──────────────────────────────────────────────────────────────

describe('AssetManager – concurrency', () => {
  it('respects max concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;

    const load = async (url) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 0));
      active -= 1;
      return url;
    };

    const manager = new AssetManager({ load, concurrency: 2 });
    for (let i = 0; i < 6; i++) {
      manager.register(`asset${i}`, `/asset${i}`);
    }

    await manager.preload(['asset0', 'asset1', 'asset2', 'asset3', 'asset4', 'asset5']);
    assert.ok(maxActive <= 2, `maxActive was ${maxActive}, expected <= 2`);
  });

  it('all assets eventually load even with concurrency=1', async () => {
    const load = async (url) => url + '_loaded';
    const manager = new AssetManager({ load, concurrency: 1 });
    for (let i = 0; i < 4; i++) {
      manager.register(`a${i}`, `/a${i}`);
    }
    const assets = await manager.preload(['a0', 'a1', 'a2', 'a3']);
    assert.ok(assets.every((a) => a.status === 'loaded'));
    assert.equal(manager.loadedCount, 4);
  });
});
