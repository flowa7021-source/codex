# NovaReader v4.0 — Комплексный план улучшений

> Дата аудита: 2026-03-19
> Версия: 4.0.0 | 90 JS-файлов | ~32K LOC app + ~3.5K LOC tests

---

## АУДИТ: Текущее техническое состояние

### Сводка метрик

| Метрика | Значение | Оценка |
|---------|----------|--------|
| Модулей в app/modules/ | 87 файлов | Хорошая декомпозиция |
| app.js (оркестратор) | 1 584 LOC | Приемлемо (было 11K) |
| Самые большие модули | render-controller 977, export-controller 976, ocr-controller 869 | Требуют внимания |
| ESLint ошибок | 0 | Отлично |
| ESLint предупреждений | 132 | Требует работы |
| Unit-тестов | 220 (pass), 10 файлов | Покрытие ~14% модулей |
| Silent catch-блоков (`catch {}`) | 67 в 31 файле | Критическая проблема |
| TODO/FIXME в коде | 0 | Хорошо |
| CI pipeline | lint + unit tests | Нет e2e в CI |
| i18n | 2 языка (ru/en), ~540 хардкод-строк | Неполное |
| Стаб-модули | cloud-integration, ai-features (partial) | UI не сообщает об ограничениях |
| Типизация | Нет (ни TS, ни JSDoc @ts-check) | Рефакторинг вслепую |

### Что реализовано хорошо

1. **Модульная архитектура** — 87 модулей с чёткими границами (render, ocr, pdf-ops, export, annotations и т.д.)
2. **Декомпозиция app.js** — снижен с 11K до 1.5K LOC (оркестратор)
3. **OCR pipeline** — Tesseract.js 5 с worker pool, adaptive DPI, confidence scoring, batch OCR, post-correction (ru/en)
4. **PDF Pro Tools** — merge/split/rotate/watermark/encrypt/redact/text-edit/forms/headers/Bates
5. **Конвертация** — PDF→DOCX (с таблицами, стилями, images), PDF→HTML, Image→PDF, DjVu→PDF
6. **Тестовая инфраструктура** — unit (node:test), e2e (Playwright), benchmarks, soak tests
7. **Accessibility** — ARIA, keyboard nav, reduced-motion, 5 viewport-профилей
8. **Error boundary** — `withErrorBoundary()`, crash telemetry, diagnostics
9. **ESLint** настроен, 0 ошибок
10. **CI** — lint + unit-test gates

### Критические проблемы

| # | Проблема | Файлов | Влияние |
|---|---------|--------|---------|
| 1 | **67 silent catch-блоков** | 31 | Ошибки проглатываются — баги невидимы |
| 2 | **132 ESLint warnings** (unused vars, empty blocks) | 12 | Мёртвый код, снижена читаемость |
| 3 | **14% покрытие тестами** (10 из 87 модулей) | — | Регрессии не ловятся |
| 4 | **Нет типизации** | все | Рефакторинг на ощупь |
| 5 | **~540 хардкод-строк на русском** | app.js + модули | Неполная i18n |
| 6 | **3 крупных модуля >900 LOC** | 3 | Сложно тестировать |
| 7 | **Стабы без маркировки** | cloud, ai | UI обещает то, чего нет |
| 8 | **Нет e2e в CI** | — | Регрессии UI не ловятся автоматически |
| 9 | **Нет coverage reporting** | — | Непонятен уровень покрытия |
| 10 | **Нет pre-commit hooks** | — | Нет гейта до пуша |

---

## ПЛАН УЛУЧШЕНИЙ

### Волна 1: Гигиена кода (приоритет — немедленно)

#### 1.1 [M] Устранение 132 ESLint warnings

**Файлы с наибольшим числом warnings:**
- `workspace-controller.js` — 4 unused `err`
- `xps-adapter.js` — 2 unused vars
- `ui-init-blocks.js` — 3 (unused err, setOcrStatus, includeAnnotations)
- `text-layer-builder.js` — 2 unused vars (c, d)
- `text-extractor.js` — 1 unused xEnds
- `touch-gestures.js` — 1 empty block
- `undo-redo.js` — 1 empty block

**Действия:**
- Удалить или переименовать в `_err`, `_c` неиспользуемые переменные
- Добавить логирование в пустые catch-блоки
- Цель: `--max-warnings 0` в CI

#### 1.2 [L] Устранение 67 silent catch-блоков

**Стратегия по категориям:**

| Категория | Файлы | Действие |
|-----------|-------|----------|
| Некритичные (UI fallback) | thumbnail, navigation, loaders | `catch (e) { console.warn('[module]', e.message); }` |
| Storage (IndexedDB, localStorage) | ocr-storage (5), app-persistence (2), bookmark (2), notes (2) | Логировать + продолжить с fallback |
| PDF операции | pdf-operations (3), pdf-optimize (6), pdf-forms (4), pdf-create (2) | `handleError(e, { context, severity: 'medium' })` |
| OCR pipeline | tesseract-adapter (9), ocr-batch (3) | Логировать + retry/fallback |
| Конвертация | docx-structure-detector (5), batch-convert, convert-to-pdf | Логировать + user notification |

#### 1.3 [S] Ужесточение CI pipeline

- `--max-warnings 0` в eslint step
- Добавить coverage reporting через `c8`
- Добавить e2e tests step (Playwright с `--project=desktop-hd`)

---

### Волна 2: Тестовое покрытие (цель: 50% модулей)

#### 2.1 [XL] Unit-тесты для критических модулей

**Текущее покрытие: 10 файлов / 87 модулей**

Существующие тесты:
- `ai-features.test.js`, `annotations-core.test.js`, `app-persistence.test.js`
- `error-handler.test.js`, `ocr-post-correct.test.js`, `ocr-search.test.js`
- `pdf-forms.test.js`, `pdf-print.test.js`, `pdf-pro-tools.test.js`, `text-extractor.test.js`

**Приоритет P0 (core — ломается = всё ломается):**
- `state.js` — state management
- `event-bus.js` — межмодульная коммуникация
- `memory-manager.js` — lifecycle, утечки
- `safe-timers.js` — timer registry
- `async-lock.js` — concurrency

**Приоритет P1 (основная ценность):**
- `tesseract-adapter.js` — OCR engine
- `ocr-batch.js` — batch processing
- `ocr-image-processing.js` — preprocessing
- `pdf-operations.js` — merge/split/rotate
- `pdf-advanced-edit.js` — text editing
- `docx-converter.js` — export
- `docx-structure-detector.js` — structure analysis

**Приоритет P2 (rendering/UX):**
- `render-controller.js` — page rendering
- `navigation.js` — page navigation
- `virtual-scroll.js` — continuous scroll
- `search-controller.js` — search
- `bookmark-controller.js` — bookmarks
- `tab-manager.js` — tabs

**Цель:** +30 тест-файлов, +500 тестов, покрытие 50% модулей

#### 2.2 [M] Coverage reporting

- Добавить `c8` в devDependencies
- `"test:coverage": "c8 --reporter=text --reporter=lcov node --test tests/unit/*.test.js"`
- CI gate: coverage >= 40% statements
- Визуальный отчёт в PR

---

### Волна 3: Надёжность и наблюдаемость

#### 3.1 [M] Structured logging

**Текущее:** хаотичный `console.log/warn/error`.

**Целевое:** Расширить существующий `logger.js`:
```
log.debug('[render]', 'Page rendered', { page: 5, ms: 120 });
log.warn('[ocr]', 'Low confidence', { page: 3, confidence: 0.4 });
log.error('[pdf-ops]', 'Merge failed', { error: err.message });
```
- Production: только warn + error
- Dev: все уровни
- Интеграция с diagnostics.js

#### 3.2 [M] Graceful degradation для stub-модулей

Каждый стаб экспортирует `MODULE_STATUS`:
```javascript
export const MODULE_STATUS = 'stub'; // | 'partial' | 'ready'
```

UI проверяет и отключает кнопки:
- `cloud-integration.js` → `stub` (Google Drive, Dropbox, OneDrive)
- `ai-features.js` → `partial` (heuristic-only, без AI backend)

#### 3.3 [S] Memory leak audit

Проверить и исправить:
- `URL.createObjectURL()` — все ли revoke'd при смене документа
- Canvas элементы — обнуление width/height при dispose (WebKit)
- Tesseract workers — terminate при закрытии документа
- Event listeners — removeEventListener при переключении вкладок

---

### Волна 4: Типизация и документирование

#### 4.1 [L] JSDoc @ts-check для core-модулей

Вместо миграции на TypeScript — добавить JSDoc с `// @ts-check`:

**Порядок:**
1. `state.js` — все поля state объекта
2. `event-bus.js` — типы событий
3. `pdf-operations.js` — входы/выходы всех операций
4. `tesseract-adapter.js` — OCR API
5. `render-controller.js` — render pipeline

**Эффект:** IDE autocomplete, ошибки до runtime, документация из кода.

#### 4.2 [M] API contracts между модулями

Формализовать интерфейсы:
```javascript
/** @typedef {Object} OcrResult
 *  @property {string} text
 *  @property {number} confidence
 *  @property {Array<{text: string, bbox: Bounds, confidence: number}>} words
 */
```

---

### Волна 5: Производительность

#### 5.1 [M] Render pipeline optimization

- `requestAnimationFrame` debounce для rapid-fire zoom/scroll
- Раздельные dirty-флаги: `canvasDirty`, `textLayerDirty`, `annotationsDirty`
- Не перерисовывать canvas при изменении только аннотаций

#### 5.2 [M] Декомпозиция крупных модулей

3 модуля >900 LOC — кандидаты на разбиение:
- `render-controller.js` (977 LOC) → render-core + render-text-layer + render-annotations-layer
- `export-controller.js` (976 LOC) → export-docx + export-html + export-images
- `ocr-controller.js` (869 LOC) → ocr-core + ocr-background + ocr-ui

#### 5.3 [S] Throttling фоновых операций

- `requestIdleCallback` для background OCR scan, indexing
- Yield to main thread каждые 16ms (60fps budget)

---

### Волна 6: i18n и UX Polish

#### 6.1 [L] Вынос ~540 хардкод-строк в i18n

- Grep все русские строки в app.js и модулях
- Создать ключи в `i18n.js`
- Заменить все литералы → `t('key')`
- Цель: 100% i18n coverage

#### 6.2 [M] Улучшение UI для ошибок

- Toast notifications вместо console.log для user-facing ошибок
- Прогресс-бар с ETA для batch-операций
- Отмена для долгих операций (OCR batch, merge, convert)

---

### Волна 7: CI/CD и инфраструктура

#### 7.1 [M] Полный CI pipeline

```yaml
jobs:
  lint:        # eslint --max-warnings 0
  test-unit:   # node --test + c8 coverage
  test-e2e:    # playwright (desktop + mobile)
  build-web:   # vite build
  build-win:   # electron-builder (depends on lint + test)
```

#### 7.2 [S] Pre-commit hooks

- `husky` + `lint-staged`
- На commit: eslint --fix для staged файлов
- Блокирует коммиты с lint ошибками

#### 7.3 [S] Release workflow

- `CHANGELOG.md` (Keep a Changelog)
- `npm version` + git tags
- Автоматический GitHub Release при теге `v*`

---

## ПРИОРИТЕТЫ РЕАЛИЗАЦИИ

| Спринт | Волна | Задачи | Эффект |
|--------|-------|--------|--------|
| **S1** (сейчас) | 1 — Гигиена | 1.1 Fix 132 warnings, 1.2 Fix 67 silent catch, 1.3 CI strict | Видимость ошибок, чистый код |
| **S2** | 2 — Тесты | 2.1 +30 тест-файлов P0+P1, 2.2 Coverage | Защита от регрессий |
| **S3** | 3 — Надёжность | 3.1 Structured logging, 3.2 Stub markers, 3.3 Memory audit | Наблюдаемость, честный UI |
| **S4** | 4 — Типы | 4.1 JSDoc @ts-check core, 4.2 API contracts | IDE support, документация |
| **S5** | 5 — Perf | 5.1 Render opt, 5.2 Split big modules, 5.3 Throttling | 60fps, maintainability |
| **S6** | 6 — i18n | 6.1 540 строк → i18n, 6.2 Error UX | Мультиязычность |
| **S7** | 7 — CI/CD | 7.1 Full pipeline, 7.2 Pre-commit, 7.3 Releases | Автоматизация |

---

## МЕТРИКИ УСПЕХА

| Метрика | Сейчас | После S1 | После S3 | Финал |
|---------|--------|----------|----------|-------|
| ESLint warnings | 132 | 0 | 0 | 0 |
| Silent catch blocks | 67 | 0 | 0 | 0 |
| Test coverage (модули) | 14% | 14% | 50% | 70%+ |
| Unit tests count | 220 | 220 | 700+ | 1000+ |
| Typed modules (JSDoc) | 0 | 0 | 0 | 15+ |
| i18n coverage | ~50% | ~50% | ~50% | 100% |
| CI gates | lint+unit | strict lint+unit | +e2e+coverage | +release |
| Max module size | 977 LOC | 977 | 977 | <600 |
| Stub UI honesty | Скрыто | Скрыто | Маркировка | disabled+tooltip |
