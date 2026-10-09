param([Parameter(Mandatory=$true)][string]$RuntimeRoot,[int]$ProcessId=0,[switch]$Snapshot,[string]$SessionId='')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RendererToken {
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access,bool inherit,int id);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll")] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
  [DllImport("advapi32.dll")] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr data,int size,out int required);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthority(IntPtr sid,uint index);
  public static int Integrity(int id) {
    IntPtr process=OpenProcess(0x1000,false,id),token=IntPtr.Zero,buffer=IntPtr.Zero;
    try {
      if(process==IntPtr.Zero || !OpenProcessToken(process,8,out token))return -1;
      int size;GetTokenInformation(token,25,IntPtr.Zero,0,out size);
      buffer=Marshal.AllocHGlobal(size);
      if(!GetTokenInformation(token,25,buffer,size,out size))return -1;
      IntPtr sid=Marshal.ReadIntPtr(buffer);byte count=Marshal.ReadByte(GetSidSubAuthorityCount(sid));
      return Marshal.ReadInt32(GetSidSubAuthority(sid,(uint)(count-1)));
    } finally {
      if(buffer!=IntPtr.Zero)Marshal.FreeHGlobal(buffer);
      if(token!=IntPtr.Zero)CloseHandle(token);
      if(process!=IntPtr.Zero)CloseHandle(process);
    }
  }
}
'@
function Normalize-ProcessPath([string]$Path) {
  if(-not $Path){return ''}
  if($Path.StartsWith('\\?\UNC\',[StringComparison]::OrdinalIgnoreCase)){$Path='\\'+$Path.Substring(8)}
  elseif($Path.StartsWith('\\?\',[StringComparison]::OrdinalIgnoreCase)){$Path=$Path.Substring(4)}
  return [IO.Path]::GetFullPath($Path).TrimEnd('\')
}
$root=(Normalize-ProcessPath $RuntimeRoot)+'\'
$processes=@(Get-CimInstance Win32_Process)
if($Snapshot){
  $rows=@($processes | ForEach-Object {
    $path=Normalize-ProcessPath ([string]$_.ExecutablePath)
    $command=[string]$_.CommandLine
    [pscustomobject]@{pid=[int]$_.ProcessId;parentPid=[int]$_.ParentProcessId;createdAt=$(if($_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{''});name=[string]$_.Name;
      runtimeOwned=($path -and $path.StartsWith($root,[StringComparison]::OrdinalIgnoreCase));
      sessionOwned=($SessionId -and $command.Contains($SessionId));worker=($SessionId -and $command.Contains($SessionId) -and $command -match 'scanner-worker');
      renderer=$(if($command){$command -match '--type=renderer'}else{$null});noSandbox=$(if($command){$command -match '--no-sandbox'}else{$null})}
  })
  ConvertTo-Json -InputObject $rows -Depth 3 -Compress
  exit 0
}
$rows=@($processes | Where-Object {
  if($ProcessId -gt 0){$_.ProcessId -eq $ProcessId}else{
    $_.ExecutablePath -and (Normalize-ProcessPath $_.ExecutablePath).StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -and $_.CommandLine -match '--type=renderer'
  }
} | ForEach-Object {
  @{pid=$_.ProcessId;integrityRid=[RendererToken]::Integrity($_.ProcessId);noSandbox=$(if($_.CommandLine){$_.CommandLine -match '--no-sandbox'}else{$null});executable=$(if($_.ExecutablePath){Split-Path -Leaf $_.ExecutablePath}else{$null})}
})
ConvertTo-Json -InputObject $rows -Compress
