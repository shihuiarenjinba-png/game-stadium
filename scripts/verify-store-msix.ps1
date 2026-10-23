param()
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$record = Get-Content -LiteralPath (Join-Path $root "store/partner-center-identity.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$dir = Join-Path $root "dist-msix-store-candidate"
if (-not (Test-Path -LiteralPath $dir)) { throw "MSIX output directory missing" }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packages = @(Get-ChildItem -LiteralPath $dir -File -Filter "*.msix")
$uploads = @(Get-ChildItem -LiteralPath $dir -File -Filter "*.msixupload")
if ($packages.Count -ne 1 -or $uploads.Count -ne 1) { throw "Expected exactly one MSIX and one MSIXUPLOAD" }
if ($packages[0].Length -lt 4096 -or $uploads[0].Length -lt 4096) { throw "Candidate artifact is unexpectedly small" }

$archive = [System.IO.Compression.ZipFile]::OpenRead($packages[0].FullName)
try {
  $entry = $archive.GetEntry("AppxManifest.xml")
  if (-not $entry) { throw "AppxManifest.xml missing from MSIX" }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }

  $identity = $manifest.SelectSingleNode("/*[local-name()='Package']/*[local-name()='Identity']")
  if (-not $identity) { throw "Identity node missing" }
  if ([string]$identity.Name -cne [string]$record.identityName) { throw "Identity.Name mismatch" }
  if ([string]$identity.Publisher -cne [string]$record.publisher) { throw "Identity.Publisher mismatch" }
  if ([string]$identity.Version -cne [string]$env:STORE_PACKAGE_VERSION) { throw "Identity.Version mismatch" }
  if ([string]$identity.Version -notmatch '^\d+\.\d+\.\d+\.0$') { throw "Identity.Version revision must be 0" }
  if ([string]$identity.ProcessorArchitecture -cne "x64") { throw "ProcessorArchitecture is not x64" }

  $pdn = $manifest.SelectSingleNode("//*[local-name()='PublisherDisplayName']")
  if (-not $pdn -or [string]$pdn.InnerText -cne [string]$record.publisherDisplayName) { throw "PublisherDisplayName mismatch" }

  $propertiesName = $manifest.SelectSingleNode("//*[local-name()='Properties']/*[local-name()='DisplayName']")
  $visualElements = @($manifest.SelectNodes("//*[local-name()='VisualElements']"))
  if (-not $propertiesName -or [string]$propertiesName.InnerText -cne [string]$record.storeDisplayName) {
    throw "Package/Properties/DisplayName differs from reserved Store display name"
  }
  if ($visualElements.Count -ne 1 -or [string]$visualElements[0].GetAttribute("DisplayName") -cne [string]$record.storeDisplayName) {
    throw "uap:VisualElements/@DisplayName differs from reserved Store display name"
  }

  $langs = @($manifest.SelectNodes("//*[local-name()='Resources']/*[local-name()='Resource']") | ForEach-Object { [string]$_.GetAttribute("Language") })
  foreach ($requiredLanguage in @("ja-JP","en-US")) {
    if ($langs -notcontains $requiredLanguage) { throw "Manifest Resources missing $requiredLanguage" }
  }

  if (@($archive.Entries | Where-Object { $_.FullName -match '(^|/)app\.asar$' }).Count -lt 1) { throw "app.asar missing from MSIX" }
  if (@($archive.Entries | Where-Object { $_.FullName -match '(^|/)LICENSE\.electron\.txt$' }).Count -lt 1) { throw "LICENSE.electron.txt missing from MSIX" }

  $commitEntries = @($archive.Entries | Where-Object { $_.FullName -match '(^|/)SOURCE_GIT_COMMIT\.txt$' })
  if ($commitEntries.Count -ne 1) { throw "Expected exactly one SOURCE_GIT_COMMIT.txt in MSIX" }
  $commitReader = New-Object System.IO.StreamReader($commitEntries[0].Open())
  try { $embeddedCommit = $commitReader.ReadToEnd().Trim() } finally { $commitReader.Dispose() }
  $expectedCommit = if ($env:SOURCE_GIT_COMMIT) { [string]$env:SOURCE_GIT_COMMIT } else { [string]$env:GITHUB_SHA }
  if ($expectedCommit -notmatch '^[0-9a-fA-F]{40}$' -or $embeddedCommit -cne $expectedCommit) { throw "Embedded Source commit mismatch" }

  Write-Host "MANIFEST_IDENTITY_PASS $($record.identityName) $($identity.Version) x64"
  Write-Host "STORE_DISPLAY_NAME_PASS $($record.storeDisplayName)"
  Write-Host "RESOURCE_LANGUAGE_PASS ja-JP,en-US"
  Write-Host "SOURCE_COMMIT_PASS $embeddedCommit"
  Write-Host ("MSIX_SHA256=" + (Get-FileHash -LiteralPath $packages[0].FullName -Algorithm SHA256).Hash)
  Write-Host ("MSIXUPLOAD_SHA256=" + (Get-FileHash -LiteralPath $uploads[0].FullName -Algorithm SHA256).Hash)
  Write-Host "Candidate only: Windows install/save/restore, WACK, Partner Center validation, certification and publication remain separate gates."
}
finally { $archive.Dispose() }
