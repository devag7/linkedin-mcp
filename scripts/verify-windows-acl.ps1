$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:OS -ne 'Windows_NT' -or -not $env:RUNNER_TEMP -or -not $env:GITHUB_WORKSPACE) {
  throw 'NATIVE_WINDOWS_RUNNER_REQUIRED'
}
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'DISPOSABLE_USER_CREATION_UNAVAILABLE'
}

$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 10)
$user = "lmcp$suffix"
$password = ConvertTo-SecureString ([Guid]::NewGuid().ToString('N') + 'aA1!') -AsPlainText -Force
$credential = [PSCredential]::new("$env:COMPUTERNAME\$user", $password)
$createdUser = $false
$roots = @()
$results = @()
$child = Join-Path $env:GITHUB_WORKSPACE 'scripts\verify-windows-acl-child.ps1'
$shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

try {
  New-LocalUser -Name $user -Password $password -Description 'Disposable LinkedIn MCP ACL verifier' | Out-Null
  $createdUser = $true
  $member = Get-LocalGroupMember -Group 'Administrators' | Where-Object { $_.Name -eq "$env:COMPUTERNAME\$user" }
  if ($member) { throw 'PROBE_USER_NOT_UNPRIVILEGED' }

  # One private default-style location and one deliberately public custom parent.
  # Any exposed target fails the gate; this is a probe, not an exemption.
  $roots = @(
    (Join-Path $env:RUNNER_TEMP "lmcp-private-$suffix"),
    (Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-public-$suffix")
  )
  for ($index = 0; $index -lt $roots.Count; $index++) {
    $root = $roots[$index]
    & node --import tsx scripts/verify-windows-acl-fixture.ts $root | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'DISPOSABLE_FIXTURE_FAILED' }
    $env:LMCP_ACL_ROOT = $root
    $result = Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-acl-result-$suffix-$index.txt"
    if (Test-Path -LiteralPath $result) { throw 'PROBE_RESULT_PREEXISTS' }
    $results += $result
    $env:LMCP_ACL_RESULT = $result
    $process = Start-Process -FilePath $shell -Credential $credential -LoadUserProfile -WindowStyle Hidden -PassThru -WorkingDirectory $env:SystemRoot -ArgumentList @(
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$child`""
    )
    if (-not $process.WaitForExit(30000)) {
      $process.Kill()
      throw 'SECOND_USER_PROBE_TIMEOUT'
    }
    if (-not (Test-Path -LiteralPath $result)) { throw 'PROBE_RESULT_UNAVAILABLE' }
    $resultCode = [System.IO.File]::ReadAllText($result)
    if ($resultCode -notmatch '^(0|10|11|20|21)$') { throw 'PROBE_RESULT_INVALID' }
    if ($resultCode -ne '0') { throw "SECOND_USER_ACCESS_NOT_REFUSED:$resultCode" }
  }
  Write-Output '{"nativeWindowsAcl":"passed","locations":2,"distinctUnprivilegedUser":true,"targetsPerLocation":5,"readDenied":true,"writeDenied":true}'
} finally {
  Remove-Item Env:\LMCP_ACL_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:\LMCP_ACL_RESULT -ErrorAction SilentlyContinue
  foreach ($result in $results) {
    if (Test-Path -LiteralPath $result) { Remove-Item -LiteralPath $result -Force }
  }
  foreach ($root in $roots) {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
  }
  if ($createdUser) { Remove-LocalUser -Name $user }
}
