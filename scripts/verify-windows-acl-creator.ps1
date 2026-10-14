param([string]$Fixture, [string]$Node, [string]$Result, [string]$Suffix, [string]$Workspace)

$ErrorActionPreference = 'Stop'
try {
  if (-not $Fixture -or -not $Node -or -not $Result -or -not $Suffix -or -not $Workspace) {
    throw 'CREATOR_INPUT_INVALID'
  }
  $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'CREATOR_MUST_BE_UNPRIVILEGED'
  }
  $creatorHome = [Environment]::GetFolderPath('UserProfile')
  if (-not $creatorHome) { throw 'CREATOR_PROFILE_UNAVAILABLE' }
  $env:USERPROFILE = $creatorHome
  $root = Join-Path $creatorHome "lmcp-owner-$Suffix"
  Set-Location -LiteralPath $Workspace
  & $Node --import tsx $Fixture $root | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'CREATOR_FIXTURE_FAILED' }
  [IO.File]::WriteAllText($Result, $root)
  exit 0
} catch {
  [IO.File]::WriteAllText($Result, 'FAILED')
  exit 1
}
