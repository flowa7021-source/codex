# Architecture.md

## 1. Цель
Офлайн-приложение под Windows 10–11 (portable), форматы: PDF, DjVu, CBZ, EPUB, с UX-ориентиром на PDFGear (Home-хаб + Home-вкладка с полным набором инструментов).

## 2. Слои

### UI Layer
- Win32 + Windows Ribbon Framework.
- Home Screen: Open/Recent/Pinned/Library/Hotkeys.
- Document Shell: tabs, ribbon, left panel (thumbnails/bookmarks/comments), status bar.

### Core Layer
- `DocumentSession` (унифицированный API для страниц, поиска, зума, рендера).
- `RenderScheduler` (очередь задач, progressive render low→high).
- `Input/Command Router` (горячие клавиши, команды ribbon).

### Format Plugins
- `PdfPlugin` (PDFium + QPDF слой модификаций страниц).
- `DjvuPlugin` (DjVuLibre).
- `CbzPlugin` (ZIP + image decoders + page ordering).
- `EpubPlugin` (WebView2 sandboxed local-only loader).

### OCR Subsystem
- Tesseract pipeline: preprocess → OCR → normalize → index.
- Режимы: selection/page/document.
- Sidecar-индекс привязан к hash документа.

### Annotation Subsystem
- Унифицированная модель: note, highlight, underline, strike, ink, textbox, stamp.
- Hide/Show toggle.
- Lock/LockContents + Flatten export.

### Storage Subsystem (portable)
- `config/config.json`
- `config/hotkeys.json`
- `config/library.db` (или JSON на MVP)
- `cache/ocr/` и `cache/render/`

### Diagnostics
- Файл-логи (`logs/app.log`).
- Minidump через `MiniDumpWriteDump` (предпочтительно helper-process).

## 3. Нефункциональные требования
- Первый рендер < 1 сек (типовой документ).
- Навигация < 200 мс.
- RAM budget target < 300MB / документ.
- Полный запрет сетевых запросов в рантайме.

## 4. План релизов
- R0: Shell + Home + open formats stubs.
- R1: Reading modes + search API + tabs/session.
- R2: OCR + screenshot tool + copy as image.
- R3: annotations + pages operations + print.
- R4: hardening/perf/diagnostics + installer helper for associations.
