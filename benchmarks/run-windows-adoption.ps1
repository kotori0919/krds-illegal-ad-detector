param([Parameter(Mandatory=$true)][string]$Repository,[Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$Output,[switch]$PoisonBrowserRoot)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Set-Location -LiteralPath $Repository
New-Item -ItemType Directory -Path $Output -Force | Out-Null
$node=(Get-Command node.exe -ErrorAction Stop).Source
try {
  $driverArguments=@((Join-Path $Repository 'benchmarks\windows-adoption.mjs'),$Executable,$Output)
  if($PoisonBrowserRoot){$driverArguments+='--poison-browser-root'}
  & $node @driverArguments *> (Join-Path $Output 'driver.log')
  $code=$LASTEXITCODE
  [IO.File]::WriteAllText((Join-Path $Output 'exit-code.txt'),[string]$code)
  exit $code
} catch {
  $_ | Out-String | Set-Content -LiteralPath (Join-Path $Output 'launcher-error.txt') -Encoding UTF8
  exit 1
}
