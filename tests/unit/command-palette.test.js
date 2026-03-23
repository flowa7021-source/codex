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

// Mock getElementById to return our elements
document.getElementById = (id) => {
  if (id === 'commandPalette') return overlay;
  if (id === 'commandPaletteInput') return input;
  if (id === 'commandPaletteList') return list;
  return null;
};

// Patch requestAnimationFrame to run synchronously for tests
globalThis.requestAnimationFrame = (fn) => { fn(0); return 0; };

const {
  showCommandPalette,
  hideCommandPalette,
  isCommandPaletteVisible,
  cleanupCommandPalette,
  registerCommand,
  initCommandPalette,
} = await import('../../app/modules/command-palette.js');

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
    // Verify by showing palette and checking list has items
    showCommandPalette();
    assert.ok(list.children.length > 0);
  });

  it('registerCommand replaces existing command with same id', () => {
    const action1 = mock.fn();
    const action2 = mock.fn();
    registerCommand({ id: 'dup.cmd', label: 'First', action: action1 });
    registerCommand({ id: 'dup.cmd', label: 'Second', action: action2 });
    // Should not have duplicates - the label should be updated
    showCommandPalette();
    const items = list.children.filter(c => {
      const label = c.children.find(ch => ch.className === 'command-palette-label');
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
    const deps = {
      state: { pageCount: 10 },
      els: {},
      goToPage: () => {},
    };
    initCommandPalette(deps);
    // After init, showing palette should render default commands
    showCommandPalette();
    assert.ok(list.children.length > 0);
  });

  it('initCommandPalette is a function', () => {
    assert.equal(typeof initCommandPalette, 'function');
  });
});
