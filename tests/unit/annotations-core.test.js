// ─── Unit Tests: AnnotationController ───────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AnnotationController } from '../../app/modules/annotations-core.js';

function createController() {
  const storage = { strokes: {}, comments: {} };
  return new AnnotationController({
    loadStrokes: (doc, page) => JSON.parse(JSON.stringify(storage.strokes[`${doc}_${page}`] || [])),
    saveStrokes: (doc, page, strokes) => { storage.strokes[`${doc}_${page}`] = strokes; },
    loadComments: (doc, page) => JSON.parse(JSON.stringify(storage.comments[`${doc}_${page}`] || [])),
    saveComments: (doc, page, comments) => { storage.comments[`${doc}_${page}`] = comments; },
  });
}

describe('AnnotationController', () => {
  let ctrl;

  beforeEach(() => {
    ctrl = createController();
    ctrl.setDocument('test.pdf');
  });

  // ─── Strokes ──────────────────────────────────────────────────────────

  it('starts with empty strokes', () => {
    const strokes = ctrl.getStrokes(1);
    assert.deepEqual(strokes, []);
  });

  it('adds a stroke to a page', () => {
    const stroke = { tool: 'pen', color: '#f00', width: 2, opacity: 1, points: [[0,0],[10,10]] };
    ctrl.addStroke(1, stroke);
    const strokes = ctrl.getStrokes(1);
    assert.equal(strokes.length, 1);
    assert.equal(strokes[0].tool, 'pen');
    assert.ok(strokes[0].timestamp > 0);
  });

  it('undo removes last stroke', () => {
    ctrl.addStroke(1, { tool: 'pen', color: '#000', width: 1, opacity: 1, points: [[0,0],[5,5]] });
    ctrl.addStroke(1, { tool: 'pen', color: '#f00', width: 1, opacity: 1, points: [[0,0],[10,10]] });
    const removed = ctrl.undoStroke(1);
    assert.equal(removed.color, '#f00');
    assert.equal(ctrl.getStrokes(1).length, 1);
  });

  it('undo on empty page returns null', () => {
    assert.equal(ctrl.undoStroke(1), null);
  });

  it('clearStrokes removes all strokes', () => {
    ctrl.addStroke(1, { tool: 'pen', color: '#000', width: 1, opacity: 1, points: [[0,0],[5,5]] });
    ctrl.addStroke(1, { tool: 'pen', color: '#f00', width: 1, opacity: 1, points: [[0,0],[10,10]] });
    ctrl.clearStrokes(1);
    assert.equal(ctrl.getStrokes(1).length, 0);
  });

  // ─── Comments ─────────────────────────────────────────────────────────

  it('adds a comment', () => {
    const comment = ctrl.addComment(1, { x: 100, y: 200, text: 'Note here' });
    assert.ok(comment.id.startsWith('c-'));
    assert.equal(comment.text, 'Note here');
    assert.equal(comment.resolved, false);
    assert.deepEqual(comment.replies, []);
  });

  it('retrieves comments for a page', () => {
    ctrl.addComment(1, { text: 'A' });
    ctrl.addComment(1, { text: 'B' });
    ctrl.addComment(2, { text: 'C' });
    assert.equal(ctrl.getComments(1).length, 2);
    assert.equal(ctrl.getComments(2).length, 1);
  });

  it('replies to a comment', () => {
    const comment = ctrl.addComment(1, { text: 'Original' });
    ctrl.replyToComment(1, comment.id, 'Reply text', 'User');
    const updated = ctrl.getComments(1).find(c => c.id === comment.id);
    assert.equal(updated.replies.length, 1);
    assert.equal(updated.replies[0].text, 'Reply text');
    assert.equal(updated.replies[0].author, 'User');
  });

  it('toggles resolve on a comment', () => {
    const comment = ctrl.addComment(1, { text: 'Test' });
    assert.equal(comment.resolved, false);
    ctrl.toggleResolve(1, comment.id);
    assert.equal(ctrl.getComments(1).find(c => c.id === comment.id).resolved, true);
    ctrl.toggleResolve(1, comment.id);
    assert.equal(ctrl.getComments(1).find(c => c.id === comment.id).resolved, false);
  });

  it('deletes a comment', () => {
    const c1 = ctrl.addComment(1, { text: 'A' });
    ctrl.addComment(1, { text: 'B' });
    ctrl.deleteComment(1, c1.id);
    const comments = ctrl.getComments(1);
    assert.equal(comments.length, 1);
    assert.equal(comments[0].text, 'B');
  });

  // ─── Events ───────────────────────────────────────────────────────────

  it('emits stroke-added event', () => {
    const events = [];
    ctrl.on((type, data) => events.push({ type, data }));
    ctrl.addStroke(1, { tool: 'pen', color: '#000', width: 1, opacity: 1, points: [[0,0],[5,5]] });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'stroke-added');
    assert.equal(events[0].data.page, 1);
  });

  it('emits comment-added event', () => {
    const events = [];
    ctrl.on((type, data) => events.push({ type, data }));
    ctrl.addComment(1, { text: 'Test' });
    assert.equal(events[0].type, 'comment-added');
  });

  it('unsubscribe stops events', () => {
    const events = [];
    const unsub = ctrl.on((type) => events.push(type));
    ctrl.addStroke(1, { tool: 'pen', color: '#000', width: 1, opacity: 1, points: [[0,0],[5,5]] });
    assert.equal(events.length, 1);
    unsub();
    ctrl.addStroke(1, { tool: 'pen', color: '#f00', width: 1, opacity: 1, points: [[0,0],[10,10]] });
    assert.equal(events.length, 1); // no new events
  });

  // ─── Export / Import ──────────────────────────────────────────────────

  it('exports all annotations', () => {
    ctrl.addStroke(1, { tool: 'pen', color: '#000', width: 1, opacity: 1, points: [[0,0],[5,5]] });
    ctrl.addComment(2, { text: 'Note' });
    const data = ctrl.exportAll(3);
    assert.ok(data.strokes[1]);
    assert.equal(data.strokes[1].length, 1);
    assert.ok(data.comments[2]);
    assert.equal(data.comments[2].length, 1);
    assert.ok(!data.strokes[3]); // empty page not exported
  });

  it('imports annotations', () => {
    const data = {
      strokes: { 1: [{ tool: 'pen', color: '#00f', width: 3, opacity: 1, points: [[0,0],[20,20]], timestamp: 1000 }] },
      comments: { 2: [{ id: 'c-test', x: 50, y: 50, text: 'Imported', author: '', timestamp: 1000, resolved: false, replies: [] }] },
    };
    ctrl.importAll(data);
    assert.equal(ctrl.getStrokes(1).length, 1);
    assert.equal(ctrl.getStrokes(1)[0].color, '#00f');
    assert.equal(ctrl.getComments(2).length, 1);
    assert.equal(ctrl.getComments(2)[0].text, 'Imported');
  });

  // ─── setDocument clears state ─────────────────────────────────────────

  it('setDocument clears cached data', () => {
    ctrl.addStroke(1, { tool: 'pen', color: '#000', width: 1, opacity: 1, points: [[0,0],[5,5]] });
    ctrl.setDocument('other.pdf');
    // After setDocument, cache is clear — getStrokes will reload from storage
    // For 'other.pdf' page 1, storage is empty
    assert.equal(ctrl.getStrokes(1).length, 0);
  });
});
