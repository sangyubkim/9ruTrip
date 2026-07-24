# USB로 Android 실기기 설치 (Expo Go 아님)

Expo Go(`eax`/`expo start` QR) 대신 **개발 빌드(APK)** 를 USB로 깔아 씁니다.
네이티브 모듈(지도·알림·공유 intent)이 `com.nineru.trip` 앱으로 동작합니다.

## 한 줄 요약

| 목적 | 명령 (repo 루트 또는 `apps/mobile`) |
|------|-------------------------------------|
| **Trip/Docs 선택 → 빌드+설치 (권장)** | `D:\01_Project\build-install-apk.bat` 더블클릭 |
| Trip만 빌드+설치 | `D:\01_Project\9ruTrip\build-install-apk.bat` |
| USB 연결 기기 확인 | `npm run android:devices` (`apps/mobile`) |
| **로컬 debug + USB** (Metro 필요) | `npm run android:usb` |
| Metro만 재연결 | `npm run start:dev` 후 앱에서 서버 선택 |
| **로컬 release + USB 설치** (기기 필요 · Metro 없음) | `npm run android:release` (`--device`) |
| **기기 없이 APK만** 빌드 후 나중에 설치 | `npm run android:apk` → (연결 후) `npm run android:install:release` |
| 클라우드 preview APK (EAS 로그인) | `npm run android:eas` → 설치 |
| 클라우드 개발 클라이언트 | `npm run android:eas:dev` → 설치 |

## 1. PC 환경 (최초 1회)

### 필수

1. **Android Studio** (SDK + 플랫폼 도구)
   - winget: `winget install Google.AndroidStudio`
   - 설치 후 Studio 실행 → SDK Manager에서 **Android SDK Platform 35**(또는 최신) + **Build-Tools** + **Platform-Tools** 확인
2. **JDK 17** (Studio 번들 JDK로도 충분). 별도 설치 시 OpenJDK 17
3. 환경 변수 (새 터미널 필요)

```powershell
# 예: 기본 SDK 경로
[System.Environment]::SetEnvironmentVariable(
  "ANDROID_HOME",
  "$env:LOCALAPPDATA\Android\Sdk",
  "User"
)
# Path에 추가: %ANDROID_HOME%\platform-tools , %ANDROID_HOME%\emulator
```

4. USB만 쓸 경우 Platform-Tools만:

```powershell
winget install Google.PlatformTools
```

### 폰 설정

1. 개발자 옵션 → **USB 디버깅** ON
2. USB로 PC 연결 → “이 컴퓨터 허용” 승인
3. 확인:

```powershell
cd apps/mobile
npm run android:devices
# 목록에 device 가 보이면 OK (unauthorized면 폰에서 허용)
```

## 2. 앱 쪽 설정

`apps/mobile/.env` 예시 (실기기에서는 **에뮬레이터용 10.0.2.2 불가**):

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_key
# PC의 LAN IP (같은 Wi‑Fi). ipconfig 로 IPv4 확인
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:3011
```

API 서버는 PC에서 `npm run api` (포트 **3011**). 방화벽이 3011 인바운드를 막으면 해제.

로컬 빌드(`android:usb` / `android:release` / `android:apk`)는 빌드 시점의 `apps/mobile/.env`의 `EXPO_PUBLIC_*`를 JS·네이티브 설정에 포함합니다.
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`는 `react-native-maps` 플러그인으로 AndroidManifest `com.google.android.geo.API_KEY`에 들어갑니다 — **키를 넣거나 바꾼 뒤에는 반드시 재빌드·재설치**하세요. (서버 `GOOGLE_MAPS_API_KEY`만으로는 지도 크래시/타일이 해결되지 않습니다.)

`npm run android:apk`는 `expo prebuild` + `gradlew assembleRelease` 입니다 (`expo run:android`가 USB/adb를 건드려 실패하는 문제 회피).
산출물: `android/app/build/outputs/apk/release/app-release.apk`

## 3. 로컬 USB 빌드·설치

### A. 실앱처럼 바로 실행 (권장 · Metro/EAS 불필요)

JS가 APK에 포함되어 아이콘만 누르면 바로 9ruTrip 화면이 뜹니다. **EAS 로그인 없음.**

```powershell
# 루트
npm run install:mobile
npm run api          # 다른 터미널 (API 쓸 때)

cd apps/mobile
npm run android:devices   # device 목록에 기기가 보여야 함
# .env 의 EXPO_PUBLIC_* 확인 후
npm run android:release   # --device: USB/에뮬 없으면 실패
```

기기 없이 APK만 만든 뒤 설치:

```powershell
cd apps/mobile
npm run android:apk
# 산출물: android/app/build/outputs/apk/release/*.apk
npm run android:install:release
# 또는: npm run android:install -- -Release
```

`android:install`은 **release APK를 debug보다 우선**합니다. release가 없고 debug만 있으면 Development Build 경고 후 debug를 설치합니다.

서명: 로컬 release는 보통 **debug 키스토어**로 서명됩니다(스토어 제출용 아님).  
같은 PC에서 `android:usb`(debug) ↔ `android:release` 전환 시 대부분 `adb install -r`로 덮어쓰기 가능합니다.  
**EAS 클라우드 APK**와는 서명이 다르므로 전환 시:

```powershell
adb uninstall com.nineru.trip
```

### B. Debug / Development Build (Metro 연결)

```powershell
cd apps/mobile
npm run android:usb
```

동작:

1. `android/` 네이티브 프로젝트 생성(없으면 prebuild)
2. Debug APK 빌드
3. 연결된 USB 기기에 설치·실행
4. Metro bundler 연결 → Development Build 런처가 뜰 수 있음

이후 JS만 고칠 때는:

```powershell
npm run start:dev
# 폰의 9ruTrip(dev) 앱 실행 → 같은 네트워크 Metro에 연결
```

네이티브 의존성/플러그인을 바꾼 뒤에만 `android:usb` / `android:release`를 다시 돌리면 됩니다.

## 4. EAS 클라우드 APK → USB 설치 (선택)

클라우드 빌드·팀 배포용입니다. **EAS 로그인이 필요**합니다. 로컬 release만 필요하면 섹션 3-A를 쓰세요.

### preview (Metro 불필요)

```powershell
cd apps/mobile
npx eas-cli login
npm run android:eas
```

빌드 완료 후 APK 다운로드 →

```powershell
adb uninstall com.nineru.trip   # 로컬 debug/release와 서명 다를 때
npm run android:install -- C:\Users\...\9rutrip-preview.apk
```

Maps/API 키는 EAS 빌드 시점에 주입됩니다. 로컬 `.env`만으로는 클라우드에 안 넘어가므로,
`eas secret:create` 또는 `eas.json` `env`에 `EXPO_PUBLIC_*`를 넣으세요.

### 개발 클라이언트 (Metro 연결용)

```powershell
npm run android:eas:dev
```

## 5. 문제 해결

| 증상 | 조치 |
|------|------|
| `No Android connected device found...` | `android:release`는 `--device`라 USB/에뮬 필수. 연결 후 `android:devices` 확인, 또는 기기 없이 `npm run android:apk` |
| `adb: no devices` / 기기 목록 비어 있음 | 케이블/드라이버, USB 디버깅, 폰에서 “이 컴퓨터 허용”, `adb kill-server` 후 재연결 |
| `SDK location not found` | `ANDROID_HOME` 설정 후 터미널 재시작 |
| API 연결 실패 | `.env` LAN IP, PC·폰 같은 Wi‑Fi, `npm run api`, cleartext 허용됨(`usesCleartextTraffic`) |
| 지도 빈 화면 | Maps 키 + 패키지 `com.nineru.trip` SHA-1(디버그 키스토어) 등록 — `docs/GOOGLE-MAPS-API-KEY.md` |
| Development Build 런처만 뜸 | debug APK(`.../apk/debug/app-debug.apk`) 또는 `android:usb` / `android:eas:dev`는 Metro용. → `npm run android:apk` 후 `npm run android:install:release` |
| EAS 로그인 프롬프트 | 클라우드(`android:eas`)만 필요. 로컬은 `android:release` / `android:apk` |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | `adb uninstall com.nineru.trip` 후 재설치 |
| Expo Go만 열림 | `android:usb` 또는 `android:release`로 **9ruTrip**을 설치했는지 확인 |

## 관련

- SMS 공유 intent: `apps/mobile/docs/SMS.md` (dev 빌드에서 동작)
- Maps 키: `docs/GOOGLE-MAPS-API-KEY.md`
