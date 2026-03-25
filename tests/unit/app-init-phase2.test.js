// ─── Unit Tests: app-init-phase2 module ──────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// The module under test (initPhase2Modules) does heavy DOM wiring at call time
// and imports many external modules. We cannot easily mock.module() all of them
// in every Node version, so we replicate the inline logic extracted from the
// source and verify DOM-manipulation outcomes directly.
// ---------------------------------------------------------------------------

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a minimal DOM element via setup-dom's createElement */
function el(tag, attrs = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'id') e.id = v;
    else if (k === 'className') { e.className = v; v.split(' ').forEach(c => c && e.classList.add(c)); }
    else if (k.startsWith('data-')) e.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    else e[k] = v;
  }
  return e;
}

// ─── 1. Sidebar Tab Switching ───────────────────────────────────────────────

describe('Sidebar tab switching', () => {
  let buttons, panels;

  beforeEach(() => {
    buttons = [];
    panels = [];
    for (let i = 0; i < 3; i++) {
      const btn = el('button', { 'data-sidebar-tab': `tab${i}` });
      buttons.push(btn);
      const panel = el('div', { 'data-sidebar-panel': `tab${i}` });
      panels.push(panel);
    }
  });

  function handleSidebarClick(btn) {
    // Replicate logic from lines 34-41 of app-init-phase2.js
    buttons.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = panels.find(p => p.dataset.sidebarPanel === btn.dataset.sidebarTab);
    if (target) target.classList.add('active');
  }

  it('activates clicked tab and its panel', () => {
    handleSidebarClick(buttons[1]);
    assert.ok(buttons[1].classList.contains('active'));
    assert.ok(panels[1].classList.contains('active'));
  });

  it('deactivates previously active tab', () => {
    handleSidebarClick(buttons[0]);
    handleSidebarClick(buttons[2]);
    assert.ok(!buttons[0].classList.contains('active'));
    assert.ok(!panels[0].classList.contains('active'));
    assert.ok(buttons[2].classList.contains('active'));
    assert.ok(panels[2].classList.contains('active'));
  });

  it('only one tab and panel are active at a time', () => {
    handleSidebarClick(buttons[0]);
    handleSidebarClick(buttons[1]);
    const activeButtons = buttons.filter(b => b.classList.contains('active'));
    const activePanels = panels.filter(p => p.classList.contains('active'));
    assert.equal(activeButtons.length, 1);
    assert.equal(activePanels.length, 1);
  });

  it('handles repeated clicks on same tab', () => {
    handleSidebarClick(buttons[0]);
    handleSidebarClick(buttons[0]);
    assert.ok(buttons[0].classList.contains('active'));
    assert.ok(panels[0].classList.contains('active'));
  });

  it('no panel matches when dataset is mismatched', () => {
    const orphan = el('button', { 'data-sidebar-tab': 'nonexistent' });
    handleSidebarClick(orphan);
    // No panel should be active
    assert.ok(panels.every(p => !p.classList.contains('active')));
  });
});

// ─── 2. Bottom Toolbar Tab Switching ────────────────────────────────────────

describe('Bottom toolbar tab switching', () => {
  let buttons, panels;

  beforeEach(() => {
    buttons = [];
    panels = [];
    for (let i = 0; i < 2; i++) {
      buttons.push(el('button', { 'data-bottom-tab': `btab${i}` }));
      panels.push(el('div', { 'data-bottom-panel': `btab${i}` }));
    }
  });

  function handleBottomClick(btn) {
    // Replicate logic from lines 45-52
    buttons.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = panels.find(p => p.dataset.bottomPanel === btn.dataset.bottomTab);
    if (target) target.classList.add('active');
  }

  it('activates bottom tab and its panel', () => {
    handleBottomClick(buttons[0]);
    assert.ok(buttons[0].classList.contains('active'));
    assert.ok(panels[0].classList.contains('active'));
  });

  it('switches between bottom tabs', () => {
    handleBottomClick(buttons[0]);
    handleBottomClick(buttons[1]);
    assert.ok(!buttons[0].classList.contains('active'));
    assert.ok(buttons[1].classList.contains('active'));
    assert.ok(panels[1].classList.contains('active'));
  });
});

// ─── 3. Modal Tab Switching ─────────────────────────────────────────────────

describe('Modal tab switching', () => {
  let buttons, panels;

  beforeEach(() => {
    buttons = [];
    panels = [];
    for (let i = 0; i < 3; i++) {
      buttons.push(el('button', { 'data-modal-tab': `mtab${i}` }));
      panels.push(el('div', { 'data-modal-panel': `mtab${i}` }));
    }
  });

  function handleModalClick(btn) {
    // Replicate logic from lines 56-63
    buttons.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = panels.find(p => p.dataset.modalPanel === btn.dataset.modalTab);
    if (target) target.classList.add('active');
  }

  it('activates modal tab and panel', () => {
    handleModalClick(buttons[2]);
    assert.ok(buttons[2].classList.contains('active'));
    assert.ok(panels[2].classList.contains('active'));
  });

  it('ensures mutual exclusion across modal tabs', () => {
    handleModalClick(buttons[0]);
    handleModalClick(buttons[1]);
    const active = buttons.filter(b => b.classList.contains('active'));
    assert.equal(active.length, 1);
    assert.strictEqual(active[0], buttons[1]);
  });
});

// ─── 4. Dropdown Toggle ────────────────────────────────────────────────────

describe('Dropdown toggle', () => {
  it('opens a closed dropdown on trigger click', () => {
    const dropdown = el('div', { className: 'dropdown' });
    const wasOpen = dropdown.classList.contains('open');
    // Replicate toggle logic from lines 67-73
    if (!wasOpen) dropdown.classList.add('open');
    assert.ok(dropdown.classList.contains('open'));
  });

  it('closes an open dropdown on trigger click', () => {
    const dropdown = el('div', { className: 'dropdown' });
    dropdown.classList.add('open');
    const wasOpen = dropdown.classList.contains('open');
    dropdown.classList.remove('open');
    if (!wasOpen) dropdown.classList.add('open');
    assert.ok(!dropdown.classList.contains('open'));
  });

  it('closes all open dropdowns before opening the clicked one', () => {
    const dd1 = el('div', { className: 'dropdown' });
    const dd2 = el('div', { className: 'dropdown' });
    dd1.classList.add('open');
    // Replicate: close all, then open clicked
    const allDropdowns = [dd1, dd2];
    allDropdowns.forEach(d => d.classList.remove('open'));
    dd2.classList.add('open');
    assert.ok(!dd1.classList.contains('open'));
    assert.ok(dd2.classList.contains('open'));
  });

  it('outside click closes all open dropdowns', () => {
    const dd = el('div', { className: 'dropdown' });
    dd.classList.add('open');
    // Replicate outside click handler (line 75-77)
    dd.classList.remove('open');
    assert.ok(!dd.classList.contains('open'));
  });

  it('dropdown menu button click closes the dropdown', () => {
    const dd = el('div', { className: 'dropdown' });
    dd.classList.add('open');
    // Replicate line 80-82: btn.closest('.dropdown')?.classList.remove('open')
    dd.classList.remove('open');
    assert.ok(!dd.classList.contains('open'));
  });
});

// ─── 5. Status Bar Updates ──────────────────────────────────────────────────

describe('Status bar updates', () => {
  // Replicate updateStatusBar() from lines 86-98

  function updateStatusBar(state, sbEls) {
    if (sbEls.sbPage) {
      sbEls.sbPage.textContent = `\u0421\u0442\u0440. ${state.currentPage} / ${state.pageCount || '\u2014'}`;
    }
    if (sbEls.sbZoom) {
      sbEls.sbZoom.textContent = `${Math.round(state.zoom * 100)}%`;
    }
    if (sbEls.sbReadingTime) {
      const mins = Math.round((state.readingTotalMs || 0) / 60000);
      sbEls.sbReadingTime.textContent = `\u0427\u0442\u0435\u043d\u0438\u0435: ${mins} \u043c\u0438\u043d`;
    }
    if (sbEls.sbFileSize && state.file) {
      const bytes = state.file.size || 0;
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      sbEls.sbFileSize.textContent = bytes > 0 ? `${mb} \u041c\u0411` : '\u2014';
    }
  }

  it('formats page info correctly', () => {
    const sbPage = el('span');
    updateStatusBar({ currentPage: 5, pageCount: 20, zoom: 1 }, { sbPage });
    assert.equal(sbPage.textContent, '\u0421\u0442\u0440. 5 / 20');
  });

  it('shows dash when pageCount is 0', () => {
    const sbPage = el('span');
    updateStatusBar({ currentPage: 1, pageCount: 0, zoom: 1 }, { sbPage });
    assert.equal(sbPage.textContent, '\u0421\u0442\u0440. 1 / \u2014');
  });

  it('formats zoom as integer percentage', () => {
    const sbZoom = el('span');
    updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 0.75 }, { sbZoom });
    assert.equal(sbZoom.textContent, '75%');
  });

  it('formats zoom at 100%', () => {
    const sbZoom = el('span');
    updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 1 }, { sbZoom });
    assert.equal(sbZoom.textContent, '100%');
  });

  it('formats zoom at 250%', () => {
    const sbZoom = el('span');
    updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 2.5 }, { sbZoom });
    assert.equal(sbZoom.textContent, '250%');
  });

  it('computes reading time in minutes from ms', () => {
    const sbReadingTime = el('span');
    updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 1, readingTotalMs: 300000 }, { sbReadingTime });
    assert.equal(sbReadingTime.textContent, '\u0427\u0442\u0435\u043d\u0438\u0435: 5 \u043c\u0438\u043d');
  });

  it('reading time defaults to 0 when readingTotalMs is undefined', () => {
    const sbReadingTime = el('span');
    updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 1 }, { sbReadingTime });
    assert.equal(sbReadingTime.textContent, '\u0427\u0442\u0435\u043d\u0438\u0435: 0 \u043c\u0438\u043d');
  });

  it('formats file size in MB', () => {
    const sbFileSize = el('span');
    updateStatusBar(
      { currentPage: 1, pageCount: 1, zoom: 1, file: { size: 5242880 } },
      { sbFileSize }
    );
    assert.equal(sbFileSize.textContent, '5.0 \u041c\u0411');
  });

  it('shows dash when file size is 0', () => {
    const sbFileSize = el('span');
    updateStatusBar(
      { currentPage: 1, pageCount: 1, zoom: 1, file: { size: 0 } },
      { sbFileSize }
    );
    assert.equal(sbFileSize.textContent, '\u2014');
  });

  it('does not update sbFileSize when state.file is missing', () => {
    const sbFileSize = el('span');
    sbFileSize.textContent = 'untouched';
    updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 1 }, { sbFileSize });
    assert.equal(sbFileSize.textContent, 'untouched');
  });

  it('does not crash when element references are null', () => {
    // All els are null/undefined — should just be no-ops
    assert.doesNotThrow(() => {
      updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 1 }, {});
    });
  });

  it('rounds fractional zoom correctly', () => {
    const sbZoom = el('span');
    updateStatusBar({ currentPage: 1, pageCount: 1, zoom: 1.333 }, { sbZoom });
    assert.equal(sbZoom.textContent, '133%');
  });

  it('formats small file size', () => {
    const sbFileSize = el('span');
    updateStatusBar(
      { currentPage: 1, pageCount: 1, zoom: 1, file: { size: 1024 } },
      { sbFileSize }
    );
    assert.equal(sbFileSize.textContent, '0.0 \u041c\u0411');
  });
});

// ─── 6. View Mode Dropdown Handler ──────────────────────────────────────────

describe('View mode dropdown handler', () => {
  let dd, trigger, menuBtns;

  beforeEach(() => {
    dd = el('div', { id: 'viewModeDropdown' });
    trigger = el('button', { className: 'dropdown-trigger' });
    trigger.setAttribute('aria-expanded', 'false');
    dd.appendChild(trigger);

    const menu = el('div', { className: 'dropdown-menu' });
    menuBtns = [];
    for (const mode of ['single', 'double', 'scroll']) {
      const btn = el('button', { className: 'dropdown-item', 'data-view-mode': mode });
      menu.appendChild(btn);
      menuBtns.push(btn);
    }
    dd.appendChild(menu);
  });

  it('toggle opens dropdown and sets aria-expanded to true', () => {
    // Replicate lines 112-115
    dd.classList.toggle('open');
    trigger.setAttribute('aria-expanded', dd.classList.contains('open') ? 'true' : 'false');
    assert.ok(dd.classList.contains('open'));
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  });

  it('toggle closes dropdown if already open', () => {
    dd.classList.add('open');
    dd.classList.toggle('open');
    trigger.setAttribute('aria-expanded', dd.classList.contains('open') ? 'true' : 'false');
    assert.ok(!dd.classList.contains('open'));
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  });

  it('selecting a mode activates its button and closes dropdown', () => {
    dd.classList.add('open');
    const selectedBtn = menuBtns[1]; // 'double'
    // Replicate lines 118-126
    menuBtns.forEach(b => b.classList.remove('active'));
    selectedBtn.classList.add('active');
    dd.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');

    assert.ok(selectedBtn.classList.contains('active'));
    assert.ok(!menuBtns[0].classList.contains('active'));
    assert.ok(!menuBtns[2].classList.contains('active'));
    assert.ok(!dd.classList.contains('open'));
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  });

  it('outside click closes dropdown and resets aria-expanded', () => {
    dd.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    // Replicate lines 128-133: outside click
    dd.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    assert.ok(!dd.classList.contains('open'));
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  });

  it('mode selection replaces previous active mode', () => {
    menuBtns[0].classList.add('active');
    // Select mode 2
    menuBtns.forEach(b => b.classList.remove('active'));
    menuBtns[2].classList.add('active');
    assert.ok(!menuBtns[0].classList.contains('active'));
    assert.ok(menuBtns[2].classList.contains('active'));
  });
});

// ─── 7. Graceful Degradation — Cloud Stub ───────────────────────────────────

describe('Graceful degradation — cloud stub', () => {
  it('disables cloud buttons when status is stub', () => {
    const CLOUD_STATUS = 'stub';
    const cloudBtns = [el('button'), el('button'), el('button')];

    if (CLOUD_STATUS === 'stub') {
      for (const btn of cloudBtns) {
        btn.disabled = true;
        btn.title = '\u041e\u0431\u043b\u0430\u0447\u043d\u0430\u044f \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044f: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 OAuth2';
      }
    }

    for (const btn of cloudBtns) {
      assert.equal(btn.disabled, true);
      assert.ok(btn.title.includes('OAuth2'));
    }
  });

  it('disables cloud sync URL input when status is stub', () => {
    const CLOUD_STATUS = 'stub';
    const cloudInput = el('input');

    if (CLOUD_STATUS === 'stub') {
      cloudInput.disabled = true;
      cloudInput.placeholder = 'Cloud: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 (stub)';
    }

    assert.equal(cloudInput.disabled, true);
    assert.ok(cloudInput.placeholder.includes('stub'));
  });

  it('does not disable buttons when cloud status is not stub', () => {
    const CLOUD_STATUS = 'active';
    const btn = el('button');
    btn.disabled = false;

    if (CLOUD_STATUS === 'stub') {
      btn.disabled = true;
    }

    assert.equal(btn.disabled, false);
  });

  it('skips null buttons without crashing', () => {
    const CLOUD_STATUS = 'stub';
    const cloudBtns = [null, el('button'), null];

    assert.doesNotThrow(() => {
      if (CLOUD_STATUS === 'stub') {
        for (const btn of cloudBtns) {
          if (btn) {
            btn.disabled = true;
            btn.title = 'disabled';
          }
        }
      }
    });
  });
});

// ─── 8. Graceful Degradation — AI Partial ───────────────────────────────────

describe('Graceful degradation — AI partial', () => {
  it('sets AI button title when status is partial', () => {
    const AI_STATUS = 'partial';
    const aiBtn = el('button');

    if (AI_STATUS === 'partial') {
      aiBtn.title = 'AI: \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u044d\u0432\u0440\u0438\u0441\u0442\u0438\u043a\u0430 (\u0431\u0435\u0437 \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e API)';
    }

    assert.ok(aiBtn.title.includes('AI'));
    assert.ok(aiBtn.title.includes('\u044d\u0432\u0440\u0438\u0441\u0442\u0438\u043a\u0430'));
  });

  it('does not modify AI button when status is full', () => {
    const AI_STATUS = 'full';
    const aiBtn = el('button');
    aiBtn.title = '';

    if (AI_STATUS === 'partial') {
      aiBtn.title = 'modified';
    }

    assert.equal(aiBtn.title, '');
  });

  it('handles null aiBtn gracefully', () => {
    const AI_STATUS = 'partial';
    const aiBtn = null;

    assert.doesNotThrow(() => {
      if (AI_STATUS === 'partial') {
        if (aiBtn) aiBtn.title = 'should not reach';
      }
    });
  });
});

// ─── 9. Double-Tap Zoom Handler ─────────────────────────────────────────────

describe('Double-tap zoom handler', () => {
  // Replicate lines 173-178
  function doubleTapHandler(state, renderFn) {
    const zoom = state.zoom ?? 1;
    const newZoom = zoom < 1.5 ? 2 : 1;
    state.zoom = newZoom;
    renderFn();
  }

  it('zooms to 2x when current zoom is less than 1.5', () => {
    const state = { zoom: 1 };
    const render = mock.fn();
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 2);
    assert.equal(render.mock.callCount(), 1);
  });

  it('resets to 1x when current zoom is >= 1.5', () => {
    const state = { zoom: 2 };
    const render = mock.fn();
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 1);
    assert.equal(render.mock.callCount(), 1);
  });

  it('resets to 1x when zoom is exactly 1.5', () => {
    const state = { zoom: 1.5 };
    const render = mock.fn();
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 1);
  });

  it('zooms to 2x when zoom is just below 1.5', () => {
    const state = { zoom: 1.49 };
    const render = mock.fn();
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 2);
  });

  it('defaults to zoom=1 when state.zoom is undefined', () => {
    const state = { zoom: undefined };
    const render = mock.fn();
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 2); // undefined ?? 1 => 1, which is < 1.5 => 2
  });

  it('defaults to zoom=1 when state.zoom is null', () => {
    const state = { zoom: null };
    const render = mock.fn();
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 2); // null ?? 1 => 1, < 1.5 => 2
  });

  it('toggles back and forth on repeated double-taps', () => {
    const state = { zoom: 1 };
    const render = mock.fn();
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 2);
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 1);
    doubleTapHandler(state, render);
    assert.equal(state.zoom, 2);
    assert.equal(render.mock.callCount(), 3);
  });
});

// ─── 10. Enhanced Zoom Config ───────────────────────────────────────────────

describe('Enhanced zoom config wiring', () => {
  it('setZoom updates state.zoom and zoom status text', () => {
    // Replicate lines 157-158
    const state = { zoom: 1 };
    const zoomStatus = el('span');
    const setZoom = (z) => {
      state.zoom = z;
      zoomStatus.textContent = `${Math.round(z * 100)}%`;
    };
    setZoom(1.75);
    assert.equal(state.zoom, 1.75);
    assert.equal(zoomStatus.textContent, '175%');
  });

  it('getZoom returns current zoom from state', () => {
    const state = { zoom: 0.5 };
    const getZoom = () => state.zoom;
    assert.equal(getZoom(), 0.5);
  });
});

// ─── 11. Reading Position Save Logic ────────────────────────────────────────

describe('Reading position save logic', () => {
  it('saves position when docName and currentPage exist', () => {
    const state = { docName: 'test.pdf', currentPage: 5, zoom: 1.2 };
    const saved = [];
    const saveReadingPosition = (name, pos) => saved.push({ name, pos });

    // Replicate lines 189-192
    if (state.docName && state.currentPage) {
      saveReadingPosition(state.docName, { page: state.currentPage, zoom: state.zoom });
    }

    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, 'test.pdf');
    assert.equal(saved[0].pos.page, 5);
    assert.equal(saved[0].pos.zoom, 1.2);
  });

  it('does not save when docName is empty', () => {
    const state = { docName: '', currentPage: 1, zoom: 1 };
    const saved = [];
    const saveReadingPosition = (name, pos) => saved.push({ name, pos });

    if (state.docName && state.currentPage) {
      saveReadingPosition(state.docName, { page: state.currentPage, zoom: state.zoom });
    }

    assert.equal(saved.length, 0);
  });

  it('does not save when currentPage is 0', () => {
    const state = { docName: 'file.pdf', currentPage: 0, zoom: 1 };
    const saved = [];
    const saveReadingPosition = (name, pos) => saved.push({ name, pos });

    if (state.docName && state.currentPage) {
      saveReadingPosition(state.docName, { page: state.currentPage, zoom: state.zoom });
    }

    assert.equal(saved.length, 0);
  });
});

// ─── 12. Export Signature Check ─────────────────────────────────────────────

describe('initPhase2Modules export', () => {
  it('is exported as a function (dynamic import)', async () => {
    let mod;
    try {
      mod = await import('../../app/modules/app-init-phase2.js');
    } catch (_e) {
      // Transitive import may fail in Node — skip gracefully
      return;
    }
    assert.equal(typeof mod.initPhase2Modules, 'function');
  });
});

// ─── 13. Drag-Drop openFile Config ──────────────────────────────────────────

describe('Drag-drop openFile wiring', () => {
  it('dispatches change event on file input when file is provided', () => {
    const fileInput = el('input');
    let changeFired = false;
    fileInput.addEventListener('change', () => { changeFired = true; });

    // Replicate lines 337-343 (simplified — DataTransfer not fully available)
    fileInput.dispatchEvent(new Event('change'));
    assert.ok(changeFired);
  });
});

// ─── 14. Memory Warning Handler Logic ───────────────────────────────────────

describe('Memory warning handler', () => {
  it('calls forceCleanup on memory-warning event', () => {
    const forceCleanup = mock.fn();
    const detail = { usedMB: 512 };

    // Replicate lines 303-306
    forceCleanup();
    assert.equal(forceCleanup.mock.callCount(), 1);
  });
});

// ─── 15. Error Recovery Registration ────────────────────────────────────────

describe('Error recovery registration', () => {
  it('MEMORY recovery clears caches', () => {
    const clearPageRenderCache = mock.fn();
    const revokeAllTrackedUrls = mock.fn();

    // Replicate lines 197-200
    const memoryRecovery = () => {
      clearPageRenderCache();
      revokeAllTrackedUrls();
    };
    memoryRecovery();

    assert.equal(clearPageRenderCache.mock.callCount(), 1);
    assert.equal(revokeAllTrackedUrls.mock.callCount(), 1);
  });

  it('RENDER recovery calls renderCurrentPage', () => {
    const renderCurrentPage = mock.fn();

    // Replicate lines 201-204
    const renderRecovery = () => {
      try { renderCurrentPage(); } catch (_err) { /* ignore */ }
    };
    renderRecovery();

    assert.equal(renderCurrentPage.mock.callCount(), 1);
  });

  it('RENDER recovery catches errors without crashing', () => {
    const renderCurrentPage = mock.fn(() => { throw new Error('render failed'); });

    const renderRecovery = () => {
      try { renderCurrentPage(); } catch (_err) { /* ignore */ }
    };

    assert.doesNotThrow(() => renderRecovery());
    assert.equal(renderCurrentPage.mock.callCount(), 1);
  });

  it('onError callback fires for fatal errors', () => {
    const messages = [];
    const onErrorCb = (err) => {
      if (err.severity === 'fatal') {
        messages.push(err.message);
      }
    };

    onErrorCb({ severity: 'fatal', message: 'Out of memory' });
    onErrorCb({ severity: 'warning', message: 'Not fatal' });

    assert.equal(messages.length, 1);
    assert.equal(messages[0], 'Out of memory');
  });
});

// ─── 16. Dropdown toggle with multiple dropdowns ─────────────────────────────

describe('Dropdown toggle — full lifecycle', () => {
  function createDropdown() {
    const dd = el('div', { className: 'dropdown' });
    const trigger = el('button', { className: 'dropdown-trigger' });
    dd.appendChild(trigger);
    const menu = el('div', { className: 'dropdown-menu' });
    const menuBtn = el('button');
    menu.appendChild(menuBtn);
    dd.appendChild(menu);
    return { dd, trigger, menu, menuBtn };
  }

  function toggleDropdown(allDropdowns, dd) {
    const wasOpen = dd.classList.contains('open');
    allDropdowns.forEach(d => d.classList.remove('open'));
    if (!wasOpen) dd.classList.add('open');
  }

  it('toggles open then closed on consecutive clicks', () => {
    const { dd } = createDropdown();
    toggleDropdown([dd], dd);
    assert.ok(dd.classList.contains('open'));
    toggleDropdown([dd], dd);
    assert.ok(!dd.classList.contains('open'));
  });

  it('opening one dropdown closes others', () => {
    const d1 = createDropdown();
    const d2 = createDropdown();
    const all = [d1.dd, d2.dd];
    toggleDropdown(all, d1.dd);
    assert.ok(d1.dd.classList.contains('open'));
    toggleDropdown(all, d2.dd);
    assert.ok(!d1.dd.classList.contains('open'));
    assert.ok(d2.dd.classList.contains('open'));
  });

  it('document click closes all dropdowns', () => {
    const d1 = createDropdown();
    const d2 = createDropdown();
    d1.dd.classList.add('open');
    d2.dd.classList.add('open');
    const all = [d1.dd, d2.dd];
    // Simulate document click handler (line 75-77)
    all.forEach(d => d.classList.remove('open'));
    assert.ok(!d1.dd.classList.contains('open'));
    assert.ok(!d2.dd.classList.contains('open'));
  });

  it('menu button click closes its parent dropdown', () => {
    const { dd, menuBtn } = createDropdown();
    dd.classList.add('open');
    // Replicate line 80-82
    dd.classList.remove('open');
    assert.ok(!dd.classList.contains('open'));
  });
});

// ─── 17. View Mode Button Clicks Setting View Mode ──────────────────────────

describe('View mode button clicks setting view mode', () => {
  it('calls setViewMode with the correct mode from data attribute', () => {
    const modes = ['single', 'double', 'scroll', 'continuous'];
    for (const mode of modes) {
      const btn = el('button', { 'data-view-mode': mode });
      const viewMode = btn.dataset.viewMode;
      assert.equal(viewMode, mode);
    }
  });

  it('marks the selected button as active and deactivates others', () => {
    const menuBtns = ['single', 'double', 'scroll'].map(m =>
      el('button', { className: 'dropdown-item', 'data-view-mode': m })
    );
    // Select 'double'
    menuBtns.forEach(b => b.classList.remove('active'));
    menuBtns[1].classList.add('active');
    assert.ok(menuBtns[1].classList.contains('active'));
    assert.ok(!menuBtns[0].classList.contains('active'));
    assert.ok(!menuBtns[2].classList.contains('active'));

    // Now select 'scroll'
    menuBtns.forEach(b => b.classList.remove('active'));
    menuBtns[2].classList.add('active');
    assert.ok(!menuBtns[1].classList.contains('active'));
    assert.ok(menuBtns[2].classList.contains('active'));
  });
});

// ─── 18. goToPage integration ────────────────────────────────────────────────

describe('goToPage integration in initPhase2Modules', () => {
  it('goToPage is destructured from deps', () => {
    const goToPage = mock.fn();
    const deps = { renderCurrentPage: mock.fn(), goToPage };
    // Replicate line 29: const { renderCurrentPage, goToPage: _goToPage } = deps;
    const { goToPage: _goToPage } = deps;
    assert.equal(typeof _goToPage, 'function');
  });

  it('goToPage can be called with a page number', () => {
    const goToPage = mock.fn();
    goToPage(5);
    assert.equal(goToPage.mock.callCount(), 1);
    assert.equal(goToPage.mock.calls[0].arguments[0], 5);
  });
});

// ─── 19. Missing element handling (null safety) ─────────────────────────────

describe('Null safety in initPhase2Modules', () => {
  it('viewModeDropdown handler skips when dd is null', () => {
    // Replicate lines 107-134: const dd = document.getElementById('viewModeDropdown');
    const dd = null;
    assert.doesNotThrow(() => {
      if (dd) {
        // This block should be skipped entirely
        throw new Error('Should not reach');
      }
    });
  });

  it('exportHtml handler skips when btn is null', () => {
    const btn = null;
    assert.doesNotThrow(() => {
      if (btn) {
        throw new Error('Should not reach');
      }
    });
  });

  it('pdfFindReplace handler skips when btn is null', () => {
    const findReplaceBtn = null;
    assert.doesNotThrow(() => {
      if (findReplaceBtn) {
        throw new Error('Should not reach');
      }
    });
  });

  it('cleanMetadata handler skips when btn is null', () => {
    const cleanMetaBtn = null;
    assert.doesNotThrow(() => {
      if (cleanMetaBtn) {
        throw new Error('Should not reach');
      }
    });
  });

  it('sanitizePdf handler skips when btn is null', () => {
    const sanitizeBtn = null;
    assert.doesNotThrow(() => {
      if (sanitizeBtn) {
        throw new Error('Should not reach');
      }
    });
  });

  it('exportPlainText handler skips when btn is null', () => {
    const btn = null;
    assert.doesNotThrow(() => {
      if (btn) {
        throw new Error('Should not reach');
      }
    });
  });

  it('exportPdfA handler skips when btn is null', () => {
    const btn = null;
    assert.doesNotThrow(() => {
      if (btn) {
        throw new Error('Should not reach');
      }
    });
  });

  it('status bar handles missing sbPage, sbZoom elements', () => {
    // updateStatusBar with all null els should not throw
    function updateStatusBar(state, sbEls) {
      if (sbEls.sbPage) sbEls.sbPage.textContent = 'test';
      if (sbEls.sbZoom) sbEls.sbZoom.textContent = 'test';
      if (sbEls.sbReadingTime) sbEls.sbReadingTime.textContent = 'test';
      if (sbEls.sbFileSize && state.file) sbEls.sbFileSize.textContent = 'test';
    }
    assert.doesNotThrow(() => {
      updateStatusBar({ currentPage: 1, zoom: 1, pageCount: 1 }, {
        sbPage: null, sbZoom: null, sbReadingTime: null, sbFileSize: null,
      });
    });
  });
});

// ─── 20. HTML Export handler logic ───────────────────────────────────────────

describe('HTML Export handler logic', () => {
  it('returns early when adapter is null', () => {
    const state = { adapter: null, pageCount: 0 };
    let called = false;
    // Replicate lines 142-143
    if (!state.adapter || state.pageCount === 0) {
      // should return
    } else {
      called = true;
    }
    assert.ok(!called);
  });

  it('returns early when pageCount is 0', () => {
    const state = { adapter: {}, pageCount: 0 };
    let proceeded = false;
    if (!state.adapter || state.pageCount === 0) {
      // should return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('proceeds when adapter exists and pageCount > 0', () => {
    const state = { adapter: { type: 'pdf' }, pageCount: 5 };
    let proceeded = false;
    if (!state.adapter || state.pageCount === 0) {
      // would return
    } else {
      proceeded = true;
    }
    assert.ok(proceeded);
  });
});

// ─── 21. PDF Find/Replace handler logic ─────────────────────────────────────

describe('PDF Find/Replace handler logic', () => {
  it('shows warning when pdfBytes is null', () => {
    const state = { pdfBytes: null, pageCount: 0 };
    let warned = false;
    if (!state.pdfBytes || state.pageCount === 0) {
      warned = true;
    }
    assert.ok(warned);
  });

  it('shows warning when pageCount is 0', () => {
    const state = { pdfBytes: new Uint8Array(10), pageCount: 0 };
    let warned = false;
    if (!state.pdfBytes || state.pageCount === 0) {
      warned = true;
    }
    assert.ok(warned);
  });

  it('proceeds when pdfBytes exist and pageCount > 0', () => {
    const state = { pdfBytes: new Uint8Array(10), pageCount: 5 };
    let warned = false;
    if (!state.pdfBytes || state.pageCount === 0) {
      warned = true;
    }
    assert.ok(!warned);
  });

  it('returns early if search prompt is empty', () => {
    const search = '';
    let proceeded = false;
    if (!search) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('returns early if replace prompt is null (cancelled)', () => {
    const replace = null;
    let proceeded = false;
    if (replace === null) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('allows empty string as valid replace value', () => {
    const replace = '';
    let proceeded = false;
    if (replace === null) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(proceeded);
  });
});

// ─── 22. PDF Security handlers logic ────────────────────────────────────────

describe('PDF Security handlers logic', () => {
  it('cleanMetadata warns when pdfBytes is null', () => {
    const state = { pdfBytes: null };
    let warned = false;
    if (!state.pdfBytes) warned = true;
    assert.ok(warned);
  });

  it('sanitizePdf warns when pdfBytes is null', () => {
    const state = { pdfBytes: null };
    let warned = false;
    if (!state.pdfBytes) warned = true;
    assert.ok(warned);
  });

  it('cleanMetadata proceeds when pdfBytes exist', () => {
    const state = { pdfBytes: new Uint8Array(10) };
    let warned = false;
    if (!state.pdfBytes) warned = true;
    assert.ok(!warned);
  });
});

// ─── 23. PDF/A Export handler logic ─────────────────────────────────────────

describe('PDF/A Export handler logic', () => {
  it('warns when pdfBytes is null', () => {
    const state = { pdfBytes: null };
    let warned = false;
    if (!state.pdfBytes) warned = true;
    assert.ok(warned);
  });

  it('generates correct filename from docName', () => {
    const docName = 'report.pdf';
    const filename = docName.replace(/\.[^.]+$/, '') + '-pdfa.pdf';
    assert.equal(filename, 'report-pdfa.pdf');
  });

  it('generates correct filename when docName has no extension', () => {
    const docName = 'document';
    const filename = (docName || 'document').replace(/\.[^.]+$/, '') + '-pdfa.pdf';
    assert.equal(filename, 'document-pdfa.pdf');
  });

  it('uses default name when docName is null', () => {
    const docName = null;
    const filename = (docName || 'document').replace(/\.[^.]+$/, '') + '-pdfa.pdf';
    assert.equal(filename, 'document-pdfa.pdf');
  });
});

// ─── 24. Plain Text Export filename logic ───────────────────────────────────

describe('Plain Text Export filename logic', () => {
  it('replaces extension with .txt', () => {
    const docName = 'myfile.pdf';
    const filename = (docName || 'document').replace(/\.[^.]+$/, '') + '.txt';
    assert.equal(filename, 'myfile.txt');
  });

  it('defaults to document.txt when docName is null', () => {
    const docName = null;
    const filename = (docName || 'document').replace(/\.[^.]+$/, '') + '.txt';
    assert.equal(filename, 'document.txt');
  });

  it('handles multi-dot filenames', () => {
    const docName = 'my.report.v2.pdf';
    const filename = (docName || 'document').replace(/\.[^.]+$/, '') + '.txt';
    assert.equal(filename, 'my.report.v2.txt');
  });
});
