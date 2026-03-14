param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path .
$exe = Join-Path $root "build\$Configuration\offline_doc_studio.exe"
$singleConfigExe = Join-Path $root "build\offline_doc_studio.exe"
$iss = Join-Path $root "installer\OfflineDocStudio.iss"
$assoc = Join-Path $root "scripts\register_file_associations.ps1"
$hotkeys = Join-Path $root "config\hotkeys.json"
$sample = Join-Path $root "samples\session.ods"

$required = @($iss, $assoc, $hotkeys, $sample)
foreach ($item in $required) {
  if (-not (Test-Path $item)) {
    throw "Required file missing: $item"
  }
}

if (-not (Test-Path $exe) -and -not (Test-Path $singleConfigExe)) {
  throw "Built executable not found: $exe"
}

Write-Host "OK: windows release prerequisites are present"
