// ─── Unit Tests: Operational Transform ────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyOp,
  transform,
  composeOps,
  invertOp,
  CollaborativeDocument,
} from '../../app/modules/operational-transform.js';

// ─── applyOp ─────────────────────────────────────────────────────────────────

describe('applyOp – insert', () => {
  it('inserts at the beginning', () => {
    const doc = { content: 'world', version: 0 };
    const result = applyOp(doc, { type: 'insert', position: 0, content: 'hello ' });
    assert.equal(result.content, 'hello world');
    assert.equal(result.version, 1);
  });

  it('inserts in the middle', () => {
    const doc = { content: 'helo', version: 0 };
    const result = applyOp(doc, { type: 'insert', position: 3, content: 'l' });
    assert.equal(result.content, 'hello');
  });

  it('inserts at the end', () => {
    const doc = { content: 'hi', version: 0 };
    const result = applyOp(doc, { type: 'insert', position: 2, content: '!' });
    assert.equal(result.content, 'hi!');
  });

  it('inserts with position beyond end clamps to end', () => {
    const doc = { content: 'hi', version: 0 };
    const result = applyOp(doc, { type: 'insert', position: 99, content: '!' });
    assert.equal(result.content, 'hi!');
  });

  it('does not mutate the original document', () => {
    const doc = { content: 'abc', version: 0 };
    applyOp(doc, { type: 'insert', position: 0, content: 'X' });
    assert.equal(doc.content, 'abc');
  });
});

describe('applyOp – delete', () => {
  it('deletes a range of characters', () => {
    const doc = { content: 'hello world', version: 0 };
    const result = applyOp(doc, { type: 'delete', position: 5, length: 6 });
    assert.equal(result.content, 'hello');
  });

  it('deletes from the beginning', () => {
    const doc = { content: 'hello', version: 0 };
    const result = applyOp(doc, { type: 'delete', position: 0, length: 5 });
    assert.equal(result.content, '');
  });

  it('delete length 0 is a no-op', () => {
    const doc = { content: 'hello', version: 0 };
    const result = applyOp(doc, { type: 'delete', position: 2, length: 0 });
    assert.equal(result.content, 'hello');
  });

  it('increments version', () => {
    const doc = { content: 'abc', version: 5 };
    const result = applyOp(doc, { type: 'delete', position: 0, length: 1 });
    assert.equal(result.version, 6);
  });
});

describe('applyOp – retain', () => {
  it('retain does not change content', () => {
    const doc = { content: 'hello', version: 0 };
    const result = applyOp(doc, { type: 'retain', position: 0, length: 5 });
    assert.equal(result.content, 'hello');
    assert.equal(result.version, 1);
  });
});

// ─── transform ───────────────────────────────────────────────────────────────

describe('transform – insert vs insert', () => {
  it('op1 after op2 shifts right when op2 inserts before op1', () => {
    // Base: "hello"
    // op2: insert "XX" at pos 0  → "XXhello"
    // op1: insert "!" at pos 5   → should shift to pos 7
    const op1 = { type: 'insert', position: 5, content: '!' };
    const op2 = { type: 'insert', position: 0, content: 'XX' };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 7);
  });

  it('op1 unchanged when op2 inserts after op1', () => {
    const op1 = { type: 'insert', position: 2, content: 'A' };
    const op2 = { type: 'insert', position: 5, content: 'B' };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 2);
  });

  it('concurrent inserts at same position: content tiebreak determines order', () => {
    // Both insert at position 3.
    // Tiebreak: lexicographically smaller content goes first.
    // "A" < "B", so op1 ("A") goes first and is unchanged at 3.
    const op1 = { type: 'insert', position: 3, content: 'A' };
    const op2 = { type: 'insert', position: 3, content: 'B' };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 3);
  });

  it('concurrent inserts at same position: smaller op2 content shifts op1 right', () => {
    // op2 content "A" < op1 content "Z" → op2 goes first, op1 shifts right
    const op1 = { type: 'insert', position: 3, content: 'Z' };
    const op2 = { type: 'insert', position: 3, content: 'A' };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 4); // shifted by length of "A" = 1
  });
});

describe('transform – insert vs delete', () => {
  it('op1 insert shifts left when op2 deletes text before it', () => {
    // Base: "hello world"
    // op2: delete 6 chars at pos 0  → "world"
    // op1: insert "!" at pos 6      → should shift to pos 0
    const op1 = { type: 'insert', position: 6, content: '!' };
    const op2 = { type: 'delete', position: 0, length: 6 };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 0);
  });

  it('op1 insert unchanged when op2 deletes text after it', () => {
    const op1 = { type: 'insert', position: 2, content: 'X' };
    const op2 = { type: 'delete', position: 5, length: 3 };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 2);
  });

  it('op1 insert inside deleted range snaps to deletion point', () => {
    const op1 = { type: 'insert', position: 3, content: 'X' };
    const op2 = { type: 'delete', position: 1, length: 5 };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 1);
  });
});

describe('transform – delete vs insert', () => {
  it('delete shifts right when insert is before the delete range', () => {
    const op1 = { type: 'delete', position: 5, length: 3 };
    const op2 = { type: 'insert', position: 2, content: 'XX' };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 7);
    assert.equal(t1.length, 3);
  });

  it('delete expands when insert is inside the delete range', () => {
    const op1 = { type: 'delete', position: 2, length: 4 };
    const op2 = { type: 'insert', position: 3, content: 'AB' };
    const t1 = transform(op1, op2);
    assert.equal(t1.length, 6); // 4 + 2 inserted chars
  });

  it('delete unchanged when insert is after the delete range', () => {
    const op1 = { type: 'delete', position: 1, length: 2 };
    const op2 = { type: 'insert', position: 10, content: 'Z' };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 1);
    assert.equal(t1.length, 2);
  });
});

describe('transform – delete vs delete', () => {
  it('non-overlapping: op1 before op2 is unchanged', () => {
    const op1 = { type: 'delete', position: 0, length: 3 };
    const op2 = { type: 'delete', position: 5, length: 2 };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 0);
    assert.equal(t1.length, 3);
  });

  it('non-overlapping: op1 after op2 shifts left', () => {
    const op1 = { type: 'delete', position: 7, length: 2 };
    const op2 = { type: 'delete', position: 2, length: 3 };
    const t1 = transform(op1, op2);
    assert.equal(t1.position, 4);
    assert.equal(t1.length, 2);
  });

  it('overlapping deletes: overlap is removed from op1', () => {
    // Base: "abcdefgh"
    // op2 deletes positions 2-5 (4 chars: "cdef")
    // op1 deletes positions 4-7 (4 chars: "efgh")
    // overlap: positions 4-5 (2 chars: "ef") already deleted by op2
    // op1 transformed should only delete the non-overlapping part
    const op1 = { type: 'delete', position: 4, length: 4 };
    const op2 = { type: 'delete', position: 2, length: 4 };
    const t1 = transform(op1, op2);
    // After op2, "cdef" is gone. "gh" is at positions 2-3.
    // op1 originally wanted "efgh"; "ef" is already gone; it should delete "gh"
    assert.equal(t1.length, 2);
  });
});

// ─── composeOps ───────────────────────────────────────────────────────────────

describe('composeOps', () => {
  it('empty array returns empty', () => {
    assert.deepEqual(composeOps([]), []);
  });

  it('retain ops are dropped', () => {
    const ops = [
      { type: 'retain', position: 0, length: 5 },
      { type: 'retain', position: 5, length: 3 },
    ];
    assert.deepEqual(composeOps(ops), []);
  });

  it('adjacent inserts are merged', () => {
    const ops = [
      { type: 'insert', position: 0, content: 'he' },
      { type: 'insert', position: 2, content: 'llo' },
    ];
    const result = composeOps(ops);
    assert.equal(result.length, 1);
    assert.equal(result[0].content, 'hello');
    assert.equal(result[0].position, 0);
  });

  it('non-adjacent inserts are kept separate', () => {
    const ops = [
      { type: 'insert', position: 0, content: 'a' },
      { type: 'insert', position: 5, content: 'b' },
    ];
    const result = composeOps(ops);
    assert.equal(result.length, 2);
  });

  it('adjacent deletes are merged', () => {
    const ops = [
      { type: 'delete', position: 2, length: 3 },
      { type: 'delete', position: 5, length: 2 },
    ];
    const result = composeOps(ops);
    assert.equal(result.length, 1);
    assert.equal(result[0].length, 5);
  });

  it('single op passthrough', () => {
    const ops = [{ type: 'insert', position: 0, content: 'hi' }];
    const result = composeOps(ops);
    assert.equal(result.length, 1);
    assert.equal(result[0].content, 'hi');
  });

  it('mixed types are not merged', () => {
    const ops = [
      { type: 'insert', position: 0, content: 'a' },
      { type: 'delete', position: 1, length: 1 },
    ];
    const result = composeOps(ops);
    assert.equal(result.length, 2);
  });
});

// ─── invertOp ─────────────────────────────────────────────────────────────────

describe('invertOp', () => {
  it('invert of insert is a delete', () => {
    const doc = { content: 'hello world', version: 0 };
    const op = { type: 'insert', position: 5, content: ' there' };
    const inv = invertOp(op, doc);
    assert.equal(inv.type, 'delete');
    assert.equal(inv.position, 5);
    assert.equal(inv.length, 6);
  });

  it('invert of delete is an insert that restores the text', () => {
    const doc = { content: 'hello world', version: 0 };
    const op = { type: 'delete', position: 6, length: 5 };
    const inv = invertOp(op, doc);
    assert.equal(inv.type, 'insert');
    assert.equal(inv.position, 6);
    assert.equal(inv.content, 'world');
  });

  it('apply(op) then apply(invert(op)) round-trips', () => {
    const doc = { content: 'hello world', version: 0 };
    const op = { type: 'delete', position: 0, length: 6 };
    const inv = invertOp(op, doc);
    const modified = applyOp(doc, op);
    const restored = applyOp(modified, inv);
    assert.equal(restored.content, doc.content);
  });

  it('invert retain is a retain', () => {
    const doc = { content: 'abc', version: 0 };
    const op = { type: 'retain', position: 0, length: 3 };
    const inv = invertOp(op, doc);
    assert.equal(inv.type, 'retain');
  });
});

// ─── CollaborativeDocument ───────────────────────────────────────────────────

describe('CollaborativeDocument – local ops', () => {
  it('starts with initial content', () => {
    const cdoc = new CollaborativeDocument('hello');
    assert.equal(cdoc.content, 'hello');
    assert.equal(cdoc.version, 0);
  });

  it('apply() inserts text', () => {
    const cdoc = new CollaborativeDocument('hello');
    cdoc.apply({ type: 'insert', position: 5, content: ' world' });
    assert.equal(cdoc.content, 'hello world');
    assert.equal(cdoc.version, 1);
  });

  it('apply() deletes text', () => {
    const cdoc = new CollaborativeDocument('hello world');
    cdoc.apply({ type: 'delete', position: 5, length: 6 });
    assert.equal(cdoc.content, 'hello');
  });

  it('history() records applied ops', () => {
    const cdoc = new CollaborativeDocument('');
    cdoc.apply({ type: 'insert', position: 0, content: 'a' });
    cdoc.apply({ type: 'insert', position: 1, content: 'b' });
    assert.equal(cdoc.history().length, 2);
  });

  it('history() returns a copy (immutable)', () => {
    const cdoc = new CollaborativeDocument('abc');
    const h1 = cdoc.history();
    h1.push({ type: 'retain', position: 0 });
    assert.equal(cdoc.history().length, 0);
  });
});

describe('CollaborativeDocument – undo', () => {
  it('undo() reverts the last local op', () => {
    const cdoc = new CollaborativeDocument('hello');
    cdoc.apply({ type: 'insert', position: 5, content: ' world' });
    assert.equal(cdoc.content, 'hello world');
    const undone = cdoc.undo();
    assert.equal(undone, true);
    assert.equal(cdoc.content, 'hello');
  });

  it('undo() returns false when history is empty', () => {
    const cdoc = new CollaborativeDocument('hello');
    assert.equal(cdoc.undo(), false);
  });

  it('multiple undos walk back through history', () => {
    const cdoc = new CollaborativeDocument('');
    cdoc.apply({ type: 'insert', position: 0, content: 'a' });
    cdoc.apply({ type: 'insert', position: 1, content: 'b' });
    cdoc.apply({ type: 'insert', position: 2, content: 'c' });
    assert.equal(cdoc.content, 'abc');

    cdoc.undo();
    assert.equal(cdoc.content, 'ab');

    cdoc.undo();
    assert.equal(cdoc.content, 'a');

    cdoc.undo();
    assert.equal(cdoc.content, '');
  });
});

describe('CollaborativeDocument – remote ops convergence', () => {
  it('remote insert at base version is applied verbatim', () => {
    const cdoc = new CollaborativeDocument('hello');
    cdoc.applyRemote({ type: 'insert', position: 5, content: '!' }, 0);
    assert.equal(cdoc.content, 'hello!');
  });

  it('remote insert is transformed against one prior local op', () => {
    // Start: "hello"
    // Local: insert " world" at pos 5  → "hello world" (version 1)
    // Remote: insert "!" at pos 5 (based on version 0)
    //   → transformed: "!" should shift right by len(" world")=6 → pos 11
    //   → result: "hello world!"
    const cdoc = new CollaborativeDocument('hello');
    cdoc.apply({ type: 'insert', position: 5, content: ' world' });
    cdoc.applyRemote({ type: 'insert', position: 5, content: '!' }, 0);
    assert.equal(cdoc.content, 'hello world!');
  });

  it('two peers converge to same content', () => {
    // Peer A: "hello" → inserts " world" at 5
    // Peer B: "hello" → inserts "!" at 5
    // After applying each other's ops with OT they should have same content.

    const peerA = new CollaborativeDocument('hello');
    const peerB = new CollaborativeDocument('hello');

    const opA = { type: 'insert', position: 5, content: ' world' };
    const opB = { type: 'insert', position: 5, content: '!' };

    peerA.apply(opA); // peerA now at version 1
    peerB.apply(opB); // peerB now at version 1

    // Peer A receives B's op (which was at base version 0)
    peerA.applyRemote(opB, 0);

    // Peer B receives A's op (which was at base version 0)
    peerB.applyRemote(opA, 0);

    // Both should have the same content (order may differ but must be equal)
    assert.equal(peerA.content, peerB.content);
  });

  it('remote delete is transformed against local insert', () => {
    // Start: "hello world"
    // Local: insert "!" at pos 11 → "hello world!" (version 1)
    // Remote: delete " world" at pos 5, len 6 (based on version 0)
    //   → transformed: position unchanged (delete is before the insert point)
    //   → result: "hello!"
    const cdoc = new CollaborativeDocument('hello world');
    cdoc.apply({ type: 'insert', position: 11, content: '!' });
    cdoc.applyRemote({ type: 'delete', position: 5, length: 6 }, 0);
    assert.equal(cdoc.content, 'hello!');
  });
});
