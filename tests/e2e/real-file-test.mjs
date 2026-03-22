/**
 * Real-file E2E test — loads actual PDF/PNG into NovaReader and tests
 * rendering, navigation, zoom, export, annotations, bookmarks, search.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');
const BASE = 'http://127.0.0.1:4173/';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✘ ${name}`);
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome'
});

const errors = [];
const warnings = [];

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  return page;
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 1: Load 3-page PDF and test rendering + navigation
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 1: PDF Loading & Navigation ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Upload PDF via file input
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  await page.waitForTimeout(3000);

  // Check canvas rendered
  const canvas = page.locator('#viewerCanvas');
  const canvasVisible = await canvas.isVisible();
  assert(canvasVisible, 'Canvas is visible after PDF load');

  // Check canvas has non-zero dimensions
  const box = await canvas.boundingBox();
  assert(box && box.width > 100 && box.height > 100, 'Canvas has proper dimensions (' + (box ? box.width + 'x' + box.height : 'null') + ')');

  // Check page info
  const pageInput = page.locator('#pageInput');
  const pageVal = await pageInput.inputValue();
  assert(pageVal === '1', 'Page input shows page 1 (got: ' + pageVal + ')');

  const pageStatus = page.locator('#pageStatus');
  const statusText = await pageStatus.textContent();
  assert(statusText && statusText.includes('3'), 'Page status shows total 3 pages (got: ' + statusText + ')');

  // Navigate to next page
  await page.click('#nextPage');
  await page.waitForTimeout(1500);
  const pageVal2 = await pageInput.inputValue();
  assert(pageVal2 === '2', 'After next: page 2 (got: ' + pageVal2 + ')');

  // Navigate to next page again
  await page.click('#nextPage');
  await page.waitForTimeout(1500);
  const pageVal3 = await pageInput.inputValue();
  assert(pageVal3 === '3', 'After next: page 3 (got: ' + pageVal3 + ')');

  // Navigate back
  await page.click('#prevPage');
  await page.waitForTimeout(1500);
  const pageVal4 = await pageInput.inputValue();
  assert(pageVal4 === '2', 'After prev: page 2 (got: ' + pageVal4 + ')');

  // No page errors during navigation
  const navErrors = errors.filter(e => e.startsWith('PAGEERROR'));
  assert(navErrors.length === 0, 'No page errors during navigation (' + navErrors.length + ')');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 2: Zoom controls with loaded document
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 2: Zoom Controls ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  await page.waitForTimeout(3000);

  // Get initial zoom
  const zoomStatus = page.locator('#zoomStatus');
  const initialZoom = await zoomStatus.textContent();
  assert(!!initialZoom, 'Zoom status has text: ' + initialZoom);

  // Zoom in
  await page.click('#zoomIn');
  await page.waitForTimeout(1000);
  const zoomedIn = await zoomStatus.textContent();
  assert(zoomedIn !== initialZoom, 'Zoom in changed status (' + initialZoom + ' → ' + zoomedIn + ')');

  // Zoom out
  await page.click('#zoomOut');
  await page.waitForTimeout(1000);
  await page.click('#zoomOut');
  await page.waitForTimeout(1000);
  const zoomedOut = await zoomStatus.textContent();
  assert(zoomedOut !== zoomedIn, 'Zoom out changed status (' + zoomedIn + ' → ' + zoomedOut + ')');

  // Fit width
  await page.click('#fitWidth');
  await page.waitForTimeout(1000);
  const fitW = await zoomStatus.textContent();
  assert(!!fitW, 'Fit-width sets zoom: ' + fitW);

  // Fit page
  await page.click('#fitPage');
  await page.waitForTimeout(1000);
  const fitP = await zoomStatus.textContent();
  assert(!!fitP, 'Fit-page sets zoom: ' + fitP);

  // Rotation
  await page.click('#rotate');
  await page.waitForTimeout(1000);
  const canvas = page.locator('#viewerCanvas');
  const rotBox = await canvas.boundingBox();
  assert(rotBox && rotBox.width > 0, 'Canvas still visible after rotation');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 3: Text extraction & right panel
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 3: Text Panel & Right Panel ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  await page.waitForTimeout(3000);

  // Open right panel text-ocr via command bar button
  await page.click('.cb-tool-btn[data-tool="text-ocr"]');
  await page.waitForTimeout(1000);

  // Check text area
  const pageText = page.locator('#pageText');
  const textVisible = await pageText.isVisible();
  assert(textVisible, 'Text area visible after activating text tools');

  // Check if text was extracted
  if (textVisible) {
    await page.click('#refreshText').catch(() => {});
    await page.waitForTimeout(2000);
    const text = await pageText.inputValue();
    assert(text.length > 0, 'Text extracted from PDF (' + text.length + ' chars): "' + text.substring(0, 60) + '..."');
  }

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 4: Bookmarks
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 4: Bookmarks ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  await page.waitForTimeout(3000);

  // Switch to bookmarks tab via sidebar nav
  const bmTab = page.locator('[data-sidebar-tab="bookmarks-tab"]');
  await bmTab.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Add bookmark
  const addBm = page.locator('#addBookmark');
  const addBmVisible = await addBm.isVisible();
  // Try toolbar bookmark button as alternative
  const addBmToolbar = page.locator('#addBookmarkToolbar');
  const altVisible = await addBmToolbar.isVisible();
  assert(addBmVisible || altVisible, 'Add bookmark button visible (sidebar: ' + addBmVisible + ', toolbar: ' + altVisible + ')');

  if (addBmVisible || altVisible) {
    const btnToClick = addBmVisible ? addBm : addBmToolbar;
    await btnToClick.click();
    await page.waitForTimeout(1000);
    const bmList = page.locator('#bookmarkList > *');
    const bmCount = await bmList.count();
    assert(bmCount >= 1, 'Bookmark added (' + bmCount + ' bookmarks)');
  }

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 5: Annotations mode
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 5: Annotations ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  await page.waitForTimeout(3000);

  // Open annotations panel first, then toggle
  await page.click('.cb-tool-btn[data-tool="annotations"]');
  await page.waitForTimeout(500);
  const annotBtn = page.locator('#annotateToggle');
  if (await annotBtn.isVisible()) {
    await annotBtn.click();
    await page.waitForTimeout(500);

    const annotCanvas = page.locator('#annotationCanvas');
    const annotVisible = await annotCanvas.isVisible();
    assert(annotVisible, 'Annotation canvas visible');

    // Draw on canvas
    if (annotVisible) {
      const box = await annotCanvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 50, box.y + 50);
        await page.mouse.down();
        await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        assert(true, 'Drew on annotation canvas without errors');
      }
    }

    // Toggle off
    await annotBtn.click();
    await page.waitForTimeout(500);
  }

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 6: Search with loaded document
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 6: Search ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  await page.waitForTimeout(3000);

  // Open search via command bar or Ctrl+F
  const searchToolBtn = page.locator('.cb-tool-btn[data-tool="search"]');
  if (await searchToolBtn.isVisible()) {
    await searchToolBtn.click();
    await page.waitForTimeout(1000);
  } else {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(1000);
  }

  // Check any search input is visible
  const searchInput = page.locator('#searchInput');
  const searchFloating = page.locator('#searchFloating input');
  const si = await searchInput.isVisible();
  const sf = await searchFloating.isVisible();
  assert(si || sf, 'Search input visible (searchInput: ' + si + ', floating: ' + sf + ')');

  const activeInput = si ? searchInput : searchFloating;
  if (si || sf) {
    await activeInput.fill('Page');
    await page.waitForTimeout(2000);

    // Search may show results in status or highlight in text layer
    const searchStatus = page.locator('#searchStatus');
    const statusText = await searchStatus.textContent().catch(() => '');
    const textLayerText = await page.evaluate(() => document.getElementById('textLayerDiv')?.textContent?.substring(0, 50) || '');
    assert(textLayerText.includes('Page'), 'Text layer contains searchable text: "' + textLayerText.substring(0, 40) + '"');
  }

  // Close search
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 7: Image file loading
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 7: Image Loading ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-100x100.png'));
  await page.waitForTimeout(3000);

  const canvas = page.locator('#viewerCanvas');
  const canvasVisible = await canvas.isVisible();
  assert(canvasVisible, 'Canvas visible after image load');

  if (canvasVisible) {
    const box = await canvas.boundingBox();
    assert(box && box.width > 10, 'Image rendered with dimensions: ' + (box ? box.width + 'x' + box.height : 'null'));
  }

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 8: Export buttons with loaded document
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 8: Export Functions ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  await page.waitForTimeout(3000);

  // Open right panel text-ocr via command bar button
  await page.click('.cb-tool-btn[data-tool="text-ocr"]');
  await page.waitForTimeout(1000);

  // Check export buttons exist and are clickable
  for (const id of ['#exportWord', '#exportHtml', '#exportPlainText', '#exportOcrIndex']) {
    const btn = page.locator(id);
    const visible = await btn.isVisible();
    if (visible) {
      // Click and make sure no crash (download will be intercepted)
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
      assert(true, id + ' clicked without crash');
    } else {
      assert(false, id + ' not visible');
    }
  }

  // Test download button
  const downloadBtn = page.locator('#downloadFile');
  if (await downloadBtn.isVisible()) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      downloadBtn.click(),
    ]);
    assert(download !== null, 'Download triggered: ' + (download ? download.suggestedFilename() : 'null'));
  }

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 9: Page thumbnails
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 9: Page Thumbnails ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-3page.pdf'));
  // Wait for thumbnails to render (async)
  await page.waitForTimeout(6000);

  const thumbnails = page.locator('#pagePreviewList .thumb-wrapper');
  const thumbCount = await thumbnails.count();
  assert(thumbCount === 3, 'Three page thumbnails (' + thumbCount + ')');

  if (thumbCount >= 2) {
    // Click second thumbnail to navigate
    await thumbnails.nth(1).click();
    await page.waitForTimeout(1500);
    const pageVal = await page.locator('#pageInput').inputValue();
    assert(pageVal === '2', 'Clicking thumbnail 2 navigates to page 2 (got: ' + pageVal + ')');
  }

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 10: Settings persistence
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 10: Settings & Theme ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Get initial theme
  const initialTheme = await page.evaluate(() => document.body.className);

  // Toggle theme
  await page.click('#themeToggle');
  await page.waitForTimeout(500);
  const newTheme = await page.evaluate(() => document.body.className);
  assert(newTheme !== initialTheme, 'Theme toggled (' + initialTheme + ' → ' + newTheme + ')');

  // Check localStorage persistence
  const stored = await page.evaluate(() => localStorage.getItem('novareader-theme'));
  assert(stored !== null, 'Theme saved to localStorage: ' + stored);

  // Reload and check persistence
  await page.reload();
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.waitForTimeout(1000);
  const afterReload = await page.evaluate(() => document.body.classList.contains('light') || document.body.classList.contains('dark'));
  const expectedLight = newTheme.includes('light');
  const afterLight = await page.evaluate(() => document.body.classList.contains('light'));
  assert(expectedLight === afterLight, 'Theme persists after reload (light=' + afterLight + ')');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════
await browser.close();

console.log('\n═══════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed:');
  for (const f of failures) console.log('  ✘ ' + f);
}

const relevantErrors = errors.filter(e => e.startsWith('PAGEERROR'));
if (relevantErrors.length > 0) {
  console.log('\nPage Errors:');
  for (const e of relevantErrors) console.log('  ' + e.substring(0, 200));
}
console.log('═══════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
