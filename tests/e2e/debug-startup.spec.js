// @ts-check
import { test, expect } from '@playwright/test';

test('DEBUG: diagnose app-shell visibility', async ({ page }) => {
  // Collect all console output
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

  // Navigate
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  console.log('Response status:', response?.status());
  console.log('Response URL:', response?.url());

  // Wait a moment for any JS to run
  await page.waitForTimeout(2000);

  // Check DOM state
  const diagnostics = await page.evaluate(() => {
    const el = document.querySelector('.app-shell');
    if (!el) {
      return {
        found: false,
        bodyHTML: document.body.innerHTML.substring(0, 500),
        docTitle: document.title,
        allClasses: Array.from(document.querySelectorAll('[class]')).slice(0, 20).map(e => e.className),
      };
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      found: true,
      tagName: el.tagName,
      className: el.className,
      width: rect.width,
      height: rect.height,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      childCount: el.children.length,
      docTitle: document.title,
    };
  });
  console.log('DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2));

  // Print browser console logs
  for (const log of logs) {
    console.log('BROWSER:', log);
  }

  // The actual assertion
  expect(diagnostics.found).toBe(true);
  if (diagnostics.found) {
    expect(diagnostics.height).toBeGreaterThan(0);
  }
});
