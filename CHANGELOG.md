# Changelog

## 1.0.0 - 2026-03-14

### Added
- Runnable offline MVP application shell with interactive mode and script automation.
- Portable config/session/library/hotkeys storage model.
- Core document workflows: open, search, OCR indexing, page operations (rotate/crop/delete), print planning.
- Library workflows: import folder, pin/unpin, search.
- Diagnostics and runtime initialization commands: `--doctor`, `--init-layout`.
- Packaging and distribution flows:
  - CPack ZIP package generation
  - Inno Setup installer script for Windows
  - Build script for installer creation (`scripts/build_windows_installer.ps1`)

### Notes
- This release is an offline-first terminal MVP focused on reliability and packaging readiness.
- Native Win32 Ribbon GUI is planned for the next milestone.
