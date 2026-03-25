#!/usr/bin/env node
// ─── Post-Build Obfuscation ─────────────────────────────────────────────────
// Obfuscates all JS files in dist/ after Vite build.
// Vendor chunks (pdf-lib, docx, pdfjs, fflate, tesseract) are skipped.
//
// Usage:
//   npm run build           → builds + obfuscates
//   npm run build:dev       → builds without obfuscation
//   node scripts/obfuscate-dist.js  → obfuscate existing dist/

import fs from 'node:fs';
import path from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const DIST = 'dist';

// Files to SKIP (vendor libraries — already minified, obfuscation breaks them)
const SKIP_PATTERNS = [
  /pdf-lib/i, /pdfjs/i, /docx/i, /fflate/i, /tesseract/i,
  /djvu/i, /pdf\.min/i, /pdf\.worker/i,
  /\.css$/, /\.html$/, /\.json$/, /\.wasm$/, /\.map$/,
  /\.png$/, /\.jpg$/, /\.svg$/, /\.ico$/, /\.traineddata$/,
  /^sw\.js$/,  // Service Worker must not be obfuscated (runs in SW scope, not window)
];

const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.15,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.5,
  splitStrings: true,
  splitStringsChunkLength: 8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  target: 'browser',
  // Don't break critical browser APIs
  reservedNames: [
    'performance', 'requestAnimationFrame', 'cancelAnimationFrame',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestIdleCallback', 'IntersectionObserver', 'ResizeObserver',
    'MutationObserver', 'AbortController', 'ReadableStream',
    'crypto', 'subtle', 'CryptoKey', 'SubtleCrypto',
    'caches', 'serviceWorker', 'indexedDB',
  ],
  reservedStrings: ['__vite', 'import\\.meta'],
};

function shouldSkip(filePath) {
  const name = path.basename(filePath);
  return SKIP_PATTERNS.some(p => p.test(name) || p.test(filePath));
}

function findJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log('🔒 NovaReader Post-Build Obfuscation\n');

if (!fs.existsSync(DIST)) {
  console.error('Error: dist/ directory not found. Run `npm run build:dev` first.');
  process.exit(1);
}

const files = findJsFiles(DIST);
let obfuscated = 0;
let skipped = 0;
let totalOriginal = 0;
let totalObfuscated = 0;

for (const file of files) {
  if (shouldSkip(file)) {
    skipped++;
    continue;
  }

  const original = fs.readFileSync(file, 'utf8');
  if (original.length < 100) {
    skipped++;
    continue;
  }

  // Vite places vendor/worker assets in dist/assets/ with hash filenames
  // that don't match name-based skip patterns. Skip all JS in assets/.
  const relPath = path.relative(DIST, file);
  if (relPath.startsWith('assets' + path.sep) || relPath.startsWith('assets/')) {
    console.log(`  ⊘ ${relPath} — skipped (assets/ directory = vendor/worker)`);
    skipped++;
    continue;
  }

  const originalSize = Buffer.byteLength(original);
  totalOriginal += originalSize;

  try {
    const result = JavaScriptObfuscator.obfuscate(original, OBFUSCATION_OPTIONS);
    const obfuscatedCode = result.getObfuscatedCode();
    fs.writeFileSync(file, obfuscatedCode);

    const newSize = Buffer.byteLength(obfuscatedCode);
    totalObfuscated += newSize;
    const ratio = ((newSize / originalSize) * 100).toFixed(0);

    console.log(`  ✓ ${path.relative(DIST, file)} (${(originalSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB, ${ratio}%)`);
    obfuscated++;
  } catch (err) {
    console.log(`  ✗ ${path.relative(DIST, file)} — skipped (${err.message.slice(0, 60)})`);
    skipped++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`  Obfuscated: ${obfuscated} files`);
console.log(`  Skipped: ${skipped} files (vendors/small)`);
console.log(`  Original: ${(totalOriginal / 1024).toFixed(1)} KB`);
console.log(`  Obfuscated: ${(totalObfuscated / 1024).toFixed(1)} KB`);
console.log(`  Ratio: ${totalOriginal > 0 ? ((totalObfuscated / totalOriginal) * 100).toFixed(0) : 0}%`);
console.log(`\n✅ Production build is protected.`);
