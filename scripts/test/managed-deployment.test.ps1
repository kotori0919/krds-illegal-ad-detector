$ErrorActionPreference='Stop'
$script=Join-Path $PSScriptRoot '..\managed-deployment.ps1'
if (Get-Process -Name 'krds-detector' -ErrorAction SilentlyContinue) {
  Write-Output '{"state":"NOT_RUN","reason":"application is running; close it after saving/cancelling scans"}'
  exit 3
}
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('krds managed case '+[Guid]::NewGuid().ToString('N'))
$data=Join-Path $temporary 'data root'
$backup=Join-Path $temporary 'backup'
New-Item -ItemType Directory -Path $data -Force | Out-Null
try {
  $original='immutable official fixture'
  [IO.File]::WriteAllText((Join-Path $data 'result.json'),$original)
  & $script -Action backup -DataRoot $data -BackupPath $backup | Out-Null
  [IO.File]::WriteAllText((Join-Path $data 'result.json'),'newer saved case')
  & $script -Action restore -DataRoot $data -BackupPath $backup -ConfirmRestore | Out-Null
  if ([IO.File]::ReadAllText((Join-Path $data 'result.json')) -cne $original) { throw 'Restore changed original bytes.' }
  $previous=@(Get-ChildItem -LiteralPath $temporary -Directory | Where-Object { $_.Name -like 'data root.before-restore-*' })
  if ($previous.Count -ne 1 -or [IO.File]::ReadAllText((Join-Path $previous[0].FullName 'result.json')) -cne 'newer saved case') { throw 'Restore discarded previous data.' }
  [IO.File]::WriteAllText((Join-Path $backup 'data\result.json'),'tampered backup')
  $rejected=$false
  try { & $script -Action restore -DataRoot $data -BackupPath $backup -ConfirmRestore | Out-Null }
  catch { $rejected=$true }
  if (-not $rejected -or [IO.File]::ReadAllText((Join-Path $data 'result.json')) -cne $original) { throw 'Corrupt backup must be rejected without changing current data.' }
  Write-Output '{"state":"OBSERVED","checks":["backup hashes","restore exact bytes","previous data retained","corrupt backup rejected"]}'
} finally {
  Remove-Item -LiteralPath $temporary -Recurse -Force
}
