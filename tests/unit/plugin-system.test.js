// ─── Unit Tests: PluginSystem ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PluginSystem } from '../../app/modules/plugin-system.js';

// ─── install / has / installedIds ─────────────────────────────────────────────

describe('PluginSystem – install / has / installedIds', () => {
  it('has() returns false before install', () => {
    const ps = new PluginSystem();
    assert.equal(ps.has('my-plugin'), false);
  });

  it('has() returns true after install', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'my-plugin', name: 'My Plugin', install() {} });
    assert.equal(ps.has('my-plugin'), true);
  });

  it('installedIds() returns ids in install order', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'alpha', name: 'Alpha', install() {} });
    ps.install({ id: 'beta', name: 'Beta', install() {} });
    ps.install({ id: 'gamma', name: 'Gamma', install() {} });
    assert.deepEqual(ps.installedIds(), ['alpha', 'beta', 'gamma']);
  });

  it('installedIds() returns a copy (mutation-safe)', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'p1', name: 'P1', install() {} });
    const ids = ps.installedIds();
    ids.push('injected');
    assert.deepEqual(ps.installedIds(), ['p1']);
  });

  it('install() calls the plugin install function', () => {
    const ps = new PluginSystem();
    let called = false;
    ps.install({ id: 'p', name: 'P', install() { called = true; } });
    assert.equal(called, true);
  });
});

// ─── dependency resolution ────────────────────────────────────────────────────

describe('PluginSystem – dependency resolution', () => {
  it('can install a plugin whose dependency is already installed', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'base', name: 'Base', install() {} });
    ps.install({ id: 'ext', name: 'Ext', dependencies: ['base'], install() {} });
    assert.equal(ps.has('ext'), true);
  });

  it('throws when dependency is not installed', () => {
    const ps = new PluginSystem();
    assert.throws(
      () => ps.install({ id: 'ext', name: 'Ext', dependencies: ['missing'], install() {} }),
      /depends on "missing"/,
    );
  });

  it('multiple dependencies all present — installs fine', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'a', name: 'A', install() {} });
    ps.install({ id: 'b', name: 'B', install() {} });
    ps.install({ id: 'c', name: 'C', dependencies: ['a', 'b'], install() {} });
    assert.equal(ps.has('c'), true);
  });

  it('throws when only one of multiple dependencies is missing', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'a', name: 'A', install() {} });
    assert.throws(
      () => ps.install({ id: 'c', name: 'C', dependencies: ['a', 'b'], install() {} }),
      /depends on "b"/,
    );
  });
});

// ─── uninstall ────────────────────────────────────────────────────────────────

describe('PluginSystem – uninstall', () => {
  it('has() returns false after uninstall', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'p', name: 'P', install() {} });
    ps.uninstall('p');
    assert.equal(ps.has('p'), false);
  });

  it('calls plugin.uninstall() if provided', () => {
    const ps = new PluginSystem();
    let cleanupCalled = false;
    ps.install({ id: 'p', name: 'P', install() {}, uninstall() { cleanupCalled = true; } });
    ps.uninstall('p');
    assert.equal(cleanupCalled, true);
  });

  it('uninstall of unknown id is a no-op', () => {
    const ps = new PluginSystem();
    assert.doesNotThrow(() => ps.uninstall('ghost'));
  });

  it('removes id from installedIds()', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'a', name: 'A', install() {} });
    ps.install({ id: 'b', name: 'B', install() {} });
    ps.uninstall('a');
    assert.deepEqual(ps.installedIds(), ['b']);
  });
});

// ─── getService ───────────────────────────────────────────────────────────────

describe('PluginSystem – getService', () => {
  it('returns undefined for unregistered service', () => {
    const ps = new PluginSystem();
    assert.equal(ps.getService('db'), undefined);
  });

  it('plugin registers a service, getService retrieves it', () => {
    const ps = new PluginSystem();
    const myService = { query() { return 42; } };
    ps.install({
      id: 'db-plugin',
      name: 'DB Plugin',
      install(api) { api.register('db', myService); },
    });
    assert.strictEqual(ps.getService('db'), myService);
  });

  it('later plugin can retrieve service from earlier plugin via api.get', () => {
    const ps = new PluginSystem();
    ps.install({ id: 'provider', name: 'Provider', install(api) { api.register('msg', 'hello'); } });

    let retrieved;
    ps.install({ id: 'consumer', name: 'Consumer', install(api) { retrieved = api.get('msg'); } });
    assert.equal(retrieved, 'hello');
  });
});

// ─── emit + on (cross-plugin events) ─────────────────────────────────────────

describe('PluginSystem – emit + on', () => {
  it('plugin receives event emitted by another plugin', () => {
    const ps = new PluginSystem();
    const received = [];

    ps.install({
      id: 'listener',
      name: 'Listener',
      install(api) { api.on('data', (d) => received.push(d)); },
    });

    ps.install({
      id: 'emitter',
      name: 'Emitter',
      install(api) { api.emit('data', { value: 1 }); },
    });

    assert.deepEqual(received, [{ value: 1 }]);
  });

  it('system-level emit reaches plugin handlers', () => {
    const ps = new PluginSystem();
    const log = [];

    ps.install({ id: 'p', name: 'P', install(api) { api.on('tick', (d) => log.push(d)); } });
    ps.emit('tick', 'now');
    assert.deepEqual(log, ['now']);
  });

  it('remove fn from on() unsubscribes the handler', () => {
    const ps = new PluginSystem();
    const log = [];
    let removeFn;

    ps.install({
      id: 'p',
      name: 'P',
      install(api) { removeFn = api.on('ping', (d) => log.push(d)); },
    });

    ps.emit('ping', 1);
    removeFn();
    ps.emit('ping', 2);

    assert.deepEqual(log, [1]);
  });

  it('multiple listeners all receive the same event', () => {
    const ps = new PluginSystem();
    const a = [];
    const b = [];

    ps.install({ id: 'pa', name: 'PA', install(api) { api.on('go', (d) => a.push(d)); } });
    ps.install({ id: 'pb', name: 'PB', install(api) { api.on('go', (d) => b.push(d)); } });

    ps.emit('go', 'signal');
    assert.deepEqual(a, ['signal']);
    assert.deepEqual(b, ['signal']);
  });

  it('event with no listeners is a no-op', () => {
    const ps = new PluginSystem();
    assert.doesNotThrow(() => ps.emit('unknown-event', {}));
  });
});

// ─── idempotent install ───────────────────────────────────────────────────────

describe('PluginSystem – idempotent install', () => {
  it('installing the same plugin twice does not duplicate it', () => {
    const ps = new PluginSystem();
    let callCount = 0;
    const plugin = { id: 'p', name: 'P', install() { callCount++; } };
    ps.install(plugin);
    ps.install(plugin);
    assert.equal(callCount, 1);
    assert.deepEqual(ps.installedIds(), ['p']);
  });

  it('second install of same id (different object) is skipped', () => {
    const ps = new PluginSystem();
    let count = 0;
    ps.install({ id: 'p', name: 'P v1', install() { count++; } });
    ps.install({ id: 'p', name: 'P v2', install() { count++; } });
    assert.equal(count, 1);
  });
});
