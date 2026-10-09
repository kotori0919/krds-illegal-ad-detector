[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet('diagnose','backup','restore','install','upgrade','rollback')][string]$Action,
  [string]$Manifest,
  [string]$Installer,
  [string]$InstallationRoot,
  [string]$DataRoot = (Join-Path $env:APPDATA 'kr.go.nia.illegal-ad-detector'),
  [string]$BackupPath,
  [switch]$ConfirmRestore
)
$ErrorActionPreference = 'Stop'

function Assert-NoRunningApp {
  if (Get-Process -Name 'krds-detector' -ErrorAction SilentlyContinue) {
    throw 'Close the application after saving/cancelling its scans; deployment will not terminate it.'
  }
}
function Assert-NoLinks([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    $items = @((Get-Item -LiteralPath $Path -Force)) + @(Get-ChildItem -LiteralPath $Path -Recurse -Force)
    foreach ($item in $items) {
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point refused: $($item.FullName)" }
    }
  }
}
function Backup-Data {
  if (-not $BackupPath) { throw 'BackupPath is required; select a protected folder outside the installation and data directories.' }
  if (Test-Path -LiteralPath $BackupPath) { throw 'BackupPath must be new; existing backups are never overwritten.' }
  $source = [IO.Path]::GetFullPath($DataRoot).TrimEnd('\')
  $target = [IO.Path]::GetFullPath($BackupPath).TrimEnd('\')
  if ($target.Equals($source,[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Backup cannot be inside data root.' }
  Assert-NoLinks $DataRoot
  New-Item -ItemType Directory -Path $BackupPath | Out-Null
  if (Test-Path -LiteralPath $DataRoot) { Copy-Item -LiteralPath $DataRoot -Destination (Join-Path $BackupPath 'data') -Recurse }
  $files = @(Get-ChildItem -LiteralPath $BackupPath -Recurse -File | ForEach-Object {
    @{ path=$_.FullName.Substring($target.Length+1); size=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
  })
  @{schemaVersion=1;createdAt=[DateTime]::UtcNow.ToString('o');files=$files} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $BackupPath 'backup-manifest.json') -Encoding UTF8
  Write-Output "Backup saved: $BackupPath"
}
function Restore-Data {
  if (-not $ConfirmRestore) { throw 'Restore requires -ConfirmRestore; the current data is preserved in a sibling recovery directory.' }
  Assert-NoLinks $BackupPath
  Assert-NoLinks $DataRoot
  $backup = Get-Content -LiteralPath (Join-Path $BackupPath 'backup-manifest.json') -Raw | ConvertFrom-Json
  if ($backup.schemaVersion -ne 1) { throw 'Unsupported backup schema.' }
  $base = [IO.Path]::GetFullPath($BackupPath).TrimEnd('\')+'\'
  $actual = @(Get-ChildItem -LiteralPath $BackupPath -Recurse -File | Where-Object { $_.FullName -ne (Join-Path $BackupPath 'backup-manifest.json') })
  if ($actual.Count -ne @($backup.files).Count) { throw 'Unexpected backup files.' }
  $seen = @{}
  foreach ($file in $backup.files) {
    $path = [IO.Path]::GetFullPath((Join-Path $BackupPath $file.path))
    if (-not $path.StartsWith($base,[StringComparison]::OrdinalIgnoreCase) -or $seen.ContainsKey($path)) { throw 'Unsafe/duplicate backup path.' }
    $seen[$path]=$true
    if ((Get-Item -LiteralPath $path).Length -ne $file.size -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw 'Backup integrity failed.' }
  }
  $restore = $DataRoot+'.restore-'+[Guid]::NewGuid().ToString('N')
  if (Test-Path -LiteralPath (Join-Path $BackupPath 'data')) { Copy-Item -LiteralPath (Join-Path $BackupPath 'data') -Destination $restore -Recurse }
  else { New-Item -ItemType Directory -Path $restore | Out-Null }
  $previous = $DataRoot+'.before-restore-'+[Guid]::NewGuid().ToString('N')
  if (Test-Path -LiteralPath $DataRoot) { Move-Item -LiteralPath $DataRoot -Destination $previous }
  try { Move-Item -LiteralPath $restore -Destination $DataRoot }
  catch { if (Test-Path -LiteralPath $previous) { Move-Item -LiteralPath $previous -Destination $DataRoot }; throw }
  Write-Output "Restored: $DataRoot; previous data retained at $previous"
}

if ($Action -eq 'diagnose') {
  $wv = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application" -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
  $running=@(Get-Process -Name 'krds-detector' -ErrorAction SilentlyContinue | Select-Object Id,Path)
  if (-not $InstallationRoot -and $running.Count -gt 0) { $InstallationRoot=Split-Path -Parent $running[0].Path }
  $build=$null
  if ($InstallationRoot -and (Test-Path -LiteralPath (Join-Path $InstallationRoot 'binaries\build-manifest.json'))) {
    $record=Get-Content -LiteralPath (Join-Path $InstallationRoot 'binaries\build-manifest.json') -Raw | ConvertFrom-Json
    $build=@{appVersion=$record.appVersion;buildId=$record.buildId;target=$record.target;sourceSha256=$record.source.sourceSha256;caseSchemaVersion=$record.caseSchemaVersion;detectorPolicyVersion=$record.detectorPolicyVersion}
  }
  @{schemaVersion=1;dataRoot=$DataRoot;dataExists=(Test-Path -LiteralPath $DataRoot);installationRoot=$InstallationRoot;build=$build;nodeRuntime='22.19.0';webview2=$wv;running=$running} | ConvertTo-Json -Depth 4
  exit 0
}
Assert-NoRunningApp
switch ($Action) {
  'backup' { Backup-Data }
  'restore' { Restore-Data }
  default {
    if (-not $Manifest -or -not $Installer) { throw 'Exact candidate Manifest and Installer are required.' }
    $candidate = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
    if ($candidate.schemaVersion -ne 1 -or $candidate.releaseStatus -ne 'candidate' -or $candidate.signing -ne 'unsigned-internal-candidate') { throw 'Unsupported/incomplete candidate manifest/signing profile.' }
    $name = Split-Path -Leaf $Installer
    $entry = @($candidate.files | Where-Object { $_.path -ceq $name })
    if ($entry.Count -ne 1 -or (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry[0].sha256) { throw 'Installer SHA256 does not match supplied candidate.' }
    if ($Action -ne 'install') { Backup-Data }
    # Interactive installer: unattended switches are deliberately withheld until candidate-specific execution verifies them.
    $process = Start-Process -FilePath (Resolve-Path -LiteralPath $Installer).Path -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer returned $($process.ExitCode); backup was preserved." }
    Write-Output 'Installer exited successfully; verify the app build identity and reopen cases before accepting deployment.'
  }
}
