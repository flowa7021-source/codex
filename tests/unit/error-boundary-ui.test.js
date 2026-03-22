// ─── Unit Tests: ErrorBoundaryUI ─────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Enhance DOM mock for error-boundary-ui needs
const bodyChildren = [];
const removedIds = [];

const origCreateElement = document.createElement;
document.createElement = function (tag) {
  const children = [];
  let _textContent = '';
  const el = {
    tagName: tag.toUpperCase(),
    style: { cssText: '' },
    id: '',
    innerHTML: '',
    get textContent() { return _textContent; },
    set textContent(val) {
      _textContent = val;
      // Simulate browser escaping for escapeHtml() pattern: div.textContent = str; return div.innerHTML
      el.innerHTML = String(val || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _classes: new Set(),
    children,
    childNodes: children,
    parentNode: null,
    classList: {
      add(c) { el._classes.add(c); },
      remove(c) { el._classes.delete(c); },
      contains(c) { return el._classes.has(c); },
    },
    setAttribute(k, v) { el[`_attr_${k}`] = v; },
    getAttribute(k) { return el[`_attr_${k}`] ?? null; },
    addEventListener(ev, fn) {},
    removeEventListener(ev, fn) {},
    appendChild(child) {
      children.push(child);
      if (child && typeof child === 'object') child.parentNode = el;
    },
    remove() {
      if (el.id) removedIds.push(el.id);
      el.parentNode = null;
    },
  };
  return el;
};

document.getElementById = function (id) {
  for (const child of bodyChildren) {
    if (child.id === id) return child;
    if (child.children) {
      for (const gc of child.children) {
        if (gc.id === id) return gc;
      }
    }
  }
  return null;
};

document.body.prepend = function (child) {
  bodyChildren.unshift(child);
  child.parentNode = document.body;
};
document.body.appendChild = function (child) {
  bodyChildren.push(child);
  child.parentNode = document.body;
};

// Make sure document.body is truthy for the module
Object.defineProperty(document.body, 'innerHTML', {
  set(val) { document.body._innerHTML = val; },
  get() { return document.body._innerHTML || ''; },
  configurable: true,
});

import {
  showErrorFallback,
  showCriticalErrorScreen,
} from '../../app/modules/error-boundary-ui.js';

describe('showErrorFallback', () => {
  beforeEach(() => {
    bodyChildren.length = 0;
    removedIds.length = 0;
  });

  it('is a function', () => {
    assert.equal(typeof showErrorFallback, 'function');
  });

  it('does not throw with string error', () => {
    assert.doesNotThrow(() => {
      showErrorFallback('file-open', 'Something went wrong');
    });
  });

  it('does not throw with Error object', () => {
    assert.doesNotThrow(() => {
      showErrorFallback('render', new Error('Render failed'));
    });
  });

  it('does not throw with null error', () => {
    assert.doesNotThrow(() => {
      showErrorFallback('test', null);
    });
  });

  it('creates a banner element', () => {
    showErrorFallback('test-context', 'Test error');
    assert.ok(bodyChildren.length > 0);
  });

  it('sets banner id', () => {
    showErrorFallback('test-context', 'Test error');
    const banner = bodyChildren[0];
    assert.equal(banner.id, 'nr-error-banner');
  });

  it('sets role=alert on banner', () => {
    showErrorFallback('test-context', 'Test error');
    const banner = bodyChildren[0];
    assert.equal(banner._attr_role, 'alert');
  });

  it('includes context in text content', () => {
    showErrorFallback('file-open', 'File not found');
    const banner = bodyChildren[0];
    // The text is in a child span
    const textSpan = banner.children[0];
    assert.ok(textSpan.textContent.includes('file-open'));
  });

  it('includes error message in text content', () => {
    showErrorFallback('test', 'Something failed');
    const banner = bodyChildren[0];
    const textSpan = banner.children[0];
    assert.ok(textSpan.textContent.includes('Something failed'));
  });

  it('extracts message from Error object', () => {
    showErrorFallback('test', new Error('Specific error message'));
    const banner = bodyChildren[0];
    const textSpan = banner.children[0];
    assert.ok(textSpan.textContent.includes('Specific error message'));
  });

  it('handles undefined error gracefully', () => {
    assert.doesNotThrow(() => {
      showErrorFallback('test', undefined);
    });
  });

  it('creates retry and dismiss buttons', () => {
    showErrorFallback('test', 'Error');
    const banner = bodyChildren[0];
    // Second child is button container
    const btnContainer = banner.children[1];
    assert.ok(btnContainer.children.length >= 2);
  });

  it('retry button says Retry', () => {
    showErrorFallback('test', 'Error');
    const banner = bodyChildren[0];
    const btnContainer = banner.children[1];
    const retryBtn = btnContainer.children[0];
    assert.equal(retryBtn.textContent, 'Retry');
  });

  it('dismiss button says Dismiss', () => {
    showErrorFallback('test', 'Error');
    const banner = bodyChildren[0];
    const btnContainer = banner.children[1];
    const dismissBtn = btnContainer.children[1];
    assert.equal(dismissBtn.textContent, 'Dismiss');
  });

  it('removes existing banner before adding new one', () => {
    showErrorFallback('first', 'First error');
    const firstBanner = bodyChildren[0];

    // Simulate existing banner in DOM
    document.getElementById = (id) => {
      if (id === 'nr-error-banner') return firstBanner;
      return null;
    };

    showErrorFallback('second', 'Second error');
    // The first banner should have been "removed" (remove() called)
    assert.ok(removedIds.includes('nr-error-banner'));
  });
});

describe('showCriticalErrorScreen', () => {
  beforeEach(() => {
    bodyChildren.length = 0;
    document.body._innerHTML = '';
  });

  it('is a function', () => {
    assert.equal(typeof showCriticalErrorScreen, 'function');
  });

  it('does not throw with string error', () => {
    assert.doesNotThrow(() => {
      showCriticalErrorScreen('Critical failure');
    });
  });

  it('does not throw with Error object', () => {
    assert.doesNotThrow(() => {
      showCriticalErrorScreen(new Error('App crash'));
    });
  });

  it('sets body innerHTML', () => {
    showCriticalErrorScreen('Critical failure');
    assert.ok(document.body._innerHTML.length > 0);
  });

  it('includes NovaReader in output', () => {
    showCriticalErrorScreen('Test error');
    assert.ok(document.body._innerHTML.includes('NovaReader'));
  });

  it('includes error message in output', () => {
    showCriticalErrorScreen('Specific critical error');
    assert.ok(document.body._innerHTML.includes('Specific critical error'));
  });

  it('includes reload button', () => {
    showCriticalErrorScreen('Error');
    assert.ok(document.body._innerHTML.includes('Reload'));
  });

  it('includes failure message', () => {
    showCriticalErrorScreen('Error');
    assert.ok(document.body._innerHTML.includes('failed to start'));
  });

  it('handles Error object message extraction', () => {
    showCriticalErrorScreen(new Error('Module load failed'));
    assert.ok(document.body._innerHTML.includes('Module load failed'));
  });

  it('handles null error gracefully', () => {
    assert.doesNotThrow(() => {
      showCriticalErrorScreen(null);
    });
    assert.ok(document.body._innerHTML.includes('Unknown error'));
  });

  it('sets body margin to 0', () => {
    showCriticalErrorScreen('Error');
    assert.equal(document.body.style.margin, '0');
  });

  it('sets body padding to 0', () => {
    showCriticalErrorScreen('Error');
    assert.equal(document.body.style.padding, '0');
  });
});
