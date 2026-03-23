import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Stub safe-timers
mock.module('../../app/modules/safe-timers.js', {
  namedExports: {
    safeTimeout: (fn, ms) => setTimeout(fn, ms),
    clearSafeTimeout: (id) => clearTimeout(id),
    safeInterval: (fn, ms) => setInterval(fn, ms),
    clearSafeInterval: (id) => clearInterval(id),
  },
});

// Stub fullscreen
document.fullscreenElement = null;
document.exitFullscreen = async () => { document.fullscreenElement = null; };

const { PresentationMode } = await import('../../app/modules/presentation-mode.js');

describe('PresentationMode', () => {
  let pres;
  let pageChanges;
  let exitCalled;
  let deps;

  beforeEach(() => {
    pageChanges = [];
    exitCalled = false;

    deps = {
      renderPage: async (pageNum) => {
        const c = document.createElement('canvas');
        c.width = 800;
        c.height = 600;
        return c;
      },
      getTotalPages: () => 5,
      getCurrentPage: () => 1,
      onExit: () => { exitCalled = true; },
      onPageChange: (n) => { pageChanges.push(n); },
    };

    pres = new PresentationMode(deps);
  });

  it('constructs with default values', () => {
    assert.equal(pres._currentPage, 1);
    assert.equal(pres._totalPages, 5);
    assert.equal(pres._transition, 'fade');
    assert.equal(pres._autoAdvance, 0);
    assert.equal(pres._laserOn, false);
    assert.equal(pres._blanked, null);
  });

  it('setTransition updates transition type', () => {
    pres.setTransition('slide');
    assert.equal(pres._transition, 'slide');
  });

  it('setTransition ignores invalid transition', () => {
    pres.setTransition('invalid');
    assert.equal(pres._transition, 'fade');
  });

  it('setAutoAdvance sets non-negative interval', () => {
    pres.setAutoAdvance(5);
    assert.equal(pres._autoAdvance, 5);
  });

  it('setAutoAdvance clamps negative to 0', () => {
    pres.setAutoAdvance(-1);
    assert.equal(pres._autoAdvance, 0);
  });

  it('goToPage ignores out of range pages', async () => {
    await pres.start(1);
    await pres.goToPage(0);
    assert.equal(pres._currentPage, 1);
    await pres.goToPage(100);
    assert.equal(pres._currentPage, 1);
    pres.stop();
  });

  it('goToPage navigates to valid page', async () => {
    await pres.start(1);
    await pres.goToPage(3);
    assert.equal(pres._currentPage, 3);
    assert.ok(pageChanges.includes(3));
    pres.stop();
  });

  it('stop calls onExit', async () => {
    await pres.start();
    pres.stop();
    assert.ok(exitCalled);
  });

  it('stop removes overlay', async () => {
    await pres.start();
    assert.ok(pres._overlay !== null);
    pres.stop();
    assert.equal(pres._overlay, null);
  });

  it('toggleLaser toggles laser state', async () => {
    await pres.start();
    assert.equal(pres._laserOn, false);
    pres.toggleLaser();
    assert.equal(pres._laserOn, true);
    pres.toggleLaser();
    assert.equal(pres._laserOn, false);
    pres.stop();
  });

  it('_toggleBlank toggles blank screen', () => {
    // Build overlay first
    pres._buildOverlay();
    pres._toggleBlank('black');
    assert.equal(pres._blanked, 'black');
    pres._toggleBlank('black');
    assert.equal(pres._blanked, null);
    pres.stop();
  });

  it('start sets total pages from deps', async () => {
    deps.getTotalPages = () => 20;
    await pres.start(5);
    assert.equal(pres._totalPages, 20);
    assert.equal(pres._currentPage, 5);
    pres.stop();
  });
});
