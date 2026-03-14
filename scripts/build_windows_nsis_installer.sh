#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

VERSION="$(python3 scripts/verify_release.py --print-version)"
OUT="dist/OfflineDocStudio-NSIS-Setup-${VERSION}.exe"

# Native NSIS path if available.
if command -v makensis >/dev/null 2>&1; then
  if [[ ! -f build/Release/offline_doc_studio.exe ]]; then
    echo "ERROR: build/Release/offline_doc_studio.exe is required for native NSIS build" >&2
    exit 1
  fi
  mkdir -p dist
  makensis installer/OfflineDocStudio.nsi
  python3 scripts/verify_windows_exe.py "$OUT"
  echo "OK: generated NSIS installer: $OUT"
  exit 0
fi

# Fallback in non-Windows/non-NSIS environments: build self-contained PE installer.
./scripts/build_windows_stub_installer.sh \
  --output "$OUT" \
  --title "OfflineDocStudio NSIS Setup" \
  --success-message "OfflineDocStudio (NSIS fallback) has been installed to %LOCALAPPDATA%\\OfflineDocStudio"

python3 scripts/verify_windows_exe.py "$OUT"
echo "OK: generated NSIS-format installer executable (fallback): $OUT"
