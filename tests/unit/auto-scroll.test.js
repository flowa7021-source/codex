import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  initAutoScroll,
  destroyAutoScroll,
  startAutoScroll,
  stopAutoScroll,
  toggleAutoScroll,
  setAutoScrollSpeed,
  isAutoScrolling,
} from '../../app/modules/auto-scroll.js';

function makeDeps() {
  return {
    state: { currentPage: 1, pageCount: 10 },
    els: { canvasWrap: document.createElement('div') },
    goToPage: mock.fn(),
  };
}

describe('auto-scroll', () => {
  beforeEach(() => {
    destroyAutoScroll();
    localStorage.clear();
  });

  it('isAutoScrolling returns false initially', () => {
    assert.equal(isAutoScrolling(), false);
  });

  it('startAutoScroll sets isAutoScrolling to true', () => {
    initAutoScroll(makeDeps());
    startAutoScroll(5);
    assert.equal(isAutoScrolling(), true);
    stopAutoScroll();
  });

  it('stopAutoScroll sets isAutoScrolling to false', () => {
    initAutoScroll(makeDeps());
    startAutoScroll(3);
    stopAutoScroll();
    assert.equal(isAutoScrolling(), false);
  });

  it('toggleAutoScroll toggles between scrolling and paused', () => {
    initAutoScroll(makeDeps());
    toggleAutoScroll(); // start
    assert.equal(isAutoScrolling(), true);
    toggleAutoScroll(); // pause
    assert.equal(isAutoScrolling(), false);
    stopAutoScroll();
  });

  it('setAutoScrollSpeed clamps to range 1-10', () => {
    initAutoScroll(makeDeps());
    setAutoScrollSpeed(0);
    // Speed should be clamped to 1 minimum
    // We verify indirectly via localStorage persistence
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '1');

    setAutoScrollSpeed(15);
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '10');

    setAutoScrollSpeed(7);
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '7');
    stopAutoScroll();
  });

  it('destroyAutoScroll stops scrolling and cleans up', () => {
    initAutoScroll(makeDeps());
    startAutoScroll(5);
    assert.equal(isAutoScrolling(), true);
    destroyAutoScroll();
    assert.equal(isAutoScrolling(), false);
  });

  it('startAutoScroll persists speed to localStorage', () => {
    initAutoScroll(makeDeps());
    startAutoScroll(8);
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '8');
    stopAutoScroll();
  });

  it('initAutoScroll loads speed from localStorage', () => {
    localStorage.setItem('novareader-autoscroll-speed', '6');
    initAutoScroll(makeDeps());
    // After init, the speed should be loaded from storage
    // Starting without explicit speed should use the loaded value
    startAutoScroll();
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '6');
    stopAutoScroll();
  });
});
