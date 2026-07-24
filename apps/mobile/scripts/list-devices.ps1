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

$adb = Find-Adb
if (-not $adb) {
  Write-Host "adb 없음. winget install Google.PlatformTools"
  exit 1
}

& $adb start-server | Out-Null
& $adb devices -l
$online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
if (-not $online) {
  Write-Host ""
  Write-Host "연결된 device 없음. USB 디버깅·케이블·승인 확인."
  Write-Host "기기 없이 APK만: npm run android:apk"
  Write-Host "설치는 나중에: npm run android:install"
  Write-Host "문서: docs/ANDROID-USB-BUILD.md"
}