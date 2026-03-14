# Build.md

## Linux/macOS (разработка и запуск MVP)

```bash
cmake -S . -B build
cmake --build build -j
ctest --test-dir build --output-on-failure
```

## Windows 10/11 (Visual Studio 2022)

```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

## Пример запуска (interactive)

```bash
./build/offline_doc_studio --interactive --import-folder ./samples --list-library --theme dark --fit width --zoom 125
```

## Пример запуска (batch/script)

```bash
./build/offline_doc_studio \
  --open sample.djvu --mode overview --find theorem \
  --rotate 90 --delete-page 2 --crop-page 1 --print-range 1-3 --print-no-annotations \
  --command "pages overview" --script ./samples/session.ods \
  --import-hotkeys ./config/hotkeys.json --export-hotkeys ./config/hotkeys.export.json
```

## Offline policy
- Никаких сетевых запросов.
- Никаких проверок обновлений.
- Все данные и настройки — в portable-структуре рядом с приложением.
