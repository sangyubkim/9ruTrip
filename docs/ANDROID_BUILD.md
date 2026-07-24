# Android 빌드 및 실기기(폰) 실행 가이드 — 9ruTrip

9ruDocs와 같은 패턴입니다. `apps/mobile` Expo 앱을 폰에서 돌리는 방법입니다.

---

## 사전 준비

| 항목 | 설명 |
|------|------|
| **Node.js** | LTS |
| **Expo Go** | Play 스토어 — **SDK 55** 호환 버전 (이 앱은 Expo `~55`) |
| **같은 Wi‑Fi** | PC · 폰 (터널 모드면 예외) |
| **API 키** | `apps/mobile/.env`, `apps/api/.env` 에 입력 |

### .env (필수 입력)

| 파일 | 키 | 용도 |
|------|-----|------|
| `apps/mobile/.env` | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | 지도(Maps SDK) |
| `apps/api/.env` | `GOOGLE_MAPS_API_KEY` | Directions(서버) |
| `apps/api/.env` | `GEMINI_API_KEY` | AI 일정 (선택) |

발급 상세: [`GOOGLE-MAPS-API-KEY.md`](./GOOGLE-MAPS-API-KEY.md)

---

## 한 번에 설치

프로젝트 루트 `C:\Users\박기쁨\Desktop\workspace\9ruTrip` 에서:

```powershell
npm install
npm run shared:build
npm run install:mobile
```

---

## API URL (실기기 필수)

| 환경 | URL |
|------|-----|
| Android 에뮬레이터 | `http://10.0.2.2:3011` (기본값) |
| **실기기 폰** | `http://<PC_LAN_IP>:3011` |
| iOS 시뮬 | `http://localhost:3011` |

PC LAN IP 확인:

```powershell
ipconfig
```

무선 LAN의 **IPv4** (예: `192.168.45.185`).

1. 터미널1: `scripts\start-api.bat` (포트 **3011**)
2. 앱 **설정**에서 `http://192.168.x.x:3011` 입력 후 연결 테스트  
   또는 `apps/mobile/.env` 에  
   `EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3011` 후 Expo **재시작** (`-c`)
3. PC·폰 같은 Wi‑Fi, Windows 방화벽에서 **Node.js** 허용
4. `localhost` / `10.0.2.2` 는 **실기기에서 PC에 연결되지 않음**

---

## 방법 A: Expo Go (필드에서 가장 빠름) — 9ruDocs와 동일

```text
1) scripts\start-api.bat
2) 루트에서 start-expo.bat   (또는 start-expo-tunnel.bat)
3) 폰 Expo Go → QR 스캔
4) 앱 설정 → API = http://<PC_IP>:3011
```

| 가능 | 제한 |
|------|------|
| UI, 일정, 지도(키 있을 때), API 연동 | 일부 네이티브(SMS intent 등)는 커스텀/dev 빌드 필요 |

다른 Wi‑Fi면: `start-expo-tunnel.bat`  
(단, API는 여전히 PC LAN 또는 공개 URL 필요)

---

## 방법 B: EAS Build (클라우드 APK)

```powershell
cd apps\mobile
npm install -g eas-cli
eas login
eas build:configure   # 최초 1회
eas build --platform android --profile preview
```

- `preview` → **APK** 다운로드 링크
- 폰 브라우저로 설치 («출처 알 수 없는 앱» 허용)
- `eas.json` preview.env 의 `EXPO_PUBLIC_API_BASE_URL` 을 **본인 PC IP**로 맞춘 뒤 빌드
- IP가 바뀌면 앱 설정에서 수정하거나 재빌드

---

## 방법 C: USB 로컬 빌드 (`expo run:android`)

```powershell
cd apps\mobile
npx expo prebuild --platform android
npx expo run:android
```

- USB 디버깅 ON 기기에 설치
- APK: `apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk`

---

## 빠른 체크리스트

- [ ] `apps/mobile/.env` → `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=`
- [ ] `apps/api/.env` → `GOOGLE_MAPS_API_KEY=`
- [ ] `npm install` + `npm run shared:build` + `npm run install:mobile`
- [ ] API 실행 (`scripts\start-api.bat`) → 브라우저 `http://localhost:3011/health`
- [ ] `start-expo.bat` → 폰 Expo Go QR
- [ ] 앱 설정에서 PC LAN IP:3011

---

## 트러블슈팅

| 증상 | 조치 |
|------|------|
| QR은 뜨는데 앱이 안 열림 | Expo Go SDK **55** 업데이트 / `start-expo-tunnel.bat` |
| API 연결 실패 | IP·방화벽·VPN·API 재시작 |
| 지도 빈 화면 | 모바일 키·Maps SDK for Android 활성화·SHA-1 |
| 루트에서 expo 오류 | `expo-mobile.bat` / `npm run mobile` 만 사용 |
