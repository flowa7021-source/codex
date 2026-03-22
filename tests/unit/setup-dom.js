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
  // In-memory IndexedDB mock that supports basic CRUD via object stores
  const _idbDatabases = new Map();

  class MockObjectStore {
    constructor(name, keyPath) {
      this.name = name;
      this.keyPath = keyPath;
      this._data = new Map();
      this._indexes = new Map();
    }
    createIndex(name, keyPath, opts) { this._indexes.set(name, { keyPath, ...opts }); return { name, keyPath }; }
    index(name) {
      const idx = this._indexes.get(name);
      return {
        openCursor: () => {
          const req = { result: null, onsuccess: null, onerror: null };
          queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: { result: null } }); });
          return req;
        },
      };
    }
    put(value) {
      const key = value[this.keyPath];
      this._data.set(key, structuredClone(value));
      const req = { result: key, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    get(key) {
      const req = { result: this._data.has(key) ? structuredClone(this._data.get(key)) : undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    delete(key) {
      this._data.delete(key);
      const req = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    clear() {
      this._data.clear();
      const req = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    getAll() {
      const req = { result: [...this._data.values()].map(v => structuredClone(v)), onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    count() {
      const req = { result: this._data.size, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
  }

  class MockDatabase {
    constructor(name) {
      this.name = name;
      this.objectStoreNames = { contains: (n) => this._stores.has(n) };
      this._stores = new Map();
      this.version = 1;
    }
    createObjectStore(name, opts = {}) {
      const store = new MockObjectStore(name, opts.keyPath || 'id');
      this._stores.set(name, store);
      return store;
    }
    transaction(storeNames, mode) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const tx = {
        objectStore: (name) => this._stores.get(name),
        oncomplete: null, onerror: null, onabort: null,
        _completeCbs: [],
      };
      queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete({}); });
      return tx;
    }
    close() {}
  }

  globalThis.indexedDB = {
    open: (name, version) => {
      const req = { result: null, onerror: null, onsuccess: null, onupgradeneeded: null };
      queueMicrotask(() => {
        let db = _idbDatabases.get(name);
        const isNew = !db;
        if (!db) {
          db = new MockDatabase(name);
          _idbDatabases.set(name, db);
        }
        req.result = db;
        if (isNew && req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: db } });
        }
        if (req.onsuccess) req.onsuccess({ target: { result: db } });
      });
      return req;
    },
    deleteDatabase: (name) => {
      _idbDatabases.delete(name);
      const req = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({}); });
      return req;
    },
  };
}
