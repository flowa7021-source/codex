import './setup-dom.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
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

/**
 * Create widget DOM elements and override document.getElementById
 * so initAutoScroll can find them.
 */
function setupWidgetDOM() {
  const widget = document.createElement('div');
  widget.id = 'autoScrollWidget';
  widget.style.display = 'none';

  const speedFill = document.createElement('div');
  speedFill.id = 'autoScrollSpeedFill';

  const speedLabel = document.createElement('span');
  speedLabel.id = 'autoScrollSpeedLabel';

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'autoScrollToggle';

  const slowerBtn = document.createElement('button');
  slowerBtn.id = 'autoScrollSlower';

  const fasterBtn = document.createElement('button');
  fasterBtn.id = 'autoScrollFaster';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'autoScrollClose';

  const viewport = document.createElement('div');
  viewport.id = 'documentViewport';

  const contWrap = document.createElement('div');
  contWrap.id = 'continuousScrollWrap';
  contWrap.style.display = 'none';

  // Add contains method for onDocumentClick checks
  const allWidgetChildren = [speedFill, speedLabel, toggleBtn, slowerBtn, fasterBtn, closeBtn];
  widget.contains = (target) => target === widget || allWidgetChildren.includes(target);

  const elements = {
    autoScrollWidget: widget,
    autoScrollSpeedFill: speedFill,
    autoScrollSpeedLabel: speedLabel,
    autoScrollToggle: toggleBtn,
    autoScrollSlower: slowerBtn,
    autoScrollFaster: fasterBtn,
    autoScrollClose: closeBtn,
    documentViewport: viewport,
    continuousScrollWrap: contWrap,
  };

  return elements;
}

function installGetElementById(elements) {
  const original = document.getElementById;
  document.getElementById = (id) => elements[id] || null;
  return original;
}

/**
 * Patch document to support addEventListener/removeEventListener/dispatchEvent
 * so that initAutoScroll's event registrations actually work.
 */
function patchDocumentEvents() {
  const _docListeners = {};
  const origAddEL = document.addEventListener;
  const origRemoveEL = document.removeEventListener;

  document.addEventListener = (type, fn, _opts) => {
    if (!_docListeners[type]) _docListeners[type] = [];
    _docListeners[type].push(fn);
  };
  document.removeEventListener = (type, fn) => {
    if (_docListeners[type]) {
      _docListeners[type] = _docListeners[type].filter((f) => f !== fn);
    }
  };
  document.dispatchEvent = (evt) => {
    const fns = _docListeners[evt.type] || [];
    for (const fn of fns) fn(evt);
  };

  // Ensure document.activeElement is available for keyboard handler checks
  if (!document.activeElement) {
    document.activeElement = { tagName: 'BODY' };
  }

  return () => {
    document.addEventListener = origAddEL;
    document.removeEventListener = origRemoveEL;
    delete document.dispatchEvent;
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

  it('loadSpeed ignores invalid localStorage values', () => {
    localStorage.setItem('novareader-autoscroll-speed', 'abc');
    initAutoScroll(makeDeps());
    // Invalid value should be ignored, speed remains default (5)
    startAutoScroll();
    // NaN fails the >= MIN_SPEED check, so speed stays at previous value
    assert.equal(isAutoScrolling(), true);
    stopAutoScroll();
  });

  it('loadSpeed ignores out-of-range localStorage values', () => {
    localStorage.setItem('novareader-autoscroll-speed', '99');
    initAutoScroll(makeDeps());
    startAutoScroll();
    // 99 is out of range (> MAX_SPEED), so speed stays at default
    assert.equal(isAutoScrolling(), true);
    stopAutoScroll();
  });

  it('loadSpeed ignores value below MIN_SPEED', () => {
    localStorage.setItem('novareader-autoscroll-speed', '0');
    initAutoScroll(makeDeps());
    startAutoScroll();
    assert.equal(isAutoScrolling(), true);
    stopAutoScroll();
  });

  it('startAutoScroll without speed uses current speed', () => {
    initAutoScroll(makeDeps());
    setAutoScrollSpeed(3);
    startAutoScroll();
    assert.equal(isAutoScrolling(), true);
    // Speed should remain 3 (no change)
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '3');
    stopAutoScroll();
  });

  it('startAutoScroll clamps speed to valid range', () => {
    initAutoScroll(makeDeps());
    startAutoScroll(-5);
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '1');
    stopAutoScroll();

    startAutoScroll(100);
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '10');
    stopAutoScroll();
  });

  it('startAutoScroll rounds fractional speed', () => {
    initAutoScroll(makeDeps());
    startAutoScroll(3.7);
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '4');
    stopAutoScroll();
  });

  it('setAutoScrollSpeed rounds fractional values', () => {
    initAutoScroll(makeDeps());
    setAutoScrollSpeed(4.6);
    assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '5');
  });

  it('re-initializing aborts previous listeners', () => {
    const deps1 = makeDeps();
    initAutoScroll(deps1);
    // Re-init should not throw
    const deps2 = makeDeps();
    initAutoScroll(deps2);
    startAutoScroll(5);
    assert.equal(isAutoScrolling(), true);
    stopAutoScroll();
  });

  it('destroyAutoScroll can be called when not initialized', () => {
    // Should not throw
    destroyAutoScroll();
    assert.equal(isAutoScrolling(), false);
  });

  it('destroyAutoScroll nullifies abort controller', () => {
    initAutoScroll(makeDeps());
    destroyAutoScroll();
    // Calling again should not throw (abort controller is null)
    destroyAutoScroll();
    assert.equal(isAutoScrolling(), false);
  });

  it('stopAutoScroll when not scrolling is a no-op', () => {
    initAutoScroll(makeDeps());
    // Not scrolling, should not throw
    stopAutoScroll();
    assert.equal(isAutoScrolling(), false);
  });

  describe('with widget DOM elements', () => {
    let elements;
    let origGetById;
    let restoreDocEvents;

    beforeEach(() => {
      elements = setupWidgetDOM();
      origGetById = installGetElementById(elements);
      restoreDocEvents = patchDocumentEvents();
    });

    afterEach(() => {
      destroyAutoScroll();
      restoreDocEvents();
      document.getElementById = origGetById;
      localStorage.clear();
    });

    it('showWidget sets widget display to flex on start', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      assert.equal(elements.autoScrollWidget.style.display, 'flex');
      stopAutoScroll();
    });

    it('hideWidget sets widget display to none on stop', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      stopAutoScroll();
      assert.equal(elements.autoScrollWidget.style.display, 'none');
    });

    it('updateWidgetUI updates speed fill width', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(1);
      // speed 1: pct = ((1-1)/(10-1))*100 = 0%
      assert.equal(elements.autoScrollSpeedFill.style.width, '0%');
      stopAutoScroll();

      startAutoScroll(10);
      // speed 10: pct = ((10-1)/(10-1))*100 = 100%
      assert.equal(elements.autoScrollSpeedFill.style.width, '100%');
      stopAutoScroll();
    });

    it('updateWidgetUI updates speed label text', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(7);
      assert.equal(elements.autoScrollSpeedLabel.textContent, '7x');
      stopAutoScroll();
    });

    it('updateWidgetUI shows pause icon when scrolling', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      assert.equal(elements.autoScrollToggle.textContent, '\u23F8');
      stopAutoScroll();
    });

    it('updateWidgetUI shows play icon when paused', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      toggleAutoScroll(); // pause
      assert.equal(elements.autoScrollToggle.textContent, '\u25B6');
      stopAutoScroll();
    });

    it('setAutoScrollSpeed updates widget UI', () => {
      initAutoScroll(makeDeps());
      setAutoScrollSpeed(5);
      // pct = ((5-1)/9)*100 = 44.44...%
      const pct = ((5 - 1) / 9) * 100;
      assert.equal(elements.autoScrollSpeedFill.style.width, `${pct}%`);
      assert.equal(elements.autoScrollSpeedLabel.textContent, '5x');
    });

    it('toggle button click toggles scrolling', () => {
      initAutoScroll(makeDeps());
      // Click toggle to start
      elements.autoScrollToggle.dispatchEvent(
        Object.assign(new Event('click'), { stopPropagation() {} }),
      );
      assert.equal(isAutoScrolling(), true);
      // Click toggle again to pause
      elements.autoScrollToggle.dispatchEvent(
        Object.assign(new Event('click'), { stopPropagation() {} }),
      );
      assert.equal(isAutoScrolling(), false);
      stopAutoScroll();
    });

    it('slower button decreases speed', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      elements.autoScrollSlower.dispatchEvent(
        Object.assign(new Event('click'), { stopPropagation() {} }),
      );
      assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '4');
      stopAutoScroll();
    });

    it('faster button increases speed', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      elements.autoScrollFaster.dispatchEvent(
        Object.assign(new Event('click'), { stopPropagation() {} }),
      );
      assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '6');
      stopAutoScroll();
    });

    it('close button stops scrolling', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      elements.autoScrollClose.dispatchEvent(
        Object.assign(new Event('click'), { stopPropagation() {} }),
      );
      assert.equal(isAutoScrolling(), false);
    });

    it('widget drag: mousedown on widget background starts drag', () => {
      initAutoScroll(makeDeps());
      const widget = elements.autoScrollWidget;
      // Simulate getBoundingClientRect
      widget.getBoundingClientRect = () => ({ left: 100, top: 200, width: 200, height: 50 });
      widget.offsetWidth = 200;
      widget.offsetHeight = 50;

      const prevented = { value: false };
      const mousedown = {
        type: 'mousedown',
        target: widget,
        clientX: 150,
        clientY: 220,
        preventDefault() { prevented.value = true; },
      };
      // target.closest should return null for non-button
      mousedown.target.closest = () => null;

      widget.dispatchEvent(mousedown);
      assert.equal(prevented.value, true);

      // Now mousemove should move the widget
      const mousemove = {
        type: 'mousemove',
        clientX: 200,
        clientY: 300,
      };
      document.dispatchEvent(mousemove);
      // Widget should have been repositioned
      assert.equal(widget.style.right, 'auto');
      assert.equal(widget.style.bottom, 'auto');

      // mouseup ends drag
      document.dispatchEvent({ type: 'mouseup' });
    });

    it('widget drag: mousedown on button does not start drag', () => {
      initAutoScroll(makeDeps());
      const widget = elements.autoScrollWidget;

      const prevented = { value: false };
      const mousedown = {
        type: 'mousedown',
        target: elements.autoScrollToggle,
        clientX: 150,
        clientY: 220,
        preventDefault() { prevented.value = true; },
      };
      // target.closest returns truthy for button
      mousedown.target.closest = (sel) =>
        sel === '.auto-scroll-btn' ? elements.autoScrollToggle : null;

      widget.dispatchEvent(mousedown);
      // preventDefault should NOT have been called (drag didn't start)
      assert.equal(prevented.value, false);
    });

    it('onDragMove does nothing when not dragging', () => {
      initAutoScroll(makeDeps());
      const widget = elements.autoScrollWidget;
      widget.style.left = '50px';

      // mousemove without prior mousedown should not move widget
      document.dispatchEvent({
        type: 'mousemove',
        clientX: 300,
        clientY: 400,
      });
      assert.equal(widget.style.left, '50px');
    });
  });

  describe('scrollTick and getScrollContainer', () => {
    let elements;
    let origGetById;
    let rafCallbacks;
    let origRaf;
    let origCaf;
    let restoreDocEvents;

    beforeEach(() => {
      elements = setupWidgetDOM();
      origGetById = installGetElementById(elements);
      restoreDocEvents = patchDocumentEvents();

      // Capture requestAnimationFrame callbacks
      rafCallbacks = [];
      origRaf = globalThis.requestAnimationFrame;
      origCaf = globalThis.cancelAnimationFrame;
      globalThis.requestAnimationFrame = (fn) => {
        const id = rafCallbacks.length + 1;
        rafCallbacks.push({ id, fn });
        return id;
      };
      globalThis.cancelAnimationFrame = (id) => {
        rafCallbacks = rafCallbacks.filter((cb) => cb.id !== id);
      };
    });

    afterEach(() => {
      destroyAutoScroll();
      restoreDocEvents();
      document.getElementById = origGetById;
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCaf;
      localStorage.clear();
    });

    function runRafCallbacks(timestamp) {
      const cbs = [...rafCallbacks];
      rafCallbacks = [];
      for (const cb of cbs) {
        cb.fn(timestamp);
      }
    }

    it('scrollTick initializes lastTimestamp on first frame', () => {
      const deps = makeDeps();
      initAutoScroll(deps);
      startAutoScroll(5);

      // First frame: should set lastTimestamp and request another frame
      const beforeCount = rafCallbacks.length;
      runRafCallbacks(1000);
      assert.ok(rafCallbacks.length > 0, 'should request another animation frame');
      assert.equal(isAutoScrolling(), true);
      stopAutoScroll();
    });

    it('scrollTick scrolls the container', () => {
      const deps = makeDeps();
      const container = deps.els.canvasWrap;
      // Set up scroll dimensions so we're not at bottom
      Object.defineProperty(container, 'scrollHeight', { value: 10000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
      container.scrollTop = 0;

      initAutoScroll(deps);
      startAutoScroll(5);

      // First frame: initializes timestamp
      runRafCallbacks(1000);
      // Second frame: should scroll
      runRafCallbacks(1016); // ~16ms later
      assert.ok(container.scrollTop > 0, 'container should have scrolled');
      stopAutoScroll();
    });

    it('scrollTick clamps large deltas (tab backgrounded)', () => {
      const deps = makeDeps();
      const container = deps.els.canvasWrap;
      Object.defineProperty(container, 'scrollHeight', { value: 100000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
      container.scrollTop = 0;

      initAutoScroll(deps);
      startAutoScroll(10); // max speed

      // First frame
      runRafCallbacks(1000);
      // Second frame with huge delta (simulating tab background)
      runRafCallbacks(6000); // 5 seconds later
      // With clamped delta of 200ms at max speed (200 px/s):
      // pixels = (200/1000) * 200 = 40
      assert.ok(container.scrollTop <= 40 + 1, 'delta should be clamped');
      stopAutoScroll();
    });

    it('scrollTick stops when no container available', () => {
      const deps = makeDeps();
      deps.els.canvasWrap = null; // no container
      // Also make sure continuousScrollWrap is not found
      elements.continuousScrollWrap.style.display = 'none';

      initAutoScroll(deps);
      startAutoScroll(5);

      // First frame: init timestamp
      runRafCallbacks(1000);
      // Second frame: no container -> should stop
      runRafCallbacks(1016);
      assert.equal(isAutoScrolling(), false);
    });

    it('scrollTick advances page when at bottom', () => {
      const deps = makeDeps();
      deps.state.currentPage = 1;
      deps.state.pageCount = 10;
      const container = deps.els.canvasWrap;
      Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 1000, configurable: true });
      container.scrollTop = 0; // scrollTop >= scrollHeight - clientHeight - 1

      initAutoScroll(deps);
      startAutoScroll(5);

      // First frame
      runRafCallbacks(1000);
      // Second frame: at bottom, should advance page
      runRafCallbacks(1016);
      assert.equal(deps.state.currentPage, 2);
      assert.equal(deps.goToPage.mock.calls.length, 1);
      assert.deepEqual(deps.goToPage.mock.calls[0].arguments, [2]);
      assert.equal(container.scrollTop, 0); // reset to top
      assert.equal(isAutoScrolling(), true); // still scrolling
      stopAutoScroll();
    });

    it('scrollTick stops at end of document', () => {
      const deps = makeDeps();
      deps.state.currentPage = 10;
      deps.state.pageCount = 10; // last page
      const container = deps.els.canvasWrap;
      Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 1000, configurable: true });
      container.scrollTop = 0;

      initAutoScroll(deps);
      startAutoScroll(5);

      // First frame
      runRafCallbacks(1000);
      // Second frame: at bottom on last page -> stop
      runRafCallbacks(1016);
      assert.equal(isAutoScrolling(), false);
    });

    it('getScrollContainer prefers continuousScrollWrap when visible', () => {
      const deps = makeDeps();
      const contWrap = elements.continuousScrollWrap;
      contWrap.style.display = 'block'; // visible
      Object.defineProperty(contWrap, 'scrollHeight', { value: 10000, configurable: true });
      Object.defineProperty(contWrap, 'clientHeight', { value: 500, configurable: true });
      contWrap.scrollTop = 0;

      initAutoScroll(deps);
      startAutoScroll(5);

      // First frame
      runRafCallbacks(1000);
      // Second frame: should scroll the continuousScrollWrap, not canvasWrap
      runRafCallbacks(1016);
      assert.ok(contWrap.scrollTop > 0, 'continuousScrollWrap should have scrolled');
      stopAutoScroll();
    });

    it('getScrollContainer falls back to canvasWrap when continuousScrollWrap hidden', () => {
      const deps = makeDeps();
      elements.continuousScrollWrap.style.display = 'none';
      const container = deps.els.canvasWrap;
      Object.defineProperty(container, 'scrollHeight', { value: 10000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
      container.scrollTop = 0;

      initAutoScroll(deps);
      startAutoScroll(5);

      runRafCallbacks(1000);
      runRafCallbacks(1016);
      assert.ok(container.scrollTop > 0, 'canvasWrap should have scrolled');
      stopAutoScroll();
    });
  });

  describe('keyboard handlers', () => {
    let elements;
    let origGetById;
    let restoreDocEvents;

    beforeEach(() => {
      elements = setupWidgetDOM();
      origGetById = installGetElementById(elements);
      restoreDocEvents = patchDocumentEvents();
    });

    afterEach(() => {
      destroyAutoScroll();
      restoreDocEvents();
      document.getElementById = origGetById;
      localStorage.clear();
    });

    it('keydown spacebar toggles auto-scroll when scrolling', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      assert.equal(isAutoScrolling(), true);

      const prevented = { value: false };
      // Simulate keydown with spacebar
      document.dispatchEvent({
        type: 'keydown',
        key: ' ',
        altKey: false,
        ctrlKey: false,
        preventDefault() { prevented.value = true; },
      });
      assert.equal(prevented.value, true);
      assert.equal(isAutoScrolling(), false); // paused

      stopAutoScroll();
    });

    it('keydown spacebar does nothing when not scrolling', () => {
      initAutoScroll(makeDeps());
      const prevented = { value: false };
      document.dispatchEvent({
        type: 'keydown',
        key: ' ',
        altKey: false,
        ctrlKey: false,
        preventDefault() { prevented.value = true; },
      });
      // Not scrolling, so spacebar should not be handled
      assert.equal(prevented.value, false);
      assert.equal(isAutoScrolling(), false);
    });

    it('keydown Alt+S starts auto-scroll', () => {
      initAutoScroll(makeDeps());
      const prevented = { value: false };
      document.dispatchEvent({
        type: 'keydown',
        key: 's',
        altKey: true,
        ctrlKey: false,
        preventDefault() { prevented.value = true; },
      });
      assert.equal(prevented.value, true);
      assert.equal(isAutoScrolling(), true);
      stopAutoScroll();
    });

    it('keydown Alt+S stops auto-scroll when already scrolling', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      assert.equal(isAutoScrolling(), true);

      const prevented = { value: false };
      document.dispatchEvent({
        type: 'keydown',
        key: 's',
        altKey: true,
        ctrlKey: false,
        preventDefault() { prevented.value = true; },
      });
      assert.equal(prevented.value, true);
      assert.equal(isAutoScrolling(), false);
    });

    it('keydown Alt+S works with uppercase S', () => {
      initAutoScroll(makeDeps());
      const prevented = { value: false };
      document.dispatchEvent({
        type: 'keydown',
        key: 'S',
        altKey: true,
        ctrlKey: false,
        preventDefault() { prevented.value = true; },
      });
      assert.equal(prevented.value, true);
      assert.equal(isAutoScrolling(), true);
      stopAutoScroll();
    });
  });

  describe('manual scroll cancellation', () => {
    let elements;
    let origGetById;
    let restoreDocEvents;

    beforeEach(() => {
      elements = setupWidgetDOM();
      origGetById = installGetElementById(elements);
      restoreDocEvents = patchDocumentEvents();
    });

    afterEach(() => {
      destroyAutoScroll();
      restoreDocEvents();
      document.getElementById = origGetById;
      localStorage.clear();
    });

    it('wheel event stops auto-scroll', () => {
      const deps = makeDeps();
      initAutoScroll(deps);
      startAutoScroll(5);
      assert.equal(isAutoScrolling(), true);

      // Dispatch wheel on canvasWrap
      deps.els.canvasWrap.dispatchEvent({
        type: 'wheel',
        ctrlKey: false,
      });
      assert.equal(isAutoScrolling(), false);
    });

    it('wheel event with ctrlKey does not stop auto-scroll (zoom)', () => {
      const deps = makeDeps();
      initAutoScroll(deps);
      startAutoScroll(5);
      assert.equal(isAutoScrolling(), true);

      deps.els.canvasWrap.dispatchEvent({
        type: 'wheel',
        ctrlKey: true,
      });
      assert.equal(isAutoScrolling(), true);
      stopAutoScroll();
    });

    it('wheel event when not scrolling is a no-op', () => {
      const deps = makeDeps();
      initAutoScroll(deps);
      // Not scrolling, wheel should not throw
      deps.els.canvasWrap.dispatchEvent({
        type: 'wheel',
        ctrlKey: false,
      });
      assert.equal(isAutoScrolling(), false);
    });

    it('click on document viewport stops auto-scroll', () => {
      const deps = makeDeps();
      initAutoScroll(deps);
      startAutoScroll(5);
      assert.equal(isAutoScrolling(), true);

      elements.documentViewport.dispatchEvent({
        type: 'click',
        target: elements.documentViewport,
      });
      assert.equal(isAutoScrolling(), false);
    });

    it('click inside widget does not stop auto-scroll', () => {
      const deps = makeDeps();
      initAutoScroll(deps);
      startAutoScroll(5);

      // Simulate clicking inside the widget
      // widget.contains needs to return true for the target
      const widget = elements.autoScrollWidget;
      const origContains = widget.contains;
      widget.contains = () => true;

      elements.documentViewport.dispatchEvent({
        type: 'click',
        target: elements.autoScrollToggle,
      });
      assert.equal(isAutoScrolling(), true);

      widget.contains = origContains;
      stopAutoScroll();
    });

    it('click when not scrolling is a no-op', () => {
      const deps = makeDeps();
      initAutoScroll(deps);

      elements.documentViewport.dispatchEvent({
        type: 'click',
        target: elements.documentViewport,
      });
      assert.equal(isAutoScrolling(), false);
    });
  });

  describe('edge cases', () => {
    it('startAutoScroll cancels existing animation frame', () => {
      initAutoScroll(makeDeps());
      startAutoScroll(5);
      // Start again while already scrolling - should not throw
      startAutoScroll(7);
      assert.equal(isAutoScrolling(), true);
      assert.equal(localStorage.getItem('novareader-autoscroll-speed'), '7');
      stopAutoScroll();
    });

    it('toggleAutoScroll from paused state starts scrolling', () => {
      initAutoScroll(makeDeps());
      // Start then pause
      toggleAutoScroll(); // start
      toggleAutoScroll(); // pause
      assert.equal(isAutoScrolling(), false);
      // Toggle again to resume
      toggleAutoScroll(); // resume
      assert.equal(isAutoScrolling(), true);
      stopAutoScroll();
    });

    it('scrollTick with goToPage not a function still advances page', () => {
      let elements = setupWidgetDOM();
      const origGetById = installGetElementById(elements);

      let rafCallbacks = [];
      const origRaf = globalThis.requestAnimationFrame;
      const origCaf = globalThis.cancelAnimationFrame;
      globalThis.requestAnimationFrame = (fn) => {
        const id = rafCallbacks.length + 1;
        rafCallbacks.push({ id, fn });
        return id;
      };
      globalThis.cancelAnimationFrame = (id) => {
        rafCallbacks = rafCallbacks.filter((cb) => cb.id !== id);
      };

      const deps = makeDeps();
      deps.goToPage = 'not a function';
      deps.state.currentPage = 1;
      deps.state.pageCount = 10;
      const container = deps.els.canvasWrap;
      Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 1000, configurable: true });
      container.scrollTop = 0;

      initAutoScroll(deps);
      startAutoScroll(5);

      // Run frames
      const cbs1 = [...rafCallbacks];
      rafCallbacks = [];
      for (const cb of cbs1) cb.fn(1000);
      const cbs2 = [...rafCallbacks];
      rafCallbacks = [];
      for (const cb of cbs2) cb.fn(1016);

      // Page should still advance even though goToPage is not a function
      assert.equal(deps.state.currentPage, 2);
      assert.equal(isAutoScrolling(), true);

      stopAutoScroll();
      document.getElementById = origGetById;
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCaf;
    });

    it('multiple rapid start/stop cycles work correctly', () => {
      initAutoScroll(makeDeps());
      for (let i = 0; i < 10; i++) {
        startAutoScroll(i % 10 + 1);
        stopAutoScroll();
      }
      assert.equal(isAutoScrolling(), false);
    });
  });
});
