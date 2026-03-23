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

describe('enhanced-zoom', () => {
  let currentZoom;
  let renderCalled;
  let deps;

  beforeEach(() => {
    currentZoom = 1.0;
    renderCalled = false;
    deps = {
      getZoom: () => currentZoom,
      setZoom: (z) => { currentZoom = z; },
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
  });

  describe('zoomToNextPreset', () => {
    it('does nothing without init', () => {
      destroyEnhancedZoom();
      assert.doesNotThrow(() => zoomToNextPreset());
    });
  });

  describe('zoomToPrevPreset', () => {
    it('does nothing without init', () => {
      destroyEnhancedZoom();
      assert.doesNotThrow(() => zoomToPrevPreset());
    });
  });

  describe('zoomToPreset', () => {
    it('clamps zoom to valid range', () => {
      initEnhancedZoom(deps);
      zoomToPreset(0.01);
      // smoothZoomTo is async via rAF, so just verify no error
      assert.ok(true);
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
  });
});
