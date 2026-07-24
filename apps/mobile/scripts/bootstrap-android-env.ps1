# 9ruTrip — Android Studio / local Gradle USB bootstrap (Windows)
# Sets ANDROID_HOME, installs cmdline-tools + required SDK packages (incl. NDK).
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/mobile/scripts/bootstrap-android-env.ps1
#   powershell ... -File ...\bootstrap-android-env.ps1 -SkipWinget
#
# Docs: apps/mobile/docs/ANDROID-USB-BUILD.md

param(
  [switch]$SkipWinget,
  [switch]$SkipSdkPackages
)

$ErrorActionPreference = "Stop"

$SdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$RequiredNdk = "27.1.12297006"
$RequiredBuildTools = "36.0.0"
$RequiredPlatform = "android-36"
$CmdlineToolsZipUrl = "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"

function Write-Step([string]$msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg) { Write-Host "OK: $msg" -ForegroundColor Green }
function Write-WarnMsg([string]$msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }

function Ensure-UserEnv([string]$Name, [string]$Value) {
  $current = [System.Environment]::GetEnvironmentVariable($Name, "User")
  if ($current -ne $Value) {
    [System.Environment]::SetEnvironmentVariable($Name, $Value, "User")
    Write-Ok "User $Name = $Value"
  } else {
    Write-Ok "$Name already set"
  }
  Set-Item -Path "Env:$Name" -Value $Value
}

function Ensure-UserPathEntry([string]$Entry) {
  $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $userPath) { $userPath = "" }
  $parts = $userPath -split ";" | Where-Object { $_ -and $_.Trim() -ne "" }
  $normalized = $Entry.TrimEnd("\")
  $exists = $parts | Where-Object { $_.TrimEnd("\") -ieq $normalized }
  if (-not $exists) {
    $newPath = if ($userPath.Trim() -eq "") { $Entry } else { "$userPath;$Entry" }
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Ok "PATH += $Entry"
  } else {
    Write-Ok "PATH already has $Entry"
  }
  if (($env:Path -split ";" | ForEach-Object { $_.TrimEnd("\") }) -notcontains $normalized) {
    $env:Path = "$Entry;$env:Path"
  }
}

function Test-Cmd([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Find-SdkManager {
  $candidates = @(
    (Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"),
    (Join-Path $SdkRoot "cmdline-tools\bin\sdkmanager.bat")
  )
  $hits = Get-ChildItem -Path (Join-Path $SdkRoot "cmdline-tools") -Recurse -Filter "sdkmanager.bat" -ErrorAction SilentlyContinue
  foreach ($h in $hits) { $candidates += $h.FullName }
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

Write-Host "9ruTrip Android env bootstrap"
Write-Host "SDK root: $SdkRoot"

if (-not $SkipWinget) {
  Write-Step "winget packages (JDK / Platform-Tools / Android Studio)"
  if (Test-Cmd "winget") {
    if (-not (Test-Cmd "java")) {
      winget install Microsoft.OpenJDK.17 --accept-package-agreements --accept-source-agreements
    } else {
      Write-Ok "java already available"
    }
    if (-not (Test-Cmd "adb")) {
      winget install Google.PlatformTools --accept-package-agreements --accept-source-agreements
    } else {
      Write-Ok "adb already available"
    }
    $studio = "C:\Program Files\Android\Android Studio\bin\studio64.exe"
    if (-not (Test-Path $studio)) {
      Write-WarnMsg "Android Studio not found - installing (large download)..."
      winget install Google.AndroidStudio --accept-package-agreements --accept-source-agreements
    } else {
      Write-Ok "Android Studio found"
    }
  } else {
    Write-WarnMsg "winget missing - install JDK/Studio manually"
  }
} else {
  Write-WarnMsg "SkipWinget: skipping winget installs"
}

Write-Step "User environment variables"
if (-not (Test-Path $SdkRoot)) {
  New-Item -ItemType Directory -Path $SdkRoot -Force | Out-Null
  Write-WarnMsg "Created SDK folder. Install Platform/Build-Tools via Android Studio SDK Manager if needed."
}
Ensure-UserEnv "ANDROID_HOME" $SdkRoot
Ensure-UserEnv "ANDROID_SDK_ROOT" $SdkRoot

$javaHome = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
if (-not $javaHome) {
  $jdk = Get-ChildItem "C:\Program Files\Microsoft\jdk-17*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $jdk -and (Test-Path "C:\Program Files\Android\Android Studio\jbr")) {
    $jdk = Get-Item "C:\Program Files\Android\Android Studio\jbr"
  }
  if ($jdk) {
    Ensure-UserEnv "JAVA_HOME" $jdk.FullName
  } else {
    Write-WarnMsg "JAVA_HOME candidate not found. Install JDK 17."
  }
} else {
  Set-Item -Path "Env:JAVA_HOME" -Value $javaHome
  Write-Ok "JAVA_HOME = $javaHome"
}

Ensure-UserPathEntry (Join-Path $SdkRoot "platform-tools")
Ensure-UserPathEntry (Join-Path $SdkRoot "emulator")
$cmdlineBin = Join-Path $SdkRoot "cmdline-tools\latest\bin"
if (Test-Path $cmdlineBin) {
  Ensure-UserPathEntry $cmdlineBin
}

Write-Step "Android SDK cmdline-tools"
# Prefer cmdline-tools\latest (known-good zip). Older Studio-bundled tools often
# emit "SDK XML versions up to 3 ... version 4" warnings and may miss packages.
$sdkmanagerLatest = Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkmanagerLatest)) {
  Write-Host "cmdline-tools\latest missing - downloading..."
  $tmp = Join-Path $env:TEMP "android-cmdline-tools.zip"
  $extract = Join-Path $env:TEMP "android-cmdline-tools-extract"
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  New-Item -ItemType Directory -Path $extract -Force | Out-Null
  Invoke-WebRequest -Uri $CmdlineToolsZipUrl -OutFile $tmp -UseBasicParsing
  Expand-Archive -Path $tmp -DestinationPath $extract -Force
  $dest = Join-Path $SdkRoot "cmdline-tools\latest"
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  New-Item -ItemType Directory -Path (Join-Path $SdkRoot "cmdline-tools") -Force | Out-Null
  $inner = Join-Path $extract "cmdline-tools"
  if (-not (Test-Path $inner)) {
    throw "Unexpected cmdline-tools zip layout under $extract"
  }
  Move-Item $inner $dest
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
  Ensure-UserPathEntry (Join-Path $SdkRoot "cmdline-tools\latest\bin")
}
$sdkmanager = if (Test-Path $sdkmanagerLatest) { $sdkmanagerLatest } else { Find-SdkManager }
if (-not $sdkmanager) {
  throw "sdkmanager not found. In Android Studio: SDK Manager -> SDK Tools -> Android SDK Command-line Tools, then re-run."
}
Write-Ok "sdkmanager: $sdkmanager"

if (-not $SkipSdkPackages) {
  Write-Step "Install SDK packages (platform-tools, build-tools, platform, NDK)"
  $packages = @(
    "platform-tools",
    "build-tools;$RequiredBuildTools",
    "platforms;$RequiredPlatform",
    "ndk;$RequiredNdk"
  )
  # sdkmanager writes harmless warnings to stderr (e.g. SDK XML v3 vs v4).
  # With $ErrorActionPreference=Stop, NativeCommandError from 2>&1 would abort.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $yes = ("y" + [Environment]::NewLine) * 80
    $yes | & $sdkmanager --sdk_root=$SdkRoot --licenses 2>&1 | ForEach-Object { "$_" } | Out-Host
    & $sdkmanager --sdk_root=$SdkRoot --install $packages 2>&1 | ForEach-Object { "$_" } | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Write-WarnMsg "sdkmanager exit=$LASTEXITCODE - verify packages in Android Studio SDK Manager"
    }
  } finally {
    $ErrorActionPreference = $prevEap
  }
} else {
  Write-WarnMsg "SkipSdkPackages: skipping SDK package install"
}

Write-Step "android/local.properties"
$androidDir = Join-Path $PSScriptRoot "..\android"
$androidDir = [System.IO.Path]::GetFullPath($androidDir)
if (Test-Path $androidDir) {
  $sdkDirProp = ($SdkRoot -replace "\\", "/")
  $lp = Join-Path $androidDir "local.properties"
  $content = @"
## Generated by bootstrap-android-env.ps1 (do not commit; android/ is gitignored).
sdk.dir=$sdkDirProp
"@
  Set-Content -Path $lp -Value $content -Encoding UTF8
  Write-Ok "Wrote $lp"
} else {
  Write-WarnMsg "android/ missing - create later with npm run prebuild:android or npm run android:usb"
}

Write-Step "Verification"
$checks = [ordered]@{
  "ANDROID_HOME"   = $env:ANDROID_HOME
  "JAVA_HOME"      = $env:JAVA_HOME
  "platform-tools" = (Test-Path (Join-Path $SdkRoot "platform-tools\adb.exe"))
  "build-tools"    = (Test-Path (Join-Path $SdkRoot "build-tools\$RequiredBuildTools"))
  "platforms"      = (Test-Path (Join-Path $SdkRoot "platforms\$RequiredPlatform"))
  "ndk"            = (Test-Path (Join-Path $SdkRoot "ndk\$RequiredNdk"))
  "cmdline-tools"  = [bool](Find-SdkManager)
  "Android Studio" = (Test-Path "C:\Program Files\Android\Android Studio\bin\studio64.exe")
}
foreach ($k in $checks.Keys) {
  $v = $checks[$k]
  if ($v -eq $true -or ($v -is [string] -and $v)) {
    Write-Ok "$k = $v"
  } else {
    Write-WarnMsg "$k MISSING"
  }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1) Open a NEW terminal so env vars refresh"
Write-Host "  2) Enable USB debugging on phone -> npm run android:devices"
Write-Host "  3) Open apps/mobile/android in Android Studio, OR:"
Write-Host "       cd apps/mobile"
Write-Host "       npm run android:usb"
Write-Host "  Docs: apps/mobile/docs/ANDROID-USB-BUILD.md"