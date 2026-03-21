# NovaReader 4.0.0 — Release Notes

## Overview

Major release delivering production-grade stability, full internationalization, modular architecture, and comprehensive testing infrastructure.

---

## What's New in 4.0.0

### Architecture & Code Quality
- **Modular CSS** — 3470-line monolithic stylesheet split into 12 focused modules (base, layout, sidebar, toolbar, canvas, modals, toast, tooltip, annotations, resize, misc)
- **Controller decomposition** — 3 largest controllers split into focused sub-modules:
  - `export-controller` 1202→154 lines (+ export-docx, export-image, export-text)
  - `render-controller` 1094→280 lines (+ render-text-layer, render-annotations-overlay)
  - `ocr-controller` 884→595 lines (+ ocr-pipeline-variants, ocr-region)
- **TypeScript incremental adoption** — tsconfig.json with `@ts-check` on 19 core modules, 319-line type definitions (types.d.ts)
- **Unified persistence facade** — single API for localStorage + IndexedDB, migration helpers, storage stats
- **161 JS modules**, 0 ESLint errors, 0 ESLint warnings, 0 TypeScript errors

### Performance
- **Bundle size reduced 32%** — main chunk 234KB gzip (was 345KB)
- **Code splitting** — docx lazy-loaded via dynamic `import()`, pdf-lib/fflate/tesseract in separate chunks
- **Hidden source maps** — production crash diagnostics without exposing source to users
- **Performance profiling markers** — `performance.mark/measure` in render, OCR, file-open, and search paths
- **PDF operation yield points** — merge/split/annotate yield to UI between pages for responsiveness
- **Bundle budget enforcement** — automated checks in CI (main JS <390KB, CSS <15KB)

### Internationalization
- **9 languages** — Russian, English, German, French, Spanish, Portuguese, Chinese, Japanese, Korean
- **357 translation keys** per language, 282 tagged UI elements
- **RTL support** for Arabic, Hebrew, Farsi, Urdu
- **Language selector** in settings with live switching

### OCR
- **28 language profiles** with language-specific post-correction
- **Safe OCR pipeline** — dimension guards prevent canvas width=0 crashes
- **Lazy-loaded Tesseract.js** — WASM/worker only fetched on first OCR use
- **4 table conversion plugins** — Invoice, Financial, Scientific, Timetable

### Security
- **E2E encryption for cloud sync** — AES-GCM 256-bit with PBKDF2 key derivation (Web Crypto API)
- **XSS prevention** — textContent instead of innerHTML for user content across all modules
- **npm audit** in CI pipeline

### Stability
- **Error boundary fallback UI** — visual banner for recoverable errors, full-screen fallback for critical crashes
- **Safe timers** — tracked setTimeout/setInterval with scoped cleanup on document change
- **Memory leak prevention** — destroy methods for epub, minimap, tooltip, presentation mode; AbortController for event listeners; blob URL lifecycle management
- **Race condition fixes** — render generation tracking, Map snapshot before iteration, double-removal guards
- **DjVu file opening fixed** — progressive loader uses raw setTimeout immune to clearAllTimers()

### Testing & CI
- **500+ tests** across 27 test files:
  - 322 unit tests (Node.js test runner)
  - 80 integration tests (live server verification)
  - 30 OCR corpus benchmark tests (16 languages)
  - 46 PDF conversion benchmark tests
  - 99 E2E Playwright tests (42 test groups)
  - Visual regression screenshot tests
- **CI pipeline**: lint → unit tests → coverage → benchmarks → build → bundle budget → E2E → security audit
- **Code coverage** with c8 (lines 40%, functions 30%, branches 30% thresholds)
- **Lighthouse CI** for performance/accessibility monitoring

### PWA & Offline
- **Service Worker** — cache-first strategy for app shell, document caching for offline re-reading
- **Manifest** for installable PWA

### Developer Experience
- **Conventional commits** config for automated changelog generation
- **Bundle analysis script** with baseline comparison
- **Component documentation** (docs/components.md) — reference for all UI components
- **Git LFS** configured for large vendor files

---

## Breaking Changes
- `styles.css` removed — replaced by `styles/index.css` (12 modular files)
- Vendor binaries removed (pdf.js, tesseract WASM) — now served from npm packages
- OCR language fix patterns changed — aggressive patterns that corrupted text removed

## Migration
- No user-facing migration needed — all changes are internal
- Workspace data format is backward-compatible
- Settings persist across upgrade

## System Requirements
- Node.js ≥ 18
- Modern browser (Chrome 105+, Safari 14+, Firefox ESR)
- For Tauri desktop: Rust toolchain

## Running
```bash
# Web
npm ci
python3 dev_server.py  # → http://localhost:4173/app/

# Desktop (Tauri)
npm run tauri:dev

# Tests
npm run test:unit      # 322 unit tests
npm run test:e2e       # 99 E2E tests (needs Playwright)
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm run check:bundle   # Bundle size budget
npm run analyze        # Full bundle analysis
```
