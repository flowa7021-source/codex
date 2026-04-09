// ─── Unit Tests: EnvConfig ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EnvConfig, createEnvConfig } from '../../app/modules/env-config.js';

// All tests inject env as the second constructor argument – no process.env
// pollution occurs.

// ─── Type coercion: string ────────────────────────────────────────────────────

describe('EnvConfig – string coercion', () => {
  it('returns raw string value unchanged', () => {
    const cfg = new EnvConfig(
      { NAME: { type: 'string' } },
      { NAME: 'hello' },
    );
    assert.equal(cfg.getString('NAME'), 'hello');
  });

  it('getString with fallback returns fallback when key is not in env', () => {
    const cfg = new EnvConfig(
      { NAME: { type: 'string', default: 'world' } },
      {},
    );
    assert.equal(cfg.getString('NAME'), 'world');
  });

  it('getString with explicit fallback arg uses it when value is missing', () => {
    const cfg = new EnvConfig({ X: { type: 'string' } }, {});
    assert.equal(cfg.getString('X', 'fallback-val'), 'fallback-val');
  });

  it('getString throws when required and absent', () => {
    const cfg = new EnvConfig({ X: { type: 'string' } }, {});
    assert.throws(() => cfg.getString('X'), TypeError);
  });

  it('empty string in env is treated as missing (uses default)', () => {
    const cfg = new EnvConfig(
      { X: { type: 'string', default: 'def' } },
      { X: '' },
    );
    assert.equal(cfg.getString('X'), 'def');
  });

  it('get() returns the raw typed value as unknown', () => {
    const cfg = new EnvConfig({ VAR: { type: 'string' } }, { VAR: 'test' });
    assert.equal(cfg.get('VAR'), 'test');
  });

  it('get() returns undefined when no env value and no default', () => {
    const cfg = new EnvConfig({ VAR: { type: 'string' } }, {});
    assert.equal(cfg.get('VAR'), undefined);
  });

  it('unknown key throws RangeError', () => {
    const cfg = new EnvConfig({}, {});
    assert.throws(() => cfg.get('NO_SUCH_KEY'), RangeError);
  });
});

// ─── Type coercion: number ────────────────────────────────────────────────────

describe('EnvConfig – number coercion', () => {
  it('coerces numeric string to number', () => {
    const cfg = new EnvConfig({ PORT: { type: 'number' } }, { PORT: '8080' });
    assert.equal(cfg.getNumber('PORT'), 8080);
  });

  it('coerces float string to float', () => {
    const cfg = new EnvConfig({ RATIO: { type: 'number' } }, { RATIO: '3.14' });
    assert.ok(Math.abs(cfg.getNumber('RATIO') - 3.14) < 0.001);
  });

  it('uses numeric default when env var is absent', () => {
    const cfg = new EnvConfig(
      { PORT: { type: 'number', default: 3000 } },
      {},
    );
    assert.equal(cfg.getNumber('PORT'), 3000);
  });

  it('getNumber with fallback arg returns fallback when absent', () => {
    const cfg = new EnvConfig({ PORT: { type: 'number' } }, {});
    assert.equal(cfg.getNumber('PORT', 9999), 9999);
  });

  it('non-numeric string throws TypeError', () => {
    const cfg = new EnvConfig({ PORT: { type: 'number' } }, { PORT: 'abc' });
    assert.throws(() => cfg.getNumber('PORT'), TypeError);
  });

  it('coerces zero string to 0', () => {
    const cfg = new EnvConfig({ N: { type: 'number' } }, { N: '0' });
    assert.equal(cfg.getNumber('N'), 0);
  });

  it('coerces negative number string', () => {
    const cfg = new EnvConfig({ N: { type: 'number' } }, { N: '-42' });
    assert.equal(cfg.getNumber('N'), -42);
  });

  it('getNumber throws TypeError when absent and no fallback', () => {
    const cfg = new EnvConfig({ PORT: { type: 'number' } }, {});
    assert.throws(() => cfg.getNumber('PORT'), TypeError);
  });
});

// ─── Type coercion: boolean ───────────────────────────────────────────────────

describe('EnvConfig – boolean coercion', () => {
  it('"true" coerces to true', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: 'true' });
    assert.equal(cfg.getBoolean('FLAG'), true);
  });

  it('"false" coerces to false', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: 'false' });
    assert.equal(cfg.getBoolean('FLAG'), false);
  });

  it('"1" coerces to true', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: '1' });
    assert.equal(cfg.getBoolean('FLAG'), true);
  });

  it('"0" coerces to false', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: '0' });
    assert.equal(cfg.getBoolean('FLAG'), false);
  });

  it('"yes" coerces to true', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: 'yes' });
    assert.equal(cfg.getBoolean('FLAG'), true);
  });

  it('"no" coerces to false', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: 'no' });
    assert.equal(cfg.getBoolean('FLAG'), false);
  });

  it('invalid boolean string throws TypeError', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: 'maybe' });
    assert.throws(() => cfg.getBoolean('FLAG'), TypeError);
  });

  it('uses boolean default when absent', () => {
    const cfg = new EnvConfig(
      { DEBUG: { type: 'boolean', default: false } },
      {},
    );
    assert.equal(cfg.getBoolean('DEBUG'), false);
  });

  it('getBoolean with fallback arg returns fallback when absent', () => {
    const cfg = new EnvConfig({ DEBUG: { type: 'boolean' } }, {});
    assert.equal(cfg.getBoolean('DEBUG', true), true);
  });

  it('case-insensitive: "TRUE" coerces to true', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'boolean' } }, { FLAG: 'TRUE' });
    assert.equal(cfg.getBoolean('FLAG'), true);
  });
});

// ─── Type coercion: json ──────────────────────────────────────────────────────

describe('EnvConfig – JSON coercion', () => {
  it('parses a JSON object string', () => {
    const cfg = new EnvConfig(
      { CFG: { type: 'json' } },
      { CFG: '{"a":1,"b":2}' },
    );
    assert.deepEqual(cfg.getJSON('CFG'), { a: 1, b: 2 });
  });

  it('parses a JSON array string', () => {
    const cfg = new EnvConfig(
      { LIST: { type: 'json' } },
      { LIST: '[1,2,3]' },
    );
    assert.deepEqual(cfg.getJSON('LIST'), [1, 2, 3]);
  });

  it('parses a JSON number string', () => {
    const cfg = new EnvConfig(
      { N: { type: 'json' } },
      { N: '42' },
    );
    assert.equal(cfg.getJSON('N'), 42);
  });

  it('invalid JSON string throws TypeError', () => {
    const cfg = new EnvConfig(
      { BAD: { type: 'json' } },
      { BAD: '{not json}' },
    );
    assert.throws(() => cfg.getJSON('BAD'), TypeError);
  });

  it('uses default when env var is absent', () => {
    const cfg = new EnvConfig(
      { OPTS: { type: 'json', default: { x: 0 } } },
      {},
    );
    assert.deepEqual(cfg.getJSON('OPTS'), { x: 0 });
  });

  it('getJSON with fallback arg uses fallback when absent', () => {
    const cfg = new EnvConfig({ OPTS: { type: 'json' } }, {});
    assert.deepEqual(cfg.getJSON('OPTS', { fallback: true }), { fallback: true });
  });

  it('getJSON throws when absent and no fallback provided', () => {
    const cfg = new EnvConfig({ OPTS: { type: 'json' } }, {});
    assert.throws(() => cfg.getJSON('OPTS'), TypeError);
  });

  it('parses a JSON boolean "true"', () => {
    const cfg = new EnvConfig({ FLAG: { type: 'json' } }, { FLAG: 'true' });
    assert.equal(cfg.getJSON('FLAG'), true);
  });
});

// ─── validate ─────────────────────────────────────────────────────────────────

describe('EnvConfig – validate', () => {
  it('returns valid:true and empty errors when all required fields present', () => {
    const cfg = new EnvConfig(
      {
        HOST: { type: 'string', required: true },
        PORT: { type: 'number', required: true },
      },
      { HOST: 'localhost', PORT: '3000' },
    );
    const result = cfg.validate();

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('returns valid:false and lists missing required field', () => {
    const cfg = new EnvConfig(
      { HOST: { type: 'string', required: true } },
      {},
    );
    const result = cfg.validate();

    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].includes('HOST'));
  });

  it('non-required missing field does not produce an error', () => {
    const cfg = new EnvConfig(
      { HOST: { type: 'string', required: false } },
      {},
    );
    const result = cfg.validate();

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('multiple missing required fields all appear in errors', () => {
    const cfg = new EnvConfig(
      {
        A: { type: 'string', required: true },
        B: { type: 'number', required: true },
      },
      {},
    );
    const result = cfg.validate();

    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 2);
  });

  it('field with a default satisfies required constraint', () => {
    const cfg = new EnvConfig(
      { HOST: { type: 'string', required: true, default: 'localhost' } },
      {},
    );
    const result = cfg.validate();

    assert.equal(result.valid, true);
  });

  it('empty schema always returns valid', () => {
    const cfg = new EnvConfig({}, {});
    const result = cfg.validate();

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('validate does not mutate the schema', () => {
    const schema = { X: { type: 'string', required: true } };
    const cfg = new EnvConfig(schema, {});
    cfg.validate();

    assert.deepEqual(schema, { X: { type: 'string', required: true } });
  });

  it('required fields present via env pass validation', () => {
    const cfg = new EnvConfig(
      {
        API_KEY: { type: 'string', required: true },
        WORKERS: { type: 'number', required: true },
      },
      { API_KEY: 'secret', WORKERS: '4' },
    );
    const result = cfg.validate();

    assert.equal(result.valid, true);
  });
});

// ─── toObject ─────────────────────────────────────────────────────────────────

describe('EnvConfig – toObject', () => {
  it('returns all schema keys with resolved values', () => {
    const cfg = new EnvConfig(
      {
        HOST: { type: 'string', default: 'localhost' },
        PORT: { type: 'number', default: 3000 },
      },
      {},
    );
    const obj = cfg.toObject();

    assert.deepEqual(obj, { HOST: 'localhost', PORT: 3000 });
  });

  it('env values override defaults in toObject', () => {
    const cfg = new EnvConfig(
      { PORT: { type: 'number', default: 3000 } },
      { PORT: '9090' },
    );
    assert.deepEqual(cfg.toObject(), { PORT: 9090 });
  });

  it('absent optional fields resolve to undefined in toObject', () => {
    const cfg = new EnvConfig({ X: { type: 'string' } }, {});
    const obj = cfg.toObject();

    assert.ok(Object.prototype.hasOwnProperty.call(obj, 'X'));
    assert.equal(obj['X'], undefined);
  });

  it('toObject includes all schema keys even when not set', () => {
    const cfg = new EnvConfig(
      { A: { type: 'string' }, B: { type: 'number' } },
      {},
    );
    const obj = cfg.toObject();

    assert.ok(Object.prototype.hasOwnProperty.call(obj, 'A'));
    assert.ok(Object.prototype.hasOwnProperty.call(obj, 'B'));
  });

  it('toObject for empty schema returns {}', () => {
    const cfg = new EnvConfig({}, {});
    assert.deepEqual(cfg.toObject(), {});
  });

  it('boolean false default appears in toObject', () => {
    const cfg = new EnvConfig(
      { DEBUG: { type: 'boolean', default: false } },
      {},
    );
    assert.equal(cfg.toObject()['DEBUG'], false);
  });

  it('JSON type is resolved and present in toObject', () => {
    const cfg = new EnvConfig(
      { OPTS: { type: 'json', default: { a: 1 } } },
      {},
    );
    assert.deepEqual(cfg.toObject()['OPTS'], { a: 1 });
  });

  it('toObject returns fresh snapshot not affected by later env changes', () => {
    const env = { PORT: '3000' };
    const cfg = new EnvConfig({ PORT: { type: 'number' } }, env);
    const snap = cfg.toObject();

    env['PORT'] = '9999';
    // Cached value must remain 3000
    assert.equal(snap['PORT'], 3000);
  });
});

// ─── createEnvConfig factory ──────────────────────────────────────────────────

describe('createEnvConfig – factory', () => {
  it('returns an EnvConfig instance', () => {
    const cfg = createEnvConfig({});
    assert.ok(cfg instanceof EnvConfig);
  });

  it('factory-created instance resolves values correctly', () => {
    const cfg = createEnvConfig(
      { NAME: { type: 'string', default: 'app' } },
      {},
    );
    assert.equal(cfg.getString('NAME'), 'app');
  });

  it('each call creates an independent instance', () => {
    const c1 = createEnvConfig({ X: { type: 'string' } }, { X: 'one' });
    const c2 = createEnvConfig({ X: { type: 'string' } }, { X: 'two' });

    assert.equal(c1.getString('X'), 'one');
    assert.equal(c2.getString('X'), 'two');
  });

  it('factory supports all field types', () => {
    const cfg = createEnvConfig(
      {
        S: { type: 'string' },
        N: { type: 'number' },
        B: { type: 'boolean' },
        J: { type: 'json' },
      },
      { S: 'str', N: '7', B: 'true', J: '{"k":1}' },
    );
    assert.equal(cfg.getString('S'), 'str');
    assert.equal(cfg.getNumber('N'), 7);
    assert.equal(cfg.getBoolean('B'), true);
    assert.deepEqual(cfg.getJSON('J'), { k: 1 });
  });

  it('factory validate works correctly', () => {
    const cfg = createEnvConfig(
      { KEY: { type: 'string', required: true } },
      { KEY: 'present' },
    );
    assert.equal(cfg.validate().valid, true);
  });

  it('factory toObject works correctly', () => {
    const cfg = createEnvConfig(
      { PORT: { type: 'number', default: 4000 } },
      {},
    );
    assert.deepEqual(cfg.toObject(), { PORT: 4000 });
  });

  it('factory with no env arg does not throw', () => {
    assert.doesNotThrow(() => createEnvConfig({ X: { type: 'string' } }));
  });

  it('description field in schema is tolerated and ignored at runtime', () => {
    const cfg = createEnvConfig(
      { X: { type: 'string', default: 'hi', description: 'A test var' } },
      {},
    );
    assert.equal(cfg.getString('X'), 'hi');
  });
});
