// ─── Unit Tests: virtual-list ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateVirtualRange,
  scrollToItem,
  calculateVariableVirtualRange,
  getItemAtScrollPosition,
} from '../../app/modules/virtual-list.js';

// ─── calculateVirtualRange ────────────────────────────────────────────────────

describe('calculateVirtualRange', () => {
  const options = { itemHeight: 40, containerHeight: 200, itemCount: 100 };

  it('calculates correct range at scrollTop=0', () => {
    const state = calculateVirtualRange(options, 0);
    assert.equal(state.startIndex, 0);
    assert.equal(state.totalHeight, 4000);
    assert.equal(state.offsetY, 0);
    // 5 visible + 3 overscan below = endIndex 8
    assert.equal(state.endIndex, 8);
    assert.equal(state.visibleCount, 5);
  });

  it('calculates correct range in the middle of the list', () => {
    // scrollTop=400 → rawStart=10, startIndex=7, rawEnd=10+5=15, endIndex=18
    const state = calculateVirtualRange(options, 400);
    assert.equal(state.startIndex, 7);
    assert.equal(state.endIndex, 18);
    assert.equal(state.offsetY, 7 * 40);
  });

  it('overscan adds extra items above and below', () => {
    const opts = { itemHeight: 50, containerHeight: 100, itemCount: 50, overscan: 5 };
    // scrollTop=250 → rawStart=5, startIndex=0, rawEnd=5+2=7, endIndex=12
    const state = calculateVirtualRange(opts, 250);
    assert.equal(state.startIndex, 0);
    assert.equal(state.endIndex, 12);
  });

  it('clamps startIndex to 0 at the top of the list', () => {
    const state = calculateVirtualRange(options, 0);
    assert.equal(state.startIndex, 0);
  });

  it('clamps endIndex to itemCount at the bottom of the list', () => {
    const state = calculateVirtualRange(options, 3800); // near end
    assert.equal(state.endIndex, 100);
  });
});

// ─── scrollToItem ─────────────────────────────────────────────────────────────

describe('scrollToItem', () => {
  const options = { itemHeight: 40, containerHeight: 200, itemCount: 100 };

  it('"start" aligns item to top of container', () => {
    const scrollTop = scrollToItem(options, 10, 'start');
    assert.equal(scrollTop, 400); // item 10 * 40
  });

  it('"center" centers item in container', () => {
    const scrollTop = scrollToItem(options, 10, 'center');
    // itemTop=400, center = 400 - (200 - 40) / 2 = 400 - 80 = 320
    assert.equal(scrollTop, 320);
  });

  it('"end" aligns item to bottom of container', () => {
    const scrollTop = scrollToItem(options, 10, 'end');
    // itemTop=400, end = 400 - 200 + 40 = 240
    assert.equal(scrollTop, 240);
  });

  it('defaults to "start" alignment', () => {
    const scrollTop = scrollToItem(options, 5);
    assert.equal(scrollTop, 200);
  });

  it('clamps to 0 for items near the top', () => {
    // For item 0, "end" would give a negative scroll
    const scrollTop = scrollToItem(options, 0, 'end');
    assert.equal(scrollTop, 0);
  });

  it('clamps to max scroll at the bottom', () => {
    // maxScroll = 100 * 40 - 200 = 3800
    const scrollTop = scrollToItem(options, 99, 'start');
    assert.equal(scrollTop, 3800);
  });
});

// ─── calculateVariableVirtualRange ───────────────────────────────────────────

describe('calculateVariableVirtualRange', () => {
  it('calculates range for variable-height items at scrollTop=0', () => {
    const heights = [50, 100, 30, 80, 60, 40, 70, 90, 20, 50];
    const state = calculateVariableVirtualRange(heights, 150, 0);
    assert.equal(state.startIndex, 0);
    assert.equal(state.offsetY, 0);
    // total = 590
    assert.equal(state.totalHeight, 590);
    assert.ok(state.endIndex > 0);
  });

  it('calculates range in the middle of a variable-height list', () => {
    // heights: [50, 100, 30, 80, 60]
    // offsets: [0, 50, 150, 180, 260, 320]
    const heights = [50, 100, 30, 80, 60];
    const state = calculateVariableVirtualRange(heights, 80, 50, 0);
    // scrollTop=50 → item 1 starts at 50, rawStart=1
    // scrollBottom=130 → item 1 ends at 150 > 130, so rawEnd=1
    // overscan=0: startIndex=1, endIndex=2
    assert.equal(state.startIndex, 1);
    assert.equal(state.endIndex, 2);
    assert.equal(state.offsetY, 50);
  });

  it('respects overscan for variable-height items', () => {
    const heights = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
    // All items are 20px, container=40px, scrollTop=80 (item 4)
    const state = calculateVariableVirtualRange(heights, 40, 80, 2);
    assert.ok(state.startIndex <= 2); // at least 2 items above
    assert.ok(state.endIndex >= 8);   // at least 2 items below
  });

  it('reports correct totalHeight', () => {
    const heights = [100, 200, 300];
    const state = calculateVariableVirtualRange(heights, 100, 0);
    assert.equal(state.totalHeight, 600);
  });
});

// ─── getItemAtScrollPosition ──────────────────────────────────────────────────

describe('getItemAtScrollPosition', () => {
  const options = { itemHeight: 50, containerHeight: 200, itemCount: 20 };

  it('returns index 0 at scrollTop=0', () => {
    assert.equal(getItemAtScrollPosition(options, 0), 0);
  });

  it('returns correct item index at mid-list scroll position', () => {
    // scrollTop=100 → index 2
    assert.equal(getItemAtScrollPosition(options, 100), 2);
  });

  it('returns correct item index inside an item boundary', () => {
    // scrollTop=149 → still item 2
    assert.equal(getItemAtScrollPosition(options, 149), 2);
  });

  it('returns last item index when scrollTop exceeds total height', () => {
    assert.equal(getItemAtScrollPosition(options, 9999), 19);
  });

  it('returns 0 when scrollTop is negative', () => {
    assert.equal(getItemAtScrollPosition(options, -50), 0);
  });
});
