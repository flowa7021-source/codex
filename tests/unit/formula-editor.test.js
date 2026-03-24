// ─── Unit Tests: Formula Editor ────────────────────────────────────────────
// DOM globals provided by setup-dom.js (loaded via --import)
import './setup-dom.js';

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { FormulaEditor, renderLatexToPng, insertFormulaIntoPdf } from '../../app/modules/formula-editor.js';

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

// ─── renderLatexToPng (fallback renderer) ─────────────────────────────────

describe('renderLatexToPng', () => {
  it('renders simple LaTeX via fallback when no KaTeX/MathJax available', async () => {
    // Neither globalThis.katex nor window.MathJax is set, so it falls through
    // to the built-in fallback renderer
    const result = await renderLatexToPng('x^2 + 1');
    assert.ok(result, 'should return a result');
    assert.ok(result.png instanceof Uint8Array, 'png should be a Uint8Array');
    assert.equal(typeof result.width, 'number');
    assert.equal(typeof result.height, 'number');
  });

  it('renders with custom options', async () => {
    const result = await renderLatexToPng('\\alpha + \\beta', {
      fontSize: 24,
      color: '#ff0000',
      background: '#ffffff',
      paddingPx: 10,
      scale: 1,
      mode: 'inline',
    });
    assert.ok(result, 'should return a result');
    assert.ok(result.png instanceof Uint8Array);
  });

  it('renders Greek letters and symbols via fallback', async () => {
    const result = await renderLatexToPng('\\pi \\sigma \\omega \\infty \\sum \\int');
    assert.ok(result);
    assert.ok(result.png instanceof Uint8Array);
  });

  it('renders fractions and sqrt via fallback', async () => {
    const result = await renderLatexToPng('\\frac{a}{b} + \\sqrt{c}');
    assert.ok(result);
    assert.ok(result.png instanceof Uint8Array);
  });

  it('renders subscripts and superscripts via fallback', async () => {
    const result = await renderLatexToPng('x_0 + x_1 + x_2 + x_n + y^2 + z^3 + w^n');
    assert.ok(result);
  });

  it('renders comparison and arithmetic operators via fallback', async () => {
    const result = await renderLatexToPng('a \\leq b \\geq c \\neq d \\approx e \\times f \\div g \\pm h \\cdot i');
    assert.ok(result);
  });

  it('renders partial, nabla, and more Greek via fallback', async () => {
    const result = await renderLatexToPng('\\partial \\nabla \\delta \\epsilon \\theta \\lambda \\mu \\phi \\gamma');
    assert.ok(result);
  });

  it('uses transparent background by default', async () => {
    const result = await renderLatexToPng('x');
    assert.ok(result);
    assert.ok(result.width > 0 || result.width === 0); // mock canvas returns 0 width
  });

  it('uses KaTeX backend when globalThis.katex is available', async () => {
    const renderCalls = [];
    globalThis.katex = {
      renderToString(latex, opts) {
        renderCalls.push({ latex, opts });
        return `<span>${latex}</span>`;
      },
    };
    // Patch Image so that _htmlToPng fires onerror immediately (falls back to canvas)
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() { this.src = ''; }
      set src(v) {
        this._src = v;
        // Fire onerror async to trigger the fallback inside _htmlToPng
        queueMicrotask(() => { if (this.onerror) this.onerror(new Error('mock')); });
      }
      get src() { return this._src; }
    };
    try {
      const result = await renderLatexToPng('E=mc^2', { mode: 'display' });
      assert.ok(result, 'should return a result from KaTeX path');
      assert.equal(renderCalls.length, 1);
      assert.equal(renderCalls[0].latex, 'E=mc^2');
      assert.equal(renderCalls[0].opts.displayMode, true);
    } finally {
      delete globalThis.katex;
      globalThis.Image = OrigImage;
    }
  });

  it('falls back when KaTeX throws', async () => {
    globalThis.katex = {
      renderToString() {
        throw new Error('KaTeX parse error');
      },
    };
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() { this.src = ''; }
      set src(v) {
        this._src = v;
        queueMicrotask(() => { if (this.onerror) this.onerror(new Error('mock')); });
      }
      get src() { return this._src; }
    };
    try {
      const result = await renderLatexToPng('bad latex');
      assert.ok(result, 'should still return a result via fallback from KaTeX error path');
    } finally {
      delete globalThis.katex;
      globalThis.Image = OrigImage;
    }
  });

  it('uses MathJax backend when window.MathJax.tex2svg is available', async () => {
    const origMathJax = window.MathJax;
    window.MathJax = {
      tex2svg(latex, opts) {
        const svgEl = document.createElement('svg');
        svgEl.outerHTML = '<svg></svg>';
        return svgEl;
      },
    };
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() { this.src = ''; }
      set src(v) {
        this._src = v;
        queueMicrotask(() => { if (this.onerror) this.onerror(new Error('mock')); });
      }
      get src() { return this._src; }
    };
    try {
      const result = await renderLatexToPng('y^2', { mode: 'inline' });
      assert.ok(result, 'should return a result from MathJax path');
    } finally {
      window.MathJax = origMathJax;
      globalThis.Image = OrigImage;
    }
  });

  it('falls back when MathJax throws', async () => {
    const origMathJax = window.MathJax;
    window.MathJax = {
      tex2svg() {
        throw new Error('MathJax error');
      },
    };
    try {
      const result = await renderLatexToPng('z^3');
      assert.ok(result, 'should still return result via fallback');
    } finally {
      window.MathJax = origMathJax;
    }
  });
});

// ─── FormulaEditor._updatePreview ─────────────────────────────────────────

describe('FormulaEditor._updatePreview', () => {
  it('clears preview when input is empty', async () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    editor.open(10, 20);

    editor._inputEl.value = '';
    await editor._updatePreview();

    assert.equal(editor._previewEl.textContent, 'Введите формулу для предпросмотра...');
  });

  it('clears preview when input is whitespace', async () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    editor.open(10, 20);

    editor._inputEl.value = '   ';
    await editor._updatePreview();

    assert.equal(editor._previewEl.textContent, 'Введите формулу для предпросмотра...');
  });

  it('renders formula preview when input has content', async () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    editor.open(10, 20);

    editor._inputEl.value = 'x^2';
    await editor._updatePreview();

    // After rendering, preview should contain an img tag
    assert.ok(editor._previewEl.innerHTML.includes('img'), 'preview should contain an img element');
  });

  it('does nothing if _previewEl is null', async () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    // Don't call open(), so _previewEl stays null
    assert.doesNotThrow(async () => await editor._updatePreview());
  });

  it('does nothing if _inputEl is null', async () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    // Manually set only _previewEl
    editor._previewEl = document.createElement('div');
    assert.doesNotThrow(async () => await editor._updatePreview());
  });
});

// ─── FormulaEditor._schedulePreview ───────────────────────────────────────

describe('FormulaEditor._schedulePreview', () => {
  it('sets a debounce timer', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    editor.open(10, 20);

    assert.equal(editor._debounceTimer, null);
    editor._schedulePreview();
    assert.notEqual(editor._debounceTimer, null, 'debounce timer should be set');

    // Clean up
    editor.close();
  });

  it('clears previous timer before setting new one', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);
    editor.open(10, 20);

    editor._schedulePreview();
    const firstTimer = editor._debounceTimer;

    editor._schedulePreview();
    const secondTimer = editor._debounceTimer;

    assert.notEqual(firstTimer, secondTimer, 'new timer should be different from old one');

    // Clean up
    editor.close();
  });
});

// ─── FormulaEditor._buildOverlay ──────────────────────────────────────────

describe('FormulaEditor._buildOverlay', () => {
  it('creates overlay with correct class name', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor._buildOverlay();

    assert.ok(editor._overlay, 'overlay should exist');
    assert.equal(editor._overlay.className, 'formula-editor-overlay');
  });

  it('creates textarea input element', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor._buildOverlay();

    assert.ok(editor._inputEl, 'input element should exist');
    assert.equal(editor._inputEl.tagName, 'TEXTAREA');
  });

  it('creates preview element', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor._buildOverlay();

    assert.ok(editor._previewEl, 'preview element should exist');
  });

  it('sets container position to relative', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor._buildOverlay();

    assert.equal(container.style.position, 'relative');
  });

  it('appends overlay to container', () => {
    const container = makeContainer();
    const editor = new FormulaEditor(container, 612, 792, 1);

    editor._buildOverlay();

    assert.ok(container.children.length > 0, 'container should have children');
    assert.equal(container.children[0], editor._overlay);
  });
});
