import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrganizerState,
  togglePageSelection,
  selectPageRange,
  computeReorderFromDrag,
} from '../../app/modules/page-organizer.js';

const samplePages = [
  { index: 0, width: 612, height: 792, rotation: 0 },
  { index: 1, width: 612, height: 792, rotation: 0 },
  { index: 2, width: 612, height: 792, rotation: 0 },
  { index: 3, width: 612, height: 792, rotation: 0 },
];

describe('createOrganizerState', () => {
  it('creates state with copied pages and empty selection', () => {
    const state = createOrganizerState(samplePages);
    assert.strictEqual(state.pages.length, 4);
    assert.strictEqual(state.selected.size, 0);
    assert.strictEqual(state.dragSource, -1);
    assert.strictEqual(state.dropTarget, -1);
  });

  it('does not share reference with input array', () => {
    const state = createOrganizerState(samplePages);
    state.pages.push({ index: 4 });
    assert.strictEqual(samplePages.length, 4);
  });
});

describe('togglePageSelection', () => {
  it('selects a page by index', () => {
    const state = createOrganizerState(samplePages);
    const newState = togglePageSelection(state, 1);
    assert.ok(newState.selected.has(1));
    assert.strictEqual(newState.selected.size, 1);
  });

  it('deselects if already selected', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 2);
    state = togglePageSelection(state, 2);
    assert.strictEqual(state.selected.size, 0);
  });

  it('replaces selection without multiSelect', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = togglePageSelection(state, 2, false);
    assert.strictEqual(state.selected.size, 1);
    assert.ok(state.selected.has(2));
  });

  it('adds to selection with multiSelect', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = togglePageSelection(state, 2, true);
    assert.strictEqual(state.selected.size, 2);
    assert.ok(state.selected.has(0));
    assert.ok(state.selected.has(2));
  });
});

describe('selectPageRange', () => {
  it('selects a range of pages inclusive', () => {
    const state = createOrganizerState(samplePages);
    const newState = selectPageRange(state, 1, 3);
    assert.strictEqual(newState.selected.size, 3);
    assert.ok(newState.selected.has(1));
    assert.ok(newState.selected.has(2));
    assert.ok(newState.selected.has(3));
  });

  it('works when from > to', () => {
    const state = createOrganizerState(samplePages);
    const newState = selectPageRange(state, 3, 1);
    assert.strictEqual(newState.selected.size, 3);
    assert.ok(newState.selected.has(1));
    assert.ok(newState.selected.has(3));
  });

  it('preserves existing selections', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = selectPageRange(state, 2, 3);
    assert.ok(state.selected.has(0));
    assert.ok(state.selected.has(2));
    assert.ok(state.selected.has(3));
  });
});

describe('computeReorderFromDrag', () => {
  it('moves selected pages to target position', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    const newOrder = computeReorderFromDrag(state, 3);
    // Page 0 should be at or near position 3
    assert.strictEqual(newOrder.length, 4);
    assert.ok(newOrder.includes(0));
  });

  it('handles multiple selected pages', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = togglePageSelection(state, 1, true);
    const newOrder = computeReorderFromDrag(state, 2);
    assert.strictEqual(newOrder.length, 4);
    // All original indices should be present
    assert.deepStrictEqual([...newOrder].sort(), [0, 1, 2, 3]);
  });

  it('clamps target to remaining length', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    const newOrder = computeReorderFromDrag(state, 100);
    assert.strictEqual(newOrder.length, 4);
    // Page 0 should be at the end
    assert.strictEqual(newOrder[newOrder.length - 1], 0);
  });
});
