#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Export installer metadata JSON")
    p.add_argument("--installer", default=None, help="installer path")
    p.add_argument("--output", default=str(ROOT / "dist" / "INSTALLER_METADATA.json"), help="output JSON path")
    return p.parse_args()


def detect_version() -> str:
    out = subprocess.check_output([sys.executable, str(ROOT / "scripts" / "verify_release.py"), "--print-version"], text=True)
    return out.strip()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    args = parse_args()
    version = detect_version()
    installer = (Path(args.installer) if args.installer else ROOT / "dist" / f"OfflineDocStudio-Setup-{version}.exe").resolve()

    if not installer.exists():
        print(f"ERROR: installer not found: {installer}")
        return 1

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    digest = sha256(installer)
    size = installer.stat().st_size
    payload = {
        "app": "OfflineDocStudio",
        "version": version,
        "installer_path": installer.relative_to(ROOT).as_posix(),
        "sha256": digest,
        "size_bytes": size,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
    }

    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OK: wrote installer metadata: {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
