// ─── Unit Tests: Result / Option Monads ───────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Ok, Err, Some, None,
  ok, err, some, none,
  fromThrowable, fromPromise,
} from '../../app/modules/result.js';

// ─── Ok ──────────────────────────────────────────────────────────────────────

describe('Ok', () => {
  it('has ok === true', () => {
    assert.equal(ok(1).ok, true);
  });

  it('holds its value', () => {
    assert.equal(ok('hello').value, 'hello');
  });

  it('map transforms the value', () => {
    const result = ok(2).map((x) => x * 3);
    assert.ok(result instanceof Ok);
    assert.equal(result.value, 6);
  });

  it('map preserves Ok type', () => {
    assert.equal(ok('a').map((s) => s.toUpperCase()).ok, true);
  });

  it('flatMap chains results', () => {
    const result = ok(5).flatMap((x) => ok(x + 1));
    assert.ok(result instanceof Ok);
    assert.equal(result.value, 6);
  });

  it('flatMap can return Err', () => {
    const e = new Error('bad');
    const result = ok(5).flatMap(() => err(e));
    assert.ok(result instanceof Err);
    assert.equal(result.error, e);
  });

  it('mapErr is a no-op on Ok', () => {
    const result = ok(42).mapErr(() => 'ignored');
    assert.ok(result instanceof Ok);
    assert.equal(result.value, 42);
  });

  it('unwrap returns the value', () => {
    assert.equal(ok(99).unwrap(), 99);
  });

  it('unwrapOr returns the value (ignores default)', () => {
    assert.equal(ok(7).unwrapOr(0), 7);
  });

  it('unwrapOrElse returns the value (ignores fn)', () => {
    assert.equal(ok(7).unwrapOrElse(() => 0), 7);
  });

  it('match calls onOk branch', () => {
    const v = ok(3).match(
      (x) => `ok:${x}`,
      () => 'err',
    );
    assert.equal(v, 'ok:3');
  });

  it('toOption returns Some', () => {
    const opt = ok('x').toOption();
    assert.ok(opt instanceof Some);
    assert.equal(opt.value, 'x');
  });
});

// ─── Err ─────────────────────────────────────────────────────────────────────

describe('Err', () => {
  it('has ok === false', () => {
    assert.equal(err(new Error('e')).ok, false);
  });

  it('holds its error', () => {
    const e = new Error('oops');
    assert.equal(err(e).error, e);
  });

  it('map is a no-op on Err', () => {
    const e = new Error('x');
    const result = err(e).map((x) => x + 1);
    assert.ok(result instanceof Err);
    assert.equal(result.error, e);
  });

  it('flatMap is a no-op on Err', () => {
    const e = new Error('x');
    const result = err(e).flatMap(() => ok(1));
    assert.ok(result instanceof Err);
    assert.equal(result.error, e);
  });

  it('mapErr transforms the error', () => {
    const result = err(new Error('raw')).mapErr((e) => e.message.toUpperCase());
    assert.ok(result instanceof Err);
    assert.equal(result.error, 'RAW');
  });

  it('unwrap throws', () => {
    assert.throws(() => err(new Error('boom')).unwrap(), /boom/);
  });

  it('unwrapOr returns the default', () => {
    assert.equal(err(new Error('e')).unwrapOr(42), 42);
  });

  it('unwrapOrElse calls the function with the error', () => {
    const result = err(new Error('msg')).unwrapOrElse((e) => e.message.length);
    assert.equal(result, 3);
  });

  it('match calls onErr branch', () => {
    const v = err(new Error('fail')).match(
      () => 'ok',
      (e) => `err:${e.message}`,
    );
    assert.equal(v, 'err:fail');
  });

  it('toOption returns none', () => {
    const opt = err(new Error('e')).toOption();
    assert.ok(opt instanceof None);
  });
});

// ─── Ok/Err chaining ─────────────────────────────────────────────────────────

describe('Result chaining', () => {
  it('chains map and flatMap through Ok values', () => {
    const result = ok(1)
      .map((x) => x + 1)
      .flatMap((x) => ok(x * 10))
      .map((x) => x - 5);
    assert.ok(result instanceof Ok);
    assert.equal(result.value, 15);
  });

  it('short-circuits on first Err in flatMap chain', () => {
    const e = new Error('stop');
    const result = ok(1)
      .flatMap(() => err(e))
      .map((x) => x + 999)
      .flatMap(() => ok('never'));
    assert.ok(result instanceof Err);
    assert.equal(result.error, e);
  });
});

// ─── Some ─────────────────────────────────────────────────────────────────────

describe('Some', () => {
  it('has some === true', () => {
    assert.equal(some(1).some, true);
  });

  it('map transforms the value', () => {
    const opt = some(4).map((x) => x * 2);
    assert.ok(opt instanceof Some);
    assert.equal(opt.value, 8);
  });

  it('flatMap chains options', () => {
    const opt = some(3).flatMap((x) => some(x + 1));
    assert.ok(opt instanceof Some);
    assert.equal(opt.value, 4);
  });

  it('flatMap can return none', () => {
    const opt = some(3).flatMap(() => none);
    assert.ok(opt instanceof None);
  });

  it('unwrap returns value', () => {
    assert.equal(some('hi').unwrap(), 'hi');
  });

  it('unwrapOr returns value (ignores default)', () => {
    assert.equal(some(5).unwrapOr(0), 5);
  });

  it('filter keeps value when predicate is true', () => {
    const opt = some(10).filter((x) => x > 5);
    assert.ok(opt instanceof Some);
    assert.equal(opt.value, 10);
  });

  it('filter discards value when predicate is false', () => {
    const opt = some(3).filter((x) => x > 5);
    assert.ok(opt instanceof None);
  });

  it('match calls onSome branch', () => {
    const v = some(7).match(
      (x) => `some:${x}`,
      () => 'none',
    );
    assert.equal(v, 'some:7');
  });

  it('toResult returns Ok', () => {
    const result = some(42).toResult(new Error('unused'));
    assert.ok(result instanceof Ok);
    assert.equal(result.value, 42);
  });
});

// ─── None ────────────────────────────────────────────────────────────────────

describe('None', () => {
  it('has some === false', () => {
    assert.equal(none.some, false);
  });

  it('map is a no-op', () => {
    const opt = none.map(() => 99);
    assert.ok(opt instanceof None);
  });

  it('flatMap is a no-op', () => {
    const opt = none.flatMap(() => some(1));
    assert.ok(opt instanceof None);
  });

  it('unwrap throws', () => {
    assert.throws(() => none.unwrap(), /None/);
  });

  it('unwrapOr returns default', () => {
    assert.equal(none.unwrapOr('default'), 'default');
  });

  it('filter is a no-op', () => {
    const opt = none.filter(() => true);
    assert.ok(opt instanceof None);
  });

  it('match calls onNone branch', () => {
    const v = none.match(
      () => 'some',
      () => 'none',
    );
    assert.equal(v, 'none');
  });

  it('toResult returns Err with provided error', () => {
    const e = new Error('missing');
    const result = none.toResult(e);
    assert.ok(result instanceof Err);
    assert.equal(result.error, e);
  });
});

// ─── fromThrowable ────────────────────────────────────────────────────────────

describe('fromThrowable', () => {
  it('returns Ok when fn succeeds', () => {
    const result = fromThrowable(() => 42);
    assert.ok(result instanceof Ok);
    assert.equal(result.value, 42);
  });

  it('returns Err when fn throws an Error', () => {
    const e = new Error('thrown');
    const result = fromThrowable(() => { throw e; });
    assert.ok(result instanceof Err);
    assert.equal(result.error, e);
  });

  it('wraps non-Error throws in an Error', () => {
    const result = fromThrowable(() => { throw 'string error'; });
    assert.ok(result instanceof Err);
    assert.ok(result.error instanceof Error);
    assert.ok(result.error.message.includes('string error'));
  });
});

// ─── fromPromise ──────────────────────────────────────────────────────────────

describe('fromPromise', () => {
  it('returns Ok for resolved promise', async () => {
    const result = await fromPromise(Promise.resolve('value'));
    assert.ok(result instanceof Ok);
    assert.equal(result.value, 'value');
  });

  it('returns Err for rejected promise', async () => {
    const e = new Error('rejected');
    const result = await fromPromise(Promise.reject(e));
    assert.ok(result instanceof Err);
    assert.equal(result.error, e);
  });

  it('wraps non-Error rejections in an Error', async () => {
    const result = await fromPromise(Promise.reject('oops'));
    assert.ok(result instanceof Err);
    assert.ok(result.error instanceof Error);
  });
});
