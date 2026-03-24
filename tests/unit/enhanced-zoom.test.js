import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const {
  ZOOM_PRESETS,
  initEnhancedZoom,
  destroyEnhancedZoom,
  zoomToNextPreset,
  zoomToPrevPreset,
  zoomToPreset,
  smoothZoomTo,
  startMarqueeZoom,
  cancelMarqueeZoom,
  saveDocumentZoom,
  loadDocumentZoom,
} = await import('../../app/modules/enhanced-zoom.js');

/** Wait for all pending rAF / setTimeout(fn,0) callbacks to flush */
function flushRAF(count = 10) {
  return new Promise((resolve) => {
    let remaining = count;
    function tick() {
      if (--remaining <= 0) { resolve(); return; }
      setTimeout(tick, 5);
    }
    setTimeout(tick, 5);
  });
}

describe('enhanced-zoom', () => {
  let currentZoom;
  let renderCalled;
  let setZoomCalls;
  let deps;

  beforeEach(() => {
    currentZoom = 1.0;
    renderCalled = false;
    setZoomCalls = [];
    deps = {
      getZoom: () => currentZoom,
      setZoom: (z) => { currentZoom = z; setZoomCalls.push(z); },
      render: async () => { renderCalled = true; },
      canvasWrap: document.createElement('div'),
      canvas: document.createElement('canvas'),
    };
    localStorage.clear();
    destroyEnhancedZoom();
  });

  describe('ZOOM_PRESETS', () => {
    it('is an array of numbers in ascending order', () => {
      assert.ok(Array.isArray(ZOOM_PRESETS));
      for (let i = 1; i < ZOOM_PRESETS.length; i++) {
        assert.ok(ZOOM_PRESETS[i] > ZOOM_PRESETS[i - 1]);
      }
    });

    it('contains common zoom levels', () => {
      assert.ok(ZOOM_PRESETS.includes(1.0));
      assert.ok(ZOOM_PRESETS.includes(0.5));
      assert.ok(ZOOM_PRESETS.includes(2.0));
    });
  });

  describe('initEnhancedZoom / destroyEnhancedZoom', () => {
    it('initializes without error', () => {
      assert.doesNotThrow(() => initEnhancedZoom(deps));
    });

    it('can be re-initialized safely', () => {
      initEnhancedZoom(deps);
      assert.doesNotThrow(() => initEnhancedZoom(deps));
    });

    it('destroyEnhancedZoom runs without init', () => {
      assert.doesNotThrow(() => destroyEnhancedZoom());
    });

    it('destroyEnhancedZoom after init cleans up', () => {
      initEnhancedZoom(deps);
      assert.doesNotThrow(() => destroyEnhancedZoom());
      // After destroy, zoom functions should no-op (deps nullified via abort)
    });
  });

  describe('zoomToNextPreset', () => {
    it('does nothing without init', () => {
      destroyEnhancedZoom();
      assert.doesNotThrow(() => zoomToNextPreset());
    });

    it('zooms to the next preset above current zoom', async () => {
      currentZoom = 1.0;
      initEnhancedZoom(deps);
      zoomToNextPreset();
      // smoothZoomTo fires rAF callbacks; wait for them
      await flushRAF(20);
      // The next preset above 1.0 is 1.25
      assert.equal(currentZoom, 1.25);
    });

    it('zooms from 0.5 to 0.75', async () => {
      currentZoom = 0.5;
      initEnhancedZoom(deps);
      zoomToNextPreset();
      await flushRAF(20);
      assert.equal(currentZoom, 0.75);
    });

    it('does nothing when at the highest preset', async () => {
      currentZoom = 4.0;
      initEnhancedZoom(deps);
      zoomToNextPreset();
      await flushRAF(5);
      // Should remain at 4.0 since no preset is above 4.0
      assert.equal(currentZoom, 4.0);
    });
  });

  describe('zoomToPrevPreset', () => {
    it('does nothing without init', () => {
      destroyEnhancedZoom();
      assert.doesNotThrow(() => zoomToPrevPreset());
    });

    it('zooms to the previous preset below current zoom', async () => {
      currentZoom = 1.0;
      initEnhancedZoom(deps);
      zoomToPrevPreset();
      await flushRAF(20);
      // The previous preset below 1.0 is 0.75
      assert.equal(currentZoom, 0.75);
    });

    it('zooms from 2.0 to 1.5', async () => {
      currentZoom = 2.0;
      initEnhancedZoom(deps);
      zoomToPrevPreset();
      await flushRAF(20);
      assert.equal(currentZoom, 1.5);
    });

    it('does nothing when at the lowest preset', async () => {
      currentZoom = 0.25;
      initEnhancedZoom(deps);
      zoomToPrevPreset();
      await flushRAF(5);
      assert.equal(currentZoom, 0.25);
    });
  });

  describe('zoomToPreset', () => {
    it('clamps zoom to valid range (low)', async () => {
      initEnhancedZoom(deps);
      zoomToPreset(0.01);
      await flushRAF(20);
      // Should clamp to ZOOM_MIN = 0.1
      assert.equal(currentZoom, 0.1);
    });

    it('clamps zoom to valid range (high)', async () => {
      initEnhancedZoom(deps);
      zoomToPreset(15);
      await flushRAF(20);
      // Should clamp to ZOOM_MAX = 10
      assert.equal(currentZoom, 10);
    });

    it('sets zoom to exact value within range', async () => {
      initEnhancedZoom(deps);
      zoomToPreset(2.5);
      await flushRAF(20);
      assert.equal(currentZoom, 2.5);
    });
  });

  describe('smoothZoomTo', () => {
    it('does nothing without init', () => {
      destroyEnhancedZoom();
      assert.doesNotThrow(() => smoothZoomTo(2.0));
    });

    it('animates to target zoom value', async () => {
      currentZoom = 1.0;
      initEnhancedZoom(deps);
      smoothZoomTo(2.0);
      await flushRAF(20);
      assert.equal(currentZoom, 2.0);
      assert.ok(renderCalled, 'render should be called when animation completes');
    });

    it('skips animation when diff is negligible', () => {
      currentZoom = 1.0;
      initEnhancedZoom(deps);
      setZoomCalls = [];
      smoothZoomTo(1.0005); // diff < 0.001
      assert.equal(setZoomCalls.length, 0, 'should not set zoom for negligible diff');
    });

    it('calls setZoom during animation steps', async () => {
      currentZoom = 1.0;
      initEnhancedZoom(deps);
      setZoomCalls = [];
      smoothZoomTo(3.0);
      await flushRAF(20);
      assert.ok(setZoomCalls.length > 0, 'setZoom should be called');
      assert.equal(currentZoom, 3.0);
    });
  });

  describe('wheel zoom', () => {
    it('zooms on ctrl+wheel event', () => {
      initEnhancedZoom(deps);
      const wheelEvt = {
        type: 'wheel',
        ctrlKey: true,
        metaKey: false,
        deltaY: -100,
        preventDefault: mock.fn(),
      };
      deps.canvasWrap.dispatchEvent(wheelEvt);
      assert.ok(wheelEvt.preventDefault.mock.callCount() > 0, 'should prevent default');
      assert.ok(currentZoom > 1.0, 'zoom should increase on scroll up');
      assert.ok(renderCalled, 'render should be called');
    });

    it('zooms on meta+wheel event', () => {
      initEnhancedZoom(deps);
      const wheelEvt = {
        type: 'wheel',
        ctrlKey: false,
        metaKey: true,
        deltaY: 100,
        preventDefault: mock.fn(),
      };
      deps.canvasWrap.dispatchEvent(wheelEvt);
      assert.ok(currentZoom < 1.0, 'zoom should decrease on scroll down');
    });

    it('ignores wheel without modifier keys', () => {
      initEnhancedZoom(deps);
      const wheelEvt = {
        type: 'wheel',
        ctrlKey: false,
        metaKey: false,
        deltaY: -100,
        preventDefault: mock.fn(),
      };
      deps.canvasWrap.dispatchEvent(wheelEvt);
      assert.equal(currentZoom, 1.0, 'zoom should not change');
      assert.equal(wheelEvt.preventDefault.mock.callCount(), 0);
    });
  });

  describe('pinch zoom', () => {
    it('handles two-finger touchstart + touchmove + touchend', () => {
      initEnhancedZoom(deps);

      // Simulate touchstart with 2 fingers
      const touchStartEvt = {
        type: 'touchstart',
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      };
      deps.canvasWrap.dispatchEvent(touchStartEvt);

      // Simulate touchmove spreading fingers apart (zoom in)
      const touchMoveEvt = {
        type: 'touchmove',
        touches: [
          { clientX: 50, clientY: 50 },
          { clientX: 250, clientY: 250 },
        ],
        preventDefault: mock.fn(),
      };
      deps.canvasWrap.dispatchEvent(touchMoveEvt);
      assert.ok(currentZoom > 1.0, 'zoom should increase when pinching out');
      assert.ok(touchMoveEvt.preventDefault.mock.callCount() > 0);

      // Simulate touchend
      renderCalled = false;
      const touchEndEvt = {
        type: 'touchend',
        touches: [],
      };
      deps.canvasWrap.dispatchEvent(touchEndEvt);
      assert.ok(renderCalled, 'render should be called on touchend');
    });

    it('ignores single-finger touches', () => {
      initEnhancedZoom(deps);
      const touchStartEvt = {
        type: 'touchstart',
        touches: [{ clientX: 100, clientY: 100 }],
      };
      deps.canvasWrap.dispatchEvent(touchStartEvt);
      assert.equal(currentZoom, 1.0, 'zoom should not change for single touch');
    });

    it('handles pinch zoom in (fingers closer together)', () => {
      initEnhancedZoom(deps);

      const touchStartEvt = {
        type: 'touchstart',
        touches: [
          { clientX: 50, clientY: 50 },
          { clientX: 250, clientY: 250 },
        ],
      };
      deps.canvasWrap.dispatchEvent(touchStartEvt);

      // Move fingers closer (zoom out)
      const touchMoveEvt = {
        type: 'touchmove',
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
        preventDefault: mock.fn(),
      };
      deps.canvasWrap.dispatchEvent(touchMoveEvt);
      assert.ok(currentZoom < 1.0, 'zoom should decrease when pinching in');
    });
  });

  describe('saveDocumentZoom / loadDocumentZoom', () => {
    it('saves and loads zoom for a document', () => {
      saveDocumentZoom('test.pdf', 1.5);
      assert.equal(loadDocumentZoom('test.pdf'), 1.5);
    });

    it('returns null for unknown document', () => {
      assert.equal(loadDocumentZoom('unknown.pdf'), null);
    });

    it('overwrites previous zoom value', () => {
      saveDocumentZoom('doc.pdf', 1.0);
      saveDocumentZoom('doc.pdf', 2.0);
      assert.equal(loadDocumentZoom('doc.pdf'), 2.0);
    });

    it('limits stored documents to 50', () => {
      for (let i = 0; i < 55; i++) {
        saveDocumentZoom(`doc${i}.pdf`, 1.0);
      }
      // The first few should have been evicted
      const data = JSON.parse(localStorage.getItem('novareader-zoom-memory') || '{}');
      assert.ok(Object.keys(data).length <= 51);
    });

    it('handles corrupted localStorage gracefully on save', () => {
      localStorage.setItem('novareader-zoom-memory', 'not-json');
      // Should not throw, just warn
      assert.doesNotThrow(() => saveDocumentZoom('test.pdf', 1.0));
    });

    it('handles corrupted localStorage gracefully on load', () => {
      localStorage.setItem('novareader-zoom-memory', 'not-json');
      const result = loadDocumentZoom('test.pdf');
      assert.equal(result, null);
    });
  });

  describe('marquee zoom', () => {
    it('startMarqueeZoom does nothing without deps', () => {
      destroyEnhancedZoom();
      assert.doesNotThrow(() => startMarqueeZoom());
    });

    it('cancelMarqueeZoom runs safely without prior start', () => {
      initEnhancedZoom(deps);
      assert.doesNotThrow(() => cancelMarqueeZoom());
    });

    it('startMarqueeZoom sets crosshair cursor', () => {
      initEnhancedZoom(deps);
      startMarqueeZoom();
      assert.equal(deps.canvasWrap.style.cursor, 'crosshair');
    });

    it('cancelMarqueeZoom resets cursor and hides overlay', () => {
      initEnhancedZoom(deps);
      startMarqueeZoom();
      cancelMarqueeZoom();
      assert.equal(deps.canvasWrap.style.cursor, '');
    });

    it('startMarqueeZoom reuses existing overlay on second call', () => {
      initEnhancedZoom(deps);
      startMarqueeZoom();
      const childCountAfterFirst = deps.canvasWrap.children.length;
      cancelMarqueeZoom();
      startMarqueeZoom();
      assert.equal(deps.canvasWrap.children.length, childCountAfterFirst);
    });
  });
});
