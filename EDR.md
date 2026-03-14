# EDR.md — Engine Decision Record

## Контекст
Нужны: быстрый рендер, выделение/поиск текста, аннотации, операции страниц, офлайн OCR, юридическая чистота OSS.

## Сравнение

### PDF
- **PDFium**: + высокая скорость, активный проект, permissive-лицензия; - не thread-safe API (нужен serial dispatcher).
- MuPDF: + мощный единый стек render/edit; - AGPL/коммерческая модель.
- Poppler: + зрелый рендер; - GPL-ограничения и сложнее для закрытых сценариев распространения.

**Решение:** PDFium + QPDF (структурные операции со страницами).

### DjVu
- **DjVuLibre**: де-факто стандарт для Windows-ридеров DjVu, C/C++ friendly.

**Решение:** DjVuLibre.

### CBZ
- Формат ZIP+images, нужен собственный lightweight-плагин.

**Решение:** minizip/libarchive + WIC/decoder stack.

### EPUB
- WebView2: зрелый встроенный HTML/CSS движок под Windows.
- Readium SDK: мощно, но сложнее внедрение/лицензирование.

**Решение:** WebView2 with strict request filtering (local-only resources).

### OCR
- **Tesseract** как офлайн стандарт.

**Решение:** Tesseract + sidecar OCR index.

## Риски и меры
- DPI/PMv2: обязательный manifest + WM_DPICHANGED handling.
- Большие документы: virtualized continuous scroll + bounded caches.
- Поврежденные файлы: safe-open mode + error-report UX.
