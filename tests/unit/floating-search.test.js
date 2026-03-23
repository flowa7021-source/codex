import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// We need querySelector to work after innerHTML is set.
// The mock doesn't parse HTML, so we override createElement to make
// panel.querySelector return mock elements created on demand from innerHTML.
const _origCreate = document.createElement;

function createEnhancedElement(tag) {
  const el = _origCreate(tag);
  el.focus = el.focus || (() => {});
  el.select = el.select || (() => {});
  el.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });

  // Enhanced querySelector: if no children match but innerHTML contains the class, create a mock
  const origQS = el.querySelector.bind(el);
  el.querySelector = function (selector) {
    const result = origQS(selector);
    if (result) return result;

    // Fallback: check innerHTML for the class name and return a mock element
    const html = el.innerHTML || '';
    // Extract class from selector like '.search-input'
    const classMatch = selector.match(/^\.([a-zA-Z0-9_-]+)$/);
    if (classMatch && html.includes(classMatch[1])) {
      const mockChild = createEnhancedElement('div');
      mockChild.className = classMatch[1];
      // Determine if it's an input
      if (html.includes(`class="${classMatch[1]}"`) || html.includes(`class="` + classMatch[1] + `"`)) {
        if (html.includes('type="text"') && html.includes(classMatch[1])) {
          mockChild.value = '';
          mockChild.checked = false;
        }
        if (html.includes('type="checkbox"') && html.includes(classMatch[1])) {
          mockChild.checked = false;
        }
      }
      return mockChild;
    }
    return null;
  };

  return el;
}

document.createElement = createEnhancedElement;

// Provide body.contains
document.body.contains = () => true;

const { createFloatingSearch, initFloatingSearch } = await import('../../app/modules/floating-search.js');

describe('floating-search', () => {
  it('createFloatingSearch returns an object with panel, state, show, hide, updateResults', () => {
    const result = createFloatingSearch();
    assert.ok(result.panel);
    assert.ok(result.state);
    assert.equal(typeof result.show, 'function');
    assert.equal(typeof result.hide, 'function');
    assert.equal(typeof result.updateResults, 'function');
  });

  it('state has correct initial values', () => {
    const { state } = createFloatingSearch();
    assert.equal(state.query, '');
    assert.equal(state.caseSensitive, false);
    assert.equal(state.wholeWord, false);
    assert.equal(state.regex, false);
    assert.equal(state.currentMatch, -1);
    assert.equal(state.totalMatches, 0);
    assert.equal(state.visible, false);
  });

  it('show sets visible to true', () => {
    const { show, state } = createFloatingSearch();
    show();
    assert.equal(state.visible, true);
  });

  it('hide sets visible to false', () => {
    const { show, hide, state } = createFloatingSearch();
    show();
    hide();
    assert.equal(state.visible, false);
  });

  it('show adds visible class to panel', () => {
    const { panel, show } = createFloatingSearch();
    show();
    assert.ok(panel.classList.contains('visible'));
  });

  it('hide removes visible class from panel', () => {
    const { panel, show, hide } = createFloatingSearch();
    show();
    hide();
    assert.ok(!panel.classList.contains('visible'));
  });

  it('updateResults updates state counts', () => {
    const { state, updateResults } = createFloatingSearch();
    updateResults(3, 10);
    assert.equal(state.currentMatch, 3);
    assert.equal(state.totalMatches, 10);
  });

  it('panel has role=search', () => {
    const { panel } = createFloatingSearch();
    assert.equal(panel.getAttribute('role'), 'search');
  });

  it('panel has aria-label', () => {
    const { panel } = createFloatingSearch();
    assert.equal(panel.getAttribute('aria-label'), 'Find in document');
  });

  it('hide calls onClose callback', () => {
    const onClose = mock.fn();
    const { show, hide } = createFloatingSearch({ onClose });
    show();
    hide();
    assert.equal(onClose.mock.callCount(), 1);
  });

  it('initFloatingSearch appends panel to container', () => {
    const container = createEnhancedElement('div');
    const result = initFloatingSearch(container);
    assert.ok(result.panel);
    assert.ok(container.children.length > 0);
  });

  it('initFloatingSearch returns toggle function', () => {
    const container = createEnhancedElement('div');
    const result = initFloatingSearch(container);
    assert.equal(typeof result.toggle, 'function');
  });

  it('toggle shows and hides', () => {
    const container = createEnhancedElement('div');
    const result = initFloatingSearch(container);
    result.toggle(); // show
    assert.equal(result.state.visible, true);
    result.toggle(); // hide
    assert.equal(result.state.visible, false);
  });
});
