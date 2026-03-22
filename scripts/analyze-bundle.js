#!/usr/bin/env node

/**
 * Bundle analysis script for NovaReader.
 *
 * Reads all files in dist/js/ and dist/chunks/, reports per-file sizes
 * (raw + gzip), total bundle size, flags known large modules that should
 * be lazy-loaded, and compares against a previous baseline if one exists.
 *
 * Usage:
 *   npm run analyze          # build then analyze
 *   node scripts/analyze-bundle.js   # analyze existing dist/
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DIST_ROOT = join(process.cwd(), 'dist');
const SCAN_DIRS = ['js', 'chunks'].map(d => join(DIST_ROOT, d));
const BASELINE_PATH = join(process.cwd(), '.bundle-baseline.json');

/** Modules that should be lazy-loaded — flag if they appear in non-chunk bundles. */
const KNOWN_LARGE_MODULES = [
  'pdfjs-dist',
  'tesseract.js',
  'djvujs-dist',
  'pdf-lib',
  'docx',
];

/** Warn when the total gzip size exceeds this threshold (bytes). */
const TOTAL_SIZE_WARN_KB = 1500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function collectFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => /\.(js|css|wasm)$/.test(f))
    .map(f => join(dir, f));
}

function analyzeFile(filePath) {
  const content = readFileSync(filePath);
  const gzipped = gzipSync(content);
  return {
    file: relative(DIST_ROOT, filePath),
    raw: content.length,
    gzip: gzipped.length,
  };
}

function detectLargeModules(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const found = [];
  for (const mod of KNOWN_LARGE_MODULES) {
    if (content.includes(mod)) {
      found.push(mod);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(DIST_ROOT)) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const files = SCAN_DIRS.flatMap(collectFiles);

  if (files.length === 0) {
    console.error('No .js, .css, or .wasm files found in dist/js/ or dist/chunks/.');
    process.exit(1);
  }

  // Analyze each file
  const results = files.map(analyzeFile);

  // Sort largest first (by gzip size)
  results.sort((a, b) => b.gzip - a.gzip);

  const totalRaw = results.reduce((s, r) => s + r.raw, 0);
  const totalGzip = results.reduce((s, r) => s + r.gzip, 0);

  // Report per-file sizes
  console.log('\n=== NovaReader Bundle Analysis ===\n');
  console.log(
    'File'.padEnd(50) +
    'Raw'.padStart(12) +
    'Gzip'.padStart(12)
  );
  console.log('-'.repeat(74));

  for (const r of results) {
    console.log(
      r.file.padEnd(50) +
      formatBytes(r.raw).padStart(12) +
      formatBytes(r.gzip).padStart(12)
    );
  }

  console.log('-'.repeat(74));
  console.log(
    'Total'.padEnd(50) +
    formatBytes(totalRaw).padStart(12) +
    formatBytes(totalGzip).padStart(12)
  );

  // Warn on total size
  if (totalGzip > TOTAL_SIZE_WARN_KB * 1024) {
    console.log(
      `\n[WARNING] Total gzip size (${formatBytes(totalGzip)}) exceeds ${TOTAL_SIZE_WARN_KB} KB threshold.`
    );
  }

  // Check for large modules that should be lazy-loaded
  console.log('\n--- Large module check ---');
  let foundIssues = false;
  for (const filePath of files) {
    const rel = relative(DIST_ROOT, filePath);
    // Only flag non-chunk files (i.e. main bundles)
    if (rel.startsWith('chunks/')) continue;
    const modules = detectLargeModules(filePath);
    if (modules.length > 0) {
      foundIssues = true;
      console.log(`[WARNING] ${rel} contains modules that should be lazy-loaded:`);
      for (const mod of modules) {
        console.log(`  - ${mod}`);
      }
    }
  }
  if (!foundIssues) {
    console.log('All known large modules are properly chunked or absent from main bundles.');
  }

  // Compare against baseline
  console.log('\n--- Baseline comparison ---');
  if (existsSync(BASELINE_PATH)) {
    try {
      const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
      const baseTotal = baseline.totalGzip || 0;
      const diff = totalGzip - baseTotal;
      const pct = baseTotal > 0 ? ((diff / baseTotal) * 100).toFixed(1) : 'N/A';
      const sign = diff >= 0 ? '+' : '';
      console.log(`Previous total gzip: ${formatBytes(baseTotal)}`);
      console.log(`Current total gzip:  ${formatBytes(totalGzip)}`);
      console.log(`Difference:          ${sign}${formatBytes(Math.abs(diff))} (${sign}${pct}%)`);

      if (diff > 0) {
        console.log('[WARNING] Bundle size has increased since last baseline.');
      } else if (diff < 0) {
        console.log('Bundle size has decreased — nice work!');
      } else {
        console.log('Bundle size is unchanged.');
      }
    } catch {
      console.log('Could not parse baseline file. Skipping comparison.');
    }
  } else {
    console.log('No baseline file found at .bundle-baseline.json');
    console.log('Saving current build as baseline.');
  }

  // Write current results as the new baseline
  const baselineData = {
    timestamp: new Date().toISOString(),
    totalRaw,
    totalGzip,
    files: results,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baselineData, null, 2) + '\n');
  console.log(`Baseline written to ${BASELINE_PATH}\n`);
}

main();
