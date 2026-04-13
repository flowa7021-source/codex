// ─── Unit Tests: Pattern Matching ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  match,
  MatchBuilder,
  isMatch,
  guard,
} from '../../app/modules/pattern-match.js';

// ─── match() / MatchBuilder – basic ──────────────────────────────────────────

describe('match – basic when()', () => {
  it('returns result of the first matching branch (literal)', () => {
    const result = match(42)
      .when(n => n === 42, 'forty-two')
      .otherwise('other');
    assert.equal(result, 'forty-two');
  });

  it('returns result of the first matching branch (function)', () => {
    const result = match(10)
      .when(n => n > 5, n => `big: ${n}`)
      .otherwise('small');
    assert.equal(result, 'big: 10');
  });

  it('falls through to otherwise when nothing matches', () => {
    const result = match(1)
      .when(n => n > 100, 'big')
      .otherwise('fallback');
    assert.equal(result, 'fallback');
  });

  it('otherwise can be a function', () => {
    const result = match(7)
      .when(n => n === 0, 'zero')
      .otherwise(n => `default: ${n}`);
    assert.equal(result, 'default: 7');
  });

  it('picks the first matching branch, not the last', () => {
    const result = match(5)
      .when(n => n > 0, 'first')
      .when(n => n > 3, 'second')
      .otherwise('none');
    assert.equal(result, 'first');
  });

  it('supports zero branches with otherwise', () => {
    const result = match('hello').otherwise('fallback');
    assert.equal(result, 'fallback');
  });
});

// ─── match() – exhaustive() ───────────────────────────────────────────────────

describe('match – exhaustive()', () => {
  it('returns matched value without throwing', () => {
    const result = match(1)
      .when(n => n === 1, 'one')
      .exhaustive();
    assert.equal(result, 'one');
  });

  it('throws TypeError when no branch matches', () => {
    assert.throws(
      () => match(99).when(n => n === 0, 'zero').exhaustive(),
      TypeError,
    );
  });

  it('error message mentions exhaustive', () => {
    try {
      match('x').exhaustive();
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof TypeError);
      assert.ok(err.message.includes('exhaustive'));
    }
  });
});

// ─── match() – with() object pattern ─────────────────────────────────────────

describe('match – with() object pattern', () => {
  it('matches when all pattern keys equal value keys', () => {
    const obj = { type: 'click', x: 10, y: 20 };
    const result = match(obj)
      .with({ type: 'click' }, 'clicked')
      .otherwise('other');
    assert.equal(result, 'clicked');
  });

  it('does not match when a pattern key differs', () => {
    const obj = { type: 'hover', x: 10 };
    const result = match(obj)
      .with({ type: 'click' }, 'clicked')
      .otherwise('not clicked');
    assert.equal(result, 'not clicked');
  });

  it('matches nested pattern object', () => {
    const obj = { event: { type: 'keydown', key: 'Enter' }, repeat: false };
    const result = match(obj)
      .with({ event: { key: 'Enter' } }, 'enter pressed')
      .otherwise('other key');
    assert.equal(result, 'enter pressed');
  });

  it('with() result can be a function', () => {
    const obj = { code: 200, body: 'ok' };
    const result = match(obj)
      .with({ code: 200 }, v => `success: ${v.body}`)
      .otherwise('error');
    assert.equal(result, 'success: ok');
  });

  it('with() is skipped when extra pattern keys are absent in value', () => {
    const obj = { a: 1 };
    const result = match(obj)
      .with({ a: 1, b: 2 }, 'match')
      .otherwise('no match');
    assert.equal(result, 'no match');
  });
});

// ─── isMatch() ────────────────────────────────────────────────────────────────

describe('isMatch – primitives', () => {
  it('matches identical primitives', () => {
    assert.equal(isMatch(1, 1), true);
    assert.equal(isMatch('hello', 'hello'), true);
    assert.equal(isMatch(true, true), true);
    assert.equal(isMatch(null, null), true);
  });

  it('rejects different primitives', () => {
    assert.equal(isMatch(1, 2), false);
    assert.equal(isMatch('a', 'b'), false);
    assert.equal(isMatch(null, undefined), false);
  });
});

describe('isMatch – objects', () => {
  it('partial object match succeeds', () => {
    assert.equal(isMatch({ a: 1, b: 2, c: 3 }, { a: 1 }), true);
  });

  it('partial object match fails when value differs', () => {
    assert.equal(isMatch({ a: 1 }, { a: 2 }), false);
  });

  it('empty pattern matches any object', () => {
    assert.equal(isMatch({ x: 1 }, {}), true);
  });

  it('pattern key missing from value fails', () => {
    assert.equal(isMatch({ a: 1 }, { b: 1 }), false);
  });

  it('nested object pattern matches', () => {
    assert.equal(isMatch({ a: { b: { c: 42 } } }, { a: { b: { c: 42 } } }), true);
  });

  it('nested object pattern fails on deep mismatch', () => {
    assert.equal(isMatch({ a: { b: 1 } }, { a: { b: 2 } }), false);
  });
});

describe('isMatch – arrays', () => {
  it('identical arrays match', () => {
    assert.equal(isMatch([1, 2, 3], [1, 2, 3]), true);
  });

  it('different length arrays do not match', () => {
    assert.equal(isMatch([1, 2], [1, 2, 3]), false);
  });

  it('array with different element does not match', () => {
    assert.equal(isMatch([1, 2, 3], [1, 2, 4]), false);
  });

  it('object pattern does not match array value', () => {
    assert.equal(isMatch([1, 2], { 0: 1 }), false);
  });
});

// ─── guard() ─────────────────────────────────────────────────────────────────

describe('guard()', () => {
  it('returns result of first matching guard', () => {
    const result = guard(85, [
      [s => s >= 90, () => 'A'],
      [s => s >= 80, () => 'B'],
      [() => true,  () => 'C'],
    ]);
    assert.equal(result, 'B');
  });

  it('returns undefined when no guard matches', () => {
    const result = guard(5, [
      [n => n > 10, () => 'big'],
    ]);
    assert.equal(result, undefined);
  });

  it('passes the value to the handler', () => {
    const result = guard(42, [
      [n => n === 42, n => `answer is ${n}`],
    ]);
    assert.equal(result, 'answer is 42');
  });

  it('evaluates guards in order and stops at first match', () => {
    const log = [];
    guard(1, [
      [() => { log.push('g1'); return true; },  () => 'first'],
      [() => { log.push('g2'); return true; },  () => 'second'],
    ]);
    assert.deepEqual(log, ['g1']);
  });

  it('handles empty guards array', () => {
    const result = guard('anything', []);
    assert.equal(result, undefined);
  });

  it('works with object values', () => {
    const obj = { role: 'admin' };
    const result = guard(obj, [
      [o => o.role === 'guest',  () => 'limited'],
      [o => o.role === 'admin',  () => 'full'],
    ]);
    assert.equal(result, 'full');
  });
});

// ─── MatchBuilder – chaining and type checks ─────────────────────────────────

describe('MatchBuilder – chaining', () => {
  it('match() returns a MatchBuilder instance', () => {
    assert.ok(match(1) instanceof MatchBuilder);
  });

  it('when() returns the same builder for chaining', () => {
    const builder = match(1);
    const returned = builder.when(() => false, 0);
    assert.equal(returned, builder);
  });

  it('with() returns the same builder for chaining', () => {
    const builder = match({ a: 1 });
    const returned = builder.with({ a: 1 }, 'ok');
    assert.equal(returned, builder);
  });

  it('can chain multiple when() clauses', () => {
    const classify = n =>
      match(n)
        .when(x => x < 0, 'negative')
        .when(x => x === 0, 'zero')
        .when(x => x > 0, 'positive')
        .exhaustive();

    assert.equal(classify(-5), 'negative');
    assert.equal(classify(0), 'zero');
    assert.equal(classify(3), 'positive');
  });

  it('mixes when() and with() in a single chain', () => {
    const handle = event =>
      match(event)
        .when(e => e.type === 'error', 'error event')
        .with({ type: 'click' }, 'click event')
        .otherwise('unknown');

    assert.equal(handle({ type: 'error' }), 'error event');
    assert.equal(handle({ type: 'click' }), 'click event');
    assert.equal(handle({ type: 'hover' }), 'unknown');
  });
});
