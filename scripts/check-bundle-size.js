#!/usr/bin/env node
// ─── Bundle Size Budget Check ───────────────────────────────────────────────
// Verifies production bundle stays within size budgets.
// Run after `npm run build`.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DIST = 'dist';
const BUDGETS = {
  // Main JS entry (gzipped)
  'js/index-*.js': { maxGzip: 400_000, label: 'Main JS bundle' },
  // CSS
  'assets/index-*.css': { maxGzip: 15_000, label: 'Main CSS' },
  // Vendor chunks (gzipped)
  'chunks/pdf-lib-*.js': { maxGzip: 220_000, label: 'pdf-lib chunk' },
  'chunks/docx-*.js': { maxGzip: 120_000, label: 'docx chunk' },
};

let failures = 0;
let checks = 0;

for (const [pattern, budget] of Object.entries(BUDGETS)) {
  const globDir = path.join(DIST, path.dirname(pattern));
  const globName = path.basename(pattern);
  const regex = new RegExp('^' + globName.replace(/\*/g, '.*') + '$');

  if (!fs.existsSync(globDir)) {
    console.log(`  SKIP  ${budget.label} — directory ${globDir} not found`);
    continue;
  }

  const files = fs.readdirSync(globDir).filter(f => regex.test(f));
  if (files.length === 0) {
    console.log(`  SKIP  ${budget.label} — no matching files`);
    continue;
  }

  for (const file of files) {
    const filePath = path.join(globDir, file);
    const raw = fs.statSync(filePath).size;
    const gzipped = parseInt(execSync(`gzip -c "${filePath}" | wc -c`).toString().trim(), 10);
    checks++;

    const ok = gzipped <= budget.maxGzip;
    const icon = ok ? '  PASS' : '  FAIL';
    const rawKB = (raw / 1024).toFixed(1);
    const gzKB = (gzipped / 1024).toFixed(1);
    const budgetKB = (budget.maxGzip / 1024).toFixed(1);

    console.log(`${icon}  ${budget.label}: ${gzKB}KB gzip (raw ${rawKB}KB) — budget ${budgetKB}KB`);

    if (!ok) failures++;
  }
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);
