#!/usr/bin/env node
/**
 * NovaReader Nightly Soak Run
 *
 * Launches a headless browser, opens the app, and performs repeated
 * operations over a configurable duration to detect memory leaks,
 * crashes, and degraded performance.
 *
 * Usage:
 *   SOAK_DURATION_MIN=30 SOAK_BASE_URL=http://localhost:4173/app/ node tests/nightly-soak.js
 *
 * Requires: playwright (npx playwright install chromium)
 *
 * Exit codes:
 *   0 — soak passed (crash-free rate >= threshold)
 *   1 — soak failed
 */

const SOAK_DURATION_MIN = parseInt(process.env.SOAK_DURATION_MIN || '10', 10);
const SOAK_BASE_URL = process.env.SOAK_BASE_URL || 'http://localhost:4173/app/';
const CRASH_FREE_THRESHOLD = parseFloat(process.env.SOAK_CRASH_FREE_THRESHOLD || '99.5');
const CYCLE_DELAY_MS = parseInt(process.env.SOAK_CYCLE_DELAY_MS || '500', 10);

async function main() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error('ERROR: playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  NovaReader Nightly Soak Run');
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Duration:           ${SOAK_DURATION_MIN} minutes`);
  console.log(`  Base URL:           ${SOAK_BASE_URL}`);
  console.log(`  Crash-free target:  ${CRASH_FREE_THRESHOLD}%`);
  console.log(`${'─'.repeat(60)}`);

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const errors = [];
  const consoleErrors = [];
  let cycles = 0;
  let successfulOps = 0;
  let failedOps = 0;

  page.on('pageerror', (err) => {
    errors.push({ ts: new Date().toISOString(), message: err.message });
    failedOps++;
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ ts: new Date().toISOString(), text: msg.text().slice(0, 200) });
    }
  });

  // Navigate to app
  console.log('\n  Starting app...');
  await page.goto(SOAK_BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  console.log('  App loaded successfully.');

  const endTime = Date.now() + SOAK_DURATION_MIN * 60 * 1000;

  // Soak loop — exercises UI without real files (structural stress test)
  const operations = [
    // Navigation controls
    async () => { await page.click('#nextPage').catch(() => {}); },
    async () => { await page.click('#prevPage').catch(() => {}); },
    // Zoom
    async () => { await page.click('#zoomIn').catch(() => {}); },
    async () => { await page.click('#zoomOut').catch(() => {}); },
    async () => { await page.click('#zoomFit').catch(() => {}); },
    // Rotation
    async () => { await page.click('#rotateCw').catch(() => {}); },
    // Theme toggle
    async () => {
      await page.evaluate(() => document.body.classList.toggle('light'));
    },
    // Settings open/close
    async () => {
      await page.click('#openSettingsModal').catch(() => {});
      await page.waitForTimeout(200);
      await page.click('#closeSettingsModal').catch(() => {});
    },
    // Advanced panels toggle
    async () => { await page.click('#toggleAdvancedPanels').catch(() => {}); },
    // Text edit toggle
    async () => { await page.click('#toggleTextEdit').catch(() => {}); },
    // OCR region toggle
    async () => { await page.click('#ocrRegionMode').catch(() => {}); },
    // Cancel background OCR
    async () => { await page.click('#cancelBackgroundOcr').catch(() => {}); },
    // Bookmark add
    async () => { await page.click('#addBookmark').catch(() => {}); },
    // Memory check
    async () => {
      const mem = await page.evaluate(() => {
        if (performance.memory) return { usedJSHeapSize: performance.memory.usedJSHeapSize };
        return null;
      });
      if (mem) {
        const mb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
        if (mb > 512) {
          console.log(`  WARNING: heap usage ${mb}MB`);
        }
      }
    },
  ];

  console.log(`\n  Soak running... (${SOAK_DURATION_MIN}min)\n`);

  while (Date.now() < endTime) {
    const opIndex = cycles % operations.length;
    try {
      await operations[opIndex]();
      successfulOps++;
    } catch (err) {
      failedOps++;
      errors.push({ ts: new Date().toISOString(), message: err.message, op: opIndex });
    }
    cycles++;

    if (cycles % 50 === 0) {
      const elapsed = Math.round((Date.now() - (endTime - SOAK_DURATION_MIN * 60000)) / 60000);
      const rate = successfulOps + failedOps > 0
        ? ((successfulOps / (successfulOps + failedOps)) * 100).toFixed(2)
        : '100.00';
      console.log(`  [${elapsed}min] cycles=${cycles} ok=${successfulOps} fail=${failedOps} crash-free=${rate}%`);
    }

    await page.waitForTimeout(CYCLE_DELAY_MS);
  }

  // Collect final health from app
  let sessionHealth = null;
  try {
    sessionHealth = await page.evaluate(() => {
      if (typeof getSessionHealth === 'function') return getSessionHealth();
      return null;
    });
  } catch { /* ignore */ }

  await browser.close();

  // Report
  const totalOps = successfulOps + failedOps;
  const crashFreeRate = totalOps > 0 ? ((successfulOps / totalOps) * 100) : 100;
  const passed = crashFreeRate >= CRASH_FREE_THRESHOLD;

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Soak Run Results');
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total cycles:       ${cycles}`);
  console.log(`  Successful ops:     ${successfulOps}`);
  console.log(`  Failed ops:         ${failedOps}`);
  console.log(`  Page errors:        ${errors.length}`);
  console.log(`  Console errors:     ${consoleErrors.length}`);
  console.log(`  Crash-free rate:    ${crashFreeRate.toFixed(2)}%`);
  console.log(`  Threshold:          ${CRASH_FREE_THRESHOLD}%`);
  console.log(`  Result:             ${passed ? 'PASSED' : 'FAILED'}`);

  if (sessionHealth) {
    console.log(`\n  App Session Health:`);
    console.log(`    Session ID:       ${sessionHealth.sessionId}`);
    console.log(`    Uptime:           ${sessionHealth.uptimeMin} min`);
    console.log(`    App errors:       ${sessionHealth.totalErrors}`);
    console.log(`    App crashes:      ${sessionHealth.crashes}`);
    console.log(`    App recoveries:   ${sessionHealth.recoveries}`);
    console.log(`    App crash-free:   ${sessionHealth.crashFreeRate}%`);
    console.log(`    Longest streak:   ${sessionHealth.longestStreak}`);
  }

  if (errors.length > 0) {
    console.log(`\n  Recent errors (last 10):`);
    for (const err of errors.slice(-10)) {
      console.log(`    [${err.ts}] ${err.message?.slice(0, 100)}`);
    }
  }

  console.log(`${'═'.repeat(60)}\n`);

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    durationMin: SOAK_DURATION_MIN,
    cycles,
    successfulOps,
    failedOps,
    crashFreeRate: Math.round(crashFreeRate * 100) / 100,
    threshold: CRASH_FREE_THRESHOLD,
    passed,
    pageErrors: errors.length,
    consoleErrors: consoleErrors.length,
    sessionHealth,
    errors: errors.slice(-50),
  };

  const fs = require('fs');
  const reportPath = `soak-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  Report saved: ${reportPath}`);

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Soak run fatal error:', err);
  process.exit(1);
});
