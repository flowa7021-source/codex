// ─── Unit Tests: rope ─────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Rope, createRope } from '../../app/modules/rope.js';

// ─── constructor / toString ──────────────────────────────────────────────────

describe('Rope constructor & toString', () => {
  it('creates an empty rope when no argument is given', () => {
    const r = new Rope();
    assert.equal(r.toString(), '');
    assert.equal(r.length, 0);
  });

  it('creates a rope from a string', () => {
    const r = new Rope('hello');
    assert.equal(r.toString(), 'hello');
    assert.equal(r.length, 5);
  });

  it('handles a large string that triggers balanced splitting', () => {
    const str = 'a'.repeat(2000);
    const r = new Rope(str);
    assert.equal(r.toString(), str);
    assert.equal(r.length, 2000);
  });
});

// ─── createRope factory ─────────────────────────────────────────────────────

describe('createRope', () => {
  it('returns a Rope instance', () => {
    const r = createRope('test');
    assert.ok(r instanceof Rope);
    assert.equal(r.toString(), 'test');
  });

  it('returns empty rope with no args', () => {
    const r = createRope();
    assert.equal(r.length, 0);
  });
});

// ─── charAt ─────────────────────────────────────────────────────────────────

describe('Rope.charAt', () => {
  it('returns the correct character at a given index', () => {
    const r = new Rope('abcdef');
    assert.equal(r.charAt(0), 'a');
    assert.equal(r.charAt(3), 'd');
    assert.equal(r.charAt(5), 'f');
  });

  it('returns empty string for out-of-range indices', () => {
    const r = new Rope('abc');
    assert.equal(r.charAt(-1), '');
    assert.equal(r.charAt(3), '');
    assert.equal(r.charAt(100), '');
  });
});

// ─── concat ─────────────────────────────────────────────────────────────────

describe('Rope.concat', () => {
  it('joins two ropes', () => {
    const a = new Rope('hello');
    const b = new Rope(' world');
    const c = a.concat(b);
    assert.equal(c.toString(), 'hello world');
    assert.equal(c.length, 11);
  });

  it('concatenating with an empty rope returns equivalent rope', () => {
    const a = new Rope('abc');
    const empty = new Rope();
    assert.equal(a.concat(empty).toString(), 'abc');
    assert.equal(empty.concat(a).toString(), 'abc');
  });

  it('does not mutate the original ropes', () => {
    const a = new Rope('foo');
    const b = new Rope('bar');
    a.concat(b);
    assert.equal(a.toString(), 'foo');
    assert.equal(b.toString(), 'bar');
  });
});

// ─── split ──────────────────────────────────────────────────────────────────

describe('Rope.split', () => {
  it('splits a rope into two parts', () => {
    const r = new Rope('abcdef');
    const [left, right] = r.split(3);
    assert.equal(left.toString(), 'abc');
    assert.equal(right.toString(), 'def');
  });

  it('split at 0 gives empty left', () => {
    const r = new Rope('hello');
    const [left, right] = r.split(0);
    assert.equal(left.toString(), '');
    assert.equal(right.toString(), 'hello');
  });

  it('split at length gives empty right', () => {
    const r = new Rope('hello');
    const [left, right] = r.split(5);
    assert.equal(left.toString(), 'hello');
    assert.equal(right.toString(), '');
  });
});

// ─── substring ──────────────────────────────────────────────────────────────

describe('Rope.substring', () => {
  it('extracts a substring', () => {
    const r = new Rope('hello world');
    assert.equal(r.substring(0, 5), 'hello');
    assert.equal(r.substring(6), 'world');
    assert.equal(r.substring(6, 11), 'world');
  });

  it('returns empty string for out-of-range or zero-length range', () => {
    const r = new Rope('abc');
    assert.equal(r.substring(3, 3), '');
    assert.equal(r.substring(5, 10), '');
  });

  it('clamps parameters to valid range', () => {
    const r = new Rope('abcdef');
    assert.equal(r.substring(-2, 3), 'abc');
    assert.equal(r.substring(3, 100), 'def');
  });
});

// ─── insert ─────────────────────────────────────────────────────────────────

describe('Rope.insert', () => {
  it('inserts text at the beginning', () => {
    const r = new Rope('world');
    const result = r.insert(0, 'hello ');
    assert.equal(result.toString(), 'hello world');
  });

  it('inserts text in the middle', () => {
    const r = new Rope('helo');
    const result = r.insert(2, 'l');
    assert.equal(result.toString(), 'hello');
  });

  it('inserts text at the end', () => {
    const r = new Rope('hello');
    const result = r.insert(5, ' world');
    assert.equal(result.toString(), 'hello world');
  });

  it('returns same rope when inserting empty string', () => {
    const r = new Rope('abc');
    const result = r.insert(1, '');
    assert.equal(result.toString(), 'abc');
  });

  it('does not mutate the original rope', () => {
    const r = new Rope('abc');
    r.insert(1, 'X');
    assert.equal(r.toString(), 'abc');
  });
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe('Rope.delete', () => {
  it('deletes a range from the middle', () => {
    const r = new Rope('abcdef');
    const result = r.delete(2, 4);
    assert.equal(result.toString(), 'abef');
  });

  it('deletes from the beginning', () => {
    const r = new Rope('hello world');
    const result = r.delete(0, 6);
    assert.equal(result.toString(), 'world');
  });

  it('deletes to the end', () => {
    const r = new Rope('hello world');
    const result = r.delete(5, 11);
    assert.equal(result.toString(), 'hello');
  });

  it('returns same rope when range is empty', () => {
    const r = new Rope('abc');
    const result = r.delete(1, 1);
    assert.equal(result.toString(), 'abc');
  });

  it('does not mutate the original rope', () => {
    const r = new Rope('abcdef');
    r.delete(0, 3);
    assert.equal(r.toString(), 'abcdef');
  });
});

// ─── indexOf ────────────────────────────────────────────────────────────────

describe('Rope.indexOf', () => {
  it('finds a substring', () => {
    const r = new Rope('hello world');
    assert.equal(r.indexOf('world'), 6);
  });

  it('returns -1 when not found', () => {
    const r = new Rope('hello world');
    assert.equal(r.indexOf('xyz'), -1);
  });

  it('finds substring at position 0', () => {
    const r = new Rope('hello');
    assert.equal(r.indexOf('hel'), 0);
  });
});

// ─── lineAt / lineCount ─────────────────────────────────────────────────────

describe('Rope line operations', () => {
  it('counts lines in multiline text', () => {
    const r = new Rope('line1\nline2\nline3');
    assert.equal(r.lineCount, 3);
  });

  it('returns 1 for single line text', () => {
    const r = new Rope('hello');
    assert.equal(r.lineCount, 1);
  });

  it('returns 1 for empty rope', () => {
    const r = new Rope();
    assert.equal(r.lineCount, 1);
  });

  it('retrieves a specific line by 0-based index', () => {
    const r = new Rope('alpha\nbeta\ngamma');
    assert.equal(r.lineAt(0), 'alpha');
    assert.equal(r.lineAt(1), 'beta');
    assert.equal(r.lineAt(2), 'gamma');
  });

  it('returns empty string for out-of-range line number', () => {
    const r = new Rope('a\nb');
    assert.equal(r.lineAt(-1), '');
    assert.equal(r.lineAt(2), '');
  });

  it('handles trailing newline', () => {
    const r = new Rope('a\nb\n');
    assert.equal(r.lineCount, 3);
    assert.equal(r.lineAt(2), '');
  });
});

// ─── integration: chained operations ────────────────────────────────────────

describe('Rope chained operations', () => {
  it('insert then delete round-trips', () => {
    const r = new Rope('abcdef');
    const inserted = r.insert(3, 'XYZ');
    assert.equal(inserted.toString(), 'abcXYZdef');
    const deleted = inserted.delete(3, 6);
    assert.equal(deleted.toString(), 'abcdef');
  });

  it('multiple concats produce correct result', () => {
    const a = new Rope('Hello');
    const b = new Rope(', ');
    const c = new Rope('World');
    const d = new Rope('!');
    const result = a.concat(b).concat(c).concat(d);
    assert.equal(result.toString(), 'Hello, World!');
  });

  it('split and concat are inverse operations', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const r = new Rope(text);
    const [left, right] = r.split(10);
    const rejoined = left.concat(right);
    assert.equal(rejoined.toString(), text);
  });
});

// ─── concat with string ─────────────────────────────────────────────────────

describe('Rope.concat (string overload)', () => {
  it('accepts a plain string as argument', () => {
    const r = new Rope('hello');
    const result = r.concat(' world');
    assert.equal(result.toString(), 'hello world');
    assert.equal(result.length, 11);
  });

  it('concatenating with an empty string returns equivalent rope', () => {
    const r = new Rope('abc');
    assert.equal(r.concat('').toString(), 'abc');
  });

  it('does not mutate the original rope when concating string', () => {
    const r = new Rope('foo');
    r.concat('bar');
    assert.equal(r.toString(), 'foo');
  });
});

// ─── rebalance ──────────────────────────────────────────────────────────────

describe('Rope.rebalance', () => {
  it('rebalanced rope has same content', () => {
    const original = 'hello world';
    const r = new Rope(original);
    const rb = r.rebalance();
    assert.equal(rb.toString(), original);
    assert.equal(rb.length, original.length);
  });

  it('rebalanced rope supports all operations correctly', () => {
    // Build a highly unbalanced rope via many small inserts
    let r = new Rope('');
    for (let i = 0; i < 20; i++) {
      r = r.insert(r.length, 'x');
    }
    const rb = r.rebalance();
    assert.equal(rb.toString(), 'x'.repeat(20));
    assert.equal(rb.charAt(0), 'x');
    assert.equal(rb.substring(5, 10), 'xxxxx');
  });

  it('rebalance of empty rope returns empty rope', () => {
    const r = new Rope();
    const rb = r.rebalance();
    assert.equal(rb.toString(), '');
    assert.equal(rb.length, 0);
  });

  it('rebalance returns a new Rope instance', () => {
    const r = new Rope('test');
    const rb = r.rebalance();
    assert.ok(rb instanceof Rope);
    // original unchanged
    assert.equal(r.toString(), 'test');
  });
});
