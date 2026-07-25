# Upload Cloudways deploy helper scripts to master@HOST:~/bin/
# Usage:
#   .\scripts\upload-cloudways-deploy.ps1
#   .\scripts\upload-cloudways-deploy.ps1 -DeployHost 1.2.3.4 -User master
#   .\scripts\upload-cloudways-deploy.ps1 -Server 1.2.3.4 -IncludeBootScripts
#   .\scripts\upload-cloudways-deploy.ps1 -KeyPath C:\Users\YOU\.ssh\id_ed25519
#
# Config (optional): scripts\cloudways.deploy.env
#   CLOUDWAYS_HOST / CLOUDWAYS_USER / CLOUDWAYS_REMOTE_BIN / CLOUDWAYS_KEY_PATH
# Password is never read from files; OpenSSH prompts if needed.
# Note: avoid -Host (conflicts with PowerShell $Host automatic variable).

[CmdletBinding()]
param(
  [Alias("Server")]
  [string]$DeployHost = "",
  [string]$User = "",
  [string]$RemoteBin = "",
  [string]$KeyPath = "",
  [switch]$IncludeBootScripts,
  [switch]$SkipChmod
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$SampleDir = Join-Path $RepoRoot "docs\deploy\cloudways"
$EnvFile = Join-Path $PSScriptRoot "cloudways.deploy.env"

function Read-EnvFile {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $map[$k] = $v
  }
  return $map
}

$envMap = Read-EnvFile -Path $EnvFile

if (-not $DeployHost) { $DeployHost = $env:CLOUDWAYS_HOST }
if (-not $DeployHost -and $envMap.ContainsKey("CLOUDWAYS_HOST")) { $DeployHost = $envMap["CLOUDWAYS_HOST"] }

if (-not $User) { $User = $env:CLOUDWAYS_USER }
if (-not $User -and $envMap.ContainsKey("CLOUDWAYS_USER")) { $User = $envMap["CLOUDWAYS_USER"] }
if (-not $User) { $User = "master" }

if (-not $RemoteBin) { $RemoteBin = $env:CLOUDWAYS_REMOTE_BIN }
if (-not $RemoteBin -and $envMap.ContainsKey("CLOUDWAYS_REMOTE_BIN")) { $RemoteBin = $envMap["CLOUDWAYS_REMOTE_BIN"] }
if (-not $RemoteBin) { $RemoteBin = "~/bin" }

if (-not $KeyPath) { $KeyPath = $env:CLOUDWAYS_KEY_PATH }
if (-not $KeyPath -and $envMap.ContainsKey("CLOUDWAYS_KEY_PATH")) { $KeyPath = $envMap["CLOUDWAYS_KEY_PATH"] }

if (-not $DeployHost -or $DeployHost -eq "YOUR_PUBLIC_IP_OR_HOSTNAME") {
  Write-Host ""
  Write-Host "Cloudways SSH host is required."
  Write-Host "  - Pass -DeployHost / -Server, or set CLOUDWAYS_HOST"
  Write-Host "  - Or copy scripts\cloudways.deploy.env.example -> scripts\cloudways.deploy.env"
  Write-Host ""
  $DeployHost = Read-Host "CLOUDWAYS_HOST (public IP or hostname)"
  if (-not $DeployHost) {
    throw "Host is required."
  }
}

$uploads = @(
  @{
    Sample = "pull-restart-9rutrip-api.sh.sample"
    Remote = "pull-restart-9rutrip-api.sh"
  }
)

if ($IncludeBootScripts) {
  $uploads += @(
    @{ Sample = "start-9rutrip-api.sh.sample"; Remote = "start-9rutrip-api.sh" },
    @{ Sample = "start-9rudocs-api.sh.sample"; Remote = "start-9rudocs-api.sh" },
    @{ Sample = "start-9ru-apis.sh.sample"; Remote = "start-9ru-apis.sh" }
  )
}

foreach ($u in $uploads) {
  $local = Join-Path $SampleDir $u.Sample
  if (-not (Test-Path -LiteralPath $local)) {
    throw "Missing sample file: $local"
  }
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name (install OpenSSH Client)"
  }
}

Assert-Command scp
Assert-Command ssh

# Windows checkouts often store .sh as CRLF; Linux shebang then becomes "bash\r".
# Write a temp LF-only copy for scp so the remote file is safe regardless of git autocrlf.
function New-UnixLfTempFile {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$DestFileName
  )
  $text = [System.IO.File]::ReadAllText($SourcePath)
  $text = $text -replace "`r`n", "`n" -replace "`r", "`n"
  $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "9rutrip-cloudways-upload"
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  $tempPath = Join-Path $tempDir $DestFileName
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tempPath, $text, $utf8NoBom)
  return $tempPath
}

$sshTarget = "${User}@${DeployHost}"
$remoteBinExpanded = $RemoteBin
# scp/ssh: expand ~/bin on remote via quoted path; keep as-is for mkdir
$scpArgs = @()
$sshArgs = @()
if ($KeyPath) {
  if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "KeyPath not found: $KeyPath"
  }
  $scpArgs += @("-i", $KeyPath)
  $sshArgs += @("-i", $KeyPath)
}

Write-Host "[upload-cloudways-deploy] target=${sshTarget} remoteBin=${remoteBinExpanded}"
Write-Host "[upload-cloudways-deploy] ensuring remote bin dir..."

& ssh @sshArgs $sshTarget "mkdir -p ${remoteBinExpanded}"
if ($LASTEXITCODE -ne 0) {
  throw "ssh mkdir failed (exit $LASTEXITCODE)"
}

$remoteNames = @()
$tempFiles = @()
try {
  foreach ($u in $uploads) {
    $local = Join-Path $SampleDir $u.Sample
    $remotePath = "${remoteBinExpanded}/$($u.Remote)"
    $uploadLocal = New-UnixLfTempFile -SourcePath $local -DestFileName $u.Remote
    $tempFiles += $uploadLocal
    Write-Host "[upload-cloudways-deploy] scp $($u.Sample) (LF) -> ${sshTarget}:${remotePath}"
    & scp @scpArgs $uploadLocal "${sshTarget}:${remotePath}"
    if ($LASTEXITCODE -ne 0) {
      throw "scp failed for $($u.Sample) (exit $LASTEXITCODE)"
    }
    $remoteNames += $u.Remote
  }
}
finally {
  foreach ($t in $tempFiles) {
    Remove-Item -LiteralPath $t -Force -ErrorAction SilentlyContinue
  }
}

# Safety net: strip any leftover CR on the server (covers older uploads / odd scp modes).
$pathList = ($remoteNames | ForEach-Object { "${remoteBinExpanded}/$_" }) -join " "
$stripCrCmd = "sed -i 's/\r`$//' ${pathList}"
Write-Host "[upload-cloudways-deploy] strip CR on server (sed)..."
& ssh @sshArgs $sshTarget $stripCrCmd
if ($LASTEXITCODE -ne 0) {
  throw "ssh sed (strip CR) failed (exit $LASTEXITCODE)"
}

if (-not $SkipChmod) {
  $chmodList = $pathList
  Write-Host "[upload-cloudways-deploy] chmod +x on server..."
  & ssh @sshArgs $sshTarget "chmod +x ${chmodList}"
  if ($LASTEXITCODE -ne 0) {
    throw "ssh chmod failed (exit $LASTEXITCODE)"
  }
}

Write-Host ""
Write-Host "[upload-cloudways-deploy] OK. On the server run:"
Write-Host "  ${remoteBinExpanded}/pull-restart-9rutrip-api.sh"
Write-Host "  ${remoteBinExpanded}/pull-restart-9rutrip-api.sh --with-npm"
Write-Host ""
