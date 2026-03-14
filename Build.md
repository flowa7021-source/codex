# Build (Windows-only)

## Требования
- Windows 10/11
- Visual Studio 2022 (C++ toolchain)
- CMake
- Inno Setup 6

## Сборка приложения
```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

## Сборка инсталлятора (Inno)
```powershell
./scripts/build_windows_installer.ps1 -Configuration Release -RequireInno
```

## Сборка инсталлятора (NSIS)
```bash
./scripts/build_installer_now.sh --format nsis
```

## Единый сценарий релиза
```bash
./scripts/release_with_installer.sh
```

## Подготовка конечного артефакта для пользователя
```bash
./scripts/build_final_installer_only.sh --force
```

Итог: в каталоге `dist/` остаётся только файл вида `OfflineDocStudio-Setup-<version>.exe`.
