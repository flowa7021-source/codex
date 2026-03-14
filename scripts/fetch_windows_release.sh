#!/usr/bin/env bash
set -euo pipefail

REPO=""
CONFIGURATION="Release"
BUILD_INSTALLER="true"
OUT_DIR="dist/windows-ci"
NO_WAIT="false"

usage() {
  cat <<'EOF'
Usage: scripts/fetch_windows_release.sh [options]

Trigger GitHub Actions Windows build and download artifact.

Options:
  --repo <owner/repo>         GitHub repository (required)
  --configuration <name>      Release or RelWithDebInfo (default: Release)
  --build-installer <bool>    true/false (default: true)
  --out-dir <dir>             download directory (default: dist/windows-ci)
  --no-wait                   do not wait/download, only trigger workflow
  -h, --help                  show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"; shift 2 ;;
    --configuration)
      CONFIGURATION="$2"; shift 2 ;;
    --build-installer)
      BUILD_INSTALLER="$2"; shift 2 ;;
    --out-dir)
      OUT_DIR="$2"; shift 2 ;;
    --no-wait)
      NO_WAIT="true"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2 ;;
  esac
done

if [[ -z "$REPO" ]]; then
  echo "ERROR: --repo is required (example: --repo myorg/OfflineDocStudio)" >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    py_args=( --repo "$REPO" --configuration "$CONFIGURATION" --build-installer "$BUILD_INSTALLER" --out-dir "$OUT_DIR" )
    if [[ "$NO_WAIT" == "true" ]]; then py_args+=( --no-wait ); fi
    exec ./scripts/fetch_windows_release.py "${py_args[@]}"
  fi
  echo "ERROR: GitHub CLI (gh) is required (or set GITHUB_TOKEN for API fallback)" >&2
  exit 1
fi

if [[ "$CONFIGURATION" != "Release" && "$CONFIGURATION" != "RelWithDebInfo" ]]; then
  echo "ERROR: --configuration must be Release or RelWithDebInfo" >&2
  exit 2
fi

if [[ "$BUILD_INSTALLER" != "true" && "$BUILD_INSTALLER" != "false" ]]; then
  echo "ERROR: --build-installer must be true or false" >&2
  exit 2
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
ARTIFACT_NAME="OfflineDocStudio-windows-release-${CONFIGURATION}"

printf 'Triggering workflow on %s (%s)\n' "$REPO" "$BRANCH"
gh workflow run ci.yml --repo "$REPO" --ref "$BRANCH" \
  -f windows_configuration="$CONFIGURATION" \
  -f build_windows_installer="$BUILD_INSTALLER"

if [[ "$NO_WAIT" == "true" ]]; then
  echo "Workflow triggered. Skipping wait/download due to --no-wait."
  exit 0
fi

echo "Waiting for latest ci workflow run to finish..."
RUN_ID="$(gh run list --repo "$REPO" --workflow ci.yml --branch "$BRANCH" --limit 1 --json databaseId -q '.[0].databaseId')"
if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "ERROR: failed to resolve workflow run id" >&2
  exit 1
fi

gh run watch "$RUN_ID" --repo "$REPO"

mkdir -p "$OUT_DIR"
gh run download "$RUN_ID" --repo "$REPO" --name "$ARTIFACT_NAME" --dir "$OUT_DIR"

echo "OK: downloaded artifact to $OUT_DIR/$ARTIFACT_NAME"
echo "Look for installer in: $OUT_DIR/$ARTIFACT_NAME/dist/OfflineDocStudio-Setup-*.exe"
