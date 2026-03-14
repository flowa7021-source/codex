#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import argparse
import hashlib
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Verify OfflineDocStudio installer artifact is present and valid")
    p.add_argument("--installer", default=None, help="path to installer exe (default: dist/OfflineDocStudio-Setup-<version>.exe)")
    p.add_argument("--manifest", default=str(ROOT / "dist" / "RELEASE_ARTIFACTS.txt"))
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


def is_pe(path: Path) -> bool:
    data = path.read_bytes()
    if len(data) < 0x40 or data[:2] != b"MZ":
        return False
    pe_offset = int.from_bytes(data[0x3C:0x40], "little")
    return pe_offset + 4 <= len(data) and data[pe_offset:pe_offset + 4] == b"PE\x00\x00"


def main() -> int:
    args = parse_args()
    version = detect_version()
    default_inno = ROOT / "dist" / f"OfflineDocStudio-Setup-{version}.exe"
    default_nsis = ROOT / "dist" / f"OfflineDocStudio-NSIS-Setup-{version}.exe"
    installer = (Path(args.installer).resolve() if args.installer else (default_inno.resolve() if default_inno.exists() else default_nsis.resolve()))
    manifest = Path(args.manifest).resolve()

    if not installer.exists():
        print(f"ERROR: installer not found: {installer}")
        return 1
    if installer.stat().st_size < 2048:
        print(f"ERROR: installer too small: {installer.stat().st_size} bytes")
        return 1
    if not is_pe(installer):
        print(f"ERROR: installer is not a valid PE executable: {installer}")
        return 1

    digest = sha256(installer)

    if not manifest.exists():
        print(f"ERROR: manifest not found: {manifest}")
        return 1

    rel = installer.relative_to(ROOT).as_posix()
    pattern = re.compile(rf"^([a-f0-9]{{64}})\s+\d+\s+{re.escape(rel)}$")
    manifest_hash = None
    for line in manifest.read_text(encoding="utf-8").splitlines():
        m = pattern.match(line.strip())
        if m:
            manifest_hash = m.group(1)
            break

    if manifest_hash is None:
        print(f"ERROR: installer entry not found in manifest: {rel}")
        return 1
    if manifest_hash != digest:
        print(f"ERROR: manifest hash mismatch for {rel}")
        print(f"  manifest: {manifest_hash}")
        print(f"  actual:   {digest}")
        return 1

    print(f"OK: installer verified: {installer}")
    print(f"SHA256: {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
