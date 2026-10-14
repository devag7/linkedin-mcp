/** Windows state may be created only beneath a verified private user-profile tree. */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve, win32 } from 'node:path';
import { homedir } from 'node:os';

// The path is sent over stdin, never interpolated into a command line. This
// verifier intentionally refuses every unfamiliar allow ACE, including on
// existing directories. It cannot make previously exposed data private.
const WINDOWS_ACL_CHECK = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$stage = 'INPUT'
try {
  $request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd())) | ConvertFrom-Json
  $stage = 'INPUT_HOME'
  $stateUserProfileRoot = [IO.Path]::GetFullPath([Environment]::GetFolderPath('UserProfile')).TrimEnd([char]92)
  $stage = 'INPUT_TARGET'
  $target = [IO.Path]::GetFullPath([string]$request.target).TrimEnd([char]92)
  $stage = 'INPUT_COMPARE'
  if (-not $stateUserProfileRoot -or -not $stateUserProfileRoot.Equals([IO.Path]::GetFullPath([string]$request.home).TrimEnd([char]92), [StringComparison]::OrdinalIgnoreCase) -or -not $target.StartsWith($stateUserProfileRoot + [char]92, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'OUTSIDE_USER_PROFILE'
  }
  $stage = 'INPUT_IDENTITY'
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $sid = $identity.User.Value
  $allowed = @($sid, 'S-1-5-18', 'S-1-5-32-544', 'S-1-3-0')
  # TrustedInstaller owns some Windows volume ancestors; it is an OS service,
  # never a general service-SID wildcard.
  $trustedInstaller = 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
  $trustedOwners = @($sid, 'S-1-5-18', 'S-1-5-32-544', $trustedInstaller)
  $privateOwners = @($sid, 'S-1-5-18', 'S-1-5-32-544')
  $trustedAncestorAllow = @($allowed) + @($trustedInstaller)
  function Assert-SafeParent([string]$path) {
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'ANCESTOR_REPARSE_POINT' }
    $acl = Get-Acl -LiteralPath $path
    $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($privateOwners -cnotcontains $owner) { throw 'ANCESTOR_FOREIGN_OWNER' }
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
      if (($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0) { continue }
      if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
          $allowed -cnotcontains $rule.IdentityReference.Value -and
          (([int64]$rule.FileSystemRights -band $danger) -ne 0)) {
        throw 'ANCESTOR_REPLACE_AUTHORITY'
      }
    }
  }
  function New-PrivateDirectory([string]$path) {
    $security = New-Object Security.AccessControl.DirectorySecurity
    $security.SetAccessRuleProtection($true, $false)
    $security.SetOwner($identity.User)
    foreach ($trustee in @($sid, 'S-1-5-18', 'S-1-5-32-544')) {
      $principal = [Security.Principal.SecurityIdentifier]::new($trustee)
      $rule = [Security.AccessControl.FileSystemAccessRule]::new(
        $principal,
        [Security.AccessControl.FileSystemRights]::FullControl,
        ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),
        [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow)
      $security.AddAccessRule($rule)
    }
    [void][IO.Directory]::CreateDirectory($path, $security)
  }
  function Assert-Private([string]$path, [bool]$directory) {
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_POINT' }
    if ($directory -and -not $item.PSIsContainer) { throw 'NOT_DIRECTORY' }
    if (-not $directory -and $item.PSIsContainer) { throw 'NOT_FILE' }
    $acl = Get-Acl -LiteralPath $path
    $privateOwner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($privateOwners -cnotcontains $privateOwner) {
      if ($privateOwner -eq $trustedInstaller) { throw 'PRIVATE_TRUSTED_INSTALLER_OWNER' }
      if ($privateOwner.StartsWith('S-1-5-80-', [StringComparison]::Ordinal)) {
        throw 'PRIVATE_SERVICE_OWNER'
      }
      throw 'FOREIGN_OWNER'
    }
    $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    $ownerRights = [int64]0
    foreach ($rule in $rules) {
      if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
      if (($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0) { continue }
      $trustee = $rule.IdentityReference.Value
      if ($allowed -cnotcontains $trustee) { throw 'UNTRUSTED_ALLOW_ACE' }
      if ($trustee -eq $sid) {
        $ownerRights = $ownerRights -bor [int64]$rule.FileSystemRights
      }
    }
    $full = [int64][Security.AccessControl.FileSystemRights]::FullControl
    if (($ownerRights -band $full) -ne $full) { throw 'OWNER_NOT_FULL_CONTROL' }
  }
  $stage = 'ANCESTOR'
  $ancestor = [IO.Directory]::GetParent($stateUserProfileRoot)
  $danger = [int64][Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
    [int64][Security.AccessControl.FileSystemRights]::Delete -bor
    [int64][Security.AccessControl.FileSystemRights]::ChangePermissions -bor
    [int64][Security.AccessControl.FileSystemRights]::TakeOwnership
  while ($null -ne $ancestor) {
    $stage = 'ANCESTOR_ITEM'
    $item = Get-Item -LiteralPath $ancestor.FullName -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'ANCESTOR_REPARSE_POINT' }
    $stage = 'ANCESTOR_ACL'
    $acl = Get-Acl -LiteralPath $ancestor.FullName
    $stage = 'ANCESTOR_OWNER'
    $ancestorOwner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($trustedOwners -cnotcontains $ancestorOwner) {
      if ($ancestorOwner.StartsWith('S-1-5-80-', [StringComparison]::Ordinal)) {
        throw 'ANCESTOR_SERVICE_OWNER'
      }
      throw 'ANCESTOR_FOREIGN_OWNER'
    }
    $stage = 'ANCESTOR_RULES'
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
      if (($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0) {
        continue
      }
      if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
          $trustedAncestorAllow -cnotcontains $rule.IdentityReference.Value -and
          (([int64]$rule.FileSystemRights -band $danger) -ne 0)) {
        throw 'ANCESTOR_REPLACE_AUTHORITY'
      }
    }
    $stage = 'ANCESTOR_PARENT'
    $ancestor = $ancestor.Parent
  }
  $stage = 'HOME'
  Assert-SafeParent $stateUserProfileRoot
  $stage = 'COMPONENT'
  $current = $stateUserProfileRoot
  $suffix = $target.Substring($stateUserProfileRoot.Length + 1)
  $parts = $suffix.Split([char]92)
  for ($i = 0; $i -lt $parts.Length; $i++) {
    if (-not $parts[$i]) { throw 'INVALID_PATH' }
    $current = [IO.Path]::Combine($current, $parts[$i])
    $last = $i -eq ($parts.Length - 1)
    if (-not [IO.Directory]::Exists($current) -and -not [IO.File]::Exists($current)) {
      if (-not [bool]$request.create -or ([bool]$request.file -and $last)) {
        [Console]::Out.Write('PRIVATE_ABSENT')
        exit 0
      }
      New-PrivateDirectory $current
    }
    Assert-Private $current (-not ([bool]$request.file -and $last))
  }
  if ([bool]$request.scanTree) {
    $stage = 'TREE'
    $stack = New-Object 'System.Collections.Generic.Stack[string]'
    $stack.Push($target)
    $seen = 0
    while ($stack.Count -gt 0) {
      $parent = $stack.Pop()
      foreach ($childPath in [IO.Directory]::EnumerateFileSystemEntries($parent)) {
        $seen++
        if ($seen -gt 20000) { throw 'TREE_LIMIT' }
        $child = Get-Item -LiteralPath $childPath -Force
        $isDirectory = $child.PSIsContainer
        Assert-Private $child.FullName $isDirectory
        if ($isDirectory) { $stack.Push($child.FullName) }
      }
    }
  }
  [Console]::Out.Write('PRIVATE_OK')
  exit 0
} catch {
  $reason = [string]$_.Exception.Message
  $known = @('OUTSIDE_USER_PROFILE', 'REPARSE_POINT', 'NOT_DIRECTORY', 'NOT_FILE',
    'FOREIGN_OWNER', 'PRIVATE_TRUSTED_INSTALLER_OWNER', 'PRIVATE_SERVICE_OWNER',
    'UNTRUSTED_ALLOW_ACE', 'OWNER_NOT_FULL_CONTROL',
    'ANCESTOR_REPARSE_POINT', 'ANCESTOR_REPLACE_AUTHORITY', 'ANCESTOR_FOREIGN_OWNER',
    'ANCESTOR_TRUSTED_INSTALLER_OWNER', 'ANCESTOR_SERVICE_OWNER',
    'INVALID_PATH', 'TREE_LIMIT')
  if ($known -cnotcontains $reason) { $reason = 'ACL_CHECK_FAILED_' + $stage }
  [Console]::Out.Write('PRIVATE_REFUSED:' + $reason)
  exit 1
}
`;

const KNOWN_REFUSALS = new Set([
  'OUTSIDE_USER_PROFILE', 'REPARSE_POINT', 'NOT_DIRECTORY', 'NOT_FILE',
  'FOREIGN_OWNER', 'PRIVATE_TRUSTED_INSTALLER_OWNER', 'PRIVATE_SERVICE_OWNER',
  'UNTRUSTED_ALLOW_ACE', 'OWNER_NOT_FULL_CONTROL',
  'ANCESTOR_REPARSE_POINT', 'ANCESTOR_REPLACE_AUTHORITY', 'ANCESTOR_FOREIGN_OWNER',
  'ANCESTOR_TRUSTED_INSTALLER_OWNER', 'ANCESTOR_SERVICE_OWNER', 'INVALID_PATH',
  'TREE_LIMIT', 'ACL_CHECK_FAILED_INPUT', 'ACL_CHECK_FAILED_INPUT_HOME',
  'ACL_CHECK_FAILED_INPUT_TARGET', 'ACL_CHECK_FAILED_INPUT_COMPARE',
  'ACL_CHECK_FAILED_INPUT_IDENTITY', 'ACL_CHECK_FAILED_ANCESTOR',
  'ACL_CHECK_FAILED_ANCESTOR_ITEM', 'ACL_CHECK_FAILED_ANCESTOR_ACL',
  'ACL_CHECK_FAILED_ANCESTOR_OWNER', 'ACL_CHECK_FAILED_ANCESTOR_RULES',
  'ACL_CHECK_FAILED_ANCESTOR_PARENT',
  'ACL_CHECK_FAILED_HOME', 'ACL_CHECK_FAILED_COMPONENT', 'ACL_CHECK_FAILED_TREE',
]);

export function windowsStatePathAllowed(target: string, home: string): boolean {
  const resolved = win32.resolve(target);
  const userHome = win32.resolve(home);
  const tail = win32.relative(userHome, resolved);
  return tail !== '' && tail !== '..' && !tail.startsWith(`..${win32.sep}`) && !win32.isAbsolute(tail);
}

export function windowsVerifierEnvironment(
  parent: NodeJS.ProcessEnv,
  home: string,
  windowsRoot: string,
): NodeJS.ProcessEnv {
  const child = Object.fromEntries(
    Object.entries(parent).filter(([name]) => name.toUpperCase() !== 'PSMODULEPATH'),
  );
  // Exported MCP client configurations deliberately omit the host environment.
  // Windows PowerShell still needs these OS paths to resolve built-in modules.
  child.SystemRoot = windowsRoot;
  child.USERPROFILE = home;
  return child;
}

function verify(target: string, create: boolean, file: boolean, scanTree = false): void {
  if (process.platform !== 'win32') return;
  const home = process.env.USERPROFILE || homedir();
  if (!windowsStatePathAllowed(target, home))
    throw new Error('WINDOWS_STATE_OUTSIDE_USER_PROFILE');
  try {
    const windowsRoot = process.env.SystemRoot || 'C:\\Windows';
    const shell = `${windowsRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
    // PowerShell 7 -> Node -> Windows PowerShell 5.1 otherwise inherits PS7
    // module paths, which can break security-cmdlet autoloading (Get-Acl).
    const childEnv = windowsVerifierEnvironment(process.env, home, windowsRoot);
    const output = execFileSync(
      shell,
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_ACL_CHECK, 'utf16le').toString('base64')],
      {
        input: Buffer.from(JSON.stringify({ target: resolve(target), home: resolve(home), create, file, scanTree }), 'utf8').toString('base64'),
        encoding: 'utf8', timeout: 30_000, maxBuffer: 4096, windowsHide: true,
        env: childEnv,
      },
    );
    if (output !== 'PRIVATE_OK' && !(output === 'PRIVATE_ABSENT' && !create)) throw new Error('unverified');
  } catch (error) {
    const stdout = (error as { stdout?: Buffer | string }).stdout;
    const refused = /^PRIVATE_REFUSED:([A-Z_]+)$/.exec(String(stdout || '').trim());
    const reason = refused?.[1] && KNOWN_REFUSALS.has(refused[1]) ? refused[1] : 'ACL_CHECK_FAILED';
    throw new Error(`WINDOWS_STATE_PRIVACY_UNVERIFIED_${reason}`);
  }
}

export function ensurePrivateStateDirectory(directory: string, scanTree = false): void {
  if (process.platform !== 'win32') {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    return;
  }
  verify(directory, true, false, scanTree);
}

export function verifyPrivateStateFileIfPresent(filePath: string): void {
  verify(filePath, false, true);
}

export function ensurePrivateStateFileParent(filePath: string): void {
  ensurePrivateStateDirectory(dirname(filePath));
  verifyPrivateStateFileIfPresent(filePath);
}
