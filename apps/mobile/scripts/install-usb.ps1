param(
  [string]$ApkPath,
  [switch]$Release
)

$ErrorActionPreference = "Stop"

function Find-Adb {
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
  )
  $wingetHits = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools*\platform-tools\adb.exe" -ErrorAction SilentlyContinue
  foreach ($hit in $wingetHits) { $candidates += $hit.FullName }
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

function Find-LatestApk([string[]]$Roots) {
  $found = @()
  foreach ($r in $Roots) {
    if (Test-Path $r) {
      $found += Get-ChildItem -Path $r -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue
    }
  }
  return $found | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$adb = Find-Adb
if (-not $adb) {
  Write-Host "adb 없음. Platform-Tools 설치 후 PATH/ANDROID_HOME 설정:"
  Write-Host "  winget install Google.PlatformTools"
  Write-Host "문서: apps/mobile/docs/ANDROID-USB-BUILD.md"
  exit 1
}

Write-Host "adb: $adb"
& $adb start-server | Out-Null
$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
if (-not $devices) {
  Write-Host "연결된 USB device 없음. USB 디버깅·케이블·승인 확인 후:"
  Write-Host "  npm run android:devices"
  & $adb devices -l
  exit 1
}

Write-Host "기기:"
& $adb devices -l

$releaseRoot = Join-Path $PSScriptRoot "..\android\app\build\outputs\apk\release"
$debugRoot = Join-Path $PSScriptRoot "..\android\app\build\outputs\apk\debug"
$distRoot = Join-Path $PSScriptRoot "..\dist"

if (-not $ApkPath) {
  if ($Release) {
    $latest = Find-LatestApk @($releaseRoot, $distRoot)
    if (-not $latest) {
      Write-Host "release APK 없음. 먼저 빌드하세요:"
      Write-Host "  npm run android:apk"
      Write-Host "산출물: android/app/build/outputs/apk/release/*.apk"
      exit 1
    }
  } else {
    # release를 debug보다 우선 (최신 mtime이 debug여도 release 선택)
    $latest = Find-LatestApk @($releaseRoot)
    if (-not $latest) {
      $latest = Find-LatestApk @($distRoot)
    }
    if (-not $latest) {
      $latest = Find-LatestApk @($debugRoot)
      if ($latest) {
        Write-Host ""
        Write-Host "경고: release APK가 없어 debug APK를 설치합니다."
        Write-Host "  debug + expo-dev-client = Development Build 런처(Metro 필요)."
        Write-Host "  실앱처럼 바로 쓰려면:"
        Write-Host "    npm run android:apk"
        Write-Host "    npm run android:install -- -Release"
        Write-Host ""
      }
    }
  }
  if (-not $latest) {
    Write-Host "APK를 찾지 못했습니다. 경로를 지정하거나 먼저 빌드하세요."
    Write-Host "  npm run android:apk      # 로컬 release (Metro 없음)"
    Write-Host "  npm run android:usb     # debug / dev client"
    Write-Host "  npm run android:install -- -Release"
    Write-Host "  npm run android:install -- C:\path\to\app.apk"
    exit 1
  }
  $ApkPath = $latest.FullName
}

if (-not (Test-Path $ApkPath)) {
  Write-Host "APK 없음: $ApkPath"
  exit 1
}

$normalized = $ApkPath.Replace("/", "\").ToLowerInvariant()
if ($normalized -match "\\debug\\" -or $normalized -match "app-debug\.apk$") {
  Write-Host "참고: debug APK입니다. 실행 시 Development Build 화면이 정상입니다."
  Write-Host "  release: npm run android:apk && npm run android:install -- -Release"
}

Write-Host "설치: $ApkPath"
& $adb install -r $ApkPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "완료. 기기에서 9ruTrip을 실행하세요."
