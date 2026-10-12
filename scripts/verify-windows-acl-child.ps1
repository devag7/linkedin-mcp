$ErrorActionPreference = 'Stop'
$root = $env:LMCP_ACL_ROOT
if (-not $root) { exit 30 }

$state = Join-Path $root '.linkedin-mcp'
$targets = @(
  @{ Kind = 'directory'; Path = (Join-Path $state 'profile') },
  @{ Kind = 'file'; Path = (Join-Path (Join-Path (Join-Path $state 'profile') 'Default') 'synthetic-cookie.txt') },
  @{ Kind = 'file'; Path = (Join-Path $state 'budgets.json') },
  @{ Kind = 'file'; Path = (Join-Path (Join-Path $state 'profile.lock') 'owner.json') },
  @{ Kind = 'file'; Path = (Join-Path (Join-Path $state 'budgets.json.lock') 'owner.json') }
)

foreach ($target in $targets) {
  try {
    if ($target.Kind -eq 'directory') {
      [void][System.IO.Directory]::GetFileSystemEntries($target.Path)
    } else {
      $stream = [System.IO.File]::Open($target.Path, 'Open', 'Read', 'ReadWrite')
      $stream.Dispose()
    }
    exit 10
  } catch [System.UnauthorizedAccessException] {
    # Expected: the distinct unprivileged account cannot read the exact target.
  } catch {
    exit 20
  }

  try {
    if ($target.Kind -eq 'directory') {
      [System.IO.File]::WriteAllText((Join-Path $target.Path 'unprivileged-write.txt'), 'synthetic only')
    } else {
      $stream = [System.IO.File]::Open($target.Path, 'Open', 'Write', 'ReadWrite')
      $stream.Dispose()
    }
    exit 11
  } catch [System.UnauthorizedAccessException] {
    # Expected: the distinct unprivileged account cannot modify the target.
  } catch {
    exit 21
  }
}

exit 0
