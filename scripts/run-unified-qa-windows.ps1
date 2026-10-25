# Run in the cloned repository on a trusted Windows PC. No GitHub Actions runner or Store account required.
# This is QA tooling, never linked from the buyer's game UI.
[CmdletBinding()]
param([switch]$SkipInstall)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $root
try {
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js 22+ is needed to run this QA.' }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is needed to run this QA.' }
  $version = (& node.exe -p 'Number(process.versions.node.split(".")[0])').Trim()
  if ([int]$version -lt 22) { throw "Node 22+ is required, but found Node $version." }
  $qaDir = Join-Path $root 'unified-ui-evidence'
  if (Test-Path $qaDir) { Remove-Item -Recurse -Force $qaDir }
  if (-not $SkipInstall) {
    & npm.cmd install --no-audit --no-fund --no-package-lock
    if ($LASTEXITCODE -ne 0) { throw 'npm dependency install failed.' }
    & npm.cmd install --no-save --no-package-lock --no-audit --no-fund playwright@1.56.1
    if ($LASTEXITCODE -ne 0) { throw 'Playwright dependency install failed.' }
    & npx.cmd --no-install playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw 'Chromium install failed.' }
  }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Source regression tests FAILED.' }
  if ((Get-Content package.json -Raw | ConvertFrom-Json).scripts.'audit:integrity') {
    & npm.cmd run audit:integrity
    if ($LASTEXITCODE -ne 0) { throw 'Original source SHA-256 manifest FAILED. Do not rewrite the ledger.' }
  }
  & node.exe scripts/unified-ui-qa.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Real browser UI test FAILED.' }
  $reportPath = Join-Path $qaDir 'QA_RESULT.json'
  if (-not (Test-Path $reportPath)) { throw 'Missing QA_RESULT.json. No PASS without report.' }
  $record = Get-Content $reportPath -Raw | ConvertFrom-Json
  if ($record.status -ne 'PASS') { throw "QA record did not certify PASS: $($record.status)" }
  $pngs = @(Get-ChildItem $qaDir -Filter '*.png' -File)
  if ($pngs.Count -lt 2) { throw "Missing screenshots. Found $($pngs.Count)." }
  $sourceSha = 'UNAVAILABLE'
  if (Get-Command git.exe -ErrorAction SilentlyContinue) {
    $actual = & git.exe rev-parse --verify HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $actual -match '^[0-9a-f]{40}$') { $sourceSha = $actual }
  }
  $hashes = @($pngs | ForEach-Object {
    [ordered]@{ file=$_.Name; sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash; bytes=$_.Length }
  })
  $summary = [ordered]@{
    status='PASS'
    sourceCommit=$sourceSha
    checkedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
    sourceTests='PASS'
    browserUI='PASS'
    screenshots=$hashes
    storeSigned=$false
    msixInstalled=$false
    wackCompleted=$false
    comment='This verifies the local source and browser UI only; it is not Microsoft Store certification.'
  }
  $summary | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $qaDir 'LOCAL_QA_HANDOFF.json') -Encoding utf8
  Write-Host "LOCAL_QA_PASS source=$sourceSha; screenshots=$($pngs.Count); result=$qaDir"
}
finally { Pop-Location }
