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

  // Cache for mock children keyed by selector — ensures the same element is returned
  // for each querySelector call, so event listeners are preserved
  const _mockCache = new Map();

  // Enhanced querySelector: if no children match but innerHTML contains the class, create a mock
  const origQS = el.querySelector.bind(el);
  el.querySelector = function (selector) {
    const result = origQS(selector);
    if (result) return result;

    // Return cached mock to preserve registered event listeners
    if (_mockCache.has(selector)) return _mockCache.get(selector);

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
      _mockCache.set(selector, mockChild);
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

describe('floating-search — search callback and navigation', () => {
  it('onSearch callback is called when input has text (via caseOpt change)', () => {
    const searchCalls = [];
    const { panel, state } = createFloatingSearch({
      onSearch: (q, opts) => {
        searchCalls.push({ q, opts });
        return { total: 5 };
      },
    });
    const searchInput = panel.querySelector('.search-input');
    const caseOpt = panel.querySelector('.opt-case');
    searchInput.value = 'hello';
    caseOpt.dispatchEvent(new Event('change'));
    assert.ok(searchCalls.length >= 1, 'onSearch should have been called');
    assert.equal(state.totalMatches, 5);
    assert.equal(state.currentMatch, 0);
  });

  it('onSearch with no result leaves state unchanged', () => {
    const { panel, state } = createFloatingSearch({ onSearch: () => null });
    const searchInput = panel.querySelector('.search-input');
    const caseOpt = panel.querySelector('.opt-case');
    searchInput.value = 'test';
    caseOpt.dispatchEvent(new Event('change'));
    // result is null → state not updated by callback path
    assert.equal(state.totalMatches, 0);
  });

  it('input event triggers debounce (lines 170-171 executed)', () => {
    const { panel } = createFloatingSearch();
    const searchInput = panel.querySelector('.search-input');
    searchInput.value = 'test';
    // Firing input event executes the debounce setup (clearSafeTimeout + safeTimeout)
    assert.doesNotThrow(() => searchInput.dispatchEvent(new Event('input')));
  });

  it('nextBtn click navigates to next match', () => {
    const navigateCalls = [];
    const { panel, state } = createFloatingSearch({
      onSearch: () => ({ total: 3 }),
      onNavigate: (dir, idx) => navigateCalls.push({ dir, idx }),
    });
    const searchInput = panel.querySelector('.search-input');
    const caseOpt = panel.querySelector('.opt-case');
    const nextBtn = panel.querySelector('.search-next');

    searchInput.value = 'test';
    caseOpt.dispatchEvent(new Event('change')); // sets totalMatches=3, currentMatch=0
    nextBtn.dispatchEvent(new Event('click'));

    assert.ok(navigateCalls.length >= 1, 'onNavigate should be called');
    assert.equal(navigateCalls[0].dir, 'next');
    assert.equal(state.currentMatch, 1);
  });

  it('prevBtn click navigates to previous match', () => {
    const navigateCalls = [];
    const { panel, state } = createFloatingSearch({
      onSearch: () => ({ total: 3 }),
      onNavigate: (dir) => navigateCalls.push(dir),
    });
    const searchInput = panel.querySelector('.search-input');
    const caseOpt = panel.querySelector('.opt-case');
    const prevBtn = panel.querySelector('.search-prev');

    searchInput.value = 'test';
    caseOpt.dispatchEvent(new Event('change')); // sets totalMatches=3, currentMatch=0

    prevBtn.dispatchEvent(new Event('click'));
    assert.ok(navigateCalls.includes('prev'));
    // (0 - 1 + 3) % 3 = 2
    assert.equal(state.currentMatch, 2);
  });

  it('navigate does nothing when totalMatches is 0', () => {
    const { panel, state } = createFloatingSearch();
    const nextBtn = panel.querySelector('.search-next');
    nextBtn.dispatchEvent(new Event('click'));
    assert.equal(state.currentMatch, -1); // unchanged
  });

  it('Enter key on searchInput triggers navigate next', () => {
    const navigateCalls = [];
    const { panel, state } = createFloatingSearch({
      onSearch: () => ({ total: 4 }),
      onNavigate: (dir) => navigateCalls.push(dir),
    });
    const searchInput = panel.querySelector('.search-input');
    const caseOpt = panel.querySelector('.opt-case');
    searchInput.value = 'word';
    caseOpt.dispatchEvent(new Event('change')); // totalMatches=4

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Enter' });
    Object.defineProperty(e, 'shiftKey', { value: false });
    e.preventDefault = () => {};
    searchInput.dispatchEvent(e);

    assert.ok(navigateCalls.includes('next'));
  });

  it('Shift+Enter key on searchInput triggers navigate prev', () => {
    const navigateCalls = [];
    const { panel } = createFloatingSearch({
      onSearch: () => ({ total: 4 }),
      onNavigate: (dir) => navigateCalls.push(dir),
    });
    const searchInput = panel.querySelector('.search-input');
    const caseOpt = panel.querySelector('.opt-case');
    searchInput.value = 'word';
    caseOpt.dispatchEvent(new Event('change'));

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Enter' });
    Object.defineProperty(e, 'shiftKey', { value: true });
    e.preventDefault = () => {};
    searchInput.dispatchEvent(e);

    assert.ok(navigateCalls.includes('prev'));
  });

  it('Escape key on searchInput hides the panel', () => {
    const { panel, show, state } = createFloatingSearch();
    show();
    assert.equal(state.visible, true);

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Escape' });
    searchInput_get(panel).dispatchEvent(e);

    assert.equal(state.visible, false);
  });
});

function searchInput_get(panel) {
  return panel.querySelector('.search-input');
}

describe('floating-search — replace functionality', () => {
  it('onReplace callback is called with correct text when replaceOneBtn is clicked', async () => {
    const { createFloatingSearch } = await import('../../app/modules/floating-search.js');
    const calls = [];
    const { panel } = createFloatingSearch({
      onReplace: (text, match) => calls.push({ text, match }),
    });

    const replaceInput = panel.querySelector('.replace-input');
    const replaceOneBtn = panel.querySelector('.replace-one');
    assert.ok(replaceInput, 'replace-input element should exist');
    assert.ok(replaceOneBtn, 'replace-one button should exist');
    replaceInput.value = 'new text';
    replaceOneBtn.dispatchEvent(new Event('click'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, 'new text');
  });

  it('onReplaceAll callback is called with correct text when replaceAllBtn is clicked', async () => {
    const { createFloatingSearch } = await import('../../app/modules/floating-search.js');
    const calls = [];
    const { panel } = createFloatingSearch({
      onReplaceAll: (text) => calls.push(text),
    });

    const replaceInput = panel.querySelector('.replace-input');
    const replaceAllBtn = panel.querySelector('.replace-all');
    assert.ok(replaceInput, 'replace-input element should exist');
    assert.ok(replaceAllBtn, 'replace-all button should exist');
    replaceInput.value = 'replacement';
    replaceAllBtn.dispatchEvent(new Event('click'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'replacement');
  });

  it('toggleReplace button toggles replace row visibility', async () => {
    const { createFloatingSearch } = await import('../../app/modules/floating-search.js');
    const { panel } = createFloatingSearch();

    const toggleBtn = panel.querySelector('.search-toggle-replace');
    const replaceRow = panel.querySelector('.search-replace-row');
    assert.ok(toggleBtn, 'toggle button should exist');
    assert.ok(replaceRow, 'replace row should exist');

    // The HTML initializes the row with style="display:none"
    // Since the mock doesn't parse inline styles, replaceRow.style.display may not be 'none'
    // We set it explicitly to simulate the initial state, then test toggle behavior
    replaceRow.style.display = 'none';

    // Click to show (isHidden = true → set to flex)
    toggleBtn.dispatchEvent(new Event('click'));
    assert.equal(replaceRow.style.display, 'flex');
    // Click again to hide
    toggleBtn.dispatchEvent(new Event('click'));
    assert.equal(replaceRow.style.display, 'none');
  });

  it('Escape key on panel calls hide', async () => {
    const { createFloatingSearch } = await import('../../app/modules/floating-search.js');
    const { panel, show, state } = createFloatingSearch();
    show();
    assert.equal(state.visible, true);
    panel.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape', stopPropagation: () => {} }));
    assert.equal(state.visible, false);
  });
});
