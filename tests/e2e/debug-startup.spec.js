// @ts-check
import { test, expect } from '@playwright/test';

test('DEBUG: diagnose page load and app-shell', async ({ page }) => {
  // Collect all console output and errors
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));
  page.on('requestfailed', req => logs.push(`[REQ FAILED] ${req.url()} ${req.failure()?.errorText}`));

  // Navigate with explicit waitUntil
  console.log('TEST: Navigating to /...');
  const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  console.log('TEST: Response status:', response?.status());
  console.log('TEST: Response URL:', response?.url());
  console.log('TEST: Response content-type:', response?.headers()['content-type']);

  // Wait for page to settle
  await page.waitForTimeout(2000);

  // Check DOM state
  const diagnostics = await page.evaluate(() => {
    const el = document.querySelector('.app-shell');
    const result = {
      docTitle: document.title,
      bodyClassList: document.body.className,
      bodyChildCount: document.body.children.length,
      firstChildTag: document.body.firstElementChild?.tagName,
      firstChildClass: document.body.firstElementChild?.className,
    };
    if (!el) {
      return {
        ...result,
        appShellFound: false,
        bodyInnerHTMLPreview: document.body.innerHTML.substring(0, 1000),
      };
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      ...result,
      appShellFound: true,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      overflow: style.overflow,
      childCount: el.children.length,
    };
  });
  console.log('TEST DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2));

  // Print browser console logs
  if (logs.length > 0) {
    console.log('TEST: Browser logs (' + logs.length + '):');
    for (const log of logs.slice(0, 30)) {
      console.log('  ', log);
    }
  } else {
    console.log('TEST: No browser logs captured');
  }

  // Assert something basic
  expect(diagnostics.docTitle).toBeTruthy();
});
