# NovaReader — Project Description for Claude Code Skills

## What Is This Project

NovaReader is a **full-featured, offline-first document viewer** built as a web SPA + cross-platform desktop app (Tauri 2). It supports PDF, DjVu, EPUB, CBZ, XPS, and image formats with OCR, annotations, search, export, and AI features.

**Version:** 4.0.0  
**License:** MIT  
**Default language:** Russian (UI), but 10 languages are supported

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Module system** | ES modules (`type: "module"`) |
| **Build** | Vite 6.4.1 |
| **Type safety** | 100% `@ts-check` JSDoc + TypeScript 5.7 (`--noEmit` only) |
| **Desktop** | Tauri 2 (`@tauri-apps/api`, plugins: fs, shell, dialog, process, os) |
| **PDF rendering** | pdfjs-dist 4.4.168 |
| **PDF creation/edit** | pdf-lib 1.17.1 |
| **DjVu** | djvujs-dist 0.5.4 |
| **OCR** | tesseract.js 5.1.1 (client-side, WASM) |
| **DOCX export** | docx 9.6.1 |
| **Compression** | fflate 0.8.2 |
| **Unit tests** | Node built-in test runner + c8 coverage |
| **E2E tests** | Playwright (desktop-hd, mobile) |
| **Linting** | ESLint 9.39.4 (0 warnings enforced) |

---

## File Structure

```
app/
  app.js              — Main entry point (~773 lines, wiring layer)
  index.html          — Single HTML with all UI elements
  sw.js               — Service Worker (PWA offline)
  manifest.json       — PWA manifest
  locales/            — 10 JSON translation files
  modules/            — ~198 JS source modules (100% @ts-check)
    init-*.js         — 10 init modules extracted from app.js
  types.d.ts          — TypeScript declarations (NovaEls, Window globals)
  styles/             — 12 modular CSS files
  vendor/             — DjVu.js + Tesseract language data (LFS)
dist/                 — Build output (generated, never edit)
scripts/              — Bundle checker, bundle analysis
tests/
  unit/               — 80+ test files, 1900+ tests
  e2e/                — Playwright E2E tests
docs/                 — Architecture, backlog, release notes
```

**RULE: Always edit `app/modules/`. Never edit `dist/`.**

---

## Architecture Overview

### Initialization Flow (app.js)

```
Phase 0 — Platform detection (Tauri vs browser), preload PDF worker
Phase 1 — Import modules, create state store, set up event bus
Phase 2 — Error handling boundaries (withErrorBoundary wrapper)
Phase 3 — Settings + i18n + theme restoration
Phase 4 — UI initialization, drag-drop, layout
Phase 5 — Feature controllers wired via dependency injection
Phase 6 — Advanced tools bootstrapped on-demand
Phase 7 — Event bindings, keyboard shortcuts
```

### Core Patterns

#### 1. Reactive State (`app/modules/state.js`)
All application data lives in a single reactive store.

```javascript
import { state } from './state.js';

// Read
const page = state.currentPage;

// Write
state.currentPage = 5;

// Listen to field changes
state.on('currentPage', (newVal, oldVal) => { ... });

// Batch updates (single notification for all changes)
state.batch(() => {
  state.currentPage = 5;
  state.zoom = 1.25;
  state.searchResults = [];
});
```

#### 2. Event Bus (`app/modules/event-bus.js`)
Decoupled pub/sub for cross-module communication.

```javascript
import { emit, on, once, removeAllListeners } from './event-bus.js';

// Emit from any module
emit('ocr:page-done', { page: 3, text: '...' });

// Subscribe in another module
const unsub = on('ocr:page-done', (detail) => { ... });

// Cleanup on document close
removeAllListeners(); // clears all subscriptions
```

#### 3. Dependency Injection (no circular imports)
Modules expose an `init*Deps(deps)` function called from `app.js`.

```javascript
// In a module (e.g., render-controller.js)
const _deps = { renderAnnotations: () => {}, trackVisitedPage: () => {} };
export function initRenderControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// In app.js
initRenderControllerDeps({
  renderAnnotations: annotationController.render,
  trackVisitedPage: readingProgress.track,
});
```

#### 4. Error Boundaries (`app/modules/init-error-handling.js`)
Every major operation is wrapped in `withErrorBoundary`.

```javascript
const safeRender = withErrorBoundary(renderPage, 'page-render', {
  silent: false,  // show user notification
  fallback: null,
  rethrow: false,
});
```

#### 5. Safe Timers (`app/modules/safe-timers.js`)
All `setTimeout`/`setInterval` must be tracked for cleanup.

```javascript
import { safeTimeout, safeInterval, clearAllTimers } from './safe-timers.js';

safeTimeout(() => { ... }, 200, 'document');  // cleared on file open/close
safeInterval(() => { ... }, 1000, 'app');     // persists across documents

clearAllTimers('document'); // called on document close
```

**Exception:** Progressive loader and DjVu constructor use raw `setTimeout` (immune to clearAllTimers).

---

## Key Modules Reference

### Infrastructure

| Module | Exports / Purpose |
|--------|-------------------|
| `state.js` | `state` — reactive app state store |
| `event-bus.js` | `emit`, `on`, `once`, `subscribe`, `removeAllListeners` |
| `safe-timers.js` | `safeTimeout`, `safeInterval`, `clearAllTimers` |
| `platform.js` | `initPlatform()`, `isTauri()`, platform-specific file APIs |
| `i18n.js` | `t(key)`, `setLanguage(code)`, `applyI18nToDOM()` |
| `utils.js` | Shared utilities: `debounce`, etc. |
| `perf.js` | Page render cache, object URL tracking, metrics |
| `memory-manager.js` | Canvas pool, memory stats, force cleanup |

### Document Rendering

| Module | Purpose |
|--------|---------|
| `adapters.js` | `PDFAdapter`, `DjVuAdapter`, `ImageAdapter`, `EpubAdapter`, `CbzAdapter`, `XpsAdapter` — each implements `renderPage(canvas)`, `getPageCount()`, `getPageViewport()`, `getPageText()` |
| `render-controller.js` | Orchestrates page rendering (canvas sync, text/annotation layers) |
| `render-pipeline.js` | Low-level render pipeline with caching |
| `tile-renderer.js` | High-zoom tile-based rendering (OOM prevention) |
| `text-layer-builder.js` | Text layer for selection + search highlighting |
| `thumbnail-renderer.js` | Sidebar page preview thumbnails |

### OCR

| Module | Purpose |
|--------|---------|
| `ocr-controller.js` | OCR orchestration, region selection, page-level recognition |
| `tesseract-adapter.js` | Tesseract.js worker interface |
| `worker-pool.js` | Task queue for parallel OCR/PDF processing, priority queue |
| `ocr-storage.js` | IndexedDB storage for OCR data |
| `ocr-search.js` | `OcrSearchIndex` — full-text search over OCR results |
| `ocr-batch.js` | Batch OCR, searchable PDF creation, language detection |
| `ocr-post-correct.js` | Text correction, quality scoring |

### PDF Operations

| Module | Purpose |
|--------|---------|
| `pdf-operations.js` | Merge, split, rotate, extract, fill forms, watermark |
| `pdf-text-edit.js` | Text insertion/editing, font selection |
| `pdf-security.js` | Password protection, metadata cleaning |
| `pdf-forms.js` | Form field detection and filling |
| `pdf-advanced-edit.js` | Block-level editing |
| `pdf-optimize.js` | Compression, file size reduction |
| `pdf-create.js` | Create PDFs from images or blank templates |
| `pdf-compare.js` | Document diffing |
| `pdf-print.js` | Print layout (booklet, N-up) |

### Export / Conversion

| Module | Purpose |
|--------|---------|
| `export-controller.js` | Orchestrates exports (DOCX, PNG, PDF), undo/redo |
| `docx-converter.js` | PDF → DOCX with structure preservation |
| `html-converter.js` | PDF → HTML |
| `text-extractor.js` | Reading-order text extraction, multi-page export |
| `annotation-export.js` | Annotations → SVG or embedded in PDF |

### UI Components

| Module | Purpose |
|--------|---------|
| `toast.js` | `toastSuccess(msg)`, `toastError(msg)`, `toastWarning(msg)`, `toastProgress(msg, progress)` |
| `modal-prompt.js` | `nrPrompt(options)`, `nrConfirm(options)` — async modal dialogs |
| `hotkeys.js` | Keyboard shortcut binding, cheatsheet |
| `context-menu.js` | Right-click context menus |
| `command-palette.js` | Searchable command palette |
| `ribbon-toolbar.js` | Office-like ribbon with contextual tabs |
| `tab-manager.js` | Multi-tab document browsing |
| `tooltip.js` | Hover tooltips |

### Navigation & File

| Module | Purpose |
|--------|---------|
| `file-controller.js` | `openFile()`, `reloadPdfFromBytes()`, URL management |
| `navigation.js` | Page navigation, back/forward history |
| `search-controller.js` | Full-text search, history, result navigation |
| `outline-controller.js` | Document outline/TOC |

### Persistence & Settings

| Module | Purpose |
|--------|---------|
| `settings-controller.js` | App settings (theme, UI size, OCR language) |
| `app-persistence.js` | Facade for localStorage/IndexedDB |
| `autosave.js` | Auto-save with crash recovery |
| `reading-progress-controller.js` | Page history, reading time, bookmarks, goals |
| `bookmark-controller.js` | Bookmarks CRUD + export/import |
| `notes-controller.js` | Side-panel notes with markdown export |
| `workspace-controller.js` | Document + annotations + OCR as exportable bundle |

### Annotations

| Module | Purpose |
|--------|---------|
| `annotation-controller.js` | Drawing, text markup, erasing, comments |
| `annotations-core.js` | Core annotation model and lifecycle |
| `signature-pad.js` | Signature capture UI |
| `render-annotations-overlay.js` | Watermarks, stamps, signatures, image insertion |

---

## i18n System

**10 languages:** `ru`, `en`, `de`, `fr`, `es`, `pt`, `zh`, `ja`, `ko`, `ar`

```javascript
import { t, setLanguage, applyI18nToDOM } from './i18n.js';

t('sidebar.search');         // returns translated string (fallback: Russian)
setLanguage('en');           // switch + persist to localStorage
applyI18nToDOM();            // apply [data-i18n] attributes to DOM
```

Translations live in `app/locales/<lang>.json`. RTL auto-applied for Arabic.

---

## UI Structure (index.html)

```
.app-shell
  header.command-bar        — Top bar: navigation, zoom, view modes, tool buttons
  aside.sidebar             — Left panel: bookmarks, outline, progress, notes, settings
  main.viewer
    #canvasStack
      #canvas               — Main document canvas
      #annotationCanvas     — Annotation overlay canvas
      #textLayerDiv         — Text selection/search layer
    #searchPanel            — Search input + results
    #ocrPanel               — OCR controls + status
    #annotationPanel        — Annotation tools + comment list
  footer.status-bar         — Page status, zoom, OCR status, reading time
  #settingsModal            — Theme, UI size, hotkeys, etc.
  #commandPalette           — Searchable command list
```

DOM element references are typed in `app/types.d.ts` as `NovaEls`.

---

## Testing Conventions

### Unit Tests (`tests/unit/`)
```javascript
// File: tests/unit/my-module.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// DOM shim (if needed)
// tests/unit/setup-dom.js is auto-loaded for DOM tests

describe('MyModule', () => {
  it('does something', () => {
    assert.strictEqual(result, expected);
  });
});
```

**Run:** `npm run test:unit`  
**Coverage check:** `npm run test:coverage` (≥80% enforced)

### Linting
```bash
npm run lint         # ESLint — must have 0 warnings
npm run typecheck    # TypeScript --noEmit
```

### Build
```bash
npm run build        # Production (minified) → dist/
npm run build:dev    # Development (readable) → dist/
```

---

## Common Skill Operations

### Show a notification
```javascript
import { toastSuccess, toastError, toastProgress } from './toast.js';
toastSuccess(t('export.done'));
toastError(t('export.failed'));
toastProgress(t('export.processing'), 0.5); // 0..1
```

### Navigate to a page
```javascript
import { state } from './state.js';
import { emit } from './event-bus.js';
state.currentPage = 5;
emit('page:navigate', { page: 5 });
```

### Open a file
```javascript
import { openFile } from './file-controller.js';
await openFile(file); // File object or path
```

### Reload document from bytes (after PDF modification)
```javascript
import { reloadPdfFromBytes } from './file-controller.js';
await reloadPdfFromBytes(modifiedPdfBytes);
```

### Run OCR on current page
```javascript
import { ocrController } from './ocr-controller.js';
await ocrController.runOcrForCurrentPage();
```

### Show a confirmation dialog
```javascript
import { nrConfirm } from './modal-prompt.js';
const confirmed = await nrConfirm({ message: t('delete.confirm') });
```

### Add a translation key
1. Add to `app/locales/ru.json` (Russian — primary language)
2. Add to all other 9 locale files
3. Use `t('your.key')` in code

### Add a new setting
1. Add default value in `settings-controller.js`
2. Add UI element in `index.html` `#settingsModal`
3. Add `data-i18n` attribute + translation key
4. Wire event listener in `init-settings.js`

---

## Critical Rules for Writing Modules

1. **No circular imports** — if A needs B and B needs A, use dependency injection
2. **No raw `setTimeout`/`setInterval`** — use `safeTimeout`/`safeInterval` (except progressive loader and DjVu)
3. **Always `@ts-check`** — add `// @ts-check` at top of every new module
4. **Error boundaries** — wrap user-facing operations with `withErrorBoundary`
5. **0-dimension canvas guard** — before any `getContext('2d')` usage in OCR pipeline, check `canvas.width > 0 && canvas.height > 0`
6. **ESLint 0 warnings** — run `npm run lint` before committing
7. **Tests** — add unit tests for new logic in `tests/unit/`
8. **Bundle budget** — run `npm run check:bundle` after adding large dependencies

---

## Build Commands Quick Reference

```bash
npm run build              # Production build
npm run build:dev          # Development build
npm run lint               # ESLint (0 warnings required)
npm run typecheck          # TypeScript check
npm run test:unit          # Unit tests
npm run test:coverage      # Coverage report
npm run check:bundle       # Bundle size budgets
```
