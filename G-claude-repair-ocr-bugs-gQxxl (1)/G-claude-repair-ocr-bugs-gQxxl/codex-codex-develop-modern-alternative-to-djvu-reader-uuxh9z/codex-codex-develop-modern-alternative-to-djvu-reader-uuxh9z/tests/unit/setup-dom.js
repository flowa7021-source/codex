// ─── DOM Mock for Node.js unit tests ────────────────────────────────────────
// This file is loaded via --import before any test modules.
// It provides minimal browser globals so modules that call document.getElementById()
// at top-level scope don't crash in Node.js.

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        width: 0,
        height: 0,
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute() {},
        getAttribute() { return null; },
        addEventListener() {},
        removeEventListener() {},
        appendChild() {},
        remove() {},
        innerHTML: '',
        textContent: '',
        children: [],
        parentNode: null,
        getContext() {
          return {
            drawImage() {}, fillRect() {}, clearRect() {}, strokeRect() {},
            getImageData: () => ({ data: new Uint8Array(0), width: 0, height: 0 }),
            putImageData() {}, createImageData: () => ({ data: new Uint8Array(0) }),
            measureText: () => ({ width: 0 }), fillText() {}, strokeText() {},
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
    },
    createDocumentFragment: () => ({ appendChild() {}, children: [] }),
    body: { appendChild() {}, style: {} },
    head: { appendChild() {} },
    documentElement: { style: {} },
    addEventListener() {},
    removeEventListener() {},
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({}),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    location: { href: '', search: '', hash: '' },
    history: { pushState() {}, replaceState() {} },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
  };
}

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = {
    userAgent: 'node-test',
    hardwareConcurrency: 4,
    language: 'en-US',
  };
}

if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = {
    now: () => Date.now(),
    mark() {},
    measure() {},
    getEntriesByName: () => [],
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

if (typeof globalThis.requestIdleCallback === 'undefined') {
  globalThis.requestIdleCallback = (fn) => setTimeout(fn, 0);
}

if (typeof globalThis.URL === 'undefined' || !URL.createObjectURL) {
  const origURL = globalThis.URL;
  if (origURL) {
    origURL.createObjectURL = () => 'blob:mock';
    origURL.revokeObjectURL = () => {};
  }
}

if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = class Blob { constructor() {} };
}

if (typeof globalThis.Image === 'undefined') {
  globalThis.Image = class Image { constructor() { this.src = ''; } };
}

if (typeof globalThis.FontFace === 'undefined') {
  globalThis.FontFace = class FontFace {
    constructor() {}
    load() { return Promise.resolve(this); }
  };
}

if (typeof globalThis.HTMLCanvasElement === 'undefined') {
  globalThis.HTMLCanvasElement = class HTMLCanvasElement {};
}

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return { drawImage() {}, getImageData: () => ({ data: new Uint8Array(0) }), fillRect() {}, clearRect() {} }; }
  };
}

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, opts = {}) { super(type); this.detail = opts.detail; }
  };
}

if (typeof globalThis.EventTarget === 'undefined') {
  // Node 18+ has EventTarget, but just in case
}

if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = () => Promise.reject(new Error('fetch not available in tests'));
}

if (typeof globalThis.indexedDB === 'undefined') {
  globalThis.indexedDB = {
    open: () => ({ result: null, onerror() {}, onsuccess() {}, onupgradeneeded() {} }),
  };
}
