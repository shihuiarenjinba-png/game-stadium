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
if ($packages.Count -eq 0 -or $uploads.Count -eq 0) { throw "Both .msix and .msixupload are required for the planned candidate" }
if ($packages.Count -ne 1 -or $uploads.Count -ne 1) { throw "More than one candidate artifact found; do not choose arbitrarily" }
$pkg = $packages[0]
if ($pkg.Length -lt 4096 -or $uploads[0].Length -lt 4096) { throw "Candidate artifact is unexpectedly small" }
$archive = [System.IO.Compression.ZipFile]::OpenRead($pkg.FullName)
try {
  $entry = $archive.Entries | Where-Object { $_.FullName -eq "AppxManifest.xml" } | Select-Object -First 1
  if (-not $entry) { throw "AppxManifest.xml missing from MSIX" }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }

  $identity = $manifest.Package.Identity
  $name = [string]$identity.Name
  $publisher = [string]$identity.Publisher
  $version = [string]$identity.Version
  $arch = [string]$identity.ProcessorArchitecture
  if ($name -cne [string]$record.identityName) { throw "Identity.Name differs from canonical EKIDEN MANAGER identity record" }
  if ($publisher -cne [string]$record.publisher) { throw "Identity.Publisher differs from canonical EKIDEN MANAGER identity record" }

  $publisherDisplayNode = $manifest.SelectSingleNode("//*[local-name()='PublisherDisplayName']")
  if ($null -eq $publisherDisplayNode) { throw "PublisherDisplayName missing from AppxManifest.xml" }
  if ([string]$publisherDisplayNode.InnerText -cne [string]$record.publisherDisplayName) {
    throw "PublisherDisplayName differs from canonical EKIDEN MANAGER identity record"
  }

  if ($version -cne [string]$env:STORE_PACKAGE_VERSION) { throw "MSIX Identity.Version does not match explicit STORE_PACKAGE_VERSION" }
  if ($version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
    throw "MSIX Identity.Version must contain four canonical decimal integers"
  }
  $versionParts = @($version.Split(".") | ForEach-Object { [int]::Parse($_) })
  foreach ($part in $versionParts) {
    if ($part -lt 0 -or $part -gt 65535) { throw "MSIX Identity.Version components must be in 0..65535" }
  }
  if ($versionParts[0] -eq 0) { throw "Store Windows 10/11 package version requires a non-zero Major component" }
  if ($versionParts[3] -ne 0) { throw "Store Windows 10/11 package Revision component must be 0 at build time" }
  if ($arch -ne "x64") { throw ("Unexpected processor architecture: " + $arch) }

  Write-Host ("MANIFEST_IDENTITY_MATCH: " + $name + " / " + $publisher + " / " + $version + " / " + $arch)
  Write-Host ("PublisherDisplayName MATCH: " + [string]$publisherDisplayNode.InnerText)
  Write-Host ("MSIX candidate SHA256: " + (Get-FileHash -LiteralPath $pkg.FullName -Algorithm SHA256).Hash)
  Write-Host ("MSIXUPLOAD SHA256: " + (Get-FileHash -LiteralPath $uploads[0].FullName -Algorithm SHA256).Hash)
  Write-Host "Not certified: Windows install, save migration, signing and WACK remain HOLD."
} finally {
  $archive.Dispose()
}
