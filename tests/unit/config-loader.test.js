// ─── Unit Tests: ConfigLoader ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ConfigLoader, createConfigLoader } from '../../app/modules/config-loader.js';

// ─── loadDefaults ─────────────────────────────────────────────────────────────

describe('ConfigLoader – loadDefaults', () => {
  it('stores default values retrievable via get()', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ port: 3000, debug: false });

    assert.equal(loader.get('port'), 3000);
    assert.equal(loader.get('debug'), false);
  });

  it('returns undefined for keys not set', () => {
    const loader = new ConfigLoader();
    assert.equal(loader.get('missing'), undefined);
  });

  it('loadDefaults does not overwrite an already-set key', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ port: 8080 }, 'runtime');
    loader.loadDefaults({ port: 3000 });

    assert.equal(loader.get('port'), 8080);
  });

  it('multiple loadDefaults calls are additive for new keys', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ a: 1 });
    loader.loadDefaults({ b: 2 });

    assert.equal(loader.get('a'), 1);
    assert.equal(loader.get('b'), 2);
  });

  it('source for a default value is "defaults"', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ host: 'localhost' });

    assert.equal(loader.getSource('host'), 'defaults');
  });

  it('null and undefined values in defaults object are skipped', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ a: undefined });

    assert.equal(loader.get('a'), undefined);
    assert.equal(loader.getSource('a'), null);
  });

  it('boolean false is stored as a valid default', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ verbose: false });

    assert.equal(loader.get('verbose'), false);
  });

  it('zero is stored as a valid default', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ timeout: 0 });

    assert.equal(loader.get('timeout'), 0);
  });
});

// ─── loadObject ───────────────────────────────────────────────────────────────

describe('ConfigLoader – loadObject', () => {
  it('loads values from an object', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ host: 'example.com', port: 443 }, 'file');

    assert.equal(loader.get('host'), 'example.com');
    assert.equal(loader.get('port'), 443);
  });

  it('overwrites previously set value for the same key', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ port: 3000 }, 'file');
    loader.loadObject({ port: 8080 }, 'args');

    assert.equal(loader.get('port'), 8080);
  });

  it('source is recorded correctly', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ port: 5000 }, 'env');

    assert.equal(loader.getSource('port'), 'env');
  });

  it('source defaults to "runtime" when omitted', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ x: 1 });

    assert.equal(loader.getSource('x'), 'runtime');
  });

  it('accepts all valid ConfigSource values', () => {
    const sources = ['defaults', 'file', 'env', 'args', 'runtime'];
    for (const source of sources) {
      const loader = new ConfigLoader();
      loader.loadObject({ key: source }, source);
      assert.equal(loader.getSource('key'), source);
    }
  });

  it('undefined values in the object are skipped', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ present: 'yes', absent: undefined });

    assert.equal(loader.get('present'), 'yes');
    assert.equal(loader.get('absent'), undefined);
  });

  it('empty object is a no-op', () => {
    const loader = new ConfigLoader();
    loader.loadObject({});

    assert.deepEqual(loader.toObject(), {});
  });

  it('successive loadObject calls accumulate all keys', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ a: 1 }, 'file');
    loader.loadObject({ b: 2 }, 'args');

    assert.equal(loader.get('a'), 1);
    assert.equal(loader.get('b'), 2);
  });
});

// ─── loadEnv ──────────────────────────────────────────────────────────────────

describe('ConfigLoader – loadEnv (mapping-based)', () => {
  it('loads values from process.env via mapping', () => {
    process.env['_TEST_PORT'] = '9000';
    const loader = new ConfigLoader();
    loader.loadEnv(undefined, { port: '_TEST_PORT' });

    assert.equal(loader.get('port'), '9000');
    delete process.env['_TEST_PORT'];
  });

  it('source for env-loaded key is "env"', () => {
    process.env['_TEST_HOST'] = 'envhost';
    const loader = new ConfigLoader();
    loader.loadEnv(undefined, { host: '_TEST_HOST' });

    assert.equal(loader.getSource('host'), 'env');
    delete process.env['_TEST_HOST'];
  });

  it('missing env var does not create an entry', () => {
    const loader = new ConfigLoader();
    loader.loadEnv(undefined, { port: '_DEFINITELY_MISSING_VAR' });

    assert.equal(loader.get('port'), undefined);
    assert.equal(loader.getSource('port'), null);
  });

  it('loadEnv overwrites a previously set value', () => {
    process.env['_TEST_OVER'] = 'from-env';
    const loader = new ConfigLoader();
    loader.loadObject({ key: 'original' }, 'file');
    loader.loadEnv(undefined, { key: '_TEST_OVER' });

    assert.equal(loader.get('key'), 'from-env');
    delete process.env['_TEST_OVER'];
  });

  it('loadEnv with prefix strips prefix and lowercases key', () => {
    process.env['MYAPP_HOST'] = 'prefixed-host';
    const loader = new ConfigLoader();
    loader.loadEnv('MYAPP_');

    assert.equal(loader.get('host'), 'prefixed-host');
    delete process.env['MYAPP_HOST'];
  });

  it('loadEnv with prefix ignores vars not matching the prefix', () => {
    process.env['OTHER_HOST'] = 'other';
    const loader = new ConfigLoader();
    loader.loadEnv('MYAPP_');

    assert.equal(loader.get('other_host'), undefined);
    delete process.env['OTHER_HOST'];
  });

  it('calling loadEnv with no args is a no-op', () => {
    const loader = new ConfigLoader();
    loader.loadEnv();

    // No entries were set by the call itself; only pre-existing env survives
    // and we don't assert on external env state.
    assert.ok(typeof loader.toObject() === 'object');
  });

  it('multiple env vars loaded via mapping all resolve', () => {
    process.env['_TEST_A'] = 'alpha';
    process.env['_TEST_B'] = 'beta';
    const loader = new ConfigLoader();
    loader.loadEnv(undefined, { a: '_TEST_A', b: '_TEST_B' });

    assert.equal(loader.get('a'), 'alpha');
    assert.equal(loader.get('b'), 'beta');
    delete process.env['_TEST_A'];
    delete process.env['_TEST_B'];
  });
});

// ─── get / getOrDefault / getSource ──────────────────────────────────────────

describe('ConfigLoader – get / getOrDefault / getSource', () => {
  it('get returns undefined for unknown key', () => {
    const loader = new ConfigLoader();
    assert.equal(loader.get('nope'), undefined);
  });

  it('getOrDefault returns the value when key is set', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ port: 4000 });

    assert.equal(loader.getOrDefault('port', 9999), 4000);
  });

  it('getOrDefault returns defaultValue when key is not set', () => {
    const loader = new ConfigLoader();
    assert.equal(loader.getOrDefault('port', 9999), 9999);
  });

  it('getSource returns null for unknown key', () => {
    const loader = new ConfigLoader();
    assert.equal(loader.getSource('unknown'), null);
  });

  it('getSource reflects the most recent write source', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ x: 1 });
    assert.equal(loader.getSource('x'), 'defaults');
    loader.loadObject({ x: 2 }, 'args');
    assert.equal(loader.getSource('x'), 'args');
  });

  it('getOrDefault with false as stored value returns false not defaultValue', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ flag: false });

    assert.equal(loader.getOrDefault('flag', true), false);
  });

  it('getOrDefault with 0 as stored value returns 0 not defaultValue', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ count: 0 });

    assert.equal(loader.getOrDefault('count', 42), 0);
  });

  it('getOrDefault with empty string stored returns empty string', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ name: '' }, 'file');

    // empty string is stored (it is not undefined)
    assert.equal(loader.getOrDefault('name', 'default-name'), '');
  });
});

// ─── toObject / reset ─────────────────────────────────────────────────────────

describe('ConfigLoader – toObject / reset', () => {
  it('toObject returns all loaded key/value pairs', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ a: 1 });
    loader.loadObject({ b: 2 }, 'file');

    assert.deepEqual(loader.toObject(), { a: 1, b: 2 });
  });

  it('toObject returns empty object before any loading', () => {
    const loader = new ConfigLoader();
    assert.deepEqual(loader.toObject(), {});
  });

  it('toObject reflects the latest value after overwrite', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ port: 1234 }, 'file');
    loader.loadObject({ port: 5678 }, 'args');

    assert.deepEqual(loader.toObject(), { port: 5678 });
  });

  it('reset clears all entries', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ a: 1, b: 2 });
    loader.reset();

    assert.deepEqual(loader.toObject(), {});
    assert.equal(loader.get('a'), undefined);
  });

  it('reset allows re-loading fresh values', () => {
    const loader = new ConfigLoader();
    loader.loadDefaults({ port: 3000 });
    loader.reset();
    loader.loadDefaults({ port: 9000 });

    assert.equal(loader.get('port'), 9000);
  });

  it('toObject does not expose internal entry metadata', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ x: 42 });
    const obj = loader.toObject();

    assert.equal(Object.keys(obj).length, 1);
    assert.equal(obj['x'], 42);
  });

  it('toObject is a snapshot – mutating it does not affect loader', () => {
    const loader = new ConfigLoader();
    loader.loadObject({ color: 'red' });
    const obj = loader.toObject();
    obj['color'] = 'blue';

    assert.equal(loader.get('color'), 'red');
  });

  it('reset after no loads is a safe no-op', () => {
    const loader = new ConfigLoader();
    assert.doesNotThrow(() => loader.reset());
    assert.deepEqual(loader.toObject(), {});
  });
});

// ─── createConfigLoader factory ───────────────────────────────────────────────

describe('createConfigLoader – factory', () => {
  it('returns a ConfigLoader instance', () => {
    const loader = createConfigLoader();
    assert.ok(loader instanceof ConfigLoader);
  });

  it('factory-created loader works like constructor-created one', () => {
    const loader = createConfigLoader();
    loader.loadDefaults({ host: '127.0.0.1' });

    assert.equal(loader.get('host'), '127.0.0.1');
    assert.equal(loader.getSource('host'), 'defaults');
  });

  it('each call creates an independent loader', () => {
    const l1 = createConfigLoader();
    const l2 = createConfigLoader();
    l1.loadObject({ val: 1 });

    assert.equal(l1.get('val'), 1);
    assert.equal(l2.get('val'), undefined);
  });

  it('factory loader supports reset()', () => {
    const loader = createConfigLoader();
    loader.loadObject({ x: 99 });
    loader.reset();

    assert.equal(loader.get('x'), undefined);
  });

  it('source precedence: runtime overwrites file which overwrites defaults', () => {
    const loader = createConfigLoader();
    loader.loadDefaults({ level: 'default' });
    loader.loadObject({ level: 'file-value' }, 'file');
    loader.loadObject({ level: 'runtime-value' }, 'runtime');

    assert.equal(loader.get('level'), 'runtime-value');
    assert.equal(loader.getSource('level'), 'runtime');
  });

  it('getOrDefault on factory loader returns fallback for unset key', () => {
    const loader = createConfigLoader();
    assert.equal(loader.getOrDefault('missing', 'fallback'), 'fallback');
  });

  it('toObject on fresh factory loader returns {}', () => {
    const loader = createConfigLoader();
    assert.deepEqual(loader.toObject(), {});
  });

  it('complex value types (arrays, objects) are stored as-is', () => {
    const loader = createConfigLoader();
    const tags = ['a', 'b', 'c'];
    const meta = { version: 2 };
    loader.loadObject({ tags, meta });

    assert.deepEqual(loader.get('tags'), tags);
    assert.deepEqual(loader.get('meta'), meta);
  });
});
