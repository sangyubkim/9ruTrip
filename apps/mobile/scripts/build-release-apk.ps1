# USB/에뮬 없이 release APK 빌드
# 1) expo prebuild → Manifest에 Maps 키 주입
# 2) gradlew :app:assembleRelease (dev-menu verify 스킵)
$ErrorActionPreference = "Stop"
$MobileRoot = Split-Path -Parent $PSScriptRoot
Set-Location $MobileRoot

function Get-MapsKeyLen {
  $envFile = Join-Path $MobileRoot ".env"
  if (-not (Test-Path $envFile)) { return 0 }
  $line = Get-Content $envFile | Where-Object { $_ -match '^\s*EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\s*=' } | Select-Object -First 1
  if (-not $line) { return 0 }
  $val = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
  return $val.Length
}

function Test-ManifestKey {
  $manifest = Join-Path $MobileRoot "android\app\src\main\AndroidManifest.xml"
  if (-not (Test-Path $manifest)) { return $false }
  $raw = Get-Content $manifest -Raw
  if ($raw -match 'android:name="com\.google\.android\.geo\.API_KEY"\s+android:value="([^"]*)"') {
    Write-Host "Manifest geo.API_KEY len=$($Matches[1].Length)"
    return ($Matches[1].Length -gt 10)
  }
  return ($raw -match 'com\.google\.android\.geo\.API_KEY')
}

$keyLen = Get-MapsKeyLen
Write-Host "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY len=$keyLen"
if ($keyLen -lt 10) {
  Write-Host "경고: Maps 키가 비어 있거나 짧습니다."
}

Write-Host "expo prebuild (android)..."
npx expo prebuild --platform android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-ManifestKey)) {
  Write-Host "오류: Manifest에 Maps API 키가 없습니다."
  exit 1
}

Write-Host "gradlew :app:assembleRelease ..."
Push-Location (Join-Path $MobileRoot "android")
try {
  # expo-dev-menu-interface:verifyReleaseResources 가 로컬에서 깨지는 경우 스킵
  .\gradlew.bat :app:assembleRelease `
    -x :expo-dev-menu-interface:verifyReleaseResources `
    -x lintVitalAnalyzeRelease
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

$apk = Get-ChildItem -Path (Join-Path $MobileRoot "android\app\build\outputs\apk\release") -Filter "*.apk" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) {
  Write-Host "APK 없음"
  exit 1
}
Write-Host "APK: $($apk.FullName)"
Write-Host "SIZE_MB=$([math]::Round($apk.Length/1MB,2)) MTIME=$($apk.LastWriteTime)"
exit 0
