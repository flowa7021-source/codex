# PLAN-5.0 — Глобальный план повышения качества NovaReader

> **Цель:** кратное повышение надёжности, производительности и зрелости ВСЕХ функций.
> Не добавление новых фич, а доведение существующих до production-grade.
> **Статус-кво:** 32K LOC, 71 модуль, ~390 функций в app.js. Работает, но хрупко.

---

## АУДИТ: Текущее техническое состояние

### Сильные стороны
- **Модульная архитектура** — 71 модуль с чёткими границами ответственности
- **Современный стек** — ES2022, Vite, нативные модули, Electron 30
- **Богатая функциональность** — PDF/DjVu/ePub/XPS/CBZ, OCR, аннотации, конвертация
- **Error boundary** — `withErrorBoundary()`, классификация ошибок, recovery strategies
- **Тестовая инфраструктура** — unit + e2e + benchmarks + soak tests
- **Accessibility** — ARIA, keyboard nav, reduced-motion, 5 viewport-профилей

### Критические проблемы

| # | Проблема | Масштаб | Влияние |
|---|---------|---------|---------|
| 1 | **Монолит app.js — 11 000 строк** | 390+ функций в одном файле | Невозможно тестировать, рефакторить, параллельно разрабатывать |
| 2 | **50+ silent catch-блоков** | Ошибки проглатываются без логирования | Баги невидимы, пользователь не понимает почему что-то не работает |
| 3 | **Нет ESLint/Prettier** | Ноль статического анализа | Ошибки найдутся только в runtime |
| 4 | **3 stub-модуля** (cloud, ai, cbz-text) | Экспортируют функции, которые ничего не делают | UI обещает функциональность, которой нет |
| 5 | **~540 хардкод строк на русском в app.js** | Не вынесены в i18n | Невозможна полноценная локализация |
| 6 | **Нет CI-пайплайна для качества** | Только Windows build workflow | Нет linting-gate, нет unit-test gate, нет coverage |
| 7 | **Unit-тесты покрывают ~12% модулей** | 8 test-файлов из 71 модулей | Регрессии не ловятся |
| 8 | **Отсутствует TypeScript/JSDoc typing** | 32K LOC без типов | Рефакторинг на ощупь |
| 9 | **Нет graceful degradation для stubs** | cloud-integration возвращает пустые массивы | Пользователь не знает, что фича не работает |
| 10 | **Дублирование кода** | Toast/error pattern повторяется 50+ раз | DRY нарушен, баги размножаются |
| 11 | **Race condition в state** | `state.backgroundOcrRunning` мутируется из нескольких async-функций | Token-check хрупок, нет mutex/locking |
| 12 | **Memory leak: monitorMemory()** | Рекурсивный `setTimeout` без механизма остановки | `destroyMemoryManager()` не может остановить мониторинг |
| 13 | **Timer leaks** | 13 `setTimeout` / `setInterval`, только 6 `clearTimeout` | Утечки таймеров при смене документа |
| 14 | **4 функции >100 строк** | `runOcrOnPreparedCanvas` 233 LOC, `drawStroke` 190 LOC | Невозможно читать и тестировать |
| 15 | **Нет `"type": "module"` в package.json** | MODULE_TYPELESS_PACKAGE_JSON warning | Шум в тестах, неявное поведение Node.js |

---

## ВОЛНА Q0: Критические баги (исправить НЕМЕДЛЕННО)

> Эти проблемы вызывают реальные сбои в runtime. Исправить ДО любых улучшений.

### Q0.1 [M] Race condition в state management

**Файл:** `app.js`, строки 3092-3467
**Проблема:** `state.backgroundOcrRunning`, `state.ocrJobRunning` мутируются из нескольких async-функций одновременно. Token-based check (`state.backgroundOcrToken !== token`) — хрупок.

**Решение:**
```javascript
// app/modules/async-lock.js
export class AsyncLock {
  #locked = false;
  #queue = [];
  async acquire() {
    if (this.#locked) {
      await new Promise(resolve => this.#queue.push(resolve));
    }
    this.#locked = true;
  }
  release() {
    this.#locked = false;
    if (this.#queue.length) this.#queue.shift()();
  }
}

// Использование:
const ocrLock = new AsyncLock();
async function startBackgroundOcrScan() {
  await ocrLock.acquire();
  try { /* ... */ }
  finally { ocrLock.release(); }
}
```

### Q0.2 [S] Memory leak в monitorMemory()

**Файл:** `memory-manager.js`, строки 159-174
**Проблема:** `setTimeout(monitorMemory, 10000)` — рекурсивный цикл без возможности остановки.

**Исправление:**
```javascript
let _monitorTimerId = null;
function monitorMemory() {
  // ... check memory ...
  _monitorTimerId = setTimeout(monitorMemory, 10000);
}
export function destroyMemoryManager() {
  if (_monitorTimerId) clearTimeout(_monitorTimerId);
  _monitorTimerId = null;
}
```

### Q0.3 [S] Timer leaks — несбалансированные setTimeout/setInterval

**Проблема:** 13 setTimeout, только 6 clearTimeout. Таймеры не очищаются при закрытии документа.

**Исправление:** Создать timer registry:
```javascript
// Все таймеры через:
const _timers = new Set();
export function safeTimeout(fn, ms) {
  const id = setTimeout(() => { _timers.delete(id); fn(); }, ms);
  _timers.add(id);
  return id;
}
export function clearAllTimers() {
  _timers.forEach(clearTimeout);
  _timers.clear();
}
```
Вызвать `clearAllTimers()` в `closeDocument()` и `openFile()`.

### Q0.4 [S] `"type": "module"` в package.json

Добавить `"type": "module"` в package.json для устранения MODULE_TYPELESS_PACKAGE_JSON warning.

---

## ВОЛНА Q1: Структурная целостность (фундамент)

> Без этого всё остальное строится на песке.

### Q1.1 [XL] Декомпозиция app.js → 12 модулей-контроллеров

**Текущее:** 11 000 строк, 390+ функций, невозможно тестировать.

**Разбить на:**

```
app/
├── app.js                    ← 200 строк: init + router + imports
├── controllers/
│   ├── render-controller.js  ← renderCurrentPage, buildTextLayer, updateBboxes
│   ├── ocr-controller.js     ← runOcr, backgroundScan, prepareCanvas
│   ├── search-controller.js  ← PDF search, OCR search, highlighting
│   ├── annotation-controller.js ← strokes, shapes, comments, pro annotations
│   ├── file-controller.js    ← openFile, adapter selection, drag-drop
│   ├── pdf-ops-controller.js ← merge, split, rotate, metadata
│   ├── export-controller.js  ← DOCX, PNG, HTML, batch
│   ├── ui-controller.js      ← toolbar bindings, sidebar, context menus
│   ├── zoom-controller.js    ← zoom, pan, fit-width, fit-page
│   ├── settings-controller.js← language, hotkeys, theme, persistence
│   ├── workspace-controller.js← save/restore, cloud sync
│   └── text-edit-controller.js← inline edit, paragraph reflow, spellcheck
```

**Критерий успеха:** каждый контроллер <1000 строк, testable в изоляции.

### Q1.2 [L] ESLint + Prettier + pre-commit hook

**Конфигурация:**
```json
{
  "extends": ["eslint:recommended"],
  "env": { "browser": true, "es2022": true },
  "parserOptions": { "sourceType": "module" },
  "rules": {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-empty": ["error", { "allowEmptyCatch": false }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error"
  }
}
```

- Prettier: 100 char line width, single quotes, trailing commas
- `husky` + `lint-staged` для pre-commit
- CI gate: PR не проходит без зелёного lint

### Q1.3 [L] CI/CD Pipeline: lint → test → build

**Новый workflow `.github/workflows/ci.yml`:**

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [checkout, node 22, npm ci, npx eslint app/]

  test-unit:
    runs-on: ubuntu-latest
    steps: [checkout, node 22, npm ci, npm run test:unit]

  test-e2e:
    runs-on: ubuntu-latest
    steps: [checkout, node 22, npm ci, npx playwright install, npm run test:e2e]

  build-win:
    needs: [lint, test-unit]
    runs-on: windows-2022
    # ... existing build
```

**Критерий:** Merge в main невозможен без зелёного CI.

### Q1.4 [M] Ликвидация silent catch-блоков

**50+ мест** где `catch { /* ignore */ }` скрывает ошибки.

**Стратегия замены:**
```javascript
// БЫЛО:
try { action(); } catch { /* ignore */ }

// СТАЛО для некритических:
try { action(); } catch (err) {
  console.warn('[module:action] Non-critical error:', err.message);
  diagnostics.log('action_failed', { error: err.message });
}

// СТАЛО для критических:
try { action(); } catch (err) {
  handleError(err, { context: 'action', severity: 'medium' });
}
```

**Файлы с наибольшим количеством silent catch:**
- `app.js` — 18 мест
- `pdf-pro-tools.js` — 8 мест
- `pdf-security.js` — 5 мест
- `ocr-storage.js` — 5 мест
- `cloud-integration.js` — 1 место
- `error-handler.js` — 2 места

---

## ВОЛНА Q2: Надёжность и наблюдаемость

### Q2.1 [L] Unit-тесты для ВСЕХ модулей (цель: 80% coverage)

**Текущее покрытие:** 8 из 71 модулей (~11%).

**Порядок приоритета (по риску):**

| Приоритет | Модули | Почему |
|-----------|--------|--------|
| P0 | state.js, perf.js, memory-manager.js | Core state — ломается = всё ломается |
| P1 | tesseract-adapter.js, ocr-batch.js, ocr-preprocess.js | OCR — самая сложная и хрупкая подсистема |
| P1 | pdf-operations.js, pdf-advanced-edit.js | PDF editing — основная ценность приложения |
| P2 | docx-converter.js, html-converter.js | Export — видимый результат для пользователя |
| P2 | text-layer-builder.js, navigation.js, virtual-scroll.js | Rendering pipeline |
| P3 | Все остальные модули | Утилиты, UI, вспомогательные |

**Инструмент:** `node:test` (уже используется) + `c8` для coverage.

**Цель по метрикам:**
- Statements: 80%+
- Branches: 70%+
- Functions: 85%+

### Q2.2 [M] Structured logging вместо console.log/warn

**Текущее:** хаотичный `console.log()` / `console.warn()` — невозможно фильтровать.

**Решение:** Единый logger с уровнями:

```javascript
// app/modules/logger.js
export const log = {
  debug: (tag, msg, data) => { /* только в dev */ },
  info:  (tag, msg, data) => { /* нормальные события */ },
  warn:  (tag, msg, data) => { /* что-то пошло не так, но работаем */ },
  error: (tag, msg, data) => { /* ошибка, нужно действие */ },
};
```

- В production: только warn + error
- Tag = имя модуля: `[ocr]`, `[render]`, `[pdf-ops]`
- Интеграция с `diagnostics.js` — все логи в event store

### Q2.3 [M] Graceful degradation для stub-модулей

**Текущее:** `cloud-integration.js` возвращает пустые массивы, UI показывает кнопки облака.

**Решение:**
```javascript
// Каждый stub-модуль экспортирует:
export const MODULE_STATUS = 'stub'; // | 'partial' | 'ready'
export const MODULE_REQUIRES = ['Google OAuth2 Client ID'];

// UI проверяет:
if (cloudIntegration.MODULE_STATUS === 'stub') {
  button.disabled = true;
  button.title = 'Требуется настройка: Google OAuth2';
}
```

**Модули для маркировки:**
- `cloud-integration.js` → `stub` (все 3 провайдера)
- `ai-features.js` → `partial` (heuristic-only, без AI backend)
- `pdf-pro-tools.js` → `partial` (headers/footers частично)

### Q2.4 [M] JSDoc-типизация критических модулей

Вместо полного перехода на TypeScript (слишком дорого для 32K LOC), добавить JSDoc с `@ts-check`:

```javascript
// @ts-check
/** @typedef {{ x: number, y: number, w: number, h: number }} Bounds */
/** @typedef {'highlight'|'underline'|'strikethrough'|'sticky-note'|'text-box'} AnnotationType */

/**
 * @param {number} pageNum
 * @param {{ type: AnnotationType, bounds: Bounds, color?: string }} annotation
 * @returns {string} annotation ID
 */
export function addAnnotation(pageNum, annotation) { ... }
```

**Приоритет JSDoc:** state.js → tesseract-adapter.js → pdf-operations.js → annotation controller

---

## ВОЛНА Q3: Производительность и UX

### Q3.1 [L] Замена 540 хардкод-строк на i18n-ключи

**Текущее:** `app.js` содержит ~540 строк на русском, вплетённых в логику.

**Подход:**
1. Grep все русские строки: `[а-яА-ЯёЁ]+` в app.js
2. Создать ключи в `i18n.js`: `t('ocr.background_progress', { count, total })`
3. Заменить все `'OCR: фоновое распознавание...'` → `t('ocr.background_progress')`

**Объём:** ~540 строк → ~540 ключей. Тяжёлая, но механическая работа.

### Q3.2 [L] Оптимизация рендеринга: debounce + requestAnimationFrame

**Текущие проблемы:**
- `renderCurrentPage()` вызывается синхронно при каждом zoom/scroll
- Нет batching для rapid-fire событий (resize, zoom slider)
- Canvas перерисовывается полностью даже при изменении только текстового слоя

**Решение:**
```javascript
// render-controller.js
let _renderQueued = false;
export function scheduleRender(reason) {
  if (_renderQueued) return;
  _renderQueued = true;
  requestAnimationFrame(() => {
    _renderQueued = false;
    _doRender(reason);
  });
}
```

- Отдельные invalidation-флаги: `canvasDirty`, `textLayerDirty`, `annotationsDirty`
- Не перерисовывать canvas при изменении только аннотаций

### Q3.3 [M] Memory leak audit

**Известные риски:**
- `ObjectURL` создаются через `URL.createObjectURL()` и не всегда освобождаются
- Canvas-элементы не обнуляются при смене страницы (webkit memory)
- Tesseract workers не terminaте при закрытии документа (только при exit)
- Event listeners добавляются при каждом рендере без removeEventListener

**Решение:**
```javascript
// memory-manager.js — расширить:
export function trackObjectURL(url) { _urls.add(url); }
export function revokeAll() { _urls.forEach(URL.revokeObjectURL); }

// При смене страницы:
export function clearPageResources() {
  revokeAll();
  _canvasPool.forEach(c => { c.width = 0; c.height = 0; }); // webkit free
}
```

### Q3.4 [M] Throttling для тяжёлых операций

**Текущее:** OCR background scan, batch operations, merge/split не throttled.

**Добавить:**
- `requestIdleCallback` для фоновых задач (OCR scan, indexing)
- Приоритетная очередь: UI рендер > user action > background OCR
- Yield to main thread каждые 16ms (60fps budget)

---

## ВОЛНА Q4: Инженерная культура

### Q4.1 [M] API контракты между модулями

**Текущее:** Модули общаются через прямые вызовы + глобальный state.

**Решение — EventBus:**
```javascript
// app/modules/event-bus.js
const _bus = new EventTarget();

export function emit(event, detail) {
  _bus.dispatchEvent(new CustomEvent(event, { detail }));
}
export function on(event, handler) {
  _bus.addEventListener(event, (e) => handler(e.detail));
}
```

**Пример:**
```javascript
// ocr-controller.js
emit('ocr:page-done', { page: 5, confidence: 0.92, text: '...' });

// search-controller.js (подписчик)
on('ocr:page-done', ({ page, text }) => updateSearchIndex(page, text));
```

Это позволит:
- Тестировать модули изолированно (mock event bus)
- Добавлять новых подписчиков без изменения существующего кода
- Отслеживать поток данных в приложении

### Q4.2 [S] Версионирование и changelog

- `CHANGELOG.md` с Keep a Changelog format
- `npm version patch/minor/major` для релизов
- Git tags для каждого релиза

### Q4.3 [S] Contributing guide

- Как запустить dev-окружение
- Структура модулей (какой файл за что отвечает)
- Правила commit messages (conventional commits)
- Как добавить новый формат/инструмент

---

## ВОЛНА Q5: Качество каждой подсистемы

### Q5.1 OCR Pipeline — доведение до production

| Аспект | Текущее | Целевое |
|--------|---------|---------|
| Скорость | 28с/стр → ~5с (pool) | <3с/стр (pool + preprocessing optimization) |
| Confidence display | Есть, но hidden | Цветная шкала на каждое слово |
| Error recovery | 3 retry | Fallback на другой preprocessing mode |
| Caching | IndexedDB | + in-memory LRU для текущего документа |
| Languages | 15 | 15 + auto-detect ensemble |
| Progress UX | Процент в statusbar | Per-page progress + ETA + cancel button |

### Q5.2 PDF Editing — стабилизация

| Аспект | Текущее | Целевое |
|--------|---------|---------|
| Text reflow | Работает для простых параграфов | Edge-case: multi-column, RTL, vertical text |
| Undo/Redo | Только текст | Все операции (annotations, rotate, delete) |
| Save | pdf-lib drawText | Validate output: PDF/A compliance check |
| Image editing | Block add | + crop, replace, resize с preview |

### Q5.3 Аннотации — полнота и корректность

| Аспект | Текущее | Целевое |
|--------|---------|---------|
| Types | 11 (pen, rect, arrow, line, circle, comment, highlight, underline, strikethrough, squiggly, text-box, sticky) | + callout, cloud, polygon, measurement |
| Persistence | In-memory + export | Auto-save to PDF (flatten option) |
| Collaboration | Нет | Export as XFDF для review workflow |
| Undo | Последняя аннотация | Undo stack для каждого типа |

### Q5.4 Конвертация — точность

| Аспект | Текущее | Целевое |
|--------|---------|---------|
| PDF→DOCX | Текст + images + bold/italic | + таблицы, списки, заголовки, колонки |
| PDF→HTML | Базовый | + responsive layout, навигация |
| PDF→Excel | Нет | Извлечение таблиц → XLSX |
| Batch | Работает | + queue UI, error recovery, retry per-file |

---

## ПРИОРИТЕТЫ РЕАЛИЗАЦИИ

### Sprint 0 (День 1): Критические баги
0. **Q0.1** Race condition fix (AsyncLock) — _предотвращение data corruption_
0. **Q0.2** monitorMemory leak fix — _memory leak_
0. **Q0.3** Timer registry + cleanup — _timer leaks_
0. **Q0.4** `"type": "module"` в package.json — _1 строка_

### Sprint 1 (Неделя 1-2): Фундамент
1. **Q1.2** ESLint + Prettier + pre-commit — _гейт качества_
2. **Q1.3** CI pipeline (lint + test gate) — _автоматическая проверка_
3. **Q1.4** Ликвидация silent catch (50+ мест) — _видимость ошибок_
4. **Q2.2** Structured logging — _наблюдаемость_

### Sprint 2 (Неделя 3-4): Архитектура
5. **Q1.1** Декомпозиция app.js → контроллеры — _тестируемость_
6. **Q4.1** EventBus между модулями — _слабая связанность_
7. **Q2.3** Graceful degradation для stubs — _честный UI_

### Sprint 3 (Неделя 5-6): Тесты и типы
8. **Q2.1** Unit-тесты P0+P1 модулей — _покрытие 50%_
9. **Q2.4** JSDoc-типизация core модулей — _IDE support_
10. **Q3.3** Memory leak audit — _стабильность_

### Sprint 4 (Неделя 7-8): Производительность и i18n
11. **Q3.1** i18n: 540 строк → ключи — _мультиязычность_
12. **Q3.2** Render optimization (rAF + invalidation) — _60fps_
13. **Q3.4** Throttling тяжёлых операций — _отзывчивость UI_

### Sprint 5 (Неделя 9-10): Подсистемы
14. **Q5.1** OCR pipeline hardening — _<3с, confidence UI_
15. **Q5.2** PDF editing stabilization — _edge-cases, undo_
16. **Q5.3** Аннотации — полнота — _auto-save, XFDF_
17. **Q5.4** Конвертация — таблицы, Excel — _точность_

### Sprint 6 (Неделя 11-12): Polish
18. **Q2.1** Unit-тесты P2+P3 — _покрытие 80%_
19. **Q4.2** Changelog + versioning — _процесс_
20. **Q4.3** Contributing guide — _онбоардинг_

---

## МЕТРИКИ УСПЕХА

| Метрика | Сейчас | Цель |
|---------|--------|------|
| Файл app.js | 11 000 LOC | <500 LOC (router) |
| Silent catch blocks | 50+ | 0 |
| Race conditions | 1 critical (OCR state) | 0 (AsyncLock) |
| Memory leaks | 2 (monitor + timers) | 0 |
| Unit test coverage | ~11% | 80% |
| ESLint errors | Неизвестно (нет lint) | 0 |
| i18n coverage | ~0% (540 хардкод) | 100% |
| OCR скорость | ~5с/стр (pool) | <3с/стр |
| CI pipeline | Build only | Lint → Test → Build |
| Max function length | 233 строки | <80 строк |
| Console.log в production | ~100 | 0 (через logger) |
| Stub modules честность | Скрыто | UI disabled + tooltip |
| Unbalanced timers | 7 leak-candidates | 0 (timer registry) |

---

*Этот план ортогонален PLAN-4.0 (фичи). PLAN-5.0 — про качество существующего кода.
Оба плана могут выполняться параллельно: новые фичи сразу пишутся по стандартам Q1-Q4.*
