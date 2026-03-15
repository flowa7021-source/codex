# NovaReader 1.0.0 — Release Notes

## Что вошло
- Мульти-адаптерный viewer: PDF/Image/DjVu.
- Аннотации: pen/highlighter/eraser + rect/arrow/line/circle + комментарии.
- Поиск, извлечение текста, bookmarks, notes, hotkeys, история и превью страниц.
- Workspace backup import/export.
- Stage 4: OCR import, cloud sync (push/pull), collaboration via BroadcastChannel.

## UX переработка (release polish)
- Переработанная визуальная система: карточки, улучшенные контрасты, единые кнопки и поля ввода.
- Более читаемая структура левой панели и улучшенная адаптивность для узких экранов.

## Runtime hardening
- `dev_server.py` теперь перенаправляет `/` на `/app/` для старта в один клик.
- Добавлен `GET /api/health` для быстрой диагностики релизного запуска.
- Добавлено ограничение размера payload для `PUT /api/workspace` (по умолчанию 5 MB).

## Запуск release-версии
- `python3 dev_server.py`
- Приложение: `http://localhost:4173/app/`
- Встроенный cloud endpoint: `http://localhost:4173/api/workspace`
