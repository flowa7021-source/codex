// @ts-check
const { test, expect } = require('@playwright/test');

// ─── Helpers ────────────────────────────────────────────────────────────────
const APP_URL = '/';

async function openApp(page) {
  await page.goto(APP_URL);
  await page.waitForSelector('.app-shell', { timeout: 10_000 });
}

async function uploadTestFile(page, filePath) {
  const input = page.locator('#fileInput');
  await input.setInputFiles(filePath);
  await page.waitForTimeout(1500);
}

// ─── 1. Application Startup ────────────────────────────────────────────────
test.describe('01 — Application startup', () => {
  test('loads the app shell and sidebar', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.sidebar h1')).toHaveText('NovaReader');
  });

  test('displays version info', async ({ page }) => {
    await openApp(page);
    const version = page.locator('#appVersion');
    await expect(version).toBeVisible();
    await expect(version).not.toHaveText('Version: —');
  });

  test('has no console errors on startup', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await openApp(page);
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ─── 2. File Open ──────────────────────────────────────────────────────────
test.describe('02 — File opening', () => {
  test('upload button is visible and interactive', async ({ page }) => {
    await openApp(page);
    const uploadBtn = page.locator('.file-open-btn').first();
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toBeEnabled();
  });

  test('shows file input accepting correct types', async ({ page }) => {
    await openApp(page);
    const input = page.locator('#fileInput');
    const accept = await input.getAttribute('accept');
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.djvu');
    expect(accept).toContain('.png');
  });
});

// ─── 3. Navigation ─────────────────────────────────────────────────────────
test.describe('03 — Page navigation', () => {
  test('page controls exist', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#prevPage')).toBeVisible();
    await expect(page.locator('#nextPage')).toBeVisible();
    await expect(page.locator('#pageInput')).toBeVisible();
  });
});

// ─── 4. Zoom & Rotation ───────────────────────────────────────────────────
test.describe('04 — Zoom and rotation', () => {
  test('zoom controls exist', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#zoomIn')).toBeVisible();
    await expect(page.locator('#zoomOut')).toBeVisible();
    await expect(page.locator('#fitWidth')).toBeVisible();
    await expect(page.locator('#fitPage')).toBeVisible();
  });

  test('rotation control exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#rotate')).toBeVisible();
  });
});

// ─── 5. Sidebar Sections ──────────────────────────────────────────────────
test.describe('05 — Sidebar sections', () => {
  test('bookmarks section exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('[data-sidebar-section="bookmarks"]')).toBeVisible();
  });

  test('recent files section exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('[data-sidebar-section="recent"]')).toBeVisible();
  });

  test('outline section exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('[data-sidebar-section="outline"]')).toBeVisible();
  });

  test('page previews section exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('[data-sidebar-section="previews"]')).toBeVisible();
  });
});

// ─── 6. Bookmarks ──────────────────────────────────────────────────────────
test.describe('06 — Bookmarks', () => {
  test('add bookmark button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#addBookmark')).toBeVisible();
  });

  test('bookmark filter input exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#bookmarkFilter')).toBeVisible();
  });
});

// ─── 7. Text Extraction ───────────────────────────────────────────────────
test.describe('07 — Text tools', () => {
  test('text panel exists with textarea', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#pageText')).toBeVisible();
  });

  test('text action buttons exist', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#refreshText')).toBeVisible();
    await expect(page.locator('#copyText')).toBeVisible();
    await expect(page.locator('#exportText')).toBeVisible();
  });
});

// ─── 8. OCR Controls ──────────────────────────────────────────────────────
test.describe('08 — OCR controls', () => {
  test('OCR buttons exist', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#ocrCurrentPage')).toBeVisible();
    await expect(page.locator('#ocrRegionMode')).toBeVisible();
    await expect(page.locator('#copyOcrText')).toBeVisible();
    await expect(page.locator('#cancelBackgroundOcr')).toBeVisible();
  });

  test('OCR status label exists', async ({ page }) => {
    await openApp(page);
    const status = page.locator('#ocrStatus');
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/OCR/);
  });
});

// ─── 9. Export ─────────────────────────────────────────────────────────────
test.describe('09 — Export features', () => {
  test('export DOCX button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#exportWord')).toBeVisible();
  });

  test('export OCR index button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#exportOcrIndex')).toBeVisible();
  });

  test('import DOCX input exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#importDocx')).toBeAttached();
  });
});

// ─── 10. Text Editing ─────────────────────────────────────────────────────
test.describe('10 — Text editing mode', () => {
  test('toggle text edit button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#toggleTextEdit')).toBeVisible();
  });

  test('undo/redo buttons exist', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#undoTextEdit')).toBeVisible();
    await expect(page.locator('#redoTextEdit')).toBeVisible();
  });

  test('save text edits button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#saveTextEdits')).toBeVisible();
  });
});

// ─── 11. Settings Modal ───────────────────────────────────────────────────
test.describe('11 — Settings modal', () => {
  test('open settings modal via button', async ({ page }) => {
    await openApp(page);
    const openBtn = page.locator('#openSettingsModal');
    await openBtn.click();
    await expect(page.locator('#settingsModal')).toHaveClass(/open/);
  });

  test('close settings modal', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await page.locator('#closeSettingsModal').click();
    await expect(page.locator('#settingsModal')).not.toHaveClass(/open/);
  });
});

// ─── 12. Theme Toggle ─────────────────────────────────────────────────────
test.describe('12 — Theme', () => {
  test('body starts in dark mode by default', async ({ page }) => {
    await openApp(page);
    const isLight = await page.evaluate(() => document.body.classList.contains('light'));
    expect(isLight).toBe(false);
  });
});

// ─── 13. Search ────────────────────────────────────────────────────────────
test.describe('13 — Search', () => {
  test('search input exists', async ({ page }) => {
    await openApp(page);
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeAttached();
  });
});

// ─── 14. Annotations ──────────────────────────────────────────────────────
test.describe('14 — Annotation tools', () => {
  test('annotation canvas exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#annotationCanvas')).toBeAttached();
  });
});

// ─── 15. Crash Telemetry ──────────────────────────────────────────────────
test.describe('15 — Session health', () => {
  test('health report export button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#exportHealthReport')).toBeVisible();
  });

  test('crash telemetry is initialized on load', async ({ page }) => {
    await openApp(page);
    const hasSessionId = await page.evaluate(() => {
      return typeof crashTelemetry !== 'undefined' && typeof crashTelemetry.sessionId === 'string';
    });
    expect(hasSessionId).toBe(true);
  });
});

// ─── 16. Keyboard Shortcuts ───────────────────────────────────────────────
test.describe('16 — Keyboard shortcuts', () => {
  test('Escape closes settings modal', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#settingsModal')).not.toHaveClass(/open/);
  });
});

// ─── 17. Responsive Layout ────────────────────────────────────────────────
test.describe('17 — Responsive layout', () => {
  test('sidebar collapses on narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await openApp(page);
    const grid = page.locator('.app-shell');
    const columns = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(columns).not.toContain('240px');
  });
});

// ─── 18. Advanced Panels Toggle ───────────────────────────────────────────
test.describe('18 — Advanced panels', () => {
  test('toggle advanced panels button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#toggleAdvancedPanels')).toBeVisible();
  });
});

// ─── 19. Workspace Backup ─────────────────────────────────────────────────
test.describe('19 — Workspace', () => {
  test('print page button exists', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#printPage')).toBeVisible();
  });
});

// ─── 20. Performance Baseline ─────────────────────────────────────────────
test.describe('20 — Performance', () => {
  test('app loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await openApp(page);
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test('no long tasks blocking the main thread on idle', async ({ page }) => {
    await openApp(page);
    const longTasks = await page.evaluate(() => {
      return new Promise(resolve => {
        const tasks = [];
        const observer = new PerformanceObserver(list => {
          tasks.push(...list.getEntries());
        });
        try { observer.observe({ type: 'longtask', buffered: true }); } catch { /* not supported */ }
        setTimeout(() => { observer.disconnect(); resolve(tasks.length); }, 2000);
      });
    });
    expect(longTasks).toBeLessThan(5);
  });
});

// ─── 21. OCR Search Index ─────────────────────────────────────────────────
test.describe('21 — OCR search index', () => {
  test('ocrSearchIndex is initialized as empty', async ({ page }) => {
    await openApp(page);
    const indexSize = await page.evaluate(() => ocrSearchIndex.pages.size);
    expect(indexSize).toBe(0);
  });

  test('searchOcrIndex returns empty for no data', async ({ page }) => {
    await openApp(page);
    const results = await page.evaluate(() => searchOcrIndex('test'));
    expect(results).toHaveLength(0);
  });
});

// ─── 22. Memory & Cleanup ─────────────────────────────────────────────────
test.describe('22 — Memory management', () => {
  test('page render cache is accessible', async ({ page }) => {
    await openApp(page);
    const cacheExists = await page.evaluate(() => typeof pageRenderCache !== 'undefined');
    expect(cacheExists).toBe(true);
  });

  test('object URL registry is accessible', async ({ page }) => {
    await openApp(page);
    const registryExists = await page.evaluate(() => typeof objectUrlRegistry !== 'undefined');
    expect(registryExists).toBe(true);
  });
});
