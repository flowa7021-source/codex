// ─── Unit Tests: Overlay Manager ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  showOverlay,
  hideOverlay,
  hideAllOverlays,
  isOverlayOpen,
  getOpenOverlays,
} from '../../app/modules/overlay-manager.js';

// ─── Cleanup helper ──────────────────────────────────────────────────────────

beforeEach(() => {
  hideAllOverlays();
});

// ─── isOverlayOpen ────────────────────────────────────────────────────────────

describe('isOverlayOpen', () => {
  it('returns false initially for any ID', () => {
    assert.equal(isOverlayOpen('test-overlay'), false);
  });

  it('returns false for an unknown ID even after other overlays are open', () => {
    showOverlay({ id: 'known', content: 'hello' });
    assert.equal(isOverlayOpen('unknown-id'), false);
  });
});

// ─── showOverlay ──────────────────────────────────────────────────────────────

describe('showOverlay', () => {
  it('returns a function', () => {
    const hide = showOverlay({ id: 'overlay-1', content: 'content' });
    assert.equal(typeof hide, 'function');
  });

  it('makes isOverlayOpen() return true for the ID', () => {
    showOverlay({ id: 'overlay-2', content: 'hello' });
    assert.equal(isOverlayOpen('overlay-2'), true);
  });

  it('the returned hide function closes the overlay', () => {
    const hide = showOverlay({ id: 'overlay-3', content: 'hello' });
    hide();
    assert.equal(isOverlayOpen('overlay-3'), false);
  });

  it('appends an element to document.body', () => {
    const childCountBefore = document.body.children.length;
    showOverlay({ id: 'overlay-body', content: 'appended' });
    assert.equal(document.body.children.length, childCountBefore + 1);
  });

  it('sets className on the overlay element when provided', () => {
    showOverlay({ id: 'overlay-cls', content: 'styled', className: 'my-tooltip' });
    const children = document.body.children;
    const last = children[children.length - 1];
    assert.ok(last.className === 'my-tooltip' || last.classList.contains('my-tooltip'));
  });

  it('replaces existing overlay with the same ID', () => {
    showOverlay({ id: 'overlay-dup', content: 'first' });
    showOverlay({ id: 'overlay-dup', content: 'second' });
    assert.equal(isOverlayOpen('overlay-dup'), true);
    assert.equal(getOpenOverlays().filter(id => id === 'overlay-dup').length, 1);
  });

  it('calls onClose when the returned hide function is invoked', () => {
    let closed = false;
    const hide = showOverlay({ id: 'overlay-close-cb', content: 'x', onClose: () => { closed = true; } });
    hide();
    assert.equal(closed, true);
  });

  it('accepts an HTMLElement as content', () => {
    const el = document.createElement('span');
    el.textContent = 'element content';
    assert.doesNotThrow(() => showOverlay({ id: 'overlay-el', content: el }));
    assert.equal(isOverlayOpen('overlay-el'), true);
  });
});

// ─── hideOverlay ─────────────────────────────────────────────────────────────

describe('hideOverlay', () => {
  it('makes isOverlayOpen() return false after hiding', () => {
    showOverlay({ id: 'hide-test', content: 'visible' });
    hideOverlay('hide-test');
    assert.equal(isOverlayOpen('hide-test'), false);
  });

  it('does not throw when called with an unknown ID', () => {
    assert.doesNotThrow(() => hideOverlay('nonexistent-id'));
  });

  it('removes the overlay element from document.body', () => {
    showOverlay({ id: 'hide-body-test', content: 'to remove' });
    const countBefore = document.body.children.length;
    hideOverlay('hide-body-test');
    assert.equal(document.body.children.length, countBefore - 1);
  });
});

// ─── hideAllOverlays ─────────────────────────────────────────────────────────

describe('hideAllOverlays', () => {
  it('closes all open overlays', () => {
    showOverlay({ id: 'all-1', content: 'a' });
    showOverlay({ id: 'all-2', content: 'b' });
    showOverlay({ id: 'all-3', content: 'c' });
    hideAllOverlays();
    assert.equal(isOverlayOpen('all-1'), false);
    assert.equal(isOverlayOpen('all-2'), false);
    assert.equal(isOverlayOpen('all-3'), false);
  });

  it('getOpenOverlays() returns [] after hiding all', () => {
    showOverlay({ id: 'batch-1', content: 'x' });
    showOverlay({ id: 'batch-2', content: 'y' });
    hideAllOverlays();
    assert.deepEqual(getOpenOverlays(), []);
  });

  it('does not throw when no overlays are open', () => {
    assert.doesNotThrow(() => hideAllOverlays());
  });
});

// ─── getOpenOverlays ─────────────────────────────────────────────────────────

describe('getOpenOverlays', () => {
  it('returns an empty array when no overlays are open', () => {
    assert.deepEqual(getOpenOverlays(), []);
  });

  it('returns array of IDs of open overlays', () => {
    showOverlay({ id: 'open-a', content: '1' });
    showOverlay({ id: 'open-b', content: '2' });
    const open = getOpenOverlays();
    assert.ok(open.includes('open-a'));
    assert.ok(open.includes('open-b'));
    assert.equal(open.length, 2);
  });

  it('does not include IDs of closed overlays', () => {
    showOverlay({ id: 'was-open', content: 'x' });
    hideOverlay('was-open');
    assert.ok(!getOpenOverlays().includes('was-open'));
  });
});

// ─── showOverlay with closeOnOutsideClick ─────────────────────────────────────

describe('showOverlay with closeOnOutsideClick', () => {
  it('registers a click listener on document when closeOnOutsideClick is true', () => {
    const originalAdd = document.addEventListener;
    const registeredTypes = [];
    document.addEventListener = (type, fn) => {
      registeredTypes.push(type);
      originalAdd.call(document, type, fn);
    };
    showOverlay({ id: 'outside-click-test', content: 'popup', closeOnOutsideClick: true });
    document.addEventListener = originalAdd;
    assert.ok(registeredTypes.includes('click'));
  });

  it('hides the overlay when a click occurs outside', () => {
    showOverlay({ id: 'outside-hide', content: 'popup', closeOnOutsideClick: true });
    // Dispatch a click on an outside element
    const outsideTarget = document.createElement('div');
    outsideTarget.contains = () => false;
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: outsideTarget });
    document.dispatchEvent(event);
    assert.equal(isOverlayOpen('outside-hide'), false);
  });

  it('calls onClose when outside click hides the overlay', () => {
    let closedByOutsideClick = false;
    showOverlay({
      id: 'outside-close-cb',
      content: 'popup',
      closeOnOutsideClick: true,
      onClose: () => { closedByOutsideClick = true; },
    });
    const outsideTarget = document.createElement('div');
    outsideTarget.contains = () => false;
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: outsideTarget });
    document.dispatchEvent(event);
    assert.equal(closedByOutsideClick, true);
  });
});
