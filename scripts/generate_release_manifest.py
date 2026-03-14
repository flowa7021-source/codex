#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import argparse
import hashlib
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate release artifact manifest with SHA256 hashes")
    parser.add_argument(
        "--output",
        default=str(ROOT / "dist" / "RELEASE_ARTIFACTS.txt"),
        help="output manifest path",
    )
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def detect_version() -> str:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "verify_release.py"), "--print-version"],
        check=True,
        capture_output=True,
        text=True,
    )
    return proc.stdout.strip()


def collect_artifacts(version: str) -> list[Path]:
    artifacts: list[Path] = []

    # CPack archives are usually generated in project root.
    artifacts.extend(sorted(ROOT.glob(f"OfflineDocStudio-{version}-*.zip")))

    # Windows release artifacts usually live in dist/.
    dist = ROOT / "dist"
    artifacts.extend(
        path
        for path in [
            dist / f"OfflineDocStudio-Setup-{version}.exe",
            dist / f"OfflineDocStudio-NSIS-Setup-{version}.exe",
            dist / f"OfflineDocStudio-{version}-portable.zip",
            dist / f"OfflineDocStudio-{version}-portable" / "SHA256SUMS.txt",
            dist / "offline_doc_studio_bootstrap.exe",
        ]
        if path.exists()
    )

    # Deduplicate while preserving order.
    uniq: list[Path] = []
    seen: set[Path] = set()
    for art in artifacts:
        if art not in seen and art.exists() and art.is_file():
            uniq.append(art)
            seen.add(art)
    return uniq


def main() -> int:
    args = parse_args()
    output = Path(args.output)

    version = detect_version()
    artifacts = collect_artifacts(version)
    if not artifacts:
        print("ERROR: no release artifacts found to include in manifest")
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# OfflineDocStudio release artifacts manifest",
        f"# Version: {version}",
        f"# Generated (UTC): {datetime.now(timezone.utc).isoformat()}",
        "# Format: <SHA256>  <BYTES>  <RELATIVE_PATH>",
        "",
    ]

    for artifact in artifacts:
        rel = artifact.relative_to(ROOT).as_posix()
        digest = sha256_file(artifact)
        size = artifact.stat().st_size
        lines.append(f"{digest}  {size}  {rel}")

    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"OK: wrote release artifact manifest: {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
