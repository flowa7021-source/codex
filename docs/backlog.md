# NovaReader 4.0.0 — Product Backlog

**Status: ALL ITEMS COMPLETE.** Backlog is clear for v4.0.0 release.

## P0 — Stability & Performance: DONE
- [x] UI-freeze elimination (worker pool)
- [x] Error boundary + recovery flow
- [x] Performance budgets in CI
- [x] Memory management (LRU cache, URL registry)
- [x] Safe timer registry with scoped cleanup
- [x] DjVu file opening crash fix
- [x] OCR pipeline dimension guards
- [x] Bundle size reduction (-32%, 234KB gzip)

## P0 — OCR 2.0: DONE
- [x] Preprocessing pipeline (deskew, denoise, binarize)
- [x] Confidence scoring + post-correction (28 languages)
- [x] Batch OCR queue with cancellation/progress
- [x] OCR search index with coordinates
- [x] Lazy-loaded Tesseract.js

## P0 — PDF Pro: DONE
- [x] Text editing layer with undo/redo
- [x] DOCX converter (paragraphs, styles, images, tables)
- [x] DOCX import/merge
- [x] 4 table conversion plugins (Invoice, Financial, Scientific, Timetable)
- [x] PDF merge/split with UI yield points

## P1 — Architecture: DONE
- [x] CSS modularization (12 files)
- [x] Controller decomposition (export, render, ocr)
- [x] TypeScript incremental setup (19 checked modules)
- [x] Unified persistence facade
- [x] Code splitting (dynamic imports)
- [x] Hidden source maps

## P1 — Internationalization: DONE
- [x] 9 UI languages (RU/EN/DE/FR/ES/PT/ZH/JA/KO)
- [x] 357 keys per language, 282 tagged elements
- [x] RTL support (AR/HE/FA/UR)

## P1 — Testing & CI: DONE
- [x] 500+ tests (unit, integration, benchmarks, E2E, visual)
- [x] CI pipeline (lint, tests, coverage, build, budget, E2E, audit)
- [x] Lighthouse CI thresholds
- [x] Bundle analysis with baseline

## P2 — Security & Polish: DONE
- [x] E2E encryption for cloud sync (AES-GCM)
- [x] XSS prevention (textContent everywhere)
- [x] npm audit in CI
- [x] Error boundary fallback UI
- [x] PWA service worker
- [x] Performance profiling markers
- [x] Git LFS for vendor files
- [x] Conventional commits + changelog
- [x] Component documentation

## Future Considerations (Post-Release)
- [ ] Expand @ts-check to remaining 142 modules
- [ ] Full Lighthouse score optimization (90+)
- [ ] Additional i18n languages (Arabic, Hindi, Thai, etc.)
- [ ] Plugin system for third-party extensions
- [ ] Collaborative editing (WebRTC/WebSocket)
