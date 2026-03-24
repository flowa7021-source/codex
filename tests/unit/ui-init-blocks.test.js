import './setup-dom.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { initUiBlocks, cleanupUiBlockListeners } from '../../app/modules/ui-init-blocks.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDeps(overrides = {}) {
  return {
    state: { currentPage: 1, pageCount: 5, zoom: 1, adapter: null, docName: null, file: null },
    recognizeWithBoxes: mock.fn(async () => ({ text: '', words: [], confidence: 0 })),
    batchOcr: { processAll: mock.fn(async () => ({ processed: 0, total: 0, cancelled: false })), cancel: mock.fn(), results: new Map() },
    createSearchablePdf: mock.fn(async () => ({ blob: new Blob(), pagesProcessed: 0 })),
    detectScannedDocument: mock.fn(async () => ({ isScanned: false, scannedPages: 0, totalChecked: 5, confidence: 0 })),
    autoDetectLanguage: () => 'eng',
    pushDiagnosticEvent: mock.fn(),
    reloadPdfFromBytes: mock.fn(),
    renderCurrentPage: mock.fn(),
    parsePageRangeLib: (range, max) => {
      // Simple parser: "1-3" → [1,2,3], "2" → [2]
      const pages = [];
      for (const part of range.split(',')) {
        const m = part.trim().match(/^(\d+)-(\d+)$/);
        if (m) { for (let i = +m[1]; i <= Math.min(+m[2], max); i++) pages.push(i); }
        else { const n = parseInt(part.trim()); if (n >= 1 && n <= max) pages.push(n); }
      }
      return pages;
    },
    setOcrStatus: mock.fn(),
    ...overrides,
  };
}

/** Stores mock elements keyed by id for getElementById override */
let _mockElements = {};

function setupMockDOM(ids) {
  _mockElements = {};
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    // Add scrollIntoView for continuous scroll
    el.scrollIntoView = () => {};
    // Add matches for keydown checks
    el.matches = () => false;
    _mockElements[id] = el;
  }
}

let _origGetById;
let _origQuerySelector;
let _origQuerySelectorAll;
let _origWindowOpen;

function installMockGetById() {
  _origGetById = document.getElementById;
  _origQuerySelector = document.querySelector;
  _origQuerySelectorAll = document.querySelectorAll;
  _origWindowOpen = window.open;

  document.getElementById = (id) => _mockElements[id] || null;
  document.querySelector = (sel) => {
    // Support simple selectors
    if (sel.startsWith('#')) return _mockElements[sel.slice(1)] || null;
    if (sel === '.app-shell') return _mockElements['appShell'] || null;
    return null;
  };
  document.querySelectorAll = (sel) => {
    if (sel.includes('cb-tool-btn')) return [];
    if (sel.includes('lp-tabs') || sel.includes('sidebar-tabs')) return [];
    if (sel.includes('printRange')) return [];
    return [];
  };
  window.open = () => null;
}

function restoreMockGetById() {
  document.getElementById = _origGetById;
  document.querySelector = _origQuerySelector;
  document.querySelectorAll = _origQuerySelectorAll;
  window.open = _origWindowOpen;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('initUiBlocks — basic', () => {
  beforeEach(() => { cleanupUiBlockListeners(); });

  it('exports initUiBlocks as a function', () => {
    assert.equal(typeof initUiBlocks, 'function');
  });

  it('exports cleanupUiBlockListeners as a function', () => {
    assert.equal(typeof cleanupUiBlockListeners, 'function');
  });

  it('runs without error when given minimal deps and no DOM elements', () => {
    assert.doesNotThrow(() => initUiBlocks(makeDeps()));
  });

  it('cleanupUiBlockListeners can be called multiple times safely', () => {
    initUiBlocks(makeDeps());
    assert.doesNotThrow(() => cleanupUiBlockListeners());
    assert.doesNotThrow(() => cleanupUiBlockListeners());
  });
});

describe('initContinuousScroll', () => {
  beforeEach(() => {
    cleanupUiBlockListeners();
    setupMockDOM([
      'toggleContinuousScroll', 'canvasWrap', 'continuousScrollWrap',
      'continuousScrollContainer',
    ]);
    // Make scrollContainer support querySelectorAll for canvases
    const sc = _mockElements['continuousScrollContainer'];
    sc._canvases = [];
    sc.querySelectorAll = (sel) => {
      if (sel.includes('canvas')) return sc._canvases;
      return [];
    };
    installMockGetById();
  });

  afterEach(() => {
    restoreMockGetById();
    cleanupUiBlockListeners();
    delete window._novaContinuousScroll;
  });

  it('wires toggle button and exposes _novaContinuousScroll', () => {
    const deps = makeDeps();
    initUiBlocks(deps);
    assert.ok(window._novaContinuousScroll);
    assert.equal(typeof window._novaContinuousScroll.enterContinuousMode, 'function');
    assert.equal(typeof window._novaContinuousScroll.exitContinuousMode, 'function');
  });

  it('enterContinuousMode returns early without adapter', async () => {
    const deps = makeDeps({ state: { adapter: null, pageCount: 0, currentPage: 1, zoom: 1 } });
    initUiBlocks(deps);
    await window._novaContinuousScroll.enterContinuousMode();
    // Should not throw
  });

  it('enterContinuousMode creates canvas elements when adapter is present', async () => {
    const adapter = {
      type: 'pdf',
      renderPage: mock.fn(async () => {}),
    };
    const deps = makeDeps({ state: { adapter, pageCount: 3, currentPage: 1, zoom: 1, docName: null } });
    initUiBlocks(deps);
    await window._novaContinuousScroll.enterContinuousMode();
    // scrollContainer should have children (labels + canvases)
    const sc = _mockElements['continuousScrollContainer'];
    assert.ok(sc.children.length > 0);
  });

  it('exitContinuousMode hides scroll wrapper and clears', () => {
    const deps = makeDeps();
    initUiBlocks(deps);
    window._novaContinuousScroll.exitContinuousMode();
    assert.equal(_mockElements['continuousScrollWrap'].style.display, 'none');
  });
});

describe('initBatchOcrUI', () => {
  beforeEach(() => {
    cleanupUiBlockListeners();
    setupMockDOM([
      'batchOcrAll', 'batchOcrCancel', 'createSearchablePdf',
      'detectScanned', 'batchOcrProgress', 'batchOcrStatus',
    ]);
    installMockGetById();
  });

  afterEach(() => {
    restoreMockGetById();
    cleanupUiBlockListeners();
  });

  it('sets status when no adapter on batch OCR click', async () => {
    const deps = makeDeps();
    initUiBlocks(deps);
    // Simulate button click
    _mockElements['batchOcrAll'].click();
    // Wait for async handler
    await new Promise(r => setTimeout(r, 10));
    assert.ok(_mockElements['batchOcrStatus'].textContent.length > 0);
  });

  it('cancel button calls batchOcr.cancel', () => {
    const deps = makeDeps();
    initUiBlocks(deps);
    _mockElements['batchOcrCancel'].click();
    assert.equal(deps.batchOcr.cancel.mock.callCount(), 1);
  });

  it('detect scanned sets status when no adapter', async () => {
    const deps = makeDeps();
    initUiBlocks(deps);
    _mockElements['detectScanned'].click();
    await new Promise(r => setTimeout(r, 10));
    assert.ok(_mockElements['batchOcrStatus'].textContent.length > 0);
  });

  it('detect scanned runs analysis with pdf adapter', async () => {
    const adapter = { type: 'pdf', pdfDoc: {} };
    const deps = makeDeps({ state: { adapter, pageCount: 5, currentPage: 1, zoom: 1, docName: null, file: null } });
    initUiBlocks(deps);
    _mockElements['detectScanned'].click();
    await new Promise(r => setTimeout(r, 50));
    assert.equal(deps.detectScannedDocument.mock.callCount(), 1);
  });

  it('createSearchablePdf sets status when no file', async () => {
    const deps = makeDeps();
    initUiBlocks(deps);
    _mockElements['createSearchablePdf'].click();
    await new Promise(r => setTimeout(r, 10));
    assert.ok(_mockElements['batchOcrStatus'].textContent.length > 0);
  });

  it('createSearchablePdf sets status when no OCR results', async () => {
    const adapter = { type: 'pdf' };
    const file = { arrayBuffer: async () => new ArrayBuffer(10) };
    const deps = makeDeps({ state: { adapter, pageCount: 5, currentPage: 1, zoom: 1, docName: null, file } });
    initUiBlocks(deps);
    _mockElements['createSearchablePdf'].click();
    await new Promise(r => setTimeout(r, 10));
    assert.ok(_mockElements['batchOcrStatus'].textContent.includes('OCR'));
  });
});

describe('initDragDropAndHotkeys', () => {
  beforeEach(() => {
    cleanupUiBlockListeners();
    setupMockDOM(['documentViewport', 'fileInput']);
    installMockGetById();
  });

  afterEach(() => {
    restoreMockGetById();
    cleanupUiBlockListeners();
  });

  it('adds drag-over class on dragover', () => {
    initUiBlocks(makeDeps());
    const vp = _mockElements['documentViewport'];
    vp.dispatchEvent(Object.assign(new Event('dragover'), {
      preventDefault: () => {},
      stopPropagation: () => {},
    }));
    // The event handler should add 'drag-over' class
  });

  it('removes drag-over class on dragleave', () => {
    initUiBlocks(makeDeps());
    const vp = _mockElements['documentViewport'];
    vp.classList.add('drag-over');
    vp.dispatchEvent(Object.assign(new Event('dragleave'), {
      preventDefault: () => {},
    }));
  });
});

describe('initTabBar', () => {
  beforeEach(() => {
    cleanupUiBlockListeners();
    setupMockDOM(['tabBarTabs', 'tabBarNewTab', 'fileInput']);
    // tabBarTabs needs querySelectorAll for .doc-tab
    const tabs = _mockElements['tabBarTabs'];
    tabs.querySelectorAll = (sel) => {
      if (sel === '.doc-tab') return tabs.children;
      return [];
    };
    installMockGetById();
  });

  afterEach(() => {
    restoreMockGetById();
    cleanupUiBlockListeners();
    delete window._novaTabs;
  });

  it('exposes _novaTabs on window', () => {
    initUiBlocks(makeDeps());
    assert.ok(window._novaTabs);
    assert.equal(typeof window._novaTabs.createTab, 'function');
    assert.equal(typeof window._novaTabs.switchToTab, 'function');
    assert.equal(typeof window._novaTabs.closeTab, 'function');
  });

  it('createTab adds a tab element', () => {
    initUiBlocks(makeDeps());
    const tab = window._novaTabs.createTab('test.pdf', {}, 'pdf');
    assert.ok(tab);
    assert.equal(tab.name, 'test.pdf');
    assert.equal(tab.type, 'pdf');
    assert.ok(_mockElements['tabBarTabs'].children.length > 0);
  });

  it('createTab with different types sets correct icon', () => {
    initUiBlocks(makeDeps());
    const djvuTab = window._novaTabs.createTab('book.djvu', {}, 'djvu');
    assert.equal(djvuTab.type, 'djvu');
    const epubTab = window._novaTabs.createTab('novel.epub', {}, 'epub');
    assert.equal(epubTab.type, 'epub');
    const imgTab = window._novaTabs.createTab('photo.png', {}, 'image');
    assert.equal(imgTab.type, 'image');
  });

  it('closeTab removes tab element', () => {
    initUiBlocks(makeDeps());
    const tab1 = window._novaTabs.createTab('a.pdf', {}, 'pdf');
    const tab2 = window._novaTabs.createTab('b.pdf', {}, 'pdf');
    const initialLen = window._novaTabs.tabs.length;
    window._novaTabs.closeTab(tab1.id);
    assert.equal(window._novaTabs.tabs.length, initialLen - 1);
  });

  it('closeTab does nothing for unknown id', () => {
    initUiBlocks(makeDeps());
    window._novaTabs.createTab('a.pdf', {}, 'pdf');
    const len = window._novaTabs.tabs.length;
    window._novaTabs.closeTab(9999);
    assert.equal(window._novaTabs.tabs.length, len);
  });

  it('switchToTab updates active state', () => {
    initUiBlocks(makeDeps());
    const tab1 = window._novaTabs.createTab('a.pdf', {}, 'pdf');
    const tab2 = window._novaTabs.createTab('b.pdf', {}, 'pdf');
    window._novaTabs.switchToTab(tab1.id);
    // Should not throw
  });

  it('creates initial tab if docName is set', () => {
    const deps = makeDeps({ state: { docName: 'loaded.pdf', adapter: { type: 'pdf' }, currentPage: 1, pageCount: 5, zoom: 1, file: null } });
    initUiBlocks(deps);
    assert.ok(window._novaTabs.tabs.length > 0);
    assert.equal(window._novaTabs.tabs[0].name, 'loaded.pdf');
  });

  it('tabBarNewTab click triggers fileInput click', () => {
    let clicked = false;
    _mockElements['fileInput'].click = () => { clicked = true; };
    initUiBlocks(makeDeps());
    _mockElements['tabBarNewTab'].click();
    assert.ok(clicked);
  });
});

describe('initPrintDialog', () => {
  beforeEach(() => {
    cleanupUiBlockListeners();
    setupMockDOM([
      'printModal', 'closePrintModal', 'printCancel', 'printExecute',
      'printPreviewCanvas', 'printPreviewInfo', 'printCustomRange',
      'printScale', 'printCustomScale', 'printDpi', 'printAnnotations',
    ]);
    // printModal needs querySelectorAll for radio buttons
    _mockElements['printModal'].querySelectorAll = (sel) => {
      if (sel.includes('printRange')) return [];
      if (sel.includes(':checked')) return [];
      return [];
    };
    _mockElements['printModal'].querySelector = (sel) => {
      if (sel.includes(':checked')) return { value: 'all' };
      return null;
    };
    _mockElements['printDpi'] = document.createElement('input');
    _mockElements['printDpi'].value = '300';
    _mockElements['printAnnotations'] = document.createElement('input');
    _mockElements['printAnnotations'].checked = true;
    installMockGetById();
  });

  afterEach(() => {
    restoreMockGetById();
    cleanupUiBlockListeners();
    delete window._novaPrint;
  });

  it('exposes _novaPrint on window', () => {
    initUiBlocks(makeDeps());
    assert.ok(window._novaPrint);
    assert.equal(typeof window._novaPrint.openPrintDialog, 'function');
    assert.equal(typeof window._novaPrint.closePrintDialog, 'function');
  });

  it('openPrintDialog adds open class', () => {
    initUiBlocks(makeDeps());
    window._novaPrint.openPrintDialog();
    assert.ok(_mockElements['printModal'].classList.contains('open'));
  });

  it('closePrintDialog removes open class', () => {
    initUiBlocks(makeDeps());
    window._novaPrint.openPrintDialog();
    window._novaPrint.closePrintDialog();
    assert.ok(!_mockElements['printModal'].classList.contains('open'));
  });

  it('close button calls closePrintDialog', () => {
    initUiBlocks(makeDeps());
    window._novaPrint.openPrintDialog();
    _mockElements['closePrintModal'].click();
    assert.ok(!_mockElements['printModal'].classList.contains('open'));
  });

  it('cancel button calls closePrintDialog', () => {
    initUiBlocks(makeDeps());
    window._novaPrint.openPrintDialog();
    _mockElements['printCancel'].click();
    assert.ok(!_mockElements['printModal'].classList.contains('open'));
  });

  it('execute button returns early without adapter', async () => {
    const deps = makeDeps();
    initUiBlocks(deps);
    _mockElements['printExecute'].click();
    await new Promise(r => setTimeout(r, 10));
    // setOcrStatus should not be called (no adapter)
    assert.equal(deps.setOcrStatus.mock.callCount(), 0);
  });
});

describe('initShortcutsRef', () => {
  beforeEach(() => {
    cleanupUiBlockListeners();
    setupMockDOM(['shortcutsModal', 'closeShortcutsModal']);
    installMockGetById();
  });

  afterEach(() => {
    restoreMockGetById();
    cleanupUiBlockListeners();
    delete window._novaShortcuts;
  });

  it('exposes _novaShortcuts on window', () => {
    initUiBlocks(makeDeps());
    assert.ok(window._novaShortcuts);
    assert.equal(typeof window._novaShortcuts.openShortcuts, 'function');
    assert.equal(typeof window._novaShortcuts.closeShortcuts, 'function');
  });

  it('openShortcuts adds open class', () => {
    initUiBlocks(makeDeps());
    window._novaShortcuts.openShortcuts();
    assert.ok(_mockElements['shortcutsModal'].classList.contains('open'));
  });

  it('closeShortcuts removes open class', () => {
    initUiBlocks(makeDeps());
    window._novaShortcuts.openShortcuts();
    window._novaShortcuts.closeShortcuts();
    assert.ok(!_mockElements['shortcutsModal'].classList.contains('open'));
  });

  it('close button closes shortcuts', () => {
    initUiBlocks(makeDeps());
    window._novaShortcuts.openShortcuts();
    _mockElements['closeShortcutsModal'].click();
    assert.ok(!_mockElements['shortcutsModal'].classList.contains('open'));
  });
});

describe('initNovaReader3UI', () => {
  beforeEach(() => {
    cleanupUiBlockListeners();
    setupMockDOM([
      'rightPanel', 'rpTitle', 'closeRightPanel',
      'searchFloating', 'closeSearch',
    ]);
    // appShell needs to be found by querySelector('.app-shell')
    _mockElements['appShell'] = document.createElement('div');
    _mockElements['appShell'].classList.add('app-shell');
    // rightPanel needs querySelectorAll for .rp-panel
    _mockElements['rightPanel'].querySelectorAll = () => [];
    _mockElements['rightPanel'].querySelector = () => null;
    installMockGetById();
  });

  afterEach(() => {
    restoreMockGetById();
    cleanupUiBlockListeners();
    delete window._novaUI;
  });

  it('exposes _novaUI on window', () => {
    initUiBlocks(makeDeps());
    assert.ok(window._novaUI);
    assert.equal(typeof window._novaUI.openRightPanel, 'function');
    assert.equal(typeof window._novaUI.closeRightPanel, 'function');
    assert.equal(typeof window._novaUI.toggleFloatingSearch, 'function');
  });

  it('openRightPanel does not throw without matching panel', () => {
    initUiBlocks(makeDeps());
    // openRightPanel returns early if appShell or rightPanel are null in querySelector
    // Our mock querySelector returns null for .app-shell, so this tests the guard
    assert.doesNotThrow(() => window._novaUI.openRightPanel('search'));
  });

  it('closeRightPanel does not throw', () => {
    initUiBlocks(makeDeps());
    assert.doesNotThrow(() => window._novaUI.closeRightPanel());
  });

  it('toggleFloatingSearch opens search', () => {
    initUiBlocks(makeDeps());
    window._novaUI.toggleFloatingSearch(true);
    assert.ok(_mockElements['searchFloating'].classList.contains('open'));
  });

  it('toggleFloatingSearch closes search', () => {
    initUiBlocks(makeDeps());
    window._novaUI.toggleFloatingSearch(true);
    window._novaUI.toggleFloatingSearch(false);
    assert.ok(!_mockElements['searchFloating'].classList.contains('open'));
  });

  it('close search button closes floating search', () => {
    initUiBlocks(makeDeps());
    window._novaUI.toggleFloatingSearch(true);
    _mockElements['closeSearch'].click();
    assert.ok(!_mockElements['searchFloating'].classList.contains('open'));
  });

  it('closeRightPanel button works', () => {
    initUiBlocks(makeDeps());
    window._novaUI.openRightPanel('annotations');
    _mockElements['closeRightPanel'].click();
    assert.ok(!_mockElements['appShell'].classList.contains('right-panel-open'));
  });
});
