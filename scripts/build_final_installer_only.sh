#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FORMAT="inno"
FORCE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --format)
      FORMAT="$2"; shift 2 ;;
    --force)
      FORCE="true"; shift ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/build_final_installer_only.sh [--format inno|nsis] [--force]

Build final product and keep only ready installer .exe in dist/.
USAGE
      exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2 ;;
  esac
done

if [[ "$FORMAT" != "inno" && "$FORMAT" != "nsis" ]]; then
  echo "ERROR: unknown format: $FORMAT (expected inno|nsis)" >&2
  exit 2
fi

ARGS=(--format "$FORMAT")
if [[ "$FORCE" == "true" ]]; then
  ARGS=(--force "${ARGS[@]}")
fi

./scripts/build_installer_now.sh "${ARGS[@]}"

VERSION="$(python3 scripts/verify_release.py --print-version)"
if [[ "$FORMAT" == "nsis" ]]; then
  INSTALLER="dist/OfflineDocStudio-NSIS-Setup-${VERSION}.exe"
else
  INSTALLER="dist/OfflineDocStudio-Setup-${VERSION}.exe"
fi

if [[ ! -f "$INSTALLER" ]]; then
  echo "ERROR: installer not found: $INSTALLER" >&2
  exit 1
fi

TMP_INSTALLER="dist/.final-installer.tmp.exe"
cp -f "$INSTALLER" "$TMP_INSTALLER"

python3 - <<'PY'
from pathlib import Path
for p in Path('dist').iterdir():
    if p.name != '.final-installer.tmp.exe':
        if p.is_dir():
            import shutil
            shutil.rmtree(p)
        else:
            p.unlink()
PY

mv "$TMP_INSTALLER" "$INSTALLER"
python3 scripts/verify_windows_exe.py "$INSTALLER"

echo "OK: final product prepared"
echo "Ready installer: $INSTALLER"
