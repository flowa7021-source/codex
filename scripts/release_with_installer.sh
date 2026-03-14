#!/usr/bin/env bash
set -euo pipefail

# Full release flow + guaranteed installer artifact.
FORMAT="inno"
if [[ "${1:-}" == "--format" ]]; then
  FORMAT="${2:-inno}"
  shift 2
fi

./scripts/release.sh
./scripts/build_installer_now.sh --force --format "$FORMAT"
VERSION="$(./scripts/verify_release.py --print-version)"
if [[ "$FORMAT" == "nsis" ]]; then
  INSTALLER="dist/OfflineDocStudio-NSIS-Setup-${VERSION}.exe"
else
  INSTALLER="dist/OfflineDocStudio-Setup-${VERSION}.exe"
fi
./scripts/verify_installer_ready.py --installer "$INSTALLER"

echo "OK: release with installer is ready"
echo "Installer: ${INSTALLER}"
echo "Metadata: dist/INSTALLER_METADATA.json"
