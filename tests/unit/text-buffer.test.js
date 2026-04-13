// ─── Unit Tests: TextBuffer ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TextBuffer } from '../../app/modules/text-buffer.js';

// ─── constructor / getText ───────────────────────────────────────────────────

describe('TextBuffer constructor & getText', () => {
  it('creates an empty buffer with no argument', () => {
    const buf = new TextBuffer();
    assert.equal(buf.getText(), '');
    assert.equal(buf.lineCount, 1);
  });

  it('creates a buffer with initial content', () => {
    const buf = new TextBuffer('hello world');
    assert.equal(buf.getText(), 'hello world');
  });

  it('preserves multiline initial content', () => {
    const content = 'line1\nline2\nline3';
    const buf = new TextBuffer(content);
    assert.equal(buf.getText(), content);
  });
});

// ─── lineCount ───────────────────────────────────────────────────────────────

describe('TextBuffer.lineCount', () => {
  it('returns 1 for empty buffer', () => {
    const buf = new TextBuffer();
    assert.equal(buf.lineCount, 1);
  });

  it('returns 1 for single-line content', () => {
    const buf = new TextBuffer('hello');
    assert.equal(buf.lineCount, 1);
  });

  it('returns correct count for multiline content', () => {
    const buf = new TextBuffer('a\nb\nc');
    assert.equal(buf.lineCount, 3);
  });

  it('counts trailing newline as an extra line', () => {
    const buf = new TextBuffer('a\nb\n');
    assert.equal(buf.lineCount, 3);
  });
});

// ─── getLine ─────────────────────────────────────────────────────────────────

describe('TextBuffer.getLine', () => {
  it('retrieves a line by 0-based index', () => {
    const buf = new TextBuffer('alpha\nbeta\ngamma');
    assert.equal(buf.getLine(0), 'alpha');
    assert.equal(buf.getLine(1), 'beta');
    assert.equal(buf.getLine(2), 'gamma');
  });

  it('returns empty string for out-of-range index', () => {
    const buf = new TextBuffer('hello\nworld');
    assert.equal(buf.getLine(-1), '');
    assert.equal(buf.getLine(2), '');
  });

  it('handles trailing newline (last line is empty)', () => {
    const buf = new TextBuffer('a\nb\n');
    assert.equal(buf.getLine(2), '');
  });
});

// ─── positionToOffset / offsetToPosition ────────────────────────────────────

describe('TextBuffer position/offset conversion', () => {
  it('positionToOffset: first character', () => {
    const buf = new TextBuffer('hello');
    assert.equal(buf.positionToOffset({ line: 0, column: 0 }), 0);
  });

  it('positionToOffset: middle of first line', () => {
    const buf = new TextBuffer('hello\nworld');
    assert.equal(buf.positionToOffset({ line: 0, column: 3 }), 3);
  });

  it('positionToOffset: start of second line', () => {
    const buf = new TextBuffer('hello\nworld');
    assert.equal(buf.positionToOffset({ line: 1, column: 0 }), 6);
  });

  it('positionToOffset: end of text', () => {
    const buf = new TextBuffer('hello');
    assert.equal(buf.positionToOffset({ line: 0, column: 5 }), 5);
  });

  it('offsetToPosition: offset 0 is line 0 col 0', () => {
    const buf = new TextBuffer('hello');
    assert.deepEqual(buf.offsetToPosition(0), { line: 0, column: 0 });
  });

  it('offsetToPosition: offset within first line', () => {
    const buf = new TextBuffer('hello\nworld');
    assert.deepEqual(buf.offsetToPosition(3), { line: 0, column: 3 });
  });

  it('offsetToPosition: start of second line (after newline)', () => {
    const buf = new TextBuffer('hello\nworld');
    assert.deepEqual(buf.offsetToPosition(6), { line: 1, column: 0 });
  });

  it('offsetToPosition: clamps negative offset to 0', () => {
    const buf = new TextBuffer('hello');
    assert.deepEqual(buf.offsetToPosition(-1), { line: 0, column: 0 });
  });

  it('round-trip: positionToOffset → offsetToPosition', () => {
    const buf = new TextBuffer('first\nsecond\nthird');
    const pos = { line: 1, column: 3 };
    const offset = buf.positionToOffset(pos);
    assert.deepEqual(buf.offsetToPosition(offset), pos);
  });
});

// ─── getChar ─────────────────────────────────────────────────────────────────

describe('TextBuffer.getChar', () => {
  it('returns the correct character at a position', () => {
    const buf = new TextBuffer('hello\nworld');
    assert.equal(buf.getChar({ line: 0, column: 1 }), 'e');
    assert.equal(buf.getChar({ line: 1, column: 0 }), 'w');
  });

  it('returns empty string for out-of-range position', () => {
    const buf = new TextBuffer('hi');
    assert.equal(buf.getChar({ line: 0, column: 10 }), '');
  });
});

// ─── insert ──────────────────────────────────────────────────────────────────

describe('TextBuffer.insert', () => {
  it('inserts at the beginning', () => {
    const buf = new TextBuffer('world');
    buf.insert({ line: 0, column: 0 }, 'hello ');
    assert.equal(buf.getText(), 'hello world');
  });

  it('inserts in the middle of a line', () => {
    const buf = new TextBuffer('helo');
    buf.insert({ line: 0, column: 2 }, 'l');
    assert.equal(buf.getText(), 'hello');
  });

  it('inserts at the end', () => {
    const buf = new TextBuffer('hello');
    buf.insert({ line: 0, column: 5 }, ' world');
    assert.equal(buf.getText(), 'hello world');
  });

  it('inserts a newline in the middle', () => {
    const buf = new TextBuffer('helloworld');
    buf.insert({ line: 0, column: 5 }, '\n');
    assert.equal(buf.getText(), 'hello\nworld');
    assert.equal(buf.lineCount, 2);
  });

  it('no-ops on empty string', () => {
    const buf = new TextBuffer('abc');
    buf.insert({ line: 0, column: 1 }, '');
    assert.equal(buf.getText(), 'abc');
  });

  it('inserts at start of second line', () => {
    const buf = new TextBuffer('hello\nworld');
    buf.insert({ line: 1, column: 0 }, 'brave ');
    assert.equal(buf.getText(), 'hello\nbrave world');
  });
});

// ─── delete ──────────────────────────────────────────────────────────────────

describe('TextBuffer.delete', () => {
  it('deletes a range within a line', () => {
    const buf = new TextBuffer('abcdef');
    buf.delete({ line: 0, column: 2 }, { line: 0, column: 4 });
    assert.equal(buf.getText(), 'abef');
  });

  it('deletes from the beginning', () => {
    const buf = new TextBuffer('hello world');
    buf.delete({ line: 0, column: 0 }, { line: 0, column: 6 });
    assert.equal(buf.getText(), 'world');
  });

  it('deletes to the end of line', () => {
    const buf = new TextBuffer('hello world');
    buf.delete({ line: 0, column: 5 }, { line: 0, column: 11 });
    assert.equal(buf.getText(), 'hello');
  });

  it('deletes across lines', () => {
    const buf = new TextBuffer('hello\nworld');
    buf.delete({ line: 0, column: 3 }, { line: 1, column: 2 });
    assert.equal(buf.getText(), 'helrld');
  });

  it('no-ops when start equals end', () => {
    const buf = new TextBuffer('abc');
    buf.delete({ line: 0, column: 1 }, { line: 0, column: 1 });
    assert.equal(buf.getText(), 'abc');
  });
});

// ─── replace ─────────────────────────────────────────────────────────────────

describe('TextBuffer.replace', () => {
  it('replaces a range with new text of the same length', () => {
    const buf = new TextBuffer('hello world');
    buf.replace({ line: 0, column: 6 }, { line: 0, column: 11 }, 'there');
    assert.equal(buf.getText(), 'hello there');
  });

  it('replaces a range with shorter text', () => {
    const buf = new TextBuffer('abcdef');
    buf.replace({ line: 0, column: 1 }, { line: 0, column: 4 }, 'X');
    assert.equal(buf.getText(), 'aXef');
  });

  it('replaces a range with longer text', () => {
    const buf = new TextBuffer('abc');
    buf.replace({ line: 0, column: 1 }, { line: 0, column: 2 }, 'XXXX');
    assert.equal(buf.getText(), 'aXXXXc');
  });

  it('replaces a range with empty string (acts like delete)', () => {
    const buf = new TextBuffer('hello world');
    buf.replace({ line: 0, column: 5 }, { line: 0, column: 11 }, '');
    assert.equal(buf.getText(), 'hello');
  });

  it('replaces across lines', () => {
    const buf = new TextBuffer('hello\nworld');
    buf.replace({ line: 0, column: 5 }, { line: 1, column: 0 }, ' ');
    assert.equal(buf.getText(), 'hello world');
  });
});

// ─── undo / redo ─────────────────────────────────────────────────────────────

describe('TextBuffer undo/redo', () => {
  it('undo reverses an insert', () => {
    const buf = new TextBuffer('hello');
    buf.insert({ line: 0, column: 5 }, ' world');
    assert.equal(buf.getText(), 'hello world');
    const result = buf.undo();
    assert.ok(result);
    assert.equal(buf.getText(), 'hello');
  });

  it('undo reverses a delete', () => {
    const buf = new TextBuffer('hello world');
    buf.delete({ line: 0, column: 5 }, { line: 0, column: 11 });
    assert.equal(buf.getText(), 'hello');
    buf.undo();
    assert.equal(buf.getText(), 'hello world');
  });

  it('undo reverses a replace', () => {
    const buf = new TextBuffer('hello world');
    buf.replace({ line: 0, column: 6 }, { line: 0, column: 11 }, 'there');
    assert.equal(buf.getText(), 'hello there');
    buf.undo();
    assert.equal(buf.getText(), 'hello world');
  });

  it('undo returns false when nothing to undo', () => {
    const buf = new TextBuffer('hello');
    assert.equal(buf.undo(), false);
  });

  it('redo re-applies an undone insert', () => {
    const buf = new TextBuffer('hello');
    buf.insert({ line: 0, column: 5 }, ' world');
    buf.undo();
    assert.equal(buf.getText(), 'hello');
    const result = buf.redo();
    assert.ok(result);
    assert.equal(buf.getText(), 'hello world');
  });

  it('redo returns false when nothing to redo', () => {
    const buf = new TextBuffer('hello');
    assert.equal(buf.redo(), false);
  });

  it('new edit clears the redo stack', () => {
    const buf = new TextBuffer('hello');
    buf.insert({ line: 0, column: 5 }, ' world');
    buf.undo();
    buf.insert({ line: 0, column: 5 }, '!');
    assert.equal(buf.redo(), false);
    assert.equal(buf.getText(), 'hello!');
  });

  it('multiple undo steps work correctly', () => {
    const buf = new TextBuffer('a');
    buf.insert({ line: 0, column: 1 }, 'b');
    buf.insert({ line: 0, column: 2 }, 'c');
    assert.equal(buf.getText(), 'abc');
    buf.undo();
    assert.equal(buf.getText(), 'ab');
    buf.undo();
    assert.equal(buf.getText(), 'a');
    buf.undo(); // nothing left
    assert.equal(buf.getText(), 'a');
  });

  it('undo then redo preserves full history', () => {
    const buf = new TextBuffer('start');
    buf.insert({ line: 0, column: 5 }, '-middle');
    buf.insert({ line: 0, column: 12 }, '-end');
    assert.equal(buf.getText(), 'start-middle-end');
    buf.undo();
    assert.equal(buf.getText(), 'start-middle');
    buf.undo();
    assert.equal(buf.getText(), 'start');
    buf.redo();
    assert.equal(buf.getText(), 'start-middle');
    buf.redo();
    assert.equal(buf.getText(), 'start-middle-end');
  });
});

// ─── integration: chained operations ────────────────────────────────────────

describe('TextBuffer chained operations', () => {
  it('insert then delete is a no-op', () => {
    const buf = new TextBuffer('hello');
    buf.insert({ line: 0, column: 5 }, ' world');
    buf.delete({ line: 0, column: 5 }, { line: 0, column: 11 });
    assert.equal(buf.getText(), 'hello');
  });

  it('multiple inserts on multiple lines', () => {
    const buf = new TextBuffer('');
    buf.insert({ line: 0, column: 0 }, 'line1');
    buf.insert({ line: 0, column: 5 }, '\nline2');
    buf.insert({ line: 1, column: 5 }, '\nline3');
    assert.equal(buf.getText(), 'line1\nline2\nline3');
    assert.equal(buf.lineCount, 3);
    assert.equal(buf.getLine(0), 'line1');
    assert.equal(buf.getLine(1), 'line2');
    assert.equal(buf.getLine(2), 'line3');
  });

  it('getChar after insert returns new character', () => {
    const buf = new TextBuffer('ac');
    buf.insert({ line: 0, column: 1 }, 'b');
    assert.equal(buf.getChar({ line: 0, column: 1 }), 'b');
  });

  it('positionToOffset is consistent after edits', () => {
    const buf = new TextBuffer('hello\nworld');
    buf.insert({ line: 0, column: 5 }, '!');
    // Now text is "hello!\nworld" — line 1 starts at offset 7
    assert.equal(buf.positionToOffset({ line: 1, column: 0 }), 7);
  });
});
