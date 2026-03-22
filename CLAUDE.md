# Claude Code — NovaReader Development Instructions

## Code Protection Setup

NovaReader uses post-build JavaScript obfuscation to protect intellectual property.
Source code in `app/` is readable for development; the `dist/` output is obfuscated.

### Build Commands

```bash
# PRODUCTION (obfuscated) — for distribution
npm run build

# DEVELOPMENT (readable) — for debugging
npm run build:dev

# CLEAN BUILD (minified only, no obfuscation) — for testing
npm run build:clean
```

### How Obfuscation Works

1. `npm run build` runs Vite build, then `scripts/obfuscate-dist.js`
2. The script processes all JS files in `dist/` EXCEPT vendor chunks (pdf-lib, docx, pdfjs, fflate, tesseract)
3. Obfuscation features: control flow flattening, dead code injection, string array encoding (base64), identifier renaming (hexadecimal), string splitting
4. Original source in `app/` is NEVER modified — obfuscation only touches `dist/`

### When Working on Code

- **Always edit files in `app/modules/`** — these are the readable source files
- **Never edit files in `dist/`** — they are generated and obfuscated
- Source maps are disabled in production builds (obfuscated code shouldn't be mappable)
- For debugging, use `npm run build:dev` which skips obfuscation

### Obfuscation Config

Located in `scripts/obfuscate-dist.js`. Key settings:
- `controlFlowFlattening: true` (threshold 0.4)
- `deadCodeInjection: true` (threshold 0.15)
- `stringArrayEncoding: ['base64']`
- `identifierNamesGenerator: 'hexadecimal'`
- Vendor libraries are auto-skipped by filename pattern

### Important Notes

- Obfuscation increases file size ~4x (source → obfuscated)
- Runtime performance impact is minimal (<5% on modern browsers)
- `selfDefending` is DISABLED (breaks Tauri WebView)
- `unicodeEscapeSequence` is DISABLED (keeps error messages readable for diagnostics)

---

## Project Structure

```
app/
  app.js              — Main entry point (wiring layer, ~773 lines)
  index.html          — Single-page HTML with all UI elements
  sw.js               — Service Worker for PWA offline
  manifest.json       — PWA manifest
  locales/            — 10 i18n JSON files (ar, de, en, es, fr, ja, ko, pt, ru, zh)
  modules/            — 170 JS modules (source code, 100% @ts-check)
    init-*.js         — 10 init modules extracted from app.js
  types.d.ts          — TypeScript declarations (NovaEls, Window globals, Performance.memory)
  styles/             — 12 modular CSS files
  vendor/             — DjVu.js + Tesseract language data (LFS)
dist/                 — Production build output (obfuscated)
scripts/
  obfuscate-dist.js   — Post-build obfuscation script
  check-bundle-size.js — Bundle budget checker
  analyze-bundle.js    — Bundle analysis with baseline
tests/                — 75+ test files (1594+ tests, 75%+ coverage)
docs/                 — Release notes, backlog, architecture, components
```

## Testing

```bash
npm run lint              # ESLint (0 warnings required)
npm run test:unit         # 1594+ unit tests
npm run test:coverage     # Coverage report (≥70% lines enforced in CI)
npm run test:benchmark    # OCR quality baseline
npm run test:benchmark:ocr  # OCR corpus (16 languages)
npm run test:benchmark:pdf  # PDF conversion
npm run check:bundle      # Bundle size budget (7 chunk budgets)
npm run typecheck         # TypeScript check (170/170 modules with @ts-check)
```

## Key Architecture Decisions

- **No circular imports** — tile-renderer uses injected getter for render generation
- **Safe timers** — all setTimeout/setInterval tracked with scoped cleanup
- **Progressive loader** uses raw setTimeout (immune to clearAllTimers during file open)
- **DjVu Document constructor** uses raw setTimeout (same reason)
- **OCR pipeline** guards against 0-dimension canvas at 3 entry points
- **Event bus** tracks all listeners (on/once/subscribe) for removeAll cleanup
- **app.js decomposition** — 8 init-* modules handle error handling, navigation, OCR, annotations, PDF tools, keyboard, tabs, and advanced features
- **i18n** — translations stored in `app/locales/*.json`, loaded via static imports in `i18n.js`
- **CI bundle monitoring** — automatic size checks + PR comments with analysis
