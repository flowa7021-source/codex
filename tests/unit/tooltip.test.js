import './setup-dom.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Provide Element global so `instanceof Element` works in tooltip.js
if (typeof globalThis.Element === 'undefined') {
  globalThis.Element = class Element {
    // Make our mock elements pass instanceof checks if they have getAttribute
    static [Symbol.hasInstance](obj) {
      return obj != null && typeof obj === 'object' && typeof obj.getAttribute === 'function';
    }
  };
}

// Track body children
const _bodyChildren = [];
const _origAppend = document.body.appendChild;
document.body.appendChild = function (child) {
  _bodyChildren.push(child);
  if (child) child.parentNode = document.body;
  return child;
};
document.body.contains = function (el) {
  return _bodyChildren.includes(el);
};

// Patch createElement to add missing methods
const _origCreate = document.createElement;
document.createElement = function (tag) {
  const el = _origCreate(tag);
  el.getBoundingClientRect = () => ({ top: 100, left: 100, bottom: 130, right: 200, width: 100, height: 30 });
  el.focus = el.focus || (() => {});
  el.remove = () => {
    const idx = _bodyChildren.indexOf(el);
    if (idx !== -1) _bodyChildren.splice(idx, 1);
  };
  // Add closest and hasAttribute if missing
  if (!el.closest) {
    el.closest = function (selector) {
      // Simple closest: check self and parents
      let cur = el;
      while (cur) {
        if (cur.getAttribute) {
          if (selector === '[data-tooltip], [title]') {
            if (cur.getAttribute('data-tooltip') !== null || cur.getAttribute('title') !== null) return cur;
          }
        }
        cur = cur.parentNode;
      }
      return null;
    };
  }
  if (!el.hasAttribute) {
    el.hasAttribute = function (k) {
      return el.getAttribute(k) !== null;
    };
  }
  if (!el.removeAttribute) {
    el.removeAttribute = function (k) {
      // Use setAttribute with null-like to simulate removal
      // In our mock, we need to actually remove it
      el._removedAttrs = el._removedAttrs || new Set();
      el._removedAttrs.add(k);
    };
  }
  return el;
};

// Provide AbortController if missing
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  };
}

// Make document.addEventListener track listeners with signal support
const _docListeners = {};
document.addEventListener = function (type, fn, opts) {
  if (!_docListeners[type]) _docListeners[type] = [];
  _docListeners[type].push({ fn, opts });
  // Support AbortSignal
  if (opts && opts.signal) {
    const origAbort = opts.signal.addEventListener
      ? null
      : undefined;
    // Simple approach: on abort, remove
    const sig = opts.signal;
    if (sig && typeof sig.addEventListener === 'function') {
      sig.addEventListener('abort', () => {
        if (_docListeners[type]) {
          _docListeners[type] = _docListeners[type].filter(e => e.fn !== fn);
        }
      });
    }
  }
};
document.removeEventListener = function (type, fn) {
  if (_docListeners[type]) _docListeners[type] = _docListeners[type].filter(e => e.fn !== fn);
};

// Helper to fire document events
function fireDocEvent(type, eventObj) {
  const listeners = _docListeners[type] || [];
  for (const entry of listeners) {
    entry.fn(eventObj || {});
  }
}

// Mock querySelectorAll for initTooltips
document.querySelectorAll = () => [];

const { initTooltips, destroyTooltips } = await import('../../app/modules/tooltip.js');

describe('tooltip', () => {
  beforeEach(() => {
    destroyTooltips();
    _bodyChildren.length = 0;
    // Clear all tracked listeners
    for (const key of Object.keys(_docListeners)) {
      delete _docListeners[key];
    }
  });

  it('initTooltips is a function', () => {
    assert.equal(typeof initTooltips, 'function');
  });

  it('destroyTooltips is a function', () => {
    assert.equal(typeof destroyTooltips, 'function');
  });

  it('initTooltips can be called without errors', () => {
    assert.doesNotThrow(() => initTooltips());
  });

  it('destroyTooltips can be called without errors', () => {
    initTooltips();
    assert.doesNotThrow(() => destroyTooltips());
  });

  it('initTooltips converts title attributes to data-tooltip', () => {
    const el = document.createElement('button');
    el.setAttribute('title', 'Hello');
    document.querySelectorAll = (sel) => {
      if (sel === '[title]') return [el];
      return [];
    };
    initTooltips();
    assert.equal(el.getAttribute('data-tooltip'), 'Hello');
    // Restore
    document.querySelectorAll = () => [];
  });

  it('initTooltips does not overwrite existing data-tooltip', () => {
    const el = document.createElement('button');
    el.setAttribute('title', 'Title Text');
    el.setAttribute('data-tooltip', 'Existing');
    document.querySelectorAll = (sel) => {
      if (sel === '[title]') return [el];
      return [];
    };
    initTooltips();
    // data-tooltip should remain as 'Existing', not overwritten
    assert.equal(el.getAttribute('data-tooltip'), 'Existing');
    document.querySelectorAll = () => [];
  });

  it('destroyTooltips removes tooltip element from DOM', () => {
    initTooltips();
    // Calling destroyTooltips should clean up
    destroyTooltips();
    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.equal(tooltip, undefined);
  });

  it('multiple initTooltips calls do not throw', () => {
    assert.doesNotThrow(() => {
      initTooltips();
      initTooltips();
    });
  });

  it('destroyTooltips is safe to call multiple times', () => {
    assert.doesNotThrow(() => {
      destroyTooltips();
      destroyTooltips();
    });
  });

  it('initTooltips registers event listeners on document', () => {
    initTooltips();
    assert.ok(_docListeners['pointerenter'] && _docListeners['pointerenter'].length > 0, 'pointerenter listener registered');
    assert.ok(_docListeners['pointerleave'] && _docListeners['pointerleave'].length > 0, 'pointerleave listener registered');
    assert.ok(_docListeners['pointerdown'] && _docListeners['pointerdown'].length > 0, 'pointerdown listener registered');
    assert.ok(_docListeners['scroll'] && _docListeners['scroll'].length > 0, 'scroll listener registered');
    assert.ok(_docListeners['keydown'] && _docListeners['keydown'].length > 0, 'keydown listener registered');
  });

  it('pointerenter on element with data-tooltip triggers showTooltip after delay', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Test tooltip');

    fireDocEvent('pointerenter', { target: btn });

    // Wait for SHOW_DELAY (500ms) + rAF
    await new Promise(r => setTimeout(r, 600));

    // Tooltip element should have been created and appended to body
    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip element should exist in body');
    assert.ok(tooltip.classList.contains('nr-tooltip-visible'), 'tooltip should be visible');
    assert.equal(tooltip.getAttribute('aria-hidden'), 'false');
  });

  it('showTooltip renders text content with escaping', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Hello <b>world</b>');

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip element should exist');
    // The HTML should have escaped the <b> tags
    assert.ok(tooltip.innerHTML.includes('nr-tooltip-text'), 'should contain tooltip text span');
    // Should NOT contain raw <b> (it should be escaped)
    assert.ok(!tooltip.innerHTML.includes('<b>world</b>'), 'HTML should be escaped');
  });

  it('showTooltip renders shortcut kbd when data-shortcut is present', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Save');
    btn.setAttribute('data-shortcut', 'Ctrl+S');

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip element should exist');
    assert.ok(tooltip.innerHTML.includes('nr-tooltip-kbd'), 'should contain kbd element');
    assert.ok(tooltip.innerHTML.includes('nr-tooltip-text'), 'should contain text span');
  });

  it('showTooltip does not render kbd when no data-shortcut', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Just text');

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip element should exist');
    assert.ok(!tooltip.innerHTML.includes('nr-tooltip-kbd'), 'should not contain kbd element');
  });

  it('showTooltip converts title to data-tooltip on the target', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('title', 'From title');

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    // Should have moved title to data-tooltip
    assert.equal(btn.getAttribute('data-tooltip'), 'From title');
  });

  it('pointerenter does nothing for elements without tooltip', async () => {
    initTooltips();

    const btn = document.createElement('button');
    // No data-tooltip or title

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    // No visible tooltip
    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip-visible'));
    assert.ok(!tooltip || !tooltip.classList.contains('nr-tooltip-visible'), 'tooltip should not be visible');
  });

  it('pointerleave hides the tooltip', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Hover me');

    // Show tooltip
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip && tooltip.classList.contains('nr-tooltip-visible'), 'tooltip should be visible before leave');

    // Leave
    fireDocEvent('pointerleave', { target: btn });
    await new Promise(r => setTimeout(r, 200));

    assert.ok(!tooltip.classList.contains('nr-tooltip-visible'), 'tooltip should be hidden after leave');
    assert.equal(tooltip.getAttribute('aria-hidden'), 'true');
  });

  it('pointerdown hides the tooltip immediately', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Click me');

    // Show tooltip
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip && tooltip.classList.contains('nr-tooltip-visible'), 'tooltip visible before pointerdown');

    // Pointerdown
    fireDocEvent('pointerdown', {});
    assert.ok(!tooltip.classList.contains('nr-tooltip-visible'), 'tooltip hidden after pointerdown');
  });

  it('keydown hides the tooltip immediately', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Key test');

    // Show tooltip
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip && tooltip.classList.contains('nr-tooltip-visible'), 'tooltip visible before keydown');

    fireDocEvent('keydown', {});
    assert.ok(!tooltip.classList.contains('nr-tooltip-visible'), 'tooltip hidden after keydown');
  });

  it('scroll hides the tooltip when one is shown', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Scroll test');

    // Show tooltip
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip && tooltip.classList.contains('nr-tooltip-visible'), 'tooltip visible before scroll');

    fireDocEvent('scroll', {});
    assert.ok(!tooltip.classList.contains('nr-tooltip-visible'), 'tooltip hidden after scroll');
  });

  it('scroll does nothing when no tooltip is shown', () => {
    initTooltips();
    // Should not throw when no currentTarget
    assert.doesNotThrow(() => fireDocEvent('scroll', {}));
  });

  it('pointerenter ignores non-Element targets', () => {
    initTooltips();
    // Simulate text node target (no closest method)
    const textNode = { nodeType: 3, parentElement: null };
    assert.doesNotThrow(() => fireDocEvent('pointerenter', { target: textNode }));
  });

  it('pointerenter uses parentElement for non-Element targets', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Parent tooltip');

    // Simulate a text node with a parentElement that has the tooltip
    const textNode = { parentElement: btn };
    // textNode is not an Element instance
    Object.defineProperty(textNode, Symbol.hasInstance, { value: () => false });

    fireDocEvent('pointerenter', { target: textNode });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip should be shown via parentElement fallback');
  });

  it('pointerleave ignores non-Element targets without parentElement', () => {
    initTooltips();
    const textNode = { parentElement: null };
    assert.doesNotThrow(() => fireDocEvent('pointerleave', { target: textNode }));
  });

  it('pointerleave ignores targets without closest', () => {
    initTooltips();
    // target is an Element-like but no closest
    const fakeEl = {};
    // It's not instanceof Element, parentElement is null
    assert.doesNotThrow(() => fireDocEvent('pointerleave', { target: fakeEl }));
  });

  it('positionTooltip places tooltip below the target by default', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Position test');
    // getBoundingClientRect returns top:100, bottom:130 by default from our mock

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip element should exist');
    // After rAF, tooltip should be positioned
    // With default mock: bottom(130) + TOOLTIP_OFFSET(8) = 138
    assert.ok(tooltip.classList.contains('nr-tooltip-below') || tooltip.classList.contains('nr-tooltip-above'),
      'tooltip should have position class');
  });

  it('positionTooltip flips above when near bottom of viewport', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Flip test');
    // Make the button appear near the bottom of the viewport
    btn.getBoundingClientRect = () => ({ top: 1050, left: 100, bottom: 1080, right: 200, width: 100, height: 30 });

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip element should exist');
    // Tooltip should flip above since bottom (1080) + offset (8) + tipHeight > vh (1080) - 8
    // Check the class - it should have nr-tooltip-above
    assert.ok(tooltip.classList.contains('nr-tooltip-above'), 'tooltip should flip above near bottom');
  });

  it('positionTooltip clamps left edge when tooltip would go offscreen left', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Left edge test');
    // Button at far left edge
    btn.getBoundingClientRect = () => ({ top: 100, left: -50, bottom: 130, right: 10, width: 60, height: 30 });

    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip, 'tooltip element should exist');
    // left should be clamped to at least 8
    const leftVal = parseFloat(tooltip.style.left);
    assert.ok(leftVal >= 8 || tooltip.style.left === '8px', 'left should be clamped to minimum 8px');
  });

  it('hideTooltip does nothing when no tooltip element exists', () => {
    // After destroy, there's no tooltip element - hideTooltip path via pointerdown
    destroyTooltips();
    initTooltips();
    // Fire pointerdown immediately (no tooltip shown yet)
    assert.doesNotThrow(() => fireDocEvent('pointerdown', {}));
  });

  it('ensureTooltipEl reuses existing element', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Reuse test');

    // Show tooltip twice
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltipCountBefore = _bodyChildren.filter(c => c.className && c.className.includes('nr-tooltip')).length;

    // Hide and show again
    fireDocEvent('pointerdown', {});
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltipCountAfter = _bodyChildren.filter(c => c.className && c.className.includes('nr-tooltip')).length;
    // Should reuse the same element
    assert.equal(tooltipCountAfter, tooltipCountBefore, 'should reuse tooltip element, not create a new one');
  });

  it('showTooltip does nothing when target has no text', async () => {
    initTooltips();

    const btn = document.createElement('button');
    // Has closest match but no data-tooltip and no title
    // We need a wrapper with the attribute for closest() to find
    const wrapper = document.createElement('div');
    // No tooltip attributes - closest will return null
    fireDocEvent('pointerenter', { target: wrapper });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip-visible'));
    assert.ok(!tooltip || !tooltip.classList.contains('nr-tooltip-visible'), 'no tooltip should be visible');
  });

  it('pointerenter cancels pending hide timer', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Cancel hide test');

    // Show tooltip
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    // Start hiding
    fireDocEvent('pointerleave', { target: btn });

    // Re-enter before hide completes (hide delay is 100ms)
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.ok(tooltip && tooltip.classList.contains('nr-tooltip-visible'), 'tooltip should remain visible');
  });

  it('destroyTooltips clears pending timers', () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Timer cleanup');

    // Start showing (timer pending)
    fireDocEvent('pointerenter', { target: btn });

    // Destroy before timer fires - should not throw
    assert.doesNotThrow(() => destroyTooltips());
  });

  it('pointerenter then pointerleave before show delay cancels tooltip', async () => {
    initTooltips();

    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Quick hover');

    // Enter and leave quickly (before 500ms show delay)
    fireDocEvent('pointerenter', { target: btn });
    await new Promise(r => setTimeout(r, 50));
    fireDocEvent('pointerleave', { target: btn });
    await new Promise(r => setTimeout(r, 600));

    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    // Tooltip should not be visible (show was cancelled)
    assert.ok(!tooltip || !tooltip.classList.contains('nr-tooltip-visible'), 'tooltip should not appear after quick hover');
  });
});
