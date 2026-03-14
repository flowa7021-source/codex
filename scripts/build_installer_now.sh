#!/usr/bin/env bash
set -euo pipefail

FORCE="false"
PRINT_PATH="false"
FORMAT="inno"
MIN_SIZE_BYTES=2048

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE="true"; shift ;;
    --print-path)
      PRINT_PATH="true"; shift ;;
    --format)
      FORMAT="$2"; shift 2 ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/build_installer_now.sh [--force] [--print-path] [--format inno|nsis]

Build OfflineDocStudio Windows installer (native Windows toolchain only).
USAGE
      exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2 ;;
  esac
done

if [[ "$FORMAT" != "inno" && "$FORMAT" != "nsis" ]]; then
  echo "ERROR: unknown installer format: $FORMAT (expected inno|nsis)" >&2
  exit 2
fi

VERSION="$(python3 scripts/verify_release.py --print-version)"
if [[ "$FORMAT" == "nsis" ]]; then
  TARGET="dist/OfflineDocStudio-NSIS-Setup-${VERSION}.exe"
else
  TARGET="dist/OfflineDocStudio-Setup-${VERSION}.exe"
fi

mkdir -p dist
if [[ "$FORCE" == "true" && -f "$TARGET" ]]; then
  rm -f "$TARGET"
fi

if [[ "$FORMAT" == "inno" ]]; then
  if ! command -v powershell >/dev/null 2>&1; then
    echo "ERROR: powershell is required for native Inno installer build" >&2
    exit 1
  fi
  powershell -ExecutionPolicy Bypass -File scripts/build_windows_installer.ps1
else
  ./scripts/build_windows_nsis_installer.sh
fi

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: failed to produce installer: $TARGET" >&2
  exit 1
fi

size_bytes="$(stat -c %s "$TARGET")"
if [[ "$size_bytes" -lt "$MIN_SIZE_BYTES" ]]; then
  echo "ERROR: installer looks too small (${size_bytes} bytes): $TARGET" >&2
  exit 1
fi

python3 scripts/verify_windows_exe.py "$TARGET"
python3 scripts/generate_release_manifest.py
python3 scripts/verify_installer_ready.py --installer "$TARGET"
python3 scripts/export_installer_metadata.py --installer "$TARGET"
sha256="$(sha256sum "$TARGET" | awk '{print $1}')"

if [[ "$PRINT_PATH" == "true" ]]; then
  echo "$TARGET"
  exit 0
fi

echo "OK: installer is ready: $TARGET"
echo "SHA256: $sha256"
echo "Size: ${size_bytes} bytes"
