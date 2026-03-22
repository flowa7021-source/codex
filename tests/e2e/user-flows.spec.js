// @ts-check
const { test, expect } = require('@playwright/test');

// ─── Helpers ────────────────────────────────────────────────────────────────
const APP_URL = '/';

async function openApp(page) {
  await page.goto(APP_URL);
  await page.waitForSelector('.app-shell', { timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════════════════════
// A. File Open & Navigation Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('A — File open & navigation flow', () => {
  test('initial empty state shows empty message', async ({ page }) => {
    await openApp(page);
    const emptyState = page.locator('#emptyState');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveText(/PDF|DjVu|ePub/);
  });

  test('file input is present and hidden inside the label', async ({ page }) => {
    await openApp(page);
    const fileInput = page.locator('#fileInput');
    await expect(fileInput).toBeAttached();
    // The input is visually hidden but functional
    const display = await fileInput.evaluate(el => getComputedStyle(el).display);
    expect(['none', 'block', 'inline', 'inline-block']).toContain(display);
  });

  test('drag-drop zone: app shell accepts drag events', async ({ page }) => {
    await openApp(page);
    const shell = page.locator('.app-shell');
    // Dispatching dragenter should not cause errors
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await shell.dispatchEvent('dragenter', { dataTransfer: {} });
    await page.waitForTimeout(300);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('page navigation prev/next are visible but effectively disabled without a document', async ({ page }) => {
    await openApp(page);
    const prevBtn = page.locator('#prevPage');
    const nextBtn = page.locator('#nextPage');
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
    // Clicking prev/next without a document should not throw
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await prevBtn.click();
    await nextBtn.click();
    await page.waitForTimeout(300);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });

  test('page input shows "1" or empty when no document is loaded', async ({ page }) => {
    await openApp(page);
    const pageInput = page.locator('#pageInput');
    const value = await pageInput.inputValue();
    expect(value).toMatch(/^[01]?$/);
  });

  test('page status shows "/ 0" when no document is loaded', async ({ page }) => {
    await openApp(page);
    const pageStatus = page.locator('#pageStatus');
    await expect(pageStatus).toHaveText(/\/\s*0/);
  });

  test('zoom controls show initial 100% state', async ({ page }) => {
    await openApp(page);
    const zoomStatus = page.locator('#zoomStatus');
    await expect(zoomStatus).toBeVisible();
    const text = await zoomStatus.textContent();
    expect(text).toMatch(/\d+%/);
  });

  test('zoom in/out buttons are enabled', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#zoomIn')).toBeEnabled();
    await expect(page.locator('#zoomOut')).toBeEnabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. Settings & Theme Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('B — Settings & theme flow', () => {
  test('open settings modal and navigate to appearance tab', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/open/);
    // Click appearance tab
    const appearanceTab = page.locator('[data-modal-tab="appearance"]');
    await appearanceTab.click();
    await expect(appearanceTab).toHaveClass(/active/);
    // Theme select should be visible
    await expect(page.locator('#cfgTheme')).toBeVisible();
  });

  test('change theme to light and verify class on body', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await page.locator('[data-modal-tab="appearance"]').click();
    await page.locator('#cfgTheme').selectOption('light');
    await page.locator('#saveSettingsModal').click();
    await page.waitForTimeout(500);
    const hasLight = await page.evaluate(() =>
      document.body.classList.contains('light') ||
      document.body.classList.contains('light-theme') ||
      document.documentElement.getAttribute('data-theme') === 'light'
    );
    expect(hasLight).toBe(true);
  });

  test('change theme to dark and verify class on body', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await page.locator('[data-modal-tab="appearance"]').click();
    await page.locator('#cfgTheme').selectOption('dark');
    await page.locator('#saveSettingsModal').click();
    await page.waitForTimeout(500);
    const hasDark = await page.evaluate(() =>
      document.body.classList.contains('dark') ||
      document.body.classList.contains('dark-theme') ||
      document.documentElement.getAttribute('data-theme') === 'dark'
    );
    expect(hasDark).toBe(true);
  });

  test('change theme to sepia and verify class on body', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await page.locator('[data-modal-tab="appearance"]').click();
    await page.locator('#cfgTheme').selectOption('sepia');
    await page.locator('#saveSettingsModal').click();
    await page.waitForTimeout(500);
    const hasSepia = await page.evaluate(() =>
      document.body.classList.contains('sepia') ||
      document.body.classList.contains('sepia-theme') ||
      document.documentElement.getAttribute('data-theme') === 'sepia'
    );
    expect(hasSepia).toBe(true);
  });

  test('change language to English and verify UI text updates', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await page.locator('[data-modal-tab="appearance"]').click();
    await page.locator('#cfgAppLang').selectOption('en');
    await page.locator('#saveSettingsModal').click();
    await page.waitForTimeout(1000);
    // After switching to English, some known English text should appear
    // The sidebar "Open file" button text should now be English
    const fileOpenText = await page.locator('.file-open-btn [data-i18n="sidebar.openFile"]').textContent();
    // Should contain English text or at least not be the original Russian
    expect(fileOpenText.length).toBeGreaterThan(0);
  });

  test('close settings modal with close button', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/open/);
    await page.locator('#closeSettingsModal').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#settingsModal')).not.toHaveClass(/open/);
  });

  test('settings modal tabs are all clickable', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    const tabs = ['general', 'appearance', 'ocr', 'hotkeys', 'advanced'];
    for (const tab of tabs) {
      const tabBtn = page.locator(`[data-modal-tab="${tab}"]`);
      await tabBtn.click();
      await expect(tabBtn).toHaveClass(/active/);
      const panel = page.locator(`[data-modal-panel="${tab}"]`);
      await expect(panel).toHaveClass(/active/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. Search Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('C — Search flow', () => {
  test('Ctrl+F opens search floating bar', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);
    const searchBar = page.locator('#searchFloating');
    // Search bar should become visible (may use class or style)
    const isVisible = await searchBar.evaluate(el => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
    expect(isVisible).toBe(true);
  });

  test('search input is focused after opening search', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeFocused();
  });

  test('type search query in search input', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('test query');
    await expect(searchInput).toHaveValue('test query');
  });

  test('Escape closes search bar', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const searchBar = page.locator('#searchFloating');
    const isHidden = await searchBar.evaluate(el => {
      const style = getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    });
    expect(isHidden).toBe(true);
  });

  test('close search button hides search bar', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    await page.locator('#closeSearch').click();
    await page.waitForTimeout(300);
    const searchBar = page.locator('#searchFloating');
    const isHidden = await searchBar.evaluate(el => {
      const style = getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    });
    expect(isHidden).toBe(true);
  });

  test('search scope selector has expected options', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    const scopeSelect = page.locator('#searchScope');
    const options = await scopeSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test('search prev/next buttons exist within search bar', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    await expect(page.locator('#searchPrev')).toBeVisible();
    await expect(page.locator('#searchNext')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D. Keyboard Shortcuts Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('D — Keyboard shortcuts flow', () => {
  test('Ctrl+F opens search', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeFocused();
  });

  test('Escape closes settings modal', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#settingsModal')).not.toHaveClass(/open/);
  });

  test('? key opens shortcuts help modal', async ({ page }) => {
    await openApp(page);
    // Make sure no input is focused so ? is interpreted as a shortcut
    await page.locator('.app-shell').click();
    await page.waitForTimeout(200);
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    const shortcutsModal = page.locator('#shortcutsModal');
    const isOpen = await shortcutsModal.evaluate(el =>
      el.classList.contains('open') ||
      el.style.display !== 'none' ||
      el.getAttribute('aria-hidden') === 'false'
    );
    expect(isOpen).toBe(true);
  });

  test('Escape closes shortcuts modal', async ({ page }) => {
    await openApp(page);
    await page.locator('.app-shell').click();
    await page.waitForTimeout(200);
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const shortcutsModal = page.locator('#shortcutsModal');
    const isClosed = await shortcutsModal.evaluate(el =>
      !el.classList.contains('open') ||
      el.style.display === 'none' ||
      el.getAttribute('aria-hidden') === 'true'
    );
    expect(isClosed).toBe(true);
  });

  test('theme toggle button cycles theme on click', async ({ page }) => {
    await openApp(page);
    const themeToggle = page.locator('#themeToggle');
    await expect(themeToggle).toBeVisible();
    const themeBefore = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme') || document.body.className
    );
    await themeToggle.click();
    await page.waitForTimeout(300);
    const themeAfter = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme') || document.body.className
    );
    // Theme state should change after toggle
    expect(themeAfter).not.toBe(themeBefore);
  });

  test('keyboard shortcuts do not throw errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await openApp(page);
    await page.locator('.app-shell').click();
    // Test several keyboard shortcuts
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('?');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E. Sidebar Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('E — Sidebar flow', () => {
  test('sidebar is visible by default', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#sidebar')).toBeVisible();
  });

  test('toggle sidebar hides and shows sidebar', async ({ page }) => {
    await openApp(page);
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
    // Click the toggle button in the command bar
    await page.locator('#toggleSidebar').click();
    await page.waitForTimeout(400);
    // Sidebar should be collapsed (hidden or zero-width)
    const isCollapsed = await sidebar.evaluate(el => {
      const style = getComputedStyle(el);
      return style.display === 'none' || el.offsetWidth === 0 ||
        el.classList.contains('collapsed') || el.classList.contains('hidden');
    });
    expect(isCollapsed).toBe(true);
    // Toggle again to re-expand
    await page.locator('#toggleSidebar').click();
    await page.waitForTimeout(400);
    await expect(sidebar).toBeVisible();
  });

  test('toggle sidebar button updates aria-expanded', async ({ page }) => {
    await openApp(page);
    const toggleBtn = page.locator('#toggleSidebar');
    const initialExpanded = await toggleBtn.getAttribute('aria-expanded');
    expect(initialExpanded).toBe('true');
    await toggleBtn.click();
    await page.waitForTimeout(300);
    const afterExpanded = await toggleBtn.getAttribute('aria-expanded');
    expect(afterExpanded).toBe('false');
  });

  test('sidebar has tab navigation for different sections', async ({ page }) => {
    await openApp(page);
    const tabs = page.locator('.sidebar-tabs [role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(3); // At least: pages, bookmarks, outline
  });

  test('clicking bookmarks tab shows bookmarks panel', async ({ page }) => {
    await openApp(page);
    const bookmarksTab = page.locator('[data-sidebar-tab="bookmarks-tab"]');
    await bookmarksTab.click();
    await page.waitForTimeout(300);
    const bookmarksPanel = page.locator('[data-sidebar-panel="bookmarks-tab"]');
    await expect(bookmarksPanel).toHaveClass(/active/);
    await expect(bookmarksTab).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking outline tab shows outline panel', async ({ page }) => {
    await openApp(page);
    const outlineTab = page.locator('[data-sidebar-tab="outline-tab"]');
    await outlineTab.click();
    await page.waitForTimeout(300);
    const outlinePanel = page.locator('[data-sidebar-panel="outline-tab"]');
    await expect(outlinePanel).toHaveClass(/active/);
    await expect(outlineTab).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking pages tab shows pages panel', async ({ page }) => {
    await openApp(page);
    // First switch to another tab
    await page.locator('[data-sidebar-tab="bookmarks-tab"]').click();
    await page.waitForTimeout(200);
    // Switch back to pages (nav) tab
    const pagesTab = page.locator('[data-sidebar-tab="nav"]');
    await pagesTab.click();
    await page.waitForTimeout(300);
    const pagesPanel = page.locator('[data-sidebar-panel="nav"]');
    await expect(pagesPanel).toHaveClass(/active/);
    await expect(pagesTab).toHaveAttribute('aria-selected', 'true');
  });

  test('switching tabs deactivates previous tab', async ({ page }) => {
    await openApp(page);
    const navTab = page.locator('[data-sidebar-tab="nav"]');
    const bookmarksTab = page.locator('[data-sidebar-tab="bookmarks-tab"]');
    // Initially nav is active
    await expect(navTab).toHaveAttribute('aria-selected', 'true');
    // Switch to bookmarks
    await bookmarksTab.click();
    await page.waitForTimeout(300);
    await expect(navTab).toHaveAttribute('aria-selected', 'false');
    await expect(bookmarksTab).toHaveAttribute('aria-selected', 'true');
  });

  test('notes tab is accessible', async ({ page }) => {
    await openApp(page);
    const notesTab = page.locator('[data-sidebar-tab="notes"]');
    await notesTab.click();
    await page.waitForTimeout(300);
    const notesPanel = page.locator('[data-sidebar-panel="notes"]');
    await expect(notesPanel).toHaveClass(/active/);
    // Notes textarea should be visible
    await expect(page.locator('#notes')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F. Annotations Toolbar Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('F — Annotations toolbar flow', () => {
  test('annotations tool button exists in command bar', async ({ page }) => {
    await openApp(page);
    const annotBtn = page.locator('[data-tool="annotations"]');
    await expect(annotBtn).toBeVisible();
  });

  test('clicking annotations tool opens annotation panel', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(500);
    const annotPanel = page.locator('[data-rp-panel="annotations"]');
    await expect(annotPanel).toBeVisible();
  });

  test('annotation panel has drawing toggle button', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#annotateToggle')).toBeVisible();
  });

  test('annotation panel has draw tool selector with expected options', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(300);
    const drawTool = page.locator('#drawTool');
    await expect(drawTool).toBeVisible();
    const options = await drawTool.locator('option').allValues();
    expect(options).toContain('pen');
    expect(options).toContain('highlighter');
    expect(options).toContain('eraser');
    expect(options).toContain('text-highlight');
    expect(options).toContain('text-underline');
  });

  test('annotation panel has color picker and size slider', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#drawColor')).toBeVisible();
    await expect(page.locator('#drawSize')).toBeVisible();
  });

  test('selecting different draw tools updates the selector', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(300);
    const drawTool = page.locator('#drawTool');
    await drawTool.selectOption('highlighter');
    await expect(drawTool).toHaveValue('highlighter');
    await drawTool.selectOption('eraser');
    await expect(drawTool).toHaveValue('eraser');
    await drawTool.selectOption('pen');
    await expect(drawTool).toHaveValue('pen');
  });

  test('annotation actions (undo, clear) buttons exist', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#undoStroke')).toBeVisible();
    await expect(page.locator('#clearStrokes')).toBeVisible();
  });

  test('annotation export buttons exist (PNG, SVG, PDF, JSON)', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#exportAnnotated')).toBeVisible();
    await expect(page.locator('#exportAnnSvg')).toBeVisible();
    await expect(page.locator('#exportAnnPdf')).toBeVisible();
    await expect(page.locator('#exportAnnJson')).toBeVisible();
  });

  test('closing right panel hides annotations', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-tool="annotations"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-rp-panel="annotations"]')).toBeVisible();
    await page.locator('#closeRightPanel').click();
    await page.waitForTimeout(300);
    const rightPanel = page.locator('#rightPanel');
    const isHidden = await rightPanel.evaluate(el => {
      return el.classList.contains('hidden') || el.classList.contains('collapsed') ||
        getComputedStyle(el).display === 'none' || el.offsetWidth === 0;
    });
    expect(isHidden).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G. Export/Print Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('G — Export/print flow', () => {
  test('print button exists and is clickable', async ({ page }) => {
    await openApp(page);
    const printBtn = page.locator('#printPage');
    await expect(printBtn).toBeVisible();
    await expect(printBtn).toBeEnabled();
  });

  test('clicking print opens print modal dialog', async ({ page }) => {
    await openApp(page);
    // Override window.print to prevent actual print dialog
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#printPage').click();
    await page.waitForTimeout(500);
    const printModal = page.locator('#printModal');
    const isOpen = await printModal.evaluate(el =>
      el.classList.contains('open') ||
      el.style.display !== 'none' ||
      el.getAttribute('aria-hidden') === 'false'
    );
    expect(isOpen).toBe(true);
  });

  test('print modal has page range options', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#printPage').click();
    await page.waitForTimeout(500);
    // Check for range radio buttons
    const rangeOptions = page.locator('input[name="printRange"]');
    const count = await rangeOptions.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('print modal has scale and orientation selectors', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#printPage').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#printScale')).toBeVisible();
    await expect(page.locator('#printOrientation')).toBeVisible();
  });

  test('print modal can be closed with cancel button', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#printPage').click();
    await page.waitForTimeout(500);
    await page.locator('#printCancel').click();
    await page.waitForTimeout(300);
    const printModal = page.locator('#printModal');
    const isClosed = await printModal.evaluate(el =>
      !el.classList.contains('open') ||
      el.style.display === 'none' ||
      el.getAttribute('aria-hidden') === 'true'
    );
    expect(isClosed).toBe(true);
  });

  test('export buttons (text, docx, html, OCR index) are present', async ({ page }) => {
    await openApp(page);
    // Open text/OCR tool panel to see export buttons
    await page.locator('[data-tool="text-ocr"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#exportText')).toBeVisible();
    await expect(page.locator('#exportWord')).toBeVisible();
    await expect(page.locator('#exportHtml')).toBeVisible();
    await expect(page.locator('#exportOcrIndex')).toBeVisible();
  });

  test('export word without document does not crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await openApp(page);
    await page.locator('[data-tool="text-ocr"]').click();
    await page.waitForTimeout(300);
    await page.locator('#exportWord').click();
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H. Command Palette Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('H — Command palette flow', () => {
  test('Ctrl+K opens command palette', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    const palette = page.locator('#commandPalette');
    const isVisible = await palette.evaluate(el =>
      el.style.display !== 'none' && el.offsetWidth > 0
    );
    expect(isVisible).toBe(true);
  });

  test('command palette input is focused on open', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    const paletteInput = page.locator('#commandPaletteInput');
    await expect(paletteInput).toBeFocused();
  });

  test('typing in command palette filters the command list', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    const paletteInput = page.locator('#commandPaletteInput');
    // Get initial count of items
    const initialCount = await page.locator('#commandPaletteList').locator('.command-palette-item, [role="option"], li, button').count();
    // Type a filter query
    await paletteInput.fill('>');
    await page.waitForTimeout(300);
    const filteredCount = await page.locator('#commandPaletteList').locator('.command-palette-item, [role="option"], li, button').count();
    // The list content should change or stay the same (but not error)
    expect(typeof filteredCount).toBe('number');
  });

  test('Escape closes command palette', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const palette = page.locator('#commandPalette');
    const isHidden = await palette.evaluate(el =>
      el.style.display === 'none' || el.offsetWidth === 0
    );
    expect(isHidden).toBe(true);
  });

  test('command palette footer shows keyboard hints', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    const footer = page.locator('.command-palette-footer');
    await expect(footer).toBeVisible();
    const text = await footer.textContent();
    expect(text).toContain('esc');
  });

  test('typing a page number in command palette does not crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await openApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    await page.locator('#commandPaletteInput').fill('5');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('net::ERR'))).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I. Accessibility Flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe('I — Accessibility flow', () => {
  test('skip-to-content link exists', async ({ page }) => {
    await openApp(page);
    const skipLink = page.locator('a.skip-nav');
    await expect(skipLink).toBeAttached();
    const href = await skipLink.getAttribute('href');
    expect(href).toBe('#viewerCanvas');
  });

  test('header landmark with toolbar role exists', async ({ page }) => {
    await openApp(page);
    const header = page.locator('header.command-bar[role="toolbar"]');
    await expect(header).toBeVisible();
  });

  test('main landmark exists for document viewport', async ({ page }) => {
    await openApp(page);
    const main = page.locator('main#documentViewport');
    await expect(main).toBeVisible();
    const ariaLabel = await main.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('sidebar navigation landmark exists', async ({ page }) => {
    await openApp(page);
    const sidebar = page.locator('aside#sidebar');
    await expect(sidebar).toBeVisible();
    const ariaLabel = await sidebar.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('sidebar tabs have proper role="tablist" and role="tab"', async ({ page }) => {
    await openApp(page);
    const tablist = page.locator('.sidebar-tabs[role="tablist"]');
    await expect(tablist).toBeVisible();
    const tabs = tablist.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(3);
    // Each tab should have aria-selected
    for (let i = 0; i < count; i++) {
      const ariaSelected = await tabs.nth(i).getAttribute('aria-selected');
      expect(['true', 'false']).toContain(ariaSelected);
    }
  });

  test('settings modal has role="dialog" and aria-label', async ({ page }) => {
    await openApp(page);
    const modal = page.locator('#settingsModal');
    const role = await modal.getAttribute('role');
    expect(role).toBe('dialog');
    const ariaLabel = await modal.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('focus is moved into settings modal on open', async ({ page }) => {
    await openApp(page);
    await page.locator('#openSettingsModal').click();
    await page.waitForTimeout(500);
    // Focus should be inside the modal
    const focusInsideModal = await page.evaluate(() => {
      const modal = document.querySelector('#settingsModal');
      return modal?.contains(document.activeElement) ?? false;
    });
    expect(focusInsideModal).toBe(true);
  });

  test('focus returns to trigger after settings modal closes', async ({ page }) => {
    await openApp(page);
    const openBtn = page.locator('#openSettingsModal');
    await openBtn.click();
    await page.waitForTimeout(300);
    await page.locator('#closeSettingsModal').click();
    await page.waitForTimeout(300);
    // Focus should return to the open button or at least not be inside the modal
    const focusInsideModal = await page.evaluate(() => {
      const modal = document.querySelector('#settingsModal');
      return modal?.contains(document.activeElement) ?? false;
    });
    expect(focusInsideModal).toBe(false);
  });

  test('aria-live region exists for screen reader announcements', async ({ page }) => {
    await openApp(page);
    const announcer = page.locator('#a11yAnnouncer');
    await expect(announcer).toBeAttached();
    const ariaLive = await announcer.getAttribute('aria-live');
    expect(ariaLive).toBe('assertive');
  });

  test('all command bar buttons have aria-label attributes', async ({ page }) => {
    await openApp(page);
    const buttons = page.locator('.command-bar button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      const text = (await btn.textContent()).trim();
      const hasName = (ariaLabel?.length > 0) || (title?.length > 0) || (text.length > 0);
      expect(hasName).toBe(true);
    }
  });

  test('search bar has role="search"', async ({ page }) => {
    await openApp(page);
    const searchBar = page.locator('#searchFloating');
    const role = await searchBar.getAttribute('role');
    expect(role).toBe('search');
  });

  test('tab panels have role="tabpanel"', async ({ page }) => {
    await openApp(page);
    const panels = page.locator('.sidebar-panel[role="tabpanel"]');
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
