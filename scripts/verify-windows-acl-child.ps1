param([string]$Root, [string]$Result)

$ErrorActionPreference = 'Stop'
if (-not $root -or -not $result) { exit 30 }

function Finish([int]$code) {
  [System.IO.File]::WriteAllText($result, $code.ToString())
  exit $code
}

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
    Finish 10
  } catch [System.UnauthorizedAccessException] {
    # Expected: the distinct unprivileged account cannot read the exact target.
  } catch {
    Finish 20
  }

  try {
    if ($target.Kind -eq 'directory') {
      [System.IO.File]::WriteAllText((Join-Path $target.Path 'unprivileged-write.txt'), 'synthetic only')
    } else {
      $stream = [System.IO.File]::Open($target.Path, 'Open', 'Write', 'ReadWrite')
      $stream.Dispose()
    }
    Finish 11
  } catch [System.UnauthorizedAccessException] {
    # Expected: the distinct unprivileged account cannot modify the target.
  } catch {
    Finish 21
  }
}

Finish 0
