#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path
from urllib import parse, request, error

API = "https://api.github.com"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Trigger CI and download OfflineDocStudio Windows artifacts")
    p.add_argument("--repo", required=True, help="GitHub repository in owner/repo format")
    p.add_argument("--ref", default=None, help="Git ref (branch/tag). Default: current git branch")
    p.add_argument("--configuration", choices=["Release", "RelWithDebInfo"], default="Release")
    p.add_argument("--build-installer", choices=["true", "false"], default="true")
    p.add_argument("--out-dir", default="dist/windows-ci", help="output directory for downloaded artifact")
    p.add_argument("--workflow", default="ci.yml", help="workflow file name")
    p.add_argument("--no-wait", action="store_true", help="only trigger workflow")
    p.add_argument("--poll-seconds", type=int, default=15)
    p.add_argument("--timeout-seconds", type=int, default=3600)
    return p.parse_args()


def api_request(method: str, url: str, token: str, body: dict | None = None, accept: str = "application/vnd.github+json"):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "OfflineDocStudio-fetcher",
    }
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = request.Request(url, method=method, headers=headers, data=data)
    with request.urlopen(req) as resp:
        return resp.status, resp.read(), dict(resp.headers)


def current_branch() -> str:
    head = Path(".git/HEAD")
    if not head.exists():
        return "main"
    txt = head.read_text(encoding="utf-8").strip()
    if txt.startswith("ref:"):
        return txt.rsplit("/", 1)[-1]
    return "main"


def trigger_workflow(owner: str, repo: str, workflow: str, ref: str, config: str, build_installer: str, token: str) -> None:
    url = f"{API}/repos/{owner}/{repo}/actions/workflows/{parse.quote(workflow)}/dispatches"
    body = {
        "ref": ref,
        "inputs": {
            "windows_configuration": config,
            "build_windows_installer": build_installer,
        },
    }
    status, _, _ = api_request("POST", url, token, body=body)
    if status not in (204, 201):
        raise RuntimeError(f"failed to trigger workflow: HTTP {status}")


def latest_run(owner: str, repo: str, workflow: str, branch: str, token: str) -> dict:
    q = parse.urlencode({"branch": branch, "per_page": 1})
    url = f"{API}/repos/{owner}/{repo}/actions/workflows/{parse.quote(workflow)}/runs?{q}"
    _, data, _ = api_request("GET", url, token)
    payload = json.loads(data.decode("utf-8"))
    runs = payload.get("workflow_runs", [])
    if not runs:
        raise RuntimeError("no workflow runs found")
    return runs[0]


def wait_run(owner: str, repo: str, run_id: int, token: str, poll_seconds: int, timeout_seconds: int) -> dict:
    url = f"{API}/repos/{owner}/{repo}/actions/runs/{run_id}"
    start = time.time()
    while True:
        _, data, _ = api_request("GET", url, token)
        run = json.loads(data.decode("utf-8"))
        status = run.get("status")
        concl = run.get("conclusion")
        if status == "completed":
            if concl != "success":
                raise RuntimeError(f"workflow failed: conclusion={concl}")
            return run
        if time.time() - start > timeout_seconds:
            raise TimeoutError("timeout while waiting workflow run")
        time.sleep(poll_seconds)


def find_artifact(owner: str, repo: str, run_id: int, artifact_name: str, token: str) -> dict:
    url = f"{API}/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts?per_page=100"
    _, data, _ = api_request("GET", url, token)
    payload = json.loads(data.decode("utf-8"))
    for artifact in payload.get("artifacts", []):
        if artifact.get("name") == artifact_name:
            return artifact
    raise RuntimeError(f"artifact not found: {artifact_name}")


def download_and_extract(owner: str, repo: str, artifact_id: int, out_dir: Path, token: str) -> Path:
    url = f"{API}/repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip"
    _, data, _ = api_request("GET", url, token, accept="application/vnd.github+json")
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        zf.extractall(out_dir)
    return out_dir


def main() -> int:
    args = parse_args()
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("ERROR: GITHUB_TOKEN is required for API mode", file=sys.stderr)
        return 2

    if "/" not in args.repo:
        print("ERROR: --repo must be owner/repo", file=sys.stderr)
        return 2
    owner, repo = args.repo.split("/", 1)
    ref = args.ref or current_branch()

    try:
        print(f"Triggering workflow {args.workflow} on {args.repo}@{ref}")
        trigger_workflow(owner, repo, args.workflow, ref, args.configuration, args.build_installer, token)

        if args.no_wait:
            print("Workflow dispatched. --no-wait set, exiting.")
            return 0

        print("Resolving latest run...")
        run = latest_run(owner, repo, args.workflow, ref, token)
        run_id = int(run["id"])
        print(f"Waiting for run {run_id} to complete...")
        wait_run(owner, repo, run_id, token, args.poll_seconds, args.timeout_seconds)

        artifact_name = f"OfflineDocStudio-windows-release-{args.configuration}"
        artifact = find_artifact(owner, repo, run_id, artifact_name, token)
        out_root = Path(args.out_dir) / artifact_name
        print(f"Downloading artifact {artifact_name}...")
        download_and_extract(owner, repo, int(artifact["id"]), out_root, token)

        print(f"OK: downloaded artifact to {out_root}")
        print(f"Installer path pattern: {out_root}/dist/OfflineDocStudio-Setup-*.exe")
        return 0
    except (error.HTTPError, error.URLError) as ex:
        print(f"ERROR: network/API failure: {ex}", file=sys.stderr)
        return 1
    except Exception as ex:
        print(f"ERROR: {ex}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
