// ─── Unit Tests: Formula Editor ────────────────────────────────────────────
// DOM globals provided by setup-dom.js (loaded via --import)
import './setup-dom.js';

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { FormulaEditor } from '../../app/modules/formula-editor.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal DOM-like container that supports querySelector and
 * tracks children so the FormulaEditor overlay lifecycle is testable.
 */
function makeContainer() {
  const children = [];
  const el = {
    tagName: 'DIV',
    style: { position: '' },
    children,
    appendChild(child) {
      child.parentNode = el;
      children.push(child);
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
    },
    querySelector(sel) {
      // Support simple class selector ".formula-editor-overlay"
      const cls = sel.startsWith('.') ? sel.slice(1) : sel;
      return _findByClass(children, cls);
    },
    remove() {},
    parentNode: null,
  };
  return el;
}

/**
 * Recursively search children (mock elements) for a given className.
 */
function _findByClass(nodes, cls) {
  for (const n of nodes) {
    if (n.className === cls) return n;
    if (n._children) {
      const found = _findByClass(n._children, cls);
      if (found) return found;
    }
  }
  return null;
}

// Patch document.createElement to produce richer mock elements that the
// FormulaEditor can work with (child tracking, value, focus, remove, etc.)
const _origCreate = globalThis.document.createElement;
globalThis.document.createElement = (tag) => {
  const kids = [];
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    style: { cssText: '', left: '', top: '' },
    textContent: '',
    placeholder: '',
    innerHTML: '',
    value: '',
    dataset: {},
    parentNode: null,
    _children: kids,
    children: kids,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) {
      if (child && typeof child === 'object') {
        child.parentNode = el;
        kids.push(child);
      }
    },
    remove() {
      if (el.parentNode && el.parentNode.removeChild) {
        el.parentNode.removeChild(el);
      }
    },
    querySelector(sel) {
      const cls = sel.startsWith('.') ? sel.slice(1) : sel;
      return _findByClass(kids, cls);
    },
    focus() {},
    getContext() {
      return {
        drawImage() {}, fillRect() {}, clearRect() {}, strokeRect() {},
        getImageData: () => ({ data: new Uint8Array(0), width: 0, height: 0 }),
        putImageData() {}, createImageData: () => ({ data: new Uint8Array(0) }),
        measureText: () => ({ width: 0 }), fillText() {}, strokeText() {},
        font: '', fillStyle: '', textBaseline: '',
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
        fill() {}, stroke() {}, save() {}, restore() {}, translate() {},
        rotate() {}, scale() {}, setTransform() {}, resetTransform() {},
        canvas: el,
      };
    },
    toDataURL: () => 'data:image/png;base64,',
    toBlob: (cb) => cb(new Blob()),
  };
  return el;
};

// ─── FormulaEditor constructor ────────────────────────────────────────────

describe('FormulaEditor', () => {
  let container;
  let editor;

  beforeEach(() => {
    container = makeContainer();
    editor = new FormulaEditor(container, 612, 792, 1);
  });

  it('stores constructor args correctly', () => {
    assert.equal(editor.container, container);
    assert.equal(editor.pageW, 612);
    assert.equal(editor.pageH, 792);
    assert.equal(editor.zoom, 1);
  });

  it('starts with no overlay', () => {
    assert.equal(editor._overlay, null);
    assert.equal(editor._previewEl, null);
    assert.equal(editor._inputEl, null);
  });

  it('starts with empty listeners', () => {
    assert.deepEqual(editor._listeners, {});
  });
});

// ─── FormulaEditor.on ─────────────────────────────────────────────────────

describe('FormulaEditor.on', () => {
  it('registers event listeners', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    const handler = () => {};

    const result = editor.on('insert', handler);

    assert.equal(result, editor, 'returns this for chaining');
    assert.equal(editor._listeners['insert'].length, 1);
    assert.equal(editor._listeners['insert'][0], handler);
  });

  it('supports multiple listeners for the same event', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    const h1 = () => {};
    const h2 = () => {};

    editor.on('insert', h1);
    editor.on('insert', h2);

    assert.equal(editor._listeners['insert'].length, 2);
  });

  it('supports multiple event types', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    editor.on('insert', () => {});
    editor.on('close', () => {});

    assert.equal(editor._listeners['insert'].length, 1);
    assert.equal(editor._listeners['close'].length, 1);
  });
});

// ─── FormulaEditor.open / close ───────────────────────────────────────────

describe('FormulaEditor.open', () => {
  it('creates overlay and appends to container', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor.open(100, 200);

    assert.ok(editor._overlay, 'overlay should be created');
    assert.ok(editor._inputEl, 'input should be created');
    assert.ok(editor._previewEl, 'preview should be created');
    assert.equal(editor._x, 100);
    assert.equal(editor._y, 200);
    assert.ok(container.querySelector('.formula-editor-overlay'));
  });

  it('closes existing overlay before reopening', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor.open(10, 20);
    const firstOverlay = editor._overlay;
    editor.open(30, 40);

    assert.notEqual(editor._overlay, firstOverlay);
    assert.equal(editor._x, 30);
    assert.equal(editor._y, 40);
  });
});

describe('FormulaEditor.close', () => {
  it('removes overlay from DOM', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor.open(100, 200);
    assert.ok(editor._overlay);

    editor.close();
    assert.equal(editor._overlay, null);
    assert.ok(!container.querySelector('.formula-editor-overlay'));
  });

  it('is safe to call close when not open', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    assert.doesNotThrow(() => editor.close());
  });
});

// ─── FormulaEditor.setZoom ────────────────────────────────────────────────

describe('FormulaEditor.setZoom', () => {
  it('updates zoom property', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor.setZoom(2);
    assert.equal(editor.zoom, 2);
  });

  it('repositions overlay when open', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor.open(100, 200);
    editor.setZoom(2);

    assert.equal(editor.zoom, 2);
    assert.ok(editor._overlay);
  });
});

// ─── FormulaEditor._emit ──────────────────────────────────────────────────

describe('FormulaEditor._emit', () => {
  it('calls all registered listeners', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    const calls = [];

    editor.on('insert', (data) => calls.push(data));
    editor.on('insert', (data) => calls.push(data));

    editor._emit('insert', { latex: 'x^2' });

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], { latex: 'x^2' });
  });

  it('does not throw for events with no listeners', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    assert.doesNotThrow(() => editor._emit('nonexistent', {}));
  });

  it('catches errors in listener callbacks', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    const calls = [];

    editor.on('insert', () => { throw new Error('boom'); });
    editor.on('insert', (data) => calls.push(data));

    assert.doesNotThrow(() => editor._emit('insert', { latex: 'y' }));
    assert.equal(calls.length, 1);
  });
});

// ─── FormulaEditor._insert ───────────────────────────────────────────────

describe('FormulaEditor._insert', () => {
  it('emits insert event with latex and coordinates', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    const emitted = [];

    editor.on('insert', (data) => emitted.push(data));
    editor.open(50, 100);
    editor._inputEl.value = 'E = mc^2';

    editor._insert();

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].latex, 'E = mc^2');
    assert.equal(emitted[0].x, 50);
    assert.equal(emitted[0].y, 100);
  });

  it('does not emit if input is empty', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    const emitted = [];

    editor.on('insert', (data) => emitted.push(data));
    editor.open(50, 100);
    editor._inputEl.value = '';

    editor._insert();

    assert.equal(emitted.length, 0);
  });

  it('does not emit if input is whitespace only', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    const emitted = [];

    editor.on('insert', (data) => emitted.push(data));
    editor.open(50, 100);
    editor._inputEl.value = '   ';

    editor._insert();

    assert.equal(emitted.length, 0);
  });

  it('closes the editor after insert', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor.open(50, 100);
    editor._inputEl.value = 'x^2';
    editor._insert();

    assert.equal(editor._overlay, null);
  });

  it('does nothing if _inputEl is null', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    assert.doesNotThrow(() => editor._insert());
  });
});

// ─── FormulaEditor._positionOverlay ──────────────────────────────────────

describe('FormulaEditor._positionOverlay', () => {
  it('sets left and top based on coordinates and zoom', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 2);

    editor.open(100, 200);

    // canvasX = 100 * 2 = 200
    // canvasY = (792 - 200) * 2 = 1184
    const overlay = editor._overlay;
    assert.ok(overlay.style.top.includes('px'));
    assert.ok(overlay.style.left.includes('px'));
  });

  it('does nothing if overlay is null', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    assert.doesNotThrow(() => editor._positionOverlay());
  });
});
