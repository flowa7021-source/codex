import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Create DOM elements the minimap expects
function createMinimapEls() {
  const container = document.createElement('div');
  container.id = 'minimapContainer';
  container.style.display = 'none';
  container.clientHeight = 500;
  container.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 500, right: 50, width: 50, height: 500, clientHeight: 500 });

  const track = document.createElement('div');
  track.id = 'minimapTrack';
  track.scrollHeight = 1000;
  track.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 500, right: 50, width: 50, height: 500 });

  const viewport = document.createElement('div');
  viewport.id = 'minimapViewport';
  viewport.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });

  container.appendChild(track);
  container.appendChild(viewport);

  return { container, track, viewport };
}

let els;

// Mock getElementById
const origGetById = document.getElementById;
document.getElementById = (id) => {
  if (els) {
    if (id === 'minimapContainer') return els.container;
    if (id === 'minimapTrack') return els.track;
    if (id === 'minimapViewport') return els.viewport;
  }
  return null;
};

// Ensure AbortController is available
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  };
}

const {
  initMinimap,
  showMinimap,
  hideMinimap,
  toggleMinimap,
  updateMinimap,
  destroyMinimap,
} = await import('../../app/modules/minimap.js');

describe('minimap', () => {
  beforeEach(() => {
    destroyMinimap();
    els = createMinimapEls();
  });

  it('initMinimap is a function', () => {
    assert.equal(typeof initMinimap, 'function');
  });

  it('initMinimap returns early if container elements missing', () => {
    els = null;
    assert.doesNotThrow(() => initMinimap({ state: {}, els: {} }));
  });

  it('hideMinimap hides the container', () => {
    initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} });
    hideMinimap();
    assert.equal(els.container.style.display, 'none');
  });

  it('showMinimap does nothing without adapter', () => {
    initMinimap({ state: { pageCount: 5 }, els: {} });
    showMinimap();
    // No error should occur
    assert.equal(els.container.style.display, 'none');
  });

  it('toggleMinimap toggles visibility', () => {
    const deps = { state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} };
    initMinimap(deps);
    // After init with >1 page and adapter, it shows automatically
    // Then toggle should hide
    toggleMinimap();
    assert.equal(els.container.style.display, 'none');
  });

  it('updateMinimap does nothing when not visible', () => {
    initMinimap({ state: { pageCount: 5, adapter: {} }, els: {} });
    hideMinimap();
    assert.doesNotThrow(() => updateMinimap());
  });

  it('destroyMinimap cleans up state', () => {
    initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} });
    destroyMinimap();
    // After destroy, updateMinimap should be safe
    assert.doesNotThrow(() => updateMinimap());
  });

  it('destroyMinimap is safe to call multiple times', () => {
    assert.doesNotThrow(() => {
      destroyMinimap();
      destroyMinimap();
    });
  });

  it('hideMinimap is safe without init', () => {
    assert.doesNotThrow(() => hideMinimap());
  });

  it('showMinimap builds track with page placeholders', () => {
    const deps = { state: { pageCount: 3, adapter: {}, minimapEnabled: true }, els: {} };
    initMinimap(deps);
    // Track should have children (one per page)
    assert.equal(els.track.children.length, 3);
  });
});
