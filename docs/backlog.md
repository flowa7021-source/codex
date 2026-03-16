# NovaReader 2.0.0 — Product Backlog (приоритетный)

## P0 — Блокеры стабильности и производительности
- [ ] Устранить UI-freeze при поиске/OCR/аннотациях (вынос тяжёлых задач в worker pool).
- [ ] Единый error boundary + recover flow для операций открытия/рендера/экспорта.
- [ ] Ввести perf budgets в CI (render p95, input latency, long tasks).
- [ ] Memory management: LRU кэш страниц/изображений + безопасное освобождение object URLs.

## P0 — OCR 2.0
- [ ] Preprocessing pipeline: deskew, denoise, binarization, contrast normalization.
- [ ] OCR confidence scoring + пост-обработка для RU/EN.
- [ ] Batch OCR queue с отменой/приоритизацией/прогрессом.
- [ ] Поиск по OCR-индексу + экспорт OCR-текста с координатами.

## P0 — PDF Pro (ядро)
- [ ] Текстовый editing layer (блочная модель + визуальное редактирование).
- [ ] Undo/redo и история правок по документу.
- [ ] Корректная запись исправлений в документ/рабочую область.
- [ ] PDF→DOCX converter v1: абзацы, стили, изображения, таблицы.

## P1 — UX и функциональная целостность
- [ ] Унификация state-машины инструментов (аннотации/поиск/OCR/редактура).
- [ ] Устранение конфликтов горячих клавиш и фокуса.
- [ ] Адаптивность <16:9 и low-height экранов без наложений.
- [ ] Стабильные настройки границ/зон с live-preview и persisted state.

## P1 — Тестирование и качество
- [ ] E2E regression-pack (Playwright) для 20+ ключевых пользовательских сценариев.
- [ ] OCR corpus benchmark (качество + скорость).
- [ ] PDF conversion benchmark suite (структура/таблицы/картинки).
- [ ] Crash telemetry dashboard + nightly soak run.

## P2 — Расширения 2.0.x
- [ ] Импорт обратно DOCX-правок (merge в workspace).
- [ ] Плагины конвертации для сложных табличных шаблонов.
- [ ] Дополнительные языковые профили OCR.
