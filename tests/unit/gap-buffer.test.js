// ─── Unit Tests: GapBuffer ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  GapBuffer,
  createGapBuffer,
} from '../../app/modules/gap-buffer.js';

describe('GapBuffer – construction', () => {
  it('creates an empty buffer by default', () => {
    const buf = new GapBuffer();
    assert.equal(buf.length, 0);
    assert.equal(buf.cursor, 0);
    assert.equal(buf.toString(), '');
  });

  it('creates a buffer with initial text', () => {
    const buf = new GapBuffer('Hello');
    assert.equal(buf.length, 5);
    assert.equal(buf.toString(), 'Hello');
    assert.equal(buf.cursor, 5); // cursor at end of initial text
  });

  it('accepts custom gap size', () => {
    const buf = new GapBuffer('AB', 128);
    assert.equal(buf.length, 2);
    assert.equal(buf.toString(), 'AB');
  });
});

describe('GapBuffer – insert', () => {
  it('inserts text at cursor position', () => {
    const buf = new GapBuffer('');
    buf.insert('Hello');
    assert.equal(buf.toString(), 'Hello');
    assert.equal(buf.cursor, 5);
  });

  it('inserts at the middle of text', () => {
    const buf = new GapBuffer('Hllo');
    buf.moveTo(1);
    buf.insert('e');
    assert.equal(buf.toString(), 'Hello');
  });

  it('inserts at the beginning', () => {
    const buf = new GapBuffer('world');
    buf.moveTo(0);
    buf.insert('Hello ');
    assert.equal(buf.toString(), 'Hello world');
  });

  it('handles large inserts that exceed gap size', () => {
    const buf = new GapBuffer('', 4);
    const longText = 'abcdefghijklmnop';
    buf.insert(longText);
    assert.equal(buf.toString(), longText);
    assert.equal(buf.length, 16);
  });

  it('insert of empty string is a no-op', () => {
    const buf = new GapBuffer('test');
    buf.moveTo(2);
    buf.insert('');
    assert.equal(buf.toString(), 'test');
    assert.equal(buf.cursor, 2);
  });
});

describe('GapBuffer – delete (forward)', () => {
  it('deletes one character forward by default', () => {
    const buf = new GapBuffer('Hello');
    buf.moveTo(0);
    const deleted = buf.delete();
    assert.equal(deleted, 'H');
    assert.equal(buf.toString(), 'ello');
  });

  it('deletes multiple characters forward', () => {
    const buf = new GapBuffer('Hello');
    buf.moveTo(0);
    const deleted = buf.delete(3);
    assert.equal(deleted, 'Hel');
    assert.equal(buf.toString(), 'lo');
  });

  it('returns empty string when at end', () => {
    const buf = new GapBuffer('Hi');
    buf.moveTo(2);
    assert.equal(buf.delete(), '');
  });

  it('clamps to available characters', () => {
    const buf = new GapBuffer('AB');
    buf.moveTo(1);
    const deleted = buf.delete(100);
    assert.equal(deleted, 'B');
    assert.equal(buf.toString(), 'A');
  });
});

describe('GapBuffer – backspace', () => {
  it('deletes one character backward by default', () => {
    const buf = new GapBuffer('Hello');
    // cursor is at 5 (end)
    const deleted = buf.backspace();
    assert.equal(deleted, 'o');
    assert.equal(buf.toString(), 'Hell');
  });

  it('deletes multiple characters backward', () => {
    const buf = new GapBuffer('Hello');
    const deleted = buf.backspace(3);
    assert.equal(deleted, 'llo');
    assert.equal(buf.toString(), 'He');
    assert.equal(buf.cursor, 2);
  });

  it('returns empty string when at beginning', () => {
    const buf = new GapBuffer('Hi');
    buf.moveTo(0);
    assert.equal(buf.backspace(), '');
  });

  it('clamps to available characters', () => {
    const buf = new GapBuffer('AB');
    buf.moveTo(1);
    const deleted = buf.backspace(100);
    assert.equal(deleted, 'A');
    assert.equal(buf.toString(), 'B');
  });
});

describe('GapBuffer – cursor movement', () => {
  it('moveTo clamps to valid range', () => {
    const buf = new GapBuffer('Hello');
    buf.moveTo(-10);
    assert.equal(buf.cursor, 0);
    buf.moveTo(999);
    assert.equal(buf.cursor, 5);
  });

  it('moveBy shifts cursor relatively', () => {
    const buf = new GapBuffer('Hello');
    buf.moveTo(0);
    buf.moveBy(3);
    assert.equal(buf.cursor, 3);
    buf.moveBy(-1);
    assert.equal(buf.cursor, 2);
  });

  it('moveTo preserves text content', () => {
    const buf = new GapBuffer('abcdef');
    buf.moveTo(3);
    assert.equal(buf.toString(), 'abcdef');
    buf.moveTo(0);
    assert.equal(buf.toString(), 'abcdef');
    buf.moveTo(6);
    assert.equal(buf.toString(), 'abcdef');
  });
});

describe('GapBuffer – charAt', () => {
  it('returns character at index', () => {
    const buf = new GapBuffer('Hello');
    assert.equal(buf.charAt(0), 'H');
    assert.equal(buf.charAt(4), 'o');
  });

  it('returns empty string for out-of-range', () => {
    const buf = new GapBuffer('Hi');
    assert.equal(buf.charAt(-1), '');
    assert.equal(buf.charAt(2), '');
    assert.equal(buf.charAt(100), '');
  });

  it('works correctly after gap movement', () => {
    const buf = new GapBuffer('abcd');
    buf.moveTo(2); // gap at position 2
    assert.equal(buf.charAt(0), 'a');
    assert.equal(buf.charAt(1), 'b');
    assert.equal(buf.charAt(2), 'c');
    assert.equal(buf.charAt(3), 'd');
  });
});

describe('GapBuffer – substring', () => {
  it('extracts a substring', () => {
    const buf = new GapBuffer('Hello world');
    assert.equal(buf.substring(0, 5), 'Hello');
    assert.equal(buf.substring(6), 'world');
  });

  it('swaps arguments like String.prototype.substring', () => {
    const buf = new GapBuffer('Hello');
    assert.equal(buf.substring(3, 1), 'el');
  });

  it('clamps out-of-range arguments', () => {
    const buf = new GapBuffer('abc');
    assert.equal(buf.substring(-5, 100), 'abc');
  });
});

describe('GapBuffer – lineAt / lineCount', () => {
  it('counts lines in multi-line text', () => {
    const buf = new GapBuffer('line1\nline2\nline3');
    assert.equal(buf.lineCount, 3);
  });

  it('single line has lineCount 1', () => {
    const buf = new GapBuffer('hello');
    assert.equal(buf.lineCount, 1);
  });

  it('empty buffer has lineCount 1', () => {
    const buf = new GapBuffer('');
    assert.equal(buf.lineCount, 1);
  });

  it('returns the correct line content', () => {
    const buf = new GapBuffer('aaa\nbbb\nccc');
    assert.equal(buf.lineAt(0), 'aaa');
    assert.equal(buf.lineAt(1), 'bbb');
    assert.equal(buf.lineAt(2), 'ccc');
  });

  it('returns empty string for out-of-range line', () => {
    const buf = new GapBuffer('one\ntwo');
    assert.equal(buf.lineAt(-1), '');
    assert.equal(buf.lineAt(5), '');
  });
});

describe('GapBuffer – createGapBuffer factory', () => {
  it('returns a GapBuffer instance', () => {
    const buf = createGapBuffer('test');
    assert.ok(buf instanceof GapBuffer);
    assert.equal(buf.toString(), 'test');
  });

  it('works with no arguments', () => {
    const buf = createGapBuffer();
    assert.ok(buf instanceof GapBuffer);
    assert.equal(buf.length, 0);
  });
});

describe('GapBuffer – complex editing sequence', () => {
  it('handles a realistic edit session', () => {
    const buf = new GapBuffer('');
    buf.insert('Hello world');
    assert.equal(buf.toString(), 'Hello world');

    // Delete " world"
    buf.backspace(6);
    assert.equal(buf.toString(), 'Hello');

    // Move to start and insert
    buf.moveTo(0);
    buf.insert('Say: ');
    assert.equal(buf.toString(), 'Say: Hello');

    // Move to end, add exclamation
    buf.moveTo(buf.length);
    buf.insert('!');
    assert.equal(buf.toString(), 'Say: Hello!');

    // Delete the 'H'
    buf.moveTo(5);
    buf.delete(1);
    buf.insert('h');
    assert.equal(buf.toString(), 'Say: hello!');
  });
});
