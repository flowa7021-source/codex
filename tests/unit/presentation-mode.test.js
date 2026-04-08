import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

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
    pres.setAutoAdvance(0); // reset to avoid lingering timers
  });

  it('setAutoAdvance clamps negative to 0', () => {
    pres.setAutoAdvance(-1);
    assert.equal(pres._autoAdvance, 0);
  });

  it('setAutoAdvance resets auto-advance timer', () => {
    pres.setAutoAdvance(10);
    pres.setAutoAdvance(0);
    assert.equal(pres._autoTimer, null);
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

  it('Home key navigates to page 1', async () => {
    await pres.start(3);
    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Home' });
    e.preventDefault = () => {};
    pres._onKeyDown(e);
    assert.equal(pres._currentPage, 1);
    pres.stop();
  });

  it('End key navigates to last page', async () => {
    await pres.start(2);
    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'End' });
    e.preventDefault = () => {};
    pres._onKeyDown(e);
    assert.equal(pres._currentPage, 5); // totalPages = 5
    pres.stop();
  });

  it('b key toggles black blank', async () => {
    await pres.start(1);
    assert.equal(pres._blanked, null);
    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'b' });
    pres._onKeyDown(e);
    assert.equal(pres._blanked, 'black');
    pres.stop();
  });

  it('w key toggles white blank', async () => {
    await pres.start(1);
    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'w' });
    pres._onKeyDown(e);
    assert.equal(pres._blanked, 'white');
    pres.stop();
  });

  it('l key toggles laser', async () => {
    await pres.start(1);
    assert.equal(pres._laserOn, false);
    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'l' });
    pres._onKeyDown(e);
    assert.equal(pres._laserOn, true);
    pres.stop();
  });

  it('f key skips fullscreen request when already in fullscreen', async () => {
    await pres.start(1);
    // Set fullscreenElement so the if-branch is skipped — no error thrown
    document.fullscreenElement = pres._overlay;
    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'f' });
    pres._onKeyDown(e);
    document.fullscreenElement = null;
    pres.stop();
  });

  it('f key requests fullscreen when not in fullscreen', async () => {
    await pres.start(1);
    document.fullscreenElement = null;
    // Mock requestFullscreen to return a thenable so .catch() works
    pres._overlay.requestFullscreen = () => ({ catch: () => {} });
    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'f' });
    pres._onKeyDown(e);
    pres.stop();
  });

  it('_onMouseMove updates cursor style and laser dot position when laser on', async () => {
    await pres.start(1);
    pres._laserOn = true;
    const e = new Event('mousemove');
    Object.defineProperty(e, 'clientX', { value: 200 });
    Object.defineProperty(e, 'clientY', { value: 300 });
    pres._overlay.dispatchEvent(e);
    assert.equal(pres._laserDot.style.left, '200px');
    assert.equal(pres._laserDot.style.top, '300px');
    assert.equal(pres._overlay.style.cursor, 'default');
    pres.stop();
  });

  it('_onMouseMove updates cursor style when laser is off', async () => {
    await pres.start(1);
    pres._laserOn = false;
    const e = new Event('mousemove');
    Object.defineProperty(e, 'clientX', { value: 50 });
    Object.defineProperty(e, 'clientY', { value: 50 });
    pres._overlay.dispatchEvent(e);
    assert.equal(pres._overlay.style.cursor, 'default');
    pres.stop();
  });

  it('_onClick left half navigates to previous page', async () => {
    await pres.start(3);
    const half = (window.innerWidth || 1024) / 2;
    const e = new Event('click');
    Object.defineProperty(e, 'clientX', { value: half / 2 }); // left half
    pres._overlay.dispatchEvent(e);
    assert.equal(pres._currentPage, 2);
    pres.stop();
  });

  it('_onClick right half navigates to next page', async () => {
    await pres.start(2);
    const half = (window.innerWidth || 1024) / 2;
    const e = new Event('click');
    Object.defineProperty(e, 'clientX', { value: half + 100 }); // right half
    pres._overlay.dispatchEvent(e);
    assert.equal(pres._currentPage, 3);
    pres.stop();
  });
});
