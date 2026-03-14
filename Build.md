# Build.md

## Linux/macOS (разработка и запуск MVP)

```bash
cmake -S . -B build
cmake --build build -j
ctest --test-dir build --output-on-failure
./build/offline_doc_studio --interactive --import-folder ./samples --list-library
```

## Windows 10/11 (Visual Studio 2022)

```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
./build/Release/offline_doc_studio.exe --interactive --import-folder .\samples --list-library
```

## Сборка ZIP-пакета через CPack

```bash
cmake -S . -B build
cmake --build build -j
cpack --config build/CPackConfig.cmake
```

Готовый архив появится в корне проекта (например, `OfflineDocStudio-0.3.0-Linux.zip`).

## Сборка Windows-инсталлятора (Inno Setup)
1. Установите **Inno Setup 6**.
2. Выполните:

```powershell
./scripts/build_windows_installer.ps1
```

Скрипт выполнит configure/build/test и вызовет `installer/OfflineDocStudio.iss`.
Итоговый `.exe` инсталлятор будет создан в папке `dist/`.

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
