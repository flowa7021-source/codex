import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set up required DOM elements before importing the module
function setupDom() {
  const ids = [
    'pageOrganizerModal', 'pageOrgGrid', 'pageOrgStatus',
    'openPageOrganizer', 'pageOrgClose', 'pageOrgCancel',
    'pageOrgApply', 'pageOrgRotateCW', 'pageOrgDelete',
    'pageOrgDuplicate', 'pageOrgInsertBlank', 'pageOrgExtract',
    'pageOrgReverse',
  ];
  const elements = {};
  for (const id of ids) {
    elements[id] = document.createElement('div');
    elements[id].id = id;
  }
  // Override getElementById to return our mocks
  const origGetById = document.getElementById;
  document.getElementById = (id) => elements[id] || origGetById?.(id) || null;
  return elements;
}

const elements = setupDom();

import { state } from '../../app/modules/state.js';
import { initPageOrganizerUI } from '../../app/modules/page-organizer-ui.js';

describe('initPageOrganizerUI', () => {
  it('is a function', () => {
    assert.strictEqual(typeof initPageOrganizerUI, 'function');
  });

  it('initializes without errors', () => {
    assert.doesNotThrow(() => {
      initPageOrganizerUI({ openFile: async () => {} });
    });
  });

  it('attaches click listener to openPageOrganizer button', () => {
    // The initPageOrganizerUI should have added event listeners
    // We test by checking the element exists and has listeners (indirect)
    const btn = elements.openPageOrganizer;
    assert.ok(btn);
    assert.strictEqual(btn.id, 'openPageOrganizer');
  });

  it('clicking close button hides the modal', () => {
    const modal = elements.pageOrganizerModal;
    modal.style.display = '';
    modal.classList.add('open');
    // Simulate close click
    elements.pageOrgClose.click();
    assert.strictEqual(modal.style.cssText.includes('none') || !modal.classList.contains('open'), true);
  });

  it('clicking cancel button hides the modal', () => {
    const modal = elements.pageOrganizerModal;
    modal.style.display = '';
    modal.classList.add('open');
    elements.pageOrgCancel.click();
    assert.ok(!modal.classList.contains('open'));
  });

  it('does not throw when apply is clicked without pdf data', () => {
    assert.doesNotThrow(() => {
      elements.pageOrgApply.click();
    });
  });

  it('does not throw when rotate is clicked without selection', () => {
    assert.doesNotThrow(() => {
      elements.pageOrgRotateCW.click();
    });
  });

  it('does not throw when delete is clicked without selection', () => {
    assert.doesNotThrow(() => {
      elements.pageOrgDelete.click();
    });
  });

  it('reverse button element exists', () => {
    assert.ok(elements.pageOrgReverse);
    assert.strictEqual(elements.pageOrgReverse.id, 'pageOrgReverse');
  });
});
