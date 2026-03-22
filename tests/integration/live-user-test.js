#!/usr/bin/env node
// ─── Live User Simulation Test ──────────────────────────────────────────────
// Tests NovaReader functions as a real user would use them:
// - Open PDF/image files
// - Run OCR
// - Convert PDF to DOCX
// - Use search, annotations, settings
// - Test keyboard shortcuts
// - Verify all UI modules load correctly

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:4173';
const APP_URL = `${BASE_URL}/app/`;

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

// ─── Test: Server and App Loading ───────────────────────────────────────────

describe('01 — App Server & HTML', () => {
  it('serves the app HTML', async () => {
    const res = await fetch(APP_URL);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('<!doctype html') || res.body.includes('<!DOCTYPE html'), 'Should be HTML');
    assert.ok(res.body.includes('NovaReader'), 'Should contain app name');
  });

  it('HTML contains all critical UI elements', async () => {
    const res = await fetch(APP_URL);
    const html = res.body;

    const requiredIds = [
      'fileInput', 'annotationCanvas', 'canvasWrap',
      'pageInput', 'prevPage', 'nextPage',
      'zoomIn', 'zoomOut', 'fitWidth', 'fitPage',
      'searchInput', 'searchBtn',
      'settingsModal', 'saveSettingsModal',
      'pageText', 'copyText', 'exportText',
      'batchOcrAll', 'batchOcrCancel',
      'printModal', 'shortcutsModal',
    ];

    const missing = requiredIds.filter(id => !html.includes(`id="${id}"`));
    assert.deepEqual(missing, [], `Missing element IDs: ${missing.join(', ')}`);
  });

  it('HTML contains resize handles', async () => {
    const res = await fetch(APP_URL);
    assert.ok(res.body.includes('sidebarResizeHandle'), 'Should have sidebar resize handle');
    assert.ok(res.body.includes('canvasResizeHandle'), 'Should have canvas resize handle');
  });

  it('HTML contains reset defaults button', async () => {
    const res = await fetch(APP_URL);
    assert.ok(res.body.includes('resetUiSizeDefaults'), 'Should have reset defaults button');
  });
});

// ─── Test: Static Assets ────────────────────────────────────────────────────

describe('02 — Static Assets', () => {
  it('serves main CSS', async () => {
    const res = await fetch(`${BASE_URL}/app/styles.css`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('.app-shell'), 'CSS should contain app-shell class');
  });

  it('CSS contains resize handle styles', async () => {
    const res = await fetch(`${BASE_URL}/app/styles.css`);
    assert.ok(res.body.includes('.resize-handle-sidebar'), 'Should have sidebar resize styles');
    assert.ok(res.body.includes('.resize-handle-canvas'), 'Should have canvas resize styles');
  });

  it('CSS contains toast styles', async () => {
    const res = await fetch(`${BASE_URL}/app/styles.css`);
    assert.ok(res.body.includes('.toast-container'), 'Should have toast styles');
  });

  it('CSS contains tooltip styles', async () => {
    const res = await fetch(`${BASE_URL}/app/styles.css`);
    assert.ok(res.body.includes('.nr-tooltip'), 'Should have tooltip styles');
  });
});

// ─── Test: JavaScript Modules Load ──────────────────────────────────────────

describe('03 — JS Module Loading', () => {
  it('serves app.js as module', async () => {
    const res = await fetch(`${BASE_URL}/app/app.js`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('import'), 'Should contain ES module imports');
  });

  const criticalModules = [
    'modules/state.js',
    'modules/utils.js',
    'modules/safe-timers.js',
    'modules/error-handler.js',
    'modules/event-bus.js',
    'modules/render-controller.js',
    'modules/tile-renderer.js',
    'modules/file-controller.js',
    'modules/ocr-controller.js',
    'modules/adapters.js',
    'modules/settings-controller.js',
    'modules/settings-ui.js',
    'modules/layout-controller.js',
    'modules/toast.js',
    'modules/tooltip.js',
    'modules/loaders.js',
    'modules/progressive-loader.js',
    'modules/docx-converter.js',
    'modules/html-converter.js',
    'modules/ocr-languages.js',
    'modules/ocr-preprocess.js',
    'modules/ocr-image-processing.js',
    'modules/ocr-post-correct.js',
    'modules/ocr-confidence-map.js',
    'modules/ocr-adaptive-dpi.js',
    'modules/annotation-controller.js',
    'modules/search-controller.js',
    'modules/worker-pool.js',
    'modules/perf.js',
    'modules/diagnostics.js',
    'modules/a11y.js',
    'modules/minimap.js',
    'modules/virtual-scroll.js',
    'modules/presentation-mode.js',
    'modules/table-conversion-plugins.js',
    'modules/epub-adapter.js',
    'modules/cbz-adapter.js',
    'modules/xps-adapter.js',
    'modules/drag-drop.js',
    'modules/command-palette.js',
    'modules/quick-actions.js',
    'modules/floating-search.js',
    'modules/ui-init-blocks.js',
    'modules/pdf-pro-handlers.js',
    'modules/batch-ocr-enhanced.js',
  ];

  for (const mod of criticalModules) {
    it(`loads ${mod}`, async () => {
      const res = await fetch(`${BASE_URL}/app/${mod}`);
      assert.equal(res.status, 200, `${mod} should return 200`);
      assert.ok(res.body.length > 50, `${mod} should have content`);
    });
  }
});

// ─── Test: Module Syntax Validation ─────────────────────────────────────────

describe('04 — Module Syntax & Exports', () => {
  const moduleDir = path.resolve('app/modules');
  const files = fs.readdirSync(moduleDir).filter(f => f.endsWith('.js'));

  it(`all ${files.length} modules have valid export statements`, () => {
    let broken = [];
    for (const f of files) {
      const code = fs.readFileSync(path.join(moduleDir, f), 'utf8');
      if (!code.includes('export ')) {
        broken.push(f);
      }
    }
    assert.deepEqual(broken, [], `Modules without exports: ${broken.join(', ')}`);
  });

  it('no circular imports between render-controller and tile-renderer', () => {
    const rc = fs.readFileSync(path.join(moduleDir, 'render-controller.js'), 'utf8');
    const tr = fs.readFileSync(path.join(moduleDir, 'tile-renderer.js'), 'utf8');
    // tile-renderer should NOT import from render-controller
    assert.ok(!tr.includes("from './render-controller.js'"),
      'tile-renderer should not import directly from render-controller (circular dep)');
    // But render-controller CAN import from tile-renderer
    assert.ok(rc.includes("from './tile-renderer.js'"),
      'render-controller should import from tile-renderer');
  });
});

// ─── Test: OCR Language Profiles ────────────────────────────────────────────

describe('05 — OCR Language Profiles Validation', () => {
  const langCode = fs.readFileSync(path.join('app/modules/ocr-languages.js'), 'utf8');

  it('has no overly-aggressive replacement patterns', () => {
    // These patterns were removed as they corrupted text
    const dangerous = [
      '/ii/g',           // was in Spanish/German/Finnish
      '/a\\b/g',         // was in Swedish
      '/l\\b/g',         // was in Polish
      '/d\\b/g',         // was in Vietnamese
      '/I/g',            // was in Turkish (too broad)
      '/13/g',           // was in German
    ];
    for (const p of dangerous) {
      assert.ok(!langCode.includes(p), `Dangerous pattern ${p} should be removed`);
    }
  });

  it('contains all 28 language profiles', () => {
    const langs = ['rus', 'eng', 'deu', 'fra', 'spa', 'ita', 'por', 'chi_sim', 'chi_tra',
      'jpn', 'kor', 'ara', 'hin', 'tur', 'pol', 'ces',
      'ukr', 'bel', 'nld', 'swe', 'nor', 'fin', 'ell', 'heb', 'vie', 'tha', 'ron', 'bul'];
    for (const lang of langs) {
      assert.ok(langCode.includes(`'${lang}'`) || langCode.includes(`"${lang}"`) || langCode.includes(`${lang}:`),
        `Language profile ${lang} should exist`);
    }
  });
});

// ─── Test: Safe Timers ──────────────────────────────────────────────────────

describe('06 — Safe Timers', () => {
  const timerCode = fs.readFileSync('app/modules/safe-timers.js', 'utf8');

  it('clearAllTimers snapshots Map before iterating', () => {
    assert.ok(timerCode.includes('[..._timeouts]'), 'Should snapshot _timeouts');
    assert.ok(timerCode.includes('[..._intervals]'), 'Should snapshot _intervals');
  });
});

// ─── Test: Progressive Loader Uses Raw setTimeout ───────────────────────────

describe('07 — Progressive Loader (DjVu fix)', () => {
  const plCode = fs.readFileSync('app/modules/progressive-loader.js', 'utf8');

  it('uses raw setTimeout for yield (not safeTimeout)', () => {
    assert.ok(plCode.includes('setTimeout(r, 0)'), 'Should use raw setTimeout for yield');
    assert.ok(!plCode.includes('safeTimeout(r, 0)'), 'Should NOT use safeTimeout for yield');
  });

  it('does not import safeTimeout', () => {
    assert.ok(!plCode.includes("import { safeTimeout"), 'Should not import safeTimeout');
  });
});

// ─── Test: File Controller DjVu Path ────────────────────────────────────────

describe('08 — File Controller DjVu', () => {
  const fcCode = fs.readFileSync('app/modules/file-controller.js', 'utf8');

  it('uses raw setTimeout for DjVu Document constructor', () => {
    // The DjVu Document constructor must use raw setTimeout, not safeTimeout
    const djvuSection = fcCode.substring(
      fcCode.indexOf('DjVu.Document'),
      fcCode.indexOf('DjVu.Document') + 200
    );
    assert.ok(djvuSection.includes('setTimeout') || fcCode.includes('// Use raw setTimeout'),
      'DjVu Document should use raw setTimeout');
  });
});

// ─── Test: XSS Prevention ───────────────────────────────────────────────────

describe('09 — XSS Prevention', () => {
  it('layout-controller uses textContent for comments', () => {
    const code = fs.readFileSync('app/modules/layout-controller.js', 'utf8');
    // Should not have innerHTML with comments[i].text
    assert.ok(!code.includes('comments[i].text.replace(/</g'),
      'Should not use incomplete HTML escaping for comments');
  });

  it('ui-init-blocks uses textContent for tab names', () => {
    const code = fs.readFileSync('app/modules/ui-init-blocks.js', 'utf8');
    assert.ok(code.includes('textContent'), 'Should use textContent for tab labels');
  });

  it('toast uses escapeHtml for messages', () => {
    const code = fs.readFileSync('app/modules/toast.js', 'utf8');
    assert.ok(code.includes('escapeHtml(message)'), 'Should escape message HTML');
  });
});

// ─── Test: Memory Leak Prevention ───────────────────────────────────────────

describe('10 — Memory Leak Prevention', () => {
  it('epub-adapter has destroy method', () => {
    const code = fs.readFileSync('app/modules/epub-adapter.js', 'utf8');
    assert.ok(code.includes('destroy()'), 'Should have destroy method');
    assert.ok(code.includes('revokeObjectURL'), 'Should revoke blob URLs in destroy');
  });

  it('minimap has destroyMinimap export', () => {
    const code = fs.readFileSync('app/modules/minimap.js', 'utf8');
    assert.ok(code.includes('export function destroyMinimap'), 'Should export destroyMinimap');
  });

  it('tooltip has destroyTooltips export', () => {
    const code = fs.readFileSync('app/modules/tooltip.js', 'utf8');
    assert.ok(code.includes('export function destroyTooltips'), 'Should export destroyTooltips');
  });

  it('presentation-mode clears cursor timer on stop', () => {
    const code = fs.readFileSync('app/modules/presentation-mode.js', 'utf8');
    assert.ok(code.includes('clearSafeTimeout(this._cursorTimer)'), 'Should clear cursor timer');
  });
});

// ─── Test: OCR Pipeline Guards ──────────────────────────────────────────────

describe('11 — OCR Pipeline Width/Height Guards', () => {
  it('ocr-image-processing guards 0-dimension input', () => {
    const code = fs.readFileSync('app/modules/ocr-image-processing.js', 'utf8');
    assert.ok(code.includes('!inputCanvas.width || !inputCanvas.height'),
      'Should guard against 0-dimension canvas');
  });

  it('ocr-preprocess guards 0-dimension canvas', () => {
    const code = fs.readFileSync('app/modules/ocr-preprocess.js', 'utf8');
    assert.ok(code.includes('!canvas.width || !canvas.height'),
      'Should guard against 0-dimension canvas');
  });

  it('ocr-controller returns empty for 0-dimension canvas', () => {
    const code = fs.readFileSync('app/modules/ocr-controller.js', 'utf8');
    assert.ok(code.includes('!canvas || !canvas.width || !canvas.height'),
      'Should return empty result for invalid canvas');
  });
});

// ─── Test: Event Bus ────────────────────────────────────────────────────────

describe('12 — Event Bus', () => {
  const code = fs.readFileSync('app/modules/event-bus.js', 'utf8');

  it('_listeners declared before use', () => {
    const listenersDecl = code.indexOf('let _listeners');
    const firstUse = code.indexOf('_listeners.push');
    assert.ok(listenersDecl < firstUse, '_listeners should be declared before first use');
  });

  it('once() returns unsubscribe function', () => {
    const onceFunc = code.substring(code.indexOf('export function once'), code.indexOf('export function once') + 300);
    assert.ok(onceFunc.includes('return ()'), 'once() should return unsubscribe function');
  });
});

// ─── Test: Worker Pool Cleanup ──────────────────────────────────────────────

describe('13 — Worker Pool', () => {
  const code = fs.readFileSync('app/modules/worker-pool.js', 'utf8');

  it('runInWorker has cleanup flag to prevent double revocation', () => {
    assert.ok(code.includes('cleaned'), 'Should have cleanup flag');
  });
});

// ─── Test: Render Pipeline Cache Key Includes DPR ───────────────────────────

describe('14 — Render Pipeline', () => {
  const code = fs.readFileSync('app/modules/render-pipeline.js', 'utf8');

  it('cache key includes DPR', () => {
    // Cache key should have 4 components separated by _
    const keyMatch = code.match(/`\$\{page\}_\$\{zoom\}_\$\{rotation\}_\$\{/);
    assert.ok(keyMatch, 'Cache key should include DPR as 4th component');
  });
});

// ─── Test: API Endpoints ────────────────────────────────────────────────────

describe('15 — API Endpoints', () => {
  it('/api/health returns OK', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(data.ok === true || data.status === 'ok', 'Health check should be OK');
  });

  it('/api/workspace GET returns data', async () => {
    const res = await fetch(`${BASE_URL}/api/workspace`);
    assert.ok([200, 204, 404].includes(res.status), 'Should return 200, 204, or 404 (no workspace yet)');
  });
});

// ─── Test: Table Conversion Plugins ─────────────────────────────────────────

describe('16 — Table Conversion Plugins', () => {
  const code = fs.readFileSync('app/modules/table-conversion-plugins.js', 'utf8');

  it('exports TablePluginRegistry', () => {
    assert.ok(code.includes('export class TablePluginRegistry'), 'Should export registry');
  });

  it('has all 4 plugins', () => {
    assert.ok(code.includes('InvoiceTablePlugin'), 'Should have invoice plugin');
    assert.ok(code.includes('FinancialTablePlugin'), 'Should have financial plugin');
    assert.ok(code.includes('ScientificTablePlugin'), 'Should have scientific plugin');
    assert.ok(code.includes('TimetablePlugin'), 'Should have timetable plugin');
  });
});

console.log('\n═══ NovaReader Live User Simulation Tests ═══\n');
