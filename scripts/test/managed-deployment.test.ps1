$ErrorActionPreference='Stop'
$deploymentScript=Join-Path $PSScriptRoot '..\managed-deployment.ps1'
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('krds managed case '+[Guid]::NewGuid().ToString('N'))
$data=Join-Path $temporary 'data root'
$backup=Join-Path $temporary 'backup'
New-Item -ItemType Directory -Path $data -Force | Out-Null
try {
  # Import helpers only; no installed app, registry or deployment is changed.
  . $deploymentScript -Action diagnose -DataRoot $data -BackupPath $backup
  $InstallationRoot=Join-Path $temporary 'installed app'
  New-Item -ItemType Directory -Path (Join-Path $InstallationRoot 'binaries') | Out-Null
  $identity=@{appVersion='fixture-1';buildId='closed-app-fixture';target='x86_64-pc-windows-msvc';source=@{sourceSha256=('a'*64)};caseSchemaVersion=1;detectorPolicyVersion=2}
  $identity | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallationRoot 'binaries\build-manifest.json') -Encoding UTF8
  $original='immutable official fixture'
  [IO.File]::WriteAllText((Join-Path $data 'result.json'),$original)
  foreach ($unsafe in @($InstallationRoot,(Join-Path $InstallationRoot 'protected backup'),(Join-Path $InstallationRoot '..\installed app\nested\backup'),(Join-Path $data 'backup'))) {
    $BackupPath=$unsafe
    $rejected=$false
    try { Backup-Data -Registrations @() | Out-Null } catch { $rejected=$true }
    if (-not $rejected -or (Test-Path -LiteralPath (Join-Path $unsafe 'backup-manifest.json'))) { throw 'Unsafe backup location was accepted.' }
  }
  $explicitRoot=$InstallationRoot
  $InstallationRoot=$null
  foreach ($hive in @('HKCU','HKLM')) {
    $BackupPath=Join-Path $explicitRoot ('detected-'+$hive)
    $registration=[pscustomobject]@{root=('"'+$explicitRoot+'"');source=$hive+' fixture'}
    $rejected=$false
    try { Backup-Data -Registrations @($registration) | Out-Null } catch { $rejected=$true }
    if (-not $rejected -or (Test-Path -LiteralPath $BackupPath)) { throw 'Detected installation root did not protect the backup boundary.' }
    $diagnosis=Get-DeploymentDiagnosis @() @($registration) @() @()
    if ($diagnosis.installationRoot -cne $explicitRoot -or $diagnosis.build.buildId -cne 'closed-app-fixture' -or $diagnosis.running.Count -ne 0) { throw 'Closed installation build identity was lost.' }
  }
  $junction=Join-Path $temporary 'redirected backup parent'
  New-Item -ItemType Junction -Path $junction -Target $explicitRoot | Out-Null
  try {
    $BackupPath=Join-Path $junction 'escaped backup'
    $rejected=$false
    try { Backup-Data -Registrations @() | Out-Null } catch { $rejected=$true }
    if (-not $rejected -or (Test-Path -LiteralPath (Join-Path $explicitRoot 'escaped backup'))) { throw 'A junction bypassed the installation backup boundary.' }
  } finally { [IO.Directory]::Delete($junction) }
  $runtime=Join-Path $temporary 'per user WebView\Application'
  $version=Join-Path $runtime '143.0.1.2'
  New-Item -ItemType Directory -Path $version,(Join-Path $runtime '144.0.1.2') -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $version 'msedgewebview2.exe'),'fixture; not executed')
  $wv=@(Get-WebViewEvidence @([pscustomobject]@{version='143.0.1.2';source='HKCU fixture'},[pscustomobject]@{version='0.0.0.0';source='invalid fixture'}) @($runtime))
  if ($wv.Count -ne 2 -or @($wv | Where-Object {$_.kind -eq 'file' -and $_.state -eq 'present-not-executed'}).Count -ne 1 -or @($wv | Where-Object {$_.kind -eq 'registry' -and $_.state -eq 'registered-not-executed'}).Count -ne 1) { throw 'WebView evidence omitted per-user files or claimed unexecuted availability.' }
  # A similarly named sibling is outside the installation boundary and is valid.
  $BackupPath=$explicitRoot+'-backups'
  Backup-Data -Registrations @([pscustomobject]@{root=$explicitRoot;source='HKCU fixture'}) | Out-Null
  $backup=$BackupPath
  [IO.File]::WriteAllText((Join-Path $data 'result.json'),'newer saved case')
  $ConfirmRestore=$true
  Restore-Data | Out-Null
  if ([IO.File]::ReadAllText((Join-Path $data 'result.json')) -cne $original) { throw 'Restore changed original bytes.' }
  $previous=@(Get-ChildItem -LiteralPath $temporary -Directory | Where-Object { $_.Name -like 'data root.before-restore-*' })
  if ($previous.Count -ne 1 -or [IO.File]::ReadAllText((Join-Path $previous[0].FullName 'result.json')) -cne 'newer saved case') { throw 'Restore discarded previous data.' }
  [IO.File]::WriteAllText((Join-Path $backup 'data\result.json'),'tampered backup')
  $rejected=$false
  try { Restore-Data | Out-Null }
  catch { $rejected=$true }
  if (-not $rejected -or [IO.File]::ReadAllText((Join-Path $data 'result.json')) -cne $original) { throw 'Corrupt backup must be rejected without changing current data.' }
  Write-Output '{"state":"OBSERVED","checks":["explicit installation backup boundary","HKCU/HKLM installation backup boundary","normalized traversal rejected","junction bypass rejected","sibling backup accepted","closed installation build identity","per-user WebView file and registry evidence","backup hashes","restore exact bytes","previous data retained","corrupt backup rejected"]}'
} finally {
  Remove-Item -LiteralPath $temporary -Recurse -Force
}
