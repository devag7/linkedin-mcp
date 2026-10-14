$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:OS -ne 'Windows_NT' -or -not $env:USERPROFILE -or -not $env:PUBLIC -or -not $env:GITHUB_WORKSPACE) {
  throw 'NATIVE_WINDOWS_RUNNER_REQUIRED'
}
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'DISPOSABLE_USER_CREATION_UNAVAILABLE'
}

$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 10)
$user = "lmcp$suffix"
$creatorUser = "lmcpowner$suffix"
$password = ConvertTo-SecureString ([Guid]::NewGuid().ToString('N') + 'aA1!') -AsPlainText -Force
$creatorPassword = ConvertTo-SecureString ([Guid]::NewGuid().ToString('N') + 'aA1!') -AsPlainText -Force
$credential = [PSCredential]::new("$env:COMPUTERNAME\$user", $password)
$creatorCredential = [PSCredential]::new("$env:COMPUTERNAME\$creatorUser", $creatorPassword)
$createdUser = $false
$createdCreator = $false
$roots = @()
$results = @()
$sourceChild = Join-Path $env:GITHUB_WORKSPACE 'scripts\verify-windows-acl-child.ps1'
$child = Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-acl-child-$suffix.ps1"
$sourceCreator = Join-Path $env:GITHUB_WORKSPACE 'scripts\verify-windows-acl-creator.ps1'
$creatorScript = Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-acl-creator-$suffix.ps1"
$creatorResult = Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-acl-created-$suffix.txt"
$fixture = Join-Path $env:GITHUB_WORKSPACE 'scripts\verify-windows-acl-fixture.ts'
$node = (Get-Command node).Source
$shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$unsafeRoot = Join-Path $env:USERPROFILE "lmcp-unsafe-$suffix"
$junctionTarget = Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-junction-target-$suffix"
$junction = Join-Path $env:USERPROFILE "lmcp-junction-$suffix"

try {
  if (Test-Path -LiteralPath $child) { throw 'PROBE_SCRIPT_PREEXISTS' }
  if (Test-Path -LiteralPath $creatorScript) { throw 'CREATOR_SCRIPT_PREEXISTS' }
  if (Test-Path -LiteralPath $creatorResult) { throw 'CREATOR_RESULT_PREEXISTS' }
  Copy-Item -LiteralPath $sourceChild -Destination $child
  Copy-Item -LiteralPath $sourceCreator -Destination $creatorScript
  New-LocalUser -Name $user -Password $password -Description 'Disposable LinkedIn MCP ACL verifier' | Out-Null
  $createdUser = $true
  New-LocalUser -Name $creatorUser -Password $creatorPassword -Description 'Disposable LinkedIn MCP state owner' | Out-Null
  $createdCreator = $true
  $member = Get-LocalGroupMember -Group 'Administrators' | Where-Object { $_.Name -eq "$env:COMPUTERNAME\$user" }
  if ($member) { throw 'PROBE_USER_NOT_UNPRIVILEGED' }
  $creatorMember = Get-LocalGroupMember -Group 'Administrators' | Where-Object { $_.Name -eq "$env:COMPUTERNAME\$creatorUser" }
  if ($creatorMember) { throw 'CREATOR_NOT_UNPRIVILEGED' }

  $creatorProcess = Start-Process -FilePath $shell -Credential $creatorCredential -LoadUserProfile -WindowStyle Hidden -PassThru -WorkingDirectory $env:SystemRoot -ArgumentList @(
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$creatorScript`"",
    '-Fixture', "`"$fixture`"", '-Node', "`"$node`"", '-Result', "`"$creatorResult`"",
    '-Suffix', $suffix, '-Workspace', "`"$env:GITHUB_WORKSPACE`""
  )
  if (-not $creatorProcess.WaitForExit(60000)) {
    $creatorProcess.Kill()
    throw 'CREATOR_PROBE_TIMEOUT'
  }
  if (-not (Test-Path -LiteralPath $creatorResult)) { throw 'CREATOR_RESULT_UNAVAILABLE' }
  $creatorRoot = [IO.File]::ReadAllText($creatorResult).Trim(@([char]0xFEFF, [char]13, [char]10, [char]32))
  if ($creatorRoot -match '^FAILED:(INPUT|IDENTITY|PROFILE|WORKSPACE|FIXTURE|RECEIPT)$') {
    throw "CREATOR_$($creatorRoot.Substring(7))_FAILED"
  }
  # Start-Process -Credential can leave ExitCode unavailable after WaitForExit
  # on this runner. A fixed success receipt is written only after the fixture
  # succeeds, then the exact root and all target permissions are probed below.
  if ($null -ne $creatorProcess.ExitCode -and $creatorProcess.ExitCode -ne 0) {
    if ([IO.Path]::IsPathRooted($creatorRoot)) {
      $code = if ($null -eq $creatorProcess.ExitCode) { 'UNKNOWN' } else { [string]$creatorProcess.ExitCode }
      throw "CREATOR_NONZERO_WITH_PATH_$code"
    }
    throw 'CREATOR_RESULT_INVALID'
  }
  $creatorSid = (Get-LocalUser -Name $creatorUser).SID.Value
  $creatorProfile = (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$creatorSid").ProfileImagePath
  $expectedCreatorRoot = Join-Path ([Environment]::ExpandEnvironmentVariables($creatorProfile)) "lmcp-owner-$suffix"
  if (-not $creatorRoot.Equals($expectedCreatorRoot, [StringComparison]::OrdinalIgnoreCase) -or
      -not (Test-Path -LiteralPath $creatorRoot)) {
    throw 'CREATOR_RESULT_INVALID'
  }

  # Elevated-runner, public-refusal and ordinary-user creation are distinct cases.
  # Any exposed target fails the gate; this is a probe, not an exemption.
  $roots = @(
    (Join-Path $env:USERPROFILE "lmcp-home-$suffix"),
    (Join-Path (Join-Path $env:USERPROFILE "lmcp-custom-$suffix") 'nested'),
    (Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-public-$suffix"),
    $creatorRoot
  )
  for ($index = 0; $index -lt $roots.Count; $index++) {
    $root = $roots[$index]
    if ($index -eq 2) {
      $marker = & node --import tsx scripts/verify-windows-acl-fixture.ts $root 'expect-public-refusal'
      if ($LASTEXITCODE -ne 0 -or $marker -ne '{"fixture":"public_path_refused_before_creation"}' -or (Test-Path -LiteralPath $root)) {
        throw 'PUBLIC_CUSTOM_PATH_NOT_REFUSED_BEFORE_CREATION'
      }
      continue
    }
    if ($index -ne 3) {
      & node --import tsx scripts/verify-windows-acl-fixture.ts $root | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'DISPOSABLE_FIXTURE_FAILED' }
    }
    $ownFile = Join-Path (Join-Path (Join-Path (Join-Path $root '.linkedin-mcp') 'profile') 'Default') 'synthetic-cookie.txt'
    $stream = [IO.File]::Open($ownFile, 'Open', 'ReadWrite', 'ReadWrite')
    $stream.Dispose()
    $result = Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-acl-result-$suffix-$index.txt"
    if (Test-Path -LiteralPath $result) { throw 'PROBE_RESULT_PREEXISTS' }
    $results += $result
    $process = Start-Process -FilePath $shell -Credential $credential -LoadUserProfile -WindowStyle Hidden -PassThru -WorkingDirectory $env:SystemRoot -ArgumentList @(
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$child`"",
      '-Root', "`"$root`"", '-Result', "`"$result`""
    )
    if (-not $process.WaitForExit(30000)) {
      $process.Kill()
      throw 'SECOND_USER_PROBE_TIMEOUT'
    }
    if (-not (Test-Path -LiteralPath $result)) { throw 'PROBE_RESULT_UNAVAILABLE' }
    $resultCode = [System.IO.File]::ReadAllText($result)
    if ($resultCode -notmatch '^(0|1[0123][0-5])$') { throw 'PROBE_RESULT_INVALID' }
    if ($resultCode -ne '0') {
      $scope = @('user_profile', 'home_custom', 'public_refused', 'ordinary_owner')[$index]
      throw "SECOND_USER_ACCESS_NOT_REFUSED:$scope`:$resultCode"
    }
  }

  $negative = Join-Path $env:GITHUB_WORKSPACE 'scripts\verify-windows-acl-negative.ts'
  & node --import tsx scripts/verify-windows-acl-fixture.ts $unsafeRoot | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'NEGATIVE_FIXTURE_FAILED' }
  $unsafeProfile = Join-Path (Join-Path $unsafeRoot '.linkedin-mcp') 'profile'
  $unsafeAcl = Get-Acl -LiteralPath $unsafeProfile
  $usersSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-545')
  $unsafeRule = [Security.AccessControl.FileSystemAccessRule]::new(
    $usersSid, [Security.AccessControl.FileSystemRights]::ReadAndExecute,
    [Security.AccessControl.AccessControlType]::Allow)
  $unsafeAcl.AddAccessRule($unsafeRule)
  Set-Acl -LiteralPath $unsafeProfile -AclObject $unsafeAcl
  & node --import tsx $negative 'untrusted-child' $unsafeProfile | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'NEGATIVE_UNTRUSTED_CHILD_FAILED' }

  [void][IO.Directory]::CreateDirectory($junctionTarget)
  New-Item -ItemType Junction -Path $junction -Target $junctionTarget | Out-Null
  & node --import tsx $negative 'junction' $junction | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'NEGATIVE_JUNCTION_FAILED' }

  $spoof = Join-Path (Join-Path $env:PUBLIC 'Documents') "lmcp-spoof-$suffix"
  & node --import tsx $negative 'spoofed-home' $spoof | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'NEGATIVE_SPOOFED_HOME_FAILED' }

  & node --import tsx $negative 'helper-failure' $unsafeRoot | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'NEGATIVE_HELPER_FAILURE_FAILED' }

  Write-Output '{"nativeWindowsAcl":"passed","homeTargets":18,"negativeCases":4,"publicCustomRefusedBeforeCreation":true,"ordinaryCreator":true,"distinctUnprivilegedUser":true,"ownerReadWrite":true,"readDenied":true,"writeDenied":true}'
} finally {
  if (Test-Path -LiteralPath $child) { Remove-Item -LiteralPath $child -Force }
  if (Test-Path -LiteralPath $creatorScript) { Remove-Item -LiteralPath $creatorScript -Force }
  if (Test-Path -LiteralPath $creatorResult) { Remove-Item -LiteralPath $creatorResult -Force }
  foreach ($result in $results) {
    if (Test-Path -LiteralPath $result) { Remove-Item -LiteralPath $result -Force }
  }
  foreach ($root in $roots) {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
  }
  if (Test-Path -LiteralPath $unsafeRoot) { Remove-Item -LiteralPath $unsafeRoot -Recurse -Force }
  if (Test-Path -LiteralPath $junction) { Remove-Item -LiteralPath $junction -Force }
  if (Test-Path -LiteralPath $junctionTarget) { Remove-Item -LiteralPath $junctionTarget -Recurse -Force }
  if ($roots.Count -gt 1) {
    $customParent = Split-Path $roots[1] -Parent
    if (Test-Path -LiteralPath $customParent) { Remove-Item -LiteralPath $customParent -Recurse -Force }
  }
  if ($createdUser) { Remove-LocalUser -Name $user }
  if ($createdCreator) { Remove-LocalUser -Name $creatorUser }
}
