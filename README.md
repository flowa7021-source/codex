# OfflineDocStudio

Офлайн-ридер/аннотатор (PDF/DjVu/CBZ/EPUB) для Windows 10–11.

## Текущий статус
Реализовано запускаемое MVP-приложение (CLI + интерактивный shell + сценарии автозапуска + упаковка/инсталлятор):

- форматный реестр `pdf|djvu|djv|cbz|epub`;
- сессии вкладок и режимы чтения;
- page operations: rotate/delete/crop;
- offline OCR index и поиск;
- print planner (`--print-range`, с/без аннотаций);
- command palette (`--command`) и script runner (`--script <file>`);
- navigation history (`--back`, `--forward`);
- библиотека документов: import folder, recent, pinned, search;
- reading settings: `--theme`, `--fit`, `--zoom`;
- hotkeys import/export (`--import-hotkeys`, `--export-hotkeys`);
- интерактивный режим (`--interactive`);
- portable storage + логирование (`logs/app.log`);
- smoke-тесты на ключевые подсистемы;
- CPack ZIP packaging + Inno Setup installer script.

## Быстрый запуск
```bash
cmake -S . -B build
cmake --build build -j
ctest --test-dir build --output-on-failure
./build/offline_doc_studio --interactive --import-folder ./samples --list-library --theme dark --fit width --zoom 125
```

## Сборка инсталлятора
См. `Build.md` и `installer/OfflineDocStudio.iss`.

## Batch-пример
```bash
./build/offline_doc_studio \
  --open sample.djvu --page 1 --mode continuous --find theorem --overview \
  --rotate 90 --crop-page 1 --print-range 1-3 --print-no-annotations \
  --command "rotate 90" --script ./samples/session.ods \
  --import-hotkeys ./config/hotkeys.json --export-hotkeys ./config/hotkeys.export.json
```

## Важно
Это runnable MVP в терминальном UI. Следующий этап — нативный Win32 GUI (Ribbon + Home/Library window) поверх текущего ядра.
