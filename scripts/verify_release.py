#!/usr/bin/env python3
from pathlib import Path
import argparse
import re
import sys

ROOT = Path(__file__).resolve().parent.parent

required_files = [
    ROOT / "CMakeLists.txt",
    ROOT / "installer" / "OfflineDocStudio.iss",
    ROOT / "installer" / "OfflineDocStudio.nsi",
    ROOT / "src" / "core" / "version.h",
    ROOT / "README.md",
    ROOT / "RELEASE.md",
]

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate release version consistency")
    parser.add_argument(
        "--print-version",
        action="store_true",
        help="print the validated release version only",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    for file_path in required_files:
        if not file_path.exists():
            print(f"ERROR: missing required file: {file_path}")
            return 1

    cmake = (ROOT / "CMakeLists.txt").read_text(encoding="utf-8")
    iss = (ROOT / "installer" / "OfflineDocStudio.iss").read_text(encoding="utf-8")
    nsi = (ROOT / "installer" / "OfflineDocStudio.nsi").read_text(encoding="utf-8")
    version_h = (ROOT / "src" / "core" / "version.h").read_text(encoding="utf-8")

    cmake_match = re.search(r"project\(OfflineDocStudio VERSION ([0-9]+\.[0-9]+\.[0-9]+)", cmake)
    iss_match = re.search(r'#define MyAppVersion "([0-9]+\.[0-9]+\.[0-9]+)"', iss)
    header_match = re.search(r'kAppVersion = "([0-9]+\.[0-9]+\.[0-9]+)"', version_h)
    nsi_match = re.search(r'!define APP_VERSION "([0-9]+\.[0-9]+\.[0-9]+)"', nsi)

    if not (cmake_match and iss_match and header_match and nsi_match):
        print("ERROR: failed to parse one or more versions")
        return 1

    versions = {
        "cmake": cmake_match.group(1),
        "installer": iss_match.group(1),
        "header": header_match.group(1),
        "nsis": nsi_match.group(1),
    }

    if len(set(versions.values())) != 1:
        print("ERROR: version mismatch detected")
        for k, v in versions.items():
            print(f"  {k}: {v}")
        return 1

    if args.print_version:
        print(versions["cmake"])
    else:
        print(f"OK: release version is consistent ({versions['cmake']})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
