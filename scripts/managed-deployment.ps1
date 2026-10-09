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

function Get-AppRegistrations {
  # This is the exact NSIS product key, not a search of unrelated installations.
  $productName = '"\ubd88\ubc95\uad11\uace0 \ud0d0\uc9c0 \ub3c4\uad6c"' | ConvertFrom-Json
  foreach ($hive in @('HKCU:', 'HKLM:')) {
    foreach ($branch in @('Software', 'Software\WOW6432Node')) {
      $key = "$hive\$branch\Microsoft\Windows\CurrentVersion\Uninstall\$productName"
      $record = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
      if ($record -and $record.DisplayName -ceq $productName -and $record.InstallLocation) {
        [pscustomobject]@{root=$record.InstallLocation;source=$key}
      }
    }
  }
}
function Resolve-Installations([object[]]$Running, [object[]]$Registrations) {
  $candidates = @()
  if ($InstallationRoot) { $candidates += [pscustomobject]@{root=$InstallationRoot;source='explicit'} }
  foreach ($process in $Running) {
    if ($process.Path) { $candidates += [pscustomobject]@{root=(Split-Path -Parent $process.Path);source='running-process'} }
  }
  $candidates += $Registrations
  $seen = @{}
  foreach ($candidate in $candidates) {
    $root = ([string]$candidate.root).Trim().Trim('"')
    if (-not $root -or -not [IO.Path]::IsPathRooted($root)) { continue }
    $root = [IO.Path]::GetFullPath($root).TrimEnd('\')
    if (-not $seen.ContainsKey($root)) {
      $seen[$root]=$true
      [pscustomobject]@{root=$root;source=$candidate.source}
    }
  }
}
function Get-WebViewRegistrations {
  $client = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  foreach ($hive in @('HKCU:', 'HKLM:')) {
    foreach ($branch in @('Software', 'Software\WOW6432Node')) {
      $key = "$hive\$branch\Microsoft\EdgeUpdate\Clients\$client"
      $record = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
      if ($record) { [pscustomobject]@{version=$record.pv;source=$key} }
    }
  }
}
function Get-WebViewEvidence([object[]]$Registrations, [string[]]$ApplicationRoots) {
  foreach ($record in $Registrations) {
    if ($record.version -match '^\d+\.\d+\.\d+\.\d+$' -and $record.version -ne '0.0.0.0') {
      [pscustomobject]@{version=$record.version;source=$record.source;kind='registry';state='registered-not-executed'}
    }
  }
  foreach ($root in $ApplicationRoots) {
    if (-not $root -or -not (Test-Path -LiteralPath $root -PathType Container)) { continue }
    # Only immediate version directories in known runtime roots are inspected.
    foreach ($directory in Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue) {
      $executable = Join-Path $directory.FullName 'msedgewebview2.exe'
      if ($directory.Name -match '^\d+\.\d+\.\d+\.\d+$' -and (Test-Path -LiteralPath $executable -PathType Leaf)) {
        [pscustomobject]@{version=$directory.Name;source=$executable;kind='file';state='present-not-executed'}
      }
    }
  }
}
function Get-DeploymentDiagnosis([object[]]$Running, [object[]]$Registrations, [object[]]$WebViewRegistrations, [string[]]$WebViewRoots) {
  $installations = @(Resolve-Installations $Running $Registrations)
  $selected = if ($installations.Count) { $installations[0].root } else { $null }
  $build=$null
  if ($selected -and (Test-Path -LiteralPath (Join-Path $selected 'binaries\build-manifest.json') -PathType Leaf)) {
    $record=Get-Content -LiteralPath (Join-Path $selected 'binaries\build-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $build=@{appVersion=$record.appVersion;buildId=$record.buildId;target=$record.target;sourceSha256=$record.source.sourceSha256;caseSchemaVersion=$record.caseSchemaVersion;detectorPolicyVersion=$record.detectorPolicyVersion}
  }
  $evidence = @(Get-WebViewEvidence $WebViewRegistrations $WebViewRoots)
  @{schemaVersion=1;dataRoot=$DataRoot;dataExists=(Test-Path -LiteralPath $DataRoot);installationRoot=$selected;installationCandidates=$installations;build=$build;nodeRuntime='22.19.0';webview2=@($evidence.version | Sort-Object -Unique);webview2Evidence=$evidence;running=@($Running)}
}
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
  param([object[]]$Registrations = @(Get-AppRegistrations))
  if (-not $BackupPath) { throw 'BackupPath is required; select a protected folder outside the installation and data directories.' }
  if (Test-Path -LiteralPath $BackupPath) { throw 'BackupPath must be new; existing backups are never overwritten.' }
  $source = [IO.Path]::GetFullPath($DataRoot).TrimEnd('\')
  $target = [IO.Path]::GetFullPath($BackupPath).TrimEnd('\')
  if ($target.Equals($source,[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Backup cannot be inside data root.' }
  $installations = @(Resolve-Installations @() $Registrations)
  foreach ($installation in $installations) {
    if ($target.Equals($installation.root,[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($installation.root+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Backup cannot be inside an installation root.' }
  }
  # A junction in an existing target ancestor must not bypass the path boundary.
  $ancestor = $target
  while ($ancestor) {
    if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Backup path cannot traverse a reparse point.' }
    $ancestor = Split-Path -Parent $ancestor
  }
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
  $backup = Get-Content -LiteralPath (Join-Path $BackupPath 'backup-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
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

# Dot-sourcing exposes the same bounded helpers for isolated administration/tests.
if ($MyInvocation.InvocationName -eq '.') { return }
if ($Action -eq 'diagnose') {
  $running=@(Get-Process -Name 'krds-detector' -ErrorAction SilentlyContinue | Select-Object Id,Path)
  $runtimeRoots = @()
  foreach ($base in @(${env:ProgramFiles(x86)},$env:ProgramFiles,$env:LOCALAPPDATA)) {
    if ($base) { $runtimeRoots += Join-Path $base 'Microsoft\EdgeWebView\Application' }
  }
  Get-DeploymentDiagnosis $running @(Get-AppRegistrations) @(Get-WebViewRegistrations) $runtimeRoots | ConvertTo-Json -Depth 6
  exit 0
}
Assert-NoRunningApp
switch ($Action) {
  'backup' { Backup-Data }
  'restore' { Restore-Data }
  default {
    if (-not $Manifest -or -not $Installer) { throw 'Exact candidate Manifest and Installer are required.' }
    $candidate = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
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
