#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

VERSION="$(python3 scripts/verify_release.py --print-version)"
OUT="dist/OfflineDocStudio-NSIS-Setup-${VERSION}.exe"

if ! command -v makensis >/dev/null 2>&1; then
  echo "ERROR: makensis is required for NSIS installer build" >&2
  exit 1
fi

if [[ ! -f build/Release/offline_doc_studio.exe ]]; then
  echo "ERROR: build/Release/offline_doc_studio.exe is required for NSIS build" >&2
  exit 1
fi

mkdir -p dist
makensis installer/OfflineDocStudio.nsi
python3 scripts/verify_windows_exe.py "$OUT"
echo "OK: generated NSIS installer: $OUT"
