// ─── DOM Mock for Node.js unit tests ────────────────────────────────────────
// This file is loaded via --import before any test modules.
// It provides minimal browser globals so modules that call document.getElementById()
// at top-level scope don't crash in Node.js.

if (typeof globalThis.document === 'undefined') {
  // Helper: recursively collect all descendants of an element
  function _descendants(el) {
    const result = [];
    for (const child of el.children) {
      result.push(child);
      result.push(..._descendants(child));
    }
    return result;
  }

  // Helper: check if an element matches a simple CSS selector
  function _matches(el, selector) {
    // tag selector
    if (/^[a-zA-Z]+$/.test(selector)) {
      return el.tagName === selector.toUpperCase();
    }
    // .className
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return el.className === cls || (el.classList && el.classList.contains(cls));
    }
    // #id
    if (selector.startsWith('#')) {
      return el.id === selector.slice(1);
    }
    // attribute selector e.g. input[type="text"], div[style*="monospace"]
    const attrMatch = selector.match(/^([a-zA-Z]*)\[([a-z]+)([~|^$*]?)="?([^"\]]*)"?\]$/);
    if (attrMatch) {
      const [, tagPart, attr, op, val] = attrMatch;
      if (tagPart && el.tagName !== tagPart.toUpperCase()) return false;
      let attrVal;
      if (attr === 'style') {
        attrVal = typeof el.style === 'object' && el.style.cssText ? el.style.cssText : '';
      } else if (attr === 'type') {
        attrVal = el.type ?? '';
      } else if (attr === 'class') {
        attrVal = el.className ?? '';
      } else {
        attrVal = el.getAttribute?.(attr) ?? '';
      }
      if (op === '*') return attrVal.includes(val);
      if (op === '^') return attrVal.startsWith(val);
      if (op === '$') return attrVal.endsWith(val);
      return attrVal === val;
    }
    return false;
  }

  function _createElement(tag) {
    const _listeners = {};
    const _attributes = {};
    const _classList = new Set();
    const _children = [];
    let _innerHTML = '';

    const el = {
      tagName: tag.toUpperCase(),
      style: { cssText: '' },
      width: 0,
      height: 0,
      className: '',
      id: '',
      type: undefined,
      value: '',
      min: '',
      max: '',
      checked: false,
      classList: {
        add(...cls) { cls.forEach(c => _classList.add(c)); el.className = [..._classList].join(' '); },
        remove(...cls) { cls.forEach(c => _classList.delete(c)); el.className = [..._classList].join(' '); },
        toggle(c, force) {
          if (force !== undefined) { force ? _classList.add(c) : _classList.delete(c); }
          else if (_classList.has(c)) { _classList.delete(c); }
          else { _classList.add(c); }
          el.className = [..._classList].join(' ');
        },
        contains(c) { return _classList.has(c); },
      },
      setAttribute(k, v) { _attributes[k] = String(v); if (k === 'class') { el.className = v; } },
      getAttribute(k) { if (k === 'class') return el.className; return _attributes[k] ?? null; },
      addEventListener(type, fn) {
        if (!_listeners[type]) _listeners[type] = [];
        _listeners[type].push(fn);
      },
      removeEventListener(type, fn) {
        if (_listeners[type]) _listeners[type] = _listeners[type].filter(f => f !== fn);
      },
      dispatchEvent(evt) {
        const fns = _listeners[evt.type] || [];
        for (const fn of fns) fn(evt);
      },
      click() {
        el.dispatchEvent(new Event('click'));
      },
      appendChild(child) {
        if (child && !_children.includes(child)) {
          _children.push(child);
          child.parentNode = el;
          if (el.tagName === 'SELECT' && child.tagName === 'OPTION' && _children.length === 1) {
            el.value = child.value;
          }
        }
        return child;
      },
      append(...nodes) {
        for (const node of nodes) {
          if (node != null) el.appendChild(node);
        }
      },
      removeChild(child) {
        const idx = _children.indexOf(child);
        if (idx !== -1) {
          _children.splice(idx, 1);
          child.parentNode = null;
        }
        return child;
      },
      remove() {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      },
      querySelector(selector) {
        const all = _descendants(el);
        return all.find(c => _matches(c, selector)) ?? null;
      },
      querySelectorAll(selector) {
        const all = _descendants(el);
        return all.filter(c => _matches(c, selector));
      },
      get innerHTML() { return _innerHTML; },
      set innerHTML(val) { _innerHTML = val; _children.length = 0; },
      textContent: '',
      get children() { return _children; },
      dataset: {},
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
  }

  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: _createElement,
    createDocumentFragment: () => {
      const frag = { children: [], appendChild(child) { frag.children.push(child); return child; }, append(...nodes) { for (const n of nodes) if (n != null) frag.appendChild(n); } };
      return frag;
    },
    body: { appendChild() {}, style: {} },
    head: { appendChild() {} },
    documentElement: { style: {} },
    addEventListener() {},
    removeEventListener() {},
  };
}

if (typeof globalThis.window === 'undefined') {
  const _winListeners = {};
  globalThis.window = {
    addEventListener(type, fn, opts) {
      if (!_winListeners[type]) _winListeners[type] = [];
      _winListeners[type].push({ fn, once: !!(opts && opts.once) });
    },
    removeEventListener(type, fn) {
      if (_winListeners[type]) _winListeners[type] = _winListeners[type].filter(e => e.fn !== fn);
    },
    dispatchEvent(evt) {
      const entries = (_winListeners[evt.type] || []).slice();
      for (const entry of entries) {
        entry.fn(evt);
        if (entry.once) {
          const arr = _winListeners[evt.type];
          const idx = arr.indexOf(entry);
          if (idx !== -1) arr.splice(idx, 1);
        }
      }
    },
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

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null;
      this.onload = null;
      this.onerror = null;
    }
    readAsText(blob) {
      blob.text().then((text) => {
        this.result = text;
        if (this.onload) this.onload({ target: this });
      }).catch((err) => {
        if (this.onerror) this.onerror(err);
      });
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onload) this.onload({ target: this });
      }).catch((err) => {
        if (this.onerror) this.onerror(err);
      });
    }
  };
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

// Promise.withResolvers polyfill (required by pdfjs-dist, native in Node 22+)
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

// ResizeObserver mock (not available in Node.js)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Worker mock (not available in Node.js — prevents "[ocr] Worker is not defined" noise)
if (typeof globalThis.Worker === 'undefined') {
  globalThis.Worker = class Worker {
    constructor() { this.onmessage = null; this.onerror = null; }
    postMessage() {}
    terminate() {}
  };
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
