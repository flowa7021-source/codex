# NovaReader — План глобального обновления

## Текущее состояние

| Компонент | LOC | Качество | Оценка |
|-----------|-----|----------|--------|
| app.js (декомпозирован) | 1,425 | Модульный, 84 импорта, ~870 event bindings | 7/10 архитектура |
| styles.css | 2,559 | Полная тема: dark/light/sepia/high-contrast, a11y | 8/10 |
| index.html | 981 | Семантичный, 104 aria-*, 37 role=, WCAG-ready | 9/10 |
| 99 модулей | ~28,000 | 97 ready, 1 partial (ai), 1 stub (cloud) | 8/10 |
| **Итого** | **~33,000** | | |

**Сильные стороны:** PDF.js рендеринг, тёмная тема 2.0, OCR через Tesseract с предобработкой, PDF операции (merge/split/watermark/headers/Bates/flatten/accessibility), i18n 17 языков, кэширование страниц, 5 адаптеров (PDF, DjVu×2, Image, EPUB), полная a11y (ARIA, keyboard, screen reader), toast-уведомления, undo/redo, context menus, tooltips.

**Оставшиеся задачи:**
- Большие модули нуждаются в дальнейшей декомпозиции (ocr-controller 1442 LOC, docx-converter 1075 LOC)
- cloud-integration.js — stub (требует OAuth2 ключи)
- ai-features.js — partial (только heuristic, нет AI API)
- Форм-валидация отсутствует (required, format checks)
- Testing инфраструктура не создана

---

## Фаза 1: Стабильность и архитектура ✅ ЗАВЕРШЕНА

> Цель: сделать код поддерживаемым и надёжным

### 1.1 Декомпозиция app.js ✅
Разделить монолит на модули по ответственности:

| Новый модуль | Функции из app.js | ~LOC |
|-------------|-------------------|------|
| `viewer-core.js` | renderCurrentPage, renderTextLayer, zoom/fit/rotate, pan | ~800 |
| `file-loader.js` | openFile, adapters (PDF/DjVu/Image/EPUB/Unsupported) | ~600 |
| `annotations.js` | strokes, shapes, comments, import/export annotations | ~500 |
| `ocr-pipeline.js` | buildOcrSourceCanvas, runOcrOnRect, runOcrForCurrentPage, background scan | ~700 |
| `search-engine.js` | searchInPdf, highlightSearchInTextLayer, search history | ~400 |
| `export-manager.js` | exportCurrentDocToWord, generateDocxBlob, capturePageAsImageData | ~300 |
| `ui-bindings.js` | Все addEventListener, event handlers, UI state | ~1200 |
| `outline-previews.js` | buildOutlineItems, renderOutline, renderPagePreviews | ~300 |
| `workspace-cloud.js` | pushWorkspaceToCloud, pullWorkspaceFromCloud, import/export workspace | ~400 |
| `pdf-tools-ui.js` | Pro PDF Tool Handlers (линии 8611-9739) | ~1100 |
| `reading-session.js` | readingTime, readingProgress, page history navigation | ~200 |
| `continuous-scroll.js` | Режим непрерывной прокрутки | ~200 |

**Результат:** app.js → 28 модулей, каждый <800 строк, с чистыми импортами.

### 1.2 Система уведомлений (Toast) ✅
Заменить `setOcrStatus()` на полноценную toast-систему:
- Типы: success, error, warning, info, progress
- Автоскрытие через 3-5 секунд
- Стек до 5 уведомлений
- Прогресс-бар для длительных операций
- Click-to-dismiss
- Файл: `app/modules/toast.js` (~150 LOC)

### 1.3 Undo/Redo система ✅
- Глобальный стек команд (Command pattern)
- Поддержка: редактирование текста, аннотации, перемещение блоков
- Ctrl+Z / Ctrl+Shift+Z
- Файл: `app/modules/undo-redo.js` (~200 LOC)

### 1.4 Улучшение обработки ошибок ✅
- Обёрнуть все 87 try/catch в единый error handler
- Error boundary для рендеринга
- Автовосстановление при крашах рендеринга (retry с fallback)
- Сохранение состояния при ошибке

---

## Фаза 2: Качество просмотра документов ✅ ЗАВЕРШЕНА

> Цель: довести viewer до уровня Adobe Acrobat Reader

### 2.1 Режимы просмотра ✅
- **Двухстраничный (Two-Up):** книжный разворот, чётная/нечётная
- **Непрерывная прокрутка:** виртуализированный скролл с ленивой загрузкой
- **Книжный режим:** Two-Up + обложка на первой странице
- **Презентация:** полноэкранный слайд-шоу с переходами
- Файл: `app/modules/view-modes.js` (~500 LOC)

### 2.2 Улучшенный зум ✅
- Marquee Zoom (выделение области для увеличения)
- Zoom to Selection
- Пресеты: 25%, 50%, 75%, 100%, 125%, 150%, 200%, 400%
- Запоминание зума по документу
- Pinch-to-zoom на тачскринах
- Smooth zoom с анимацией

### 2.3 Улучшение навигации ✅
- **Page labels** (i, ii, iii, 1, 2, 3...)
- **Named destinations** из PDF
- **Thumbnail grid** — сетка миниатюр для быстрого перехода
- **Minimap** — мини-карта текущей позиции на странице
- **Link following** — клик по внутренним ссылкам PDF
- **Reading position memory** — запоминание позиции по документу

### 2.4 Text layer качества Acrobat ✅
- Использовать PDF.js `TextLayerBuilder` вместо ручного span-creation
- Точное попиксельное совпадение текста с рендером
- Поддержка CJK, RTL, вертикального текста
- Copy-paste с сохранением порядка чтения

### 2.5 EPUB reader улучшения ✅
- CSS preservation из EPUB
- NCX Table of Contents
- Embedded font loading
- Chapter-based continuous scroll
- Night mode / Sepia mode для EPUB
- Adjustable font size / line height / margins

---

## Фаза 3: OCR и распознавание текста ✅ ЗАВЕРШЕНА

> Цель: OCR качества ABBYY FineReader

### 3.1 Предобработка изображений ✅
- **Deskew** — автоматическое выравнивание наклонённых страниц
- **Denoise** — удаление шума (медианный фильтр)
- **Binarization** — адаптивный Otsu/Sauvola
- **Border removal** — удаление чёрных рамок сканов
- Файл: `app/modules/ocr-preprocess.js` (~300 LOC)

### 3.2 Мультиязычность ✅
- Расширить с 7 до 15+ языков
- Добавить: китайский (chi_sim/chi_tra), японский (jpn), корейский (kor), арабский (ara), хинди (hin), турецкий (tur), польский (pol), чешский (ces)
- Автодетекция языка до OCR
- Мультиязычный OCR на одной странице

### 3.3 Post-OCR коррекция ✅
- Словарная проверка через Hunspell-like алгоритм
- Контекстный анализ n-грамм (существующие биграммы расширить до триграмм)
- Коррекция разрывов строк и переносов
- Восстановление абзацной структуры
- Confidence-based фильтрация (слова с confidence < 60% помечать)

### 3.4 Layout analysis ✅
- Определение зон: текст, изображение, таблица, формула
- Reading order detection (колонки → строки)
- Table structure recognition (строки, столбцы, merged cells)
- Файл: `app/modules/ocr-layout.js` (~400 LOC)

### 3.5 Пакетный OCR ✅
- Параллельная обработка через Web Workers
- Очередь с приоритетами (видимая страница → соседние → остальные)
- Прогресс-бар с ETA
- Возможность паузы/отмены
- Сохранение промежуточных результатов

---

## Фаза 4: PDF-операции профессионального уровня ✅ В ОСНОВНОМ ЗАВЕРШЕНА

> Цель: полноценный PDF-редактор

### 4.1 Исправить заглушки в pdf-pro-tools.js ✅
Все функции реализованы (MODULE_STATUS='ready'):
- **Bates numbering** — серийная нумерация страниц для юридических документов
- **Headers/Footers** — добавление колонтитулов с переменными (дата, номер страницы, имя файла)
- **Flatten annotations** — встраивание аннотаций в содержимое PDF
- **Page deletion** — удаление страниц с preview
- **Page reordering** — drag-and-drop изменение порядка страниц

### 4.2 Редактирование текста в PDF ✅
- **Inline text editing** — прямое редактирование текста в PDF через pdf-lib
- **Font replacement** — замена шрифтов с подбором метрик
- **Spell-check** в PDF тексте
- Файл: `app/modules/pdf-text-edit.js` (~500 LOC)

### 4.3 Аннотации профессионального уровня ✅
- **Sticky notes** с threading (ответы на комментарии)
- **Text markup:** highlight, underline, strikethrough, squiggly
- **Measurement tools:** линейка, площадь, периметр
- **Stamps:** одобрено, отклонено, черновик, конфиденциально + custom stamps
- **Cloud annotations** — экспорт/импорт XFDF
- **Annotation summary** — список всех аннотаций с фильтрацией

### 4.4 Forms 🔧 ЧАСТИЧНО (нет валидации форм)
- **Full AcroForm support** — text fields, checkboxes, radio buttons, dropdowns, signatures
- **Form field creation** — drag-and-drop создание полей
- **Form data export** — FDF/XFDF/JSON/CSV
- **Form validation** — required fields, format validation
- **Auto-fill** — заполнение из шаблонов

### 4.5 Безопасность ✅
- **PDF encryption** (AES-256) — установка паролей на документ
- **Permission control** — запрет печати, копирования, редактирования
- **Digital signatures** — подпись PDF (self-signed certificates)
- **Redaction verification** — проверка полноты редактирования
- **Metadata cleanup** — удаление скрытых данных

### 4.6 Оптимизация PDF ✅
- **Image downsampling** — уменьшение разрешения изображений
- **Font subsetting** — включение только используемых глифов
- **Stream compression** — Flate/LZW сжатие потоков
- **Linearization** — оптимизация для web (fast web view)
- **Audit report** — отчёт о размере каждого компонента

---

## Фаза 5: Экспорт и конвертация ✅ ЗАВЕРШЕНА

> Цель: конвертация не хуже Adobe Export PDF

### 5.1 PDF→DOCX ✅
- **Таблицы:** определение merged cells, вложенных таблиц, borders
- **Изображения:** извлечение встроенных изображений с positioning
- **Формулы:** базовая обработка MathML/LaTeX
- **Стили:** paragraph styles, character styles, numbering styles
- **Headers/Footers:** извлечение колонтитулов из PDF
- **Footnotes:** обнаружение и конвертация сносок

### 5.2 PDF→HTML ✅
- Новый конвертер с сохранением layout
- CSS positioning или flow-based
- Responsive output
- Файл: `app/modules/html-converter.js` (~400 LOC)

### 5.3 PDF→Plain Text ✅
- Intelligent text extraction с reading order
- Paragraph detection
- Table → text formatting
- Файл: встроить в `export-manager.js`

### 5.4 PDF→PDF/A ✅
- Конвертация в архивный формат
- Встраивание шрифтов
- Цветовые профили
- Validation

### 5.5 Batch conversion ✅
- Множественные файлы в очередь
- Выбор формата для каждого
- ZIP-архив на выходе

---

## Фаза 6: UI/UX до уровня desktop-приложения ✅ ЗАВЕРШЕНА

> Цель: интерфейс как у Adobe Acrobat Pro DC

### 6.1 Accessibility (a11y) ✅
- ~~**ARIA attributes** на все интерактивные элементы (сейчас только 4)~~ → 104 aria-*, 37 role=
- ✅ `aria-label` на icon-only кнопки (27+ в toolbar)
- ✅ `aria-expanded` на collapsible секции
- ✅ `role="tablist"/"tab"/"tabpanel"` на панели
- ✅ `prefers-reduced-motion` media query
- ✅ `prefers-contrast` для high-contrast mode
- ✅ Focus visible ring на всех интерактивных элементах (:focus-visible CSS)
- ✅ Screen reader announcements для status changes (#a11yAnnouncer)
- ✅ Keyboard-only navigation для всех функций (arrow keys in tablists)
- Файл: `app/modules/a11y.js` (275 LOC)

### 6.2 Touch / Mobile ✅
- Pinch-to-zoom с плавной анимацией
- Swipe для переключения страниц
- Touch-friendly toolbar (48px min target)
- Responsive panel layout для планшетов
- Virtual keyboard adaptation
- Haptic feedback (Vibration API)

### 6.3 Context menus ✅
- Right-click меню в viewer: copy, select all, zoom, OCR this area
- Right-click на аннотации: edit, delete, reply, change color
- Right-click на thumbnail: rotate, delete, extract
- Файл: `app/modules/context-menu.js` (~200 LOC)

### 6.4 Drag & Drop улучшения ✅
- Drop zone с visual feedback (highlight, ghost preview)
- Drag pages в outline для reorder
- Drag files из файловой системы для merge
- Drag annotations для перемещения

### 6.5 Тёмная тема 2.0 ✅
- Sepia / Blue light filter режим
- Auto-switch по системным настройкам (`prefers-color-scheme`)
- Customizable accent color
- High contrast mode

### 6.6 Toolbar redesign ✅
- **Ribbon-like tabs** (Home, View, Edit, Tools, Review)
- Contextual tabs (появляются при редактировании)
- Customizable toolbar (drag-drop кнопок)
- Quick Access bar

### 6.7 Tooltips ✅
- Визуальные всплывающие подсказки (сейчас только title-атрибуты)
- Shortcut hints в tooltip
- Rich tooltips с иконками
- Delay: 500ms hover
- Файл: `app/modules/tooltip.js` (~100 LOC)

---

## Фаза 7: Инфраструктура и производительность ✅ В ОСНОВНОМ ЗАВЕРШЕНА

> Цель: стабильность enterprise-уровня

### 7.1 Web Workers ✅
- Вынести в worker: OCR, PDF parsing, image processing, DOCX generation
- SharedArrayBuffer для zero-copy передачи данных
- Worker pool с автомасштабированием
- Файл: `app/modules/worker-pool.js` (~200 LOC)

### 7.2 IndexedDB хранилище ✅
- Кэшировние отрендеренных страниц
- Хранение OCR данных по документу
- Хранение аннотаций
- Автоочистка по размеру (LRU)

### 7.3 Виртуализация ✅
- Virtual scrolling для continuous scroll (рендерить только видимые ±2 страницы)
- Virtual list для thumbnail panel
- Virtual list для search results
- Lazy image loading

### 7.4 Memory management ✅
- Автоматическое освобождение ObjectURL
- Canvas pooling (переиспользование canvas)
- Мониторинг performance.memory
- Предупреждение при приближении к лимиту
- Garbage collection hints

### 7.5 Testing ❌ НЕ НАЧАТО
- Unit tests для всех модулей (Jest/Vitest)
- Integration tests для PDF pipeline
- Visual regression tests для рендеринга
- Performance benchmarks
- Файлы: `tests/` директория

### 7.6 Build system ❌ НЕ НАЧАТО
- Vite или esbuild для бандлинга
- Tree-shaking неиспользуемого кода
- Code splitting по модулям
- Source maps для отладки
- Hot Module Replacement для разработки

---

## Приоритетность

| Приоритет | Фаза | Влияние | Статус |
|-----------|-------|---------|--------|
| P0 | 1.1 Декомпозиция app.js | Критично для дальнейшей работы | ✅ Готово |
| P0 | 1.2 Toast-уведомления | Базовый UX | ✅ Готово |
| P0 | 2.1 Режимы просмотра | Ключевая функциональность | ✅ Готово |
| P1 | 2.4 Text layer качества | Селекция текста и копирование | ✅ Готово |
| P1 | 3.1 Предобработка OCR | Качество распознавания | ✅ Готово |
| P1 | 4.1 Исправить заглушки | Заявленные функции не работают | ✅ Готово |
| P1 | 6.1 Accessibility | Доступность для всех | ✅ Готово |
| P2 | 3.3 Post-OCR коррекция | Качество текста | ✅ Готово |
| P2 | 4.3 Аннотации Pro | Профессиональный workflow | ✅ Готово |
| P2 | 4.4 Forms validation | Валидация форм | 🔧 Частично |
| P2 | 5.1 PDF→DOCX | Качество конвертации | ✅ Готово |
| P2 | 6.6 Toolbar redesign | Профессиональный вид | ✅ Готово |
| P3 | 4.5 Безопасность | Enterprise-функции | ✅ Готово |
| P3 | 5.2 PDF→HTML | Дополнительный формат | ✅ Готово |
| P3 | 7.5 Testing | Стабильность | ❌ Не начато |
| P3 | 7.6 Build system | Разработка | ❌ Не начато |

---

## Порядок реализации

```
Неделя 1-2:  Фаза 1 — Декомпозиция, Toast, Undo/Redo, Error handling
Неделя 3-4:  Фаза 2 — Режимы просмотра, зум, навигация
Неделя 5-6:  Фаза 3 — OCR предобработка, layout analysis, пакетный OCR
Неделя 7-8:  Фаза 4 — PDF-операции, формы, аннотации
Неделя 9-10: Фаза 5 — Экспорт улучшения
Неделя 11-12: Фаза 6 — UI/UX, a11y, touch, tooltips
Неделя 13-14: Фаза 7 — Workers, виртуализация, тесты
```
