# NovaReader 2.0 — современный аналог DjVuReader

NovaReader — это современный reader с упором на практичность: больше инструментов в ежедневной работе с документами и понятный интерфейс.

## Что реализовано

### Форматы и просмотр
- PDF (PDF.js), DjVu, изображения (PNG, JPG, WEBP, GIF, BMP)
- Навигация, масштаб (fit-to-width/page), поворот, полноэкранный режим
- Drag & drop, колесо + Ctrl для зума
- Адаптивный интерфейс (<16:9, low-height, ultrawide, mobile)

### OCR 2.0
- Встроенный OCR (OCRAD.js) с preprocessing: deskew, denoise, binarization
- **Confidence scoring** — многофакторная оценка качества (high/medium/low/very-low)
- **Post-correction** — автоматическое исправление OCR-артефактов (RU/EN)
- **Batch OCR queue** — пакетная обработка с приоритизацией и отменой
- **OCR search index** — индексация с координатами (страница/строка/смещение), экспорт в JSON
- Фоновое распознавание всех страниц с автоиндексацией

### PDF Pro
- **Text editing layer** — редактирование текста с undo/redo (100 шагов), Ctrl+Z/Ctrl+Y
- **PDF→DOCX конвертер** — валидный OOXML с:
  - стилями (Title, Heading2), абзацами, таблицами
  - встроенными изображениями страниц (до 20 стр.)
  - page breaks, CRC-32 ZIP
- **Импорт DOCX-правок** — чтение текста из .docx, объединение с workspace

### Аннотации
- Перо/маркер/ластик, фигуры (прямоугольник/стрелка/линия/окружность)
- Комментарии-пины, экспорт PNG, JSON, bundle JSON

### Продуктивность
- Закладки, заметки, оглавление PDF, превью страниц
- Поиск по PDF/DjVu/OCR-индексу с навигацией
- История навигации (Alt+←/Alt+→)
- Workspace backup (export/import JSON), cloud push/pull
- Collaboration через BroadcastChannel
- Прогресс чтения, ETA, цель по страницам, темп чтения

### Стабильность
- **Error boundary** для всех путей (открытие/рендер/экспорт)
- **Web Worker pool** для тяжёлых задач
- **LRU-кэш страниц** (8 стр. / 32 Мпикс), Object URL registry
- **Crash telemetry** — перехват ошибок, crash-free rate, экспорт отчёта
- **Perf-метрики p95** — render, OCR, search, pageLoad
- Автоочистка при закрытии вкладки

### Тёмная/светлая тема
Настраиваемые горячие клавиши с валидацией конфликтов.

## Запуск

```bash
python3 dev_server.py
```

Открыть: `http://localhost:4173/`

### Desktop (.exe)

```bash
npm ci
npm run build:win:nosign
```

Или для dev-запуска: `npm run start:desktop`

## Тестирование

```bash
# OCR quality benchmark (self-test)
npm test

# E2E тесты (требуется Playwright)
npm run test:e2e

# Nightly soak run (10 мин по умолчанию)
npm run test:soak

# Длительный soak run (60 мин)
npm run test:soak:long
```

## API endpoints

```text
GET  /api/health     — runtime health
GET  /api/workspace  — последнее сохранённое рабочее пространство
PUT  /api/workspace  — сохранить workspace (JSON, max 5 MB)
```

## Документация

- `docs/release-notes.md` — release notes 2.0.0-alpha
- `docs/execution-status.md` — прогресс выполнения плана
- `docs/backlog.md` — roadmap
- `docs/product-plan.md` — продуктовый план
- `docs/architecture.md` — техническая архитектура

## CI workflow (GitHub Actions)

`.github/workflows/build-windows-exe.yml` — сборка portable .exe для Windows.

## Проверка

```bash
curl -sS http://localhost:4173/api/health
```
