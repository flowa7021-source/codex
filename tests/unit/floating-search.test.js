import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Patch createElement to add missing methods
const _origCreate = document.createElement;
document.createElement = function (tag) {
  const el = _origCreate(tag);
  el.getBoundingClientRect = el.getBoundingClientRect || (() => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }));
  el.focus = el.focus || (() => {});
  el.select = el.select || (() => {});
  return el;
};

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
    const container = document.createElement('div');
    const result = initFloatingSearch(container);
    assert.ok(result.panel);
    assert.ok(container.children.length > 0);
  });

  it('initFloatingSearch returns toggle function', () => {
    const container = document.createElement('div');
    const result = initFloatingSearch(container);
    assert.equal(typeof result.toggle, 'function');
  });

  it('toggle shows and hides', () => {
    const container = document.createElement('div');
    const result = initFloatingSearch(container);
    result.toggle(); // show
    assert.equal(result.state.visible, true);
    result.toggle(); // hide
    assert.equal(result.state.visible, false);
  });
});
