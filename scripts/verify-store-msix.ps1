param()
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$record = Get-Content -LiteralPath (Join-Path $root "store/partner-center-identity.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$dir = Join-Path $root "dist-msix-store-candidate"
if(-not (Test-Path -LiteralPath $dir)) { throw "MSIX output directory missing" }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packages = @(Get-ChildItem -LiteralPath $dir -File -Filter "*.msix")
$uploads = @(Get-ChildItem -LiteralPath $dir -File -Filter "*.msixupload")
if($packages.Count -eq 0 -or $uploads.Count -eq 0) { throw "Both .msix and .msixupload are required for the planned candidate" }
if($packages.Count -ne 1 -or $uploads.Count -ne 1) { throw "More than one candidate artifact found; do not choose arbitrarily" }
$pkg = $packages[0]
if($pkg.Length -lt 4096 -or $uploads[0].Length -lt 4096) { throw "Candidate artifact is unexpectedly small" }
$archive = [System.IO.Compression.ZipFile]::OpenRead($pkg.FullName)
try {
 $entry = $archive.Entries | Where-Object { $_.FullName -eq "AppxManifest.xml" } | Select-Object -First 1
 if(-not $entry) { throw "AppxManifest.xml missing from MSIX" }
 $reader = New-Object System.IO.StreamReader($entry.Open())
 try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
 $identity = $manifest.Package.Identity
 $name = [string]$identity.Name
 $publisher = [string]$identity.Publisher
 $version = [string]$identity.Version
 $arch = [string]$identity.ProcessorArchitecture
 if($name -cne $record.identityName) { throw "Identity.Name differs from EKIDEN MANAGER Partner Center record" }
 if($publisher -cne $record.publisher) { throw "Identity.Publisher differs from Partner Center record" }
 if($version -cne $env:STORE_PACKAGE_VERSION) { throw "MSIX Version does not match approved package version" }
 if($arch -ne "x64") { throw "Unexpected processor architecture: $arch" }
 Write-Host "MANIFEST_IDENTITY_MATCH: $name / $publisher / $version / $arch"
 Write-Host "MSIX candidate SHA256: $((Get-FileHash -LiteralPath $pkg.FullName -Algorithm SHA256).Hash)"
 Write-Host "MSIXUPLOAD SHA256: $((Get-FileHash -LiteralPath $uploads[0].FullName -Algorithm SHA256).Hash)"
 Write-Host "Not certified: Windows install, save migration, signing and WACK remain HOLD."
} finally { $archive.Dispose() }
