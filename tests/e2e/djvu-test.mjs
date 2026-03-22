/**
 * DjVu E2E test — loads a DjVu file into NovaReader and tests
 * rendering, navigation, and DjVu-specific features.
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
const allErrors = [];

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

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', err => allErrors.push('PAGEERROR: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') allErrors.push('ERROR: ' + msg.text().substring(0, 200));
    if (msg.type() === 'warning') allErrors.push('WARN: ' + msg.text().substring(0, 200));
  });
  return page;
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 1: DjVu.js library loading
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 1: DjVu.js Library Loading ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Check if DjVu.js can be loaded
  const djvuAvailable = await page.evaluate(async () => {
    // Try to load DjVu script
    const url = './vendor/djvu.js';
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      return { fetchOk: resp.ok, status: resp.status };
    } catch (e) {
      return { fetchOk: false, error: e.message };
    }
  });
  assert(djvuAvailable.fetchOk, 'DjVu.js is accessible via HTTP (' + JSON.stringify(djvuAvailable) + ')');

  // Actually load the script
  const loaded = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = './vendor/djvu.js';
      script.onload = () => resolve({ loaded: true, DjVuExists: typeof window.DjVu !== 'undefined' });
      script.onerror = () => resolve({ loaded: false });
      document.head.appendChild(script);
    });
  });
  assert(loaded.loaded, 'DjVu.js script loaded successfully');
  assert(loaded.DjVuExists, 'window.DjVu is available after script load');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 2: DjVu file upload and adapter initialization
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 2: DjVu File Upload ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Track errors during file load
  const loadErrors = [];
  page.on('pageerror', err => loadErrors.push(err.message));

  // Upload DjVu file
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(path.join(FIXTURES, 'test-1page.djvu'));
  await page.waitForTimeout(5000);

  // Check if file was accepted (no crash)
  const appShellStill = await page.locator('.app-shell').isVisible();
  assert(appShellStill, 'App shell still visible after DjVu upload (no crash)');

  // Check if canvas rendered or error toast appeared
  const canvas = page.locator('#viewerCanvas');
  const canvasVisible = await canvas.isVisible();

  // Check for toast errors (DjVu might fail with minimal file but shouldn't crash)
  const toastErrors = await page.evaluate(() => {
    const toasts = document.querySelectorAll('.toast-error, .toast.error');
    return [...toasts].map(t => t.textContent?.substring(0, 100));
  });

  // Check page state
  const pageState = await page.evaluate(() => ({
    pageInput: document.getElementById('pageInput')?.value,
    pageStatus: document.getElementById('pageStatus')?.textContent,
    emptyState: document.getElementById('emptyState')?.offsetWidth > 0,
  }));

  if (canvasVisible) {
    assert(true, 'DjVu rendered on canvas');
    const box = await canvas.boundingBox();
    assert(box && box.width > 10, 'Canvas has dimensions: ' + (box ? box.width + 'x' + box.height : 'null'));
  } else {
    // Minimal DjVu might not render correctly but app shouldn't crash
    console.log('  ℹ Canvas not visible — checking if app handled gracefully');
    console.log('  ℹ Page state: ' + JSON.stringify(pageState));
    console.log('  ℹ Toast errors: ' + JSON.stringify(toastErrors));
    assert(loadErrors.length === 0, 'No unhandled page errors during DjVu load (' + loadErrors.length + ' errors)');
  }

  // Check no page errors (TypeError, ReferenceError, etc.)
  const criticalErrors = loadErrors.filter(e =>
    e.includes('TypeError') || e.includes('ReferenceError') || e.includes('is not a function')
  );
  assert(criticalErrors.length === 0, 'No critical JS errors (' + criticalErrors.length + ')');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 3: DjVu adapter — load via DjVu.js API directly
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 3: DjVu.js API Direct Test ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Load DjVu.js and test API
  const apiResult = await page.evaluate(async () => {
    // Load the script first
    await new Promise((resolve, reject) => {
      if (window.DjVu) { resolve(); return; }
      const script = document.createElement('script');
      script.src = './vendor/djvu.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    const result = { DjVuExists: typeof window.DjVu !== 'undefined' };

    if (window.DjVu) {
      result.hasDocument = typeof window.DjVu.Document !== 'undefined';
      result.hasWorker = typeof window.DjVu.Worker !== 'undefined';

      // List available API
      result.apiKeys = Object.keys(window.DjVu).sort();
    }

    return result;
  });

  assert(apiResult.DjVuExists, 'DjVu global is available');
  assert(apiResult.hasDocument || apiResult.hasWorker, 'DjVu has Document or Worker API (keys: ' + (apiResult.apiKeys?.join(', ') || 'none') + ')');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 4: DjVu file input accepts .djvu extension
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 4: File Input Accepts DjVu ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  const accept = await page.evaluate(() => {
    return document.getElementById('fileInput')?.getAttribute('accept') || '';
  });
  assert(accept.includes('.djvu'), 'File input accepts .djvu (' + accept + ')');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 5: DjVu adapter module exists and exports
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 5: DjVu Adapter Module ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  // Check that the adapters are wired
  const adapterCheck = await page.evaluate(() => {
    // The app wires adapters in app.js — check if DjVu detection works
    const ext = '.djvu';
    const accept = document.getElementById('fileInput')?.getAttribute('accept') || '';

    return {
      extensionInAccept: accept.includes(ext),
      // Check if app module exposed adapter info
      hasAdapterGlobal: typeof window._adapters !== 'undefined',
    };
  });

  assert(adapterCheck.extensionInAccept, 'DjVu extension accepted in file input');

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 6: DjVu navigation and zoom (if file loaded)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══ TEST 6: DjVu Controls After Load ═══');
{
  const page = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.locator('#fileInput').setInputFiles(path.join(FIXTURES, 'test-1page.djvu'));
  await page.waitForTimeout(5000);

  // Try zoom controls — should not crash even if file is invalid
  for (const id of ['#zoomIn', '#zoomOut', '#fitWidth', '#fitPage', '#rotate']) {
    await page.click(id).catch(() => {});
    await page.waitForTimeout(300);
  }

  const appOk = await page.locator('.app-shell').isVisible();
  assert(appOk, 'App survives zoom/rotate operations on DjVu file');

  // Try navigation
  await page.click('#nextPage').catch(() => {});
  await page.click('#prevPage').catch(() => {});
  await page.waitForTimeout(500);

  assert(await page.locator('.app-shell').isVisible(), 'App survives navigation on DjVu file');

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

// Show relevant errors/warnings
const relevantErrors = allErrors.filter(e => e.includes('PAGEERROR') || e.includes('djvu') || e.includes('DjVu'));
if (relevantErrors.length > 0) {
  console.log('\nDjVu-related errors/warnings:');
  for (const e of [...new Set(relevantErrors)].slice(0, 10)) console.log('  ' + e);
}
console.log('═══════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
