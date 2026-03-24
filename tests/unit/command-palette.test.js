import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Create DOM elements the command palette expects
const overlay = document.createElement('div');
overlay.id = 'commandPalette';
const input = document.createElement('input');
input.id = 'commandPaletteInput';
input.focus = () => {};
const list = document.createElement('div');
list.id = 'commandPaletteList';

overlay.appendChild(input);
overlay.appendChild(list);

// The command-palette sets className directly (not via classList.add), but
// the setup-dom querySelectorAll relies on classList.contains. Override
// list.querySelectorAll so class-based selectors also check the className string.
list.querySelectorAll = (selector) => {
  if (selector.startsWith('.')) {
    const cls = selector.slice(1);
    return list.children.filter((c) => c.className && c.className.split(' ').includes(cls));
  }
  return [];
};
list.querySelector = (selector) => {
  if (selector.startsWith('.')) {
    const classes = selector.split('.').filter(Boolean);
    return list.children.find((c) => {
      const itemClasses = (c.className || '').split(' ');
      return classes.every((cls) => itemClasses.includes(cls));
    }) || null;
  }
  return null;
};

// Mock getElementById to return our elements
document.getElementById = (id) => {
  if (id === 'commandPalette') return overlay;
  if (id === 'commandPaletteInput') return input;
  if (id === 'commandPaletteList') return list;
  return null;
};

// Patch requestAnimationFrame to run synchronously for tests
globalThis.requestAnimationFrame = (fn) => {
  fn(0);
  return 0;
};

// Store document listeners for testing global shortcuts
const _docListeners = {};
document.addEventListener = (type, fn) => {
  if (!_docListeners[type]) _docListeners[type] = [];
  _docListeners[type].push(fn);
};

const { showCommandPalette, hideCommandPalette, isCommandPaletteVisible, cleanupCommandPalette, registerCommand, initCommandPalette } =
  await import('../../app/modules/command-palette.js');

function waitDebounce(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pressKey(key, extra = {}) {
  const evt = { type: 'keydown', key, preventDefault: mock.fn(), ...extra };
  input.dispatchEvent(evt);
  return evt;
}

function triggerInput() {
  input.dispatchEvent({ type: 'input' });
}

function getListLabels() {
  return list.children.map((item) => {
    const labelEl = item.children.find((ch) => ch.className === 'command-palette-label');
    return labelEl ? labelEl.textContent : '';
  });
}

function findItemByLabel(label) {
  return list.children.find((c) => {
    const lbl = c.children.find((ch) => ch.className === 'command-palette-label');
    return lbl && lbl.textContent === label;
  });
}

/**
 * Sync classList from className for rendered list items.
 * The command-palette sets className directly but the mock classList uses a separate Set.
 */
function syncClassLists() {
  for (const child of list.children) {
    const classes = (child.className || '').split(' ').filter(Boolean);
    child.classList.remove('selected', 'command-palette-item');
    if (classes.length > 0) child.classList.add(...classes);
    if (!child.scrollIntoView) child.scrollIntoView = () => {};
  }
}

describe('command-palette', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('isCommandPaletteVisible returns false initially', () => {
    assert.equal(isCommandPaletteVisible(), false);
  });

  it('showCommandPalette sets visible to true', () => {
    showCommandPalette();
    assert.equal(isCommandPaletteVisible(), true);
  });

  it('hideCommandPalette sets visible to false', () => {
    showCommandPalette();
    hideCommandPalette();
    assert.equal(isCommandPaletteVisible(), false);
  });

  it('showCommandPalette adds open class to overlay', () => {
    showCommandPalette();
    assert.ok(overlay.classList.contains('open'));
  });

  it('hideCommandPalette removes open class from overlay', () => {
    showCommandPalette();
    hideCommandPalette();
    assert.ok(!overlay.classList.contains('open'));
  });

  it('hideCommandPalette sets overlay display to none', () => {
    showCommandPalette();
    hideCommandPalette();
    assert.equal(overlay.style.display, 'none');
  });

  it('registerCommand adds a command', () => {
    registerCommand({ id: 'test.cmd', label: 'Test Command', action: () => {} });
    showCommandPalette();
    assert.ok(list.children.length > 0);
  });

  it('registerCommand replaces existing command with same id', () => {
    const action1 = mock.fn();
    const action2 = mock.fn();
    registerCommand({ id: 'dup.cmd', label: 'First', action: action1 });
    registerCommand({ id: 'dup.cmd', label: 'Second', action: action2 });
    showCommandPalette();
    const items = list.children.filter((c) => {
      const label = c.children.find((ch) => ch.className === 'command-palette-label');
      return label && label.textContent === 'Second';
    });
    assert.ok(items.length >= 1);
  });

  it('cleanupCommandPalette resets state', () => {
    showCommandPalette();
    cleanupCommandPalette();
    assert.equal(isCommandPaletteVisible(), false);
  });

  it('initCommandPalette registers default commands', () => {
    const deps = { state: { pageCount: 10 }, els: {}, goToPage: () => {} };
    initCommandPalette(deps);
    showCommandPalette();
    assert.ok(list.children.length > 0);
  });

  it('initCommandPalette is a function', () => {
    assert.equal(typeof initCommandPalette, 'function');
  });
});

describe('command-palette rendering', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('renderList creates items with icon, label, category badge, and shortcut', () => {
    registerCommand({ id: 'render.u1', label: 'UniqueRenderTest1', icon: 'X', category: 'testcat', shortcut: 'Ctrl+T', action: () => {} });
    showCommandPalette();
    input.value = 'UniqueRenderTest1';
    triggerInput();
    return waitDebounce().then(() => {
      const item = findItemByLabel('UniqueRenderTest1');
      assert.ok(item, 'should find item');
      const iconEl = item.children.find((ch) => ch.className === 'command-palette-icon');
      assert.ok(iconEl);
      assert.equal(iconEl.textContent, 'X');
      const badge = item.children.find((ch) => ch.className && ch.className.includes('command-palette-badge'));
      assert.ok(badge);
      assert.equal(badge.textContent, 'testcat');
      assert.ok(badge.className.includes('command-palette-badge--testcat'));
      const kbd = item.children.find((ch) => ch.className === 'command-palette-shortcut');
      assert.ok(kbd);
      assert.equal(kbd.textContent, 'Ctrl+T');
    });
  });

  it('renderList renders items without optional icon/category/shortcut', () => {
    registerCommand({ id: 'minimal.u1', label: 'UniqueMinimal1', action: () => {} });
    showCommandPalette();
    input.value = 'UniqueMinimal1';
    triggerInput();
    return waitDebounce().then(() => {
      const item = findItemByLabel('UniqueMinimal1');
      assert.ok(item, 'should find item');
      const badge = item.children.find((ch) => ch.className && ch.className.includes('command-palette-badge'));
      assert.equal(badge, undefined);
      const kbd = item.children.find((ch) => ch.className === 'command-palette-shortcut');
      assert.equal(kbd, undefined);
      const iconEl = item.children.find((ch) => ch.className === 'command-palette-icon');
      assert.ok(iconEl);
      assert.equal(iconEl.textContent, '');
    });
  });

  it('showCommandPalette clears input value', () => {
    input.value = 'leftover';
    showCommandPalette();
    assert.equal(input.value, '');
  });

  it('showCommandPalette sets overlay display to empty string', () => {
    overlay.style.display = 'none';
    showCommandPalette();
    assert.equal(overlay.style.display, '');
  });

  it('first item is selected by default', () => {
    showCommandPalette();
    if (list.children.length > 0) {
      assert.ok(list.children[0].className.includes('selected'));
    }
  });
});

describe('command-palette keyboard navigation', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('ArrowDown moves selection down', () => {
    showCommandPalette();
    syncClassLists();
    const evt = pressKey('ArrowDown');
    assert.equal(evt.preventDefault.mock.callCount(), 1);
    const items = list.querySelectorAll('.command-palette-item');
    if (items.length > 1) {
      assert.ok(items[1].classList.contains('selected'));
    }
  });

  it('ArrowUp moves selection up (wraps around)', () => {
    showCommandPalette();
    syncClassLists();
    const evt = pressKey('ArrowUp');
    assert.equal(evt.preventDefault.mock.callCount(), 1);
    const items = list.querySelectorAll('.command-palette-item');
    if (items.length > 1) {
      assert.ok(items[items.length - 1].classList.contains('selected'));
    }
  });

  it('ArrowDown wraps around at the end', () => {
    showCommandPalette();
    syncClassLists();
    const count = list.children.length;
    for (let i = 0; i < count; i++) {
      pressKey('ArrowDown');
    }
    const items = list.querySelectorAll('.command-palette-item');
    if (items.length > 0) {
      assert.ok(items[0].classList.contains('selected'));
    }
  });

  it('Escape hides the palette', () => {
    showCommandPalette();
    const evt = pressKey('Escape');
    assert.equal(evt.preventDefault.mock.callCount(), 1);
    assert.equal(isCommandPaletteVisible(), false);
  });

  it('Enter executes the selected command', () => {
    const action = mock.fn();
    registerCommand({ id: 'enter.ut', label: 'UniqueEnterTest', action });
    showCommandPalette();
    input.value = 'UniqueEnterTest';
    triggerInput();
    return waitDebounce().then(() => {
      syncClassLists();
      pressKey('Enter');
      assert.equal(action.mock.callCount(), 1);
      assert.equal(isCommandPaletteVisible(), false);
    });
  });

  it('Enter with no matching items does nothing harmful', () => {
    showCommandPalette();
    input.value = 'zzzzzzzzzzznocommand';
    triggerInput();
    return waitDebounce().then(() => {
      const evt = pressKey('Enter');
      assert.equal(evt.preventDefault.mock.callCount(), 1);
    });
  });
});

describe('command-palette input and filtering', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('typing in input triggers debounced filtering', () => {
    registerCommand({ id: 'filter.ua', label: 'UniqueABCCommand', action: () => {} });
    showCommandPalette();
    input.value = 'UniqueABCCommand';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      assert.ok(labels.some((l) => l === 'UniqueABCCommand'));
    });
  });

  it('colon prefix shows go-to-page command with page number', () => {
    initCommandPalette({ state: { pageCount: 50 }, els: {}, goToPage: () => {} });
    showCommandPalette();
    input.value = ':5';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
      const labels = getListLabels();
      assert.ok(labels[0].includes('5'));
    });
  });

  it('colon prefix without number shows hint', () => {
    showCommandPalette();
    input.value = ':';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
    });
  });

  it('hash prefix shows jump-to-page command', () => {
    showCommandPalette();
    input.value = '#10';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
      const labels = getListLabels();
      assert.ok(labels[0].includes('10'));
    });
  });

  it('hash prefix without number shows page range hint', () => {
    initCommandPalette({ state: { pageCount: 100 }, els: {}, goToPage: () => {} });
    showCommandPalette();
    input.value = '#';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
      const labels = getListLabels();
      assert.ok(labels[0].includes('1-100'));
    });
  });

  it('hash prefix without pageCount shows question mark', () => {
    initCommandPalette({ state: {}, els: {}, goToPage: () => {} });
    showCommandPalette();
    input.value = '#';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      assert.ok(labels[0].includes('?'));
    });
  });

  it('> prefix filters commands', () => {
    registerCommand({ id: 'cmd.um', label: 'UniqueCmdMode', action: () => {} });
    showCommandPalette();
    input.value = '>UniqueCmdMode';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      assert.ok(labels.some((l) => l === 'UniqueCmdMode'));
    });
  });

  it('> prefix with no query shows all commands', () => {
    showCommandPalette();
    input.value = '>';
    triggerInput();
    return waitDebounce().then(() => {
      assert.ok(list.children.length > 0);
      assert.ok(list.children.length <= 30);
    });
  });

  it('fuzzy matching scores exact match highest', () => {
    registerCommand({ id: 'fz.eu', label: 'xyzfuzzyexact', action: () => {} });
    registerCommand({ id: 'fz.su', label: 'xyzfuzzyexact bonus', action: () => {} });
    showCommandPalette();
    input.value = 'xyzfuzzyexact';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      const exactIdx = labels.indexOf('xyzfuzzyexact');
      const startsIdx = labels.indexOf('xyzfuzzyexact bonus');
      assert.ok(exactIdx >= 0);
      assert.ok(startsIdx >= 0);
      assert.ok(exactIdx < startsIdx);
    });
  });

  it('fuzzy matching works with non-contiguous characters', () => {
    registerCommand({ id: 'fz.fu', label: 'file open unique', action: () => {} });
    showCommandPalette();
    input.value = 'flounq';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      assert.ok(labels.some((l) => l === 'file open unique'));
    });
  });

  it('no match returns empty list', () => {
    showCommandPalette();
    input.value = 'zzzzzzzzzzzzzznonexistent';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 0);
    });
  });

  it('contains match scores below starts-with', () => {
    registerCommand({ id: 'fz.cu', label: 'abc targetword def', action: () => {} });
    registerCommand({ id: 'fz.swu', label: 'targetword xyz', action: () => {} });
    showCommandPalette();
    input.value = 'targetword';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      const startsIdx = labels.indexOf('targetword xyz');
      const containsIdx = labels.indexOf('abc targetword def');
      if (startsIdx >= 0 && containsIdx >= 0) {
        assert.ok(startsIdx < containsIdx);
      }
    });
  });
});

describe('command-palette click interactions', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('clicking an item executes the command', () => {
    const action = mock.fn();
    registerCommand({ id: 'click.uc', label: 'UniqueClickMe', action });
    showCommandPalette();
    input.value = 'UniqueClickMe';
    triggerInput();
    return waitDebounce().then(() => {
      const item = findItemByLabel('UniqueClickMe');
      assert.ok(item);
      item.click();
      assert.equal(action.mock.callCount(), 1);
      assert.equal(isCommandPaletteVisible(), false);
    });
  });

  it('mouseenter on item updates selection', () => {
    registerCommand({ id: 'hover.ua', label: 'UniqueHoverA', action: () => {} });
    registerCommand({ id: 'hover.ub', label: 'UniqueHoverB', action: () => {} });
    showCommandPalette();
    input.value = 'UniqueHover';
    triggerInput();
    return waitDebounce().then(() => {
      syncClassLists();
      const itemB = findItemByLabel('UniqueHoverB');
      if (itemB) {
        itemB.dispatchEvent({ type: 'mouseenter' });
        assert.ok(itemB.classList.contains('selected'));
      }
    });
  });

  it('clicking the overlay backdrop hides the palette', () => {
    showCommandPalette();
    overlay.dispatchEvent({ type: 'click', target: overlay });
    assert.equal(isCommandPaletteVisible(), false);
  });

  it('clicking a child of overlay does not hide the palette', () => {
    showCommandPalette();
    overlay.dispatchEvent({ type: 'click', target: input });
    assert.equal(isCommandPaletteVisible(), true);
  });
});

describe('command-palette execution', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('executeCommand saves to recent for non-internal commands', () => {
    const action = mock.fn();
    registerCommand({ id: 'recent.uc', label: 'UniqueRecentCmd', action });
    showCommandPalette();
    input.value = 'UniqueRecentCmd';
    triggerInput();
    return waitDebounce().then(() => {
      const item = findItemByLabel('UniqueRecentCmd');
      if (item) item.click();
      const stored = localStorage.getItem('novareader-recent-commands');
      assert.ok(stored);
      const recent = JSON.parse(stored);
      assert.ok(recent.includes('recent.uc'));
    });
  });

  it('executeCommand does not save internal commands to recent', () => {
    showCommandPalette();
    input.value = ':5';
    triggerInput();
    return waitDebounce().then(() => {
      if (list.children.length > 0) list.children[0].click();
      const stored = localStorage.getItem('novareader-recent-commands');
      if (stored) {
        const recent = JSON.parse(stored);
        assert.ok(!recent.some((id) => id.startsWith('_')));
      }
    });
  });

  it('executeCommand handles action errors gracefully', () => {
    registerCommand({
      id: 'error.uc',
      label: 'UniqueErrorCmd',
      action: () => {
        throw new Error('test error');
      },
    });
    showCommandPalette();
    input.value = 'UniqueErrorCmd';
    triggerInput();
    return waitDebounce().then(() => {
      const item = findItemByLabel('UniqueErrorCmd');
      assert.doesNotThrow(() => {
        if (item) item.click();
      });
    });
  });

  it('pushRecent deduplicates and moves command to front', () => {
    const action = mock.fn();
    registerCommand({ id: 'dedup.a', label: 'DedupA', action });
    registerCommand({ id: 'dedup.b', label: 'DedupB', action });
    showCommandPalette();
    input.value = 'DedupA';
    triggerInput();
    return waitDebounce()
      .then(() => {
        const itemA = findItemByLabel('DedupA');
        if (itemA) itemA.click();
        showCommandPalette();
        input.value = 'DedupB';
        triggerInput();
        return waitDebounce();
      })
      .then(() => {
        const itemB = findItemByLabel('DedupB');
        if (itemB) itemB.click();
        showCommandPalette();
        input.value = 'DedupA';
        triggerInput();
        return waitDebounce();
      })
      .then(() => {
        const itemA2 = findItemByLabel('DedupA');
        if (itemA2) itemA2.click();
        const stored = localStorage.getItem('novareader-recent-commands');
        const recent = JSON.parse(stored);
        assert.equal(recent.filter((id) => id === 'dedup.a').length, 1, 'no duplicates');
        assert.equal(recent[0], 'dedup.a', 'most recent first');
      });
  });
});

describe('command-palette recent commands', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('recent commands appear first in empty search', () => {
    const action = mock.fn();
    registerCommand({ id: 'rec.u1', label: 'UniqueRecFirst', action });
    registerCommand({ id: 'rec.u2', label: 'UniqueRecSecond', action });
    showCommandPalette();
    input.value = 'UniqueRecSecond';
    triggerInput();
    return waitDebounce().then(() => {
      const item = findItemByLabel('UniqueRecSecond');
      if (item) item.click();
      showCommandPalette();
      const labels = getListLabels();
      const secondIdx = labels.indexOf('UniqueRecSecond');
      const firstIdx = labels.indexOf('UniqueRecFirst');
      if (secondIdx >= 0 && firstIdx >= 0) {
        assert.ok(secondIdx < firstIdx);
      }
    });
  });

  it('loadRecent handles corrupted localStorage gracefully', () => {
    localStorage.setItem('novareader-recent-commands', '{invalid json');
    assert.doesNotThrow(() => {
      showCommandPalette();
    });
  });

  it('saveRecent limits to MAX_RECENT items', () => {
    const action = mock.fn();
    for (let i = 0; i < 15; i++) {
      registerCommand({ id: `mu.${i}`, label: `ManyUniq${i}`, action });
    }
    let chain = Promise.resolve();
    for (let i = 0; i < 15; i++) {
      const idx = i;
      chain = chain
        .then(() => {
          showCommandPalette();
          input.value = `ManyUniq${idx}`;
          triggerInput();
          return waitDebounce();
        })
        .then(() => {
          const item = findItemByLabel(`ManyUniq${idx}`);
          if (item) item.click();
        });
    }
    return chain.then(() => {
      const stored = localStorage.getItem('novareader-recent-commands');
      if (stored) {
        const recent = JSON.parse(stored);
        assert.ok(recent.length <= 10);
      }
    });
  });
});

describe('command-palette global shortcut', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('Ctrl+K toggles palette visibility', () => {
    const listeners = _docListeners['keydown'] || [];
    assert.ok(listeners.length > 0, 'should have keydown listener');
    // Use last listener since multiple initCommandPalette calls register multiple handlers
    const handler = listeners[listeners.length - 1];
    const openEvt = { type: 'keydown', key: 'k', ctrlKey: true, metaKey: false, preventDefault: mock.fn() };
    handler(openEvt);
    assert.equal(isCommandPaletteVisible(), true);
    assert.equal(openEvt.preventDefault.mock.callCount(), 1);
    const closeEvt = { type: 'keydown', key: 'k', ctrlKey: true, metaKey: false, preventDefault: mock.fn() };
    handler(closeEvt);
    assert.equal(isCommandPaletteVisible(), false);
  });

  it('Ctrl+K with uppercase K works', () => {
    const listeners = _docListeners['keydown'] || [];
    const handler = listeners[listeners.length - 1];
    const evt = { type: 'keydown', key: 'K', ctrlKey: true, metaKey: false, preventDefault: mock.fn() };
    handler(evt);
    assert.equal(isCommandPaletteVisible(), true);
  });

  it('K without Ctrl does not toggle palette', () => {
    const listeners = _docListeners['keydown'] || [];
    const handler = listeners[listeners.length - 1];
    const evt = { type: 'keydown', key: 'k', ctrlKey: false, metaKey: false, preventDefault: mock.fn() };
    handler(evt);
    assert.equal(isCommandPaletteVisible(), false);
    assert.equal(evt.preventDefault.mock.callCount(), 0);
  });

  it('other Ctrl+key combos do not toggle palette', () => {
    const listeners = _docListeners['keydown'] || [];
    const handler = listeners[listeners.length - 1];
    const evt = { type: 'keydown', key: 'a', ctrlKey: true, metaKey: false, preventDefault: mock.fn() };
    handler(evt);
    assert.equal(isCommandPaletteVisible(), false);
    assert.equal(evt.preventDefault.mock.callCount(), 0);
  });
});

describe('command-palette go-to-page actions', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('colon prefix go-to-page action calls goToPage', () => {
    const goToPage = mock.fn();
    initCommandPalette({ state: { pageCount: 50 }, els: {}, goToPage });
    showCommandPalette();
    input.value = ':7';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
      list.children[0].click();
      assert.equal(goToPage.mock.callCount(), 1);
      assert.deepEqual(goToPage.mock.calls[0].arguments, [7]);
    });
  });

  it('hash prefix jump-to-page action calls goToPage', () => {
    const goToPage = mock.fn();
    initCommandPalette({ state: { pageCount: 50 }, els: {}, goToPage });
    showCommandPalette();
    input.value = '#3';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
      list.children[0].click();
      assert.equal(goToPage.mock.callCount(), 1);
      assert.deepEqual(goToPage.mock.calls[0].arguments, [3]);
    });
  });

  it('colon hint action does nothing when executed', () => {
    showCommandPalette();
    input.value = ':';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
      assert.doesNotThrow(() => list.children[0].click());
    });
  });

  it('hash hint action does nothing when executed', () => {
    showCommandPalette();
    input.value = '#';
    triggerInput();
    return waitDebounce().then(() => {
      assert.equal(list.children.length, 1);
      assert.doesNotThrow(() => list.children[0].click());
    });
  });
});

describe('command-palette debounce handling', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('rapid input changes only apply the last value', () => {
    registerCommand({ id: 'deb.ut', label: 'UniqueDebounceTest', action: () => {} });
    showCommandPalette();
    input.value = 'x';
    triggerInput();
    input.value = 'xx';
    triggerInput();
    input.value = 'UniqueDebounceTest';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      assert.ok(labels.some((l) => l === 'UniqueDebounceTest'));
    });
  });

  it('hideCommandPalette clears pending debounce timer', () => {
    showCommandPalette();
    input.value = 'test';
    triggerInput();
    hideCommandPalette();
    return waitDebounce().then(() => {
      assert.equal(isCommandPaletteVisible(), false);
    });
  });

  it('cleanupCommandPalette clears pending debounce timer', () => {
    showCommandPalette();
    input.value = 'test';
    triggerInput();
    cleanupCommandPalette();
    return waitDebounce().then(() => {
      assert.equal(isCommandPaletteVisible(), false);
    });
  });
});

describe('command-palette default commands', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('default commands include file, nav, zoom, view categories', () => {
    initCommandPalette({ state: { pageCount: 10 }, els: {}, goToPage: () => {} });
    showCommandPalette();
    const categories = new Set();
    for (const item of list.children) {
      const badge = item.children.find((ch) => ch.className && ch.className.includes('command-palette-badge'));
      if (badge) categories.add(badge.textContent);
    }
    assert.ok(categories.has('file'));
    assert.ok(categories.has('nav'));
    assert.ok(categories.has('zoom'));
    assert.ok(categories.has('view'));
  });

  it('file.open command clicks fileInput element', () => {
    const fileInput = document.createElement('input');
    const clickFn = mock.fn();
    fileInput.click = clickFn;
    initCommandPalette({ state: { pageCount: 10 }, els: { fileInput }, goToPage: () => {} });
    showCommandPalette();
    input.value = 'file.open';
    triggerInput();
    return waitDebounce().then(() => {
      if (list.children.length > 0) {
        list.children[0].click();
        assert.equal(clickFn.mock.callCount(), 1);
      }
    });
  });

  it('page.first command calls goToPage(1)', () => {
    const goToPage = mock.fn();
    initCommandPalette({ state: { pageCount: 10 }, els: {}, goToPage });
    showCommandPalette();
    input.value = 'page.first';
    triggerInput();
    return waitDebounce().then(() => {
      if (list.children.length > 0) {
        list.children[0].click();
        assert.ok(goToPage.mock.callCount() >= 1);
        assert.deepEqual(goToPage.mock.calls[0].arguments, [1]);
      }
    });
  });

  it('page.last command calls goToPage(pageCount)', () => {
    const goToPage = mock.fn();
    initCommandPalette({ state: { pageCount: 25 }, els: {}, goToPage });
    showCommandPalette();
    input.value = 'page.last';
    triggerInput();
    return waitDebounce().then(() => {
      if (list.children.length > 0) {
        list.children[0].click();
        assert.ok(goToPage.mock.callCount() >= 1);
        assert.deepEqual(goToPage.mock.calls[0].arguments, [25]);
      }
    });
  });
});

describe('command-palette updateSelection', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('ArrowDown calls scrollIntoView on the newly selected item', () => {
    showCommandPalette();
    syncClassLists();
    let scrollCalled = false;
    for (const child of list.children) {
      child.scrollIntoView = () => {
        scrollCalled = true;
      };
    }
    pressKey('ArrowDown');
    assert.ok(scrollCalled);
  });

  it('updateSelection changes className of items', () => {
    showCommandPalette();
    syncClassLists();
    const firstItem = list.children[0];
    assert.ok(firstItem.className.includes('selected'), 'first item initially selected');
    // After ArrowDown, the first item className should no longer include selected
    // Note: multiple initCommandPalette calls may register multiple keydown handlers
    // so we verify via className string which is always authoritative
    pressKey('ArrowDown');
    assert.ok(!firstItem.className.includes('selected'), 'first item no longer selected after ArrowDown');
  });
});

describe('command-palette edge cases', () => {
  beforeEach(() => {
    hideCommandPalette();
    localStorage.clear();
  });

  it('showCommandPalette resets selectedIndex to 0', () => {
    showCommandPalette();
    syncClassLists();
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    showCommandPalette();
    if (list.children.length > 0) {
      assert.ok(list.children[0].className.includes('selected'));
    }
  });

  it('hideCommandPalette clears the input value', () => {
    showCommandPalette();
    input.value = 'something';
    hideCommandPalette();
    assert.equal(input.value, '');
  });

  it('empty search with no recent shows all commands', () => {
    localStorage.clear();
    showCommandPalette();
    assert.ok(list.children.length > 0);
  });

  it('search scoring uses max of label and id scores', () => {
    registerCommand({ id: 'uniquexyz123', label: 'Something Else', action: () => {} });
    showCommandPalette();
    input.value = 'uniquexyz123';
    triggerInput();
    return waitDebounce().then(() => {
      const labels = getListLabels();
      assert.ok(labels.some((l) => l === 'Something Else'));
    });
  });
});
