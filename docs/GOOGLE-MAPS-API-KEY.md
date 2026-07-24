# Google Maps API 키 발급·적용 가이드 (9ruTrip)

이 문서는 **Android first** Expo 앱(`com.nineru.trip`)과 API 서버에서 Google Maps / Directions를 쓰는 방법을 단계별로 설명합니다.  
**실제 API 키는 절대 Git에 커밋하지 마세요.**

---

## 1. Google Cloud Console 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 로그인합니다.
2. 상단 프로젝트 선택 → **새 프로젝트**.
3. 이름 예: `9ruTrip-maps` → 만들기.
4. 방금 만든 프로젝트를 선택합니다.

---

## 2. 결제 계정 연결 (키 발급 조건)

Google Maps Platform은 **결제 계정이 연결된 프로젝트**에서만 API 키를 발급·사용할 수 있습니다.

1. 왼쪽 메뉴 **결제(Billing)** → 결제 계정 연결.
2. 신용카드 등록이 필요할 수 있습니다 (무료 크레딧/무료 한도 적용 가능).

### 과금 참고 (요약)

| API | 비고 |
|-----|------|
| **Maps SDK for Android** | 지도 표시용. 통상 **무료 사용량**이 넉넉함 (공식 가격표 확인). |
| **Directions API** | 구간 소요시간·경로. **월 무료 한도** 이후 과금 가능. |
| **Places API** (선택) | 주변 검색 등. 사용 시에만 활성화·과금 주의. |

정확한 단가·무료 한도는 [Google Maps Platform 가격](https://mapsplatform.google.com/pricing/)을 확인하세요.  
9ruTrip은 키가 없으면 **하버사인 폴백**으로 동작하므로, 키 없이도 앱·API 스모크는 가능합니다.

---

## 3. API 활성화 (Enable)

**API 및 서비스 → 라이브러리**에서 다음을 사용 설정합니다.

필수:

1. **Maps SDK for Android** — 모바일 지도 타일/MapView
2. **Directions API** — `apps/api` 교통 추정·비교

선택 (현재 기본은 정적 POI; Places를 나중에 쓸 때만):

3. **Places API** (또는 Places API (New))

---

## 4. API 키 만들기 + 제한

1. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**.
2. 키를 복사해 안전한 곳에만 보관합니다 (채팅·PR·커밋 금지).

### 권장: 키를 2개로 분리

| 키 | 용도 | 애플리케이션 제한 | API 제한 |
|----|------|-------------------|----------|
| **모바일 키** | 지도 표시 | Android 앱: 패키지 `com.nineru.trip` + **SHA-1** | Maps SDK for Android 만 |
| **서버 키** | Directions | 없음 또는 서버 IP (선택) | Directions API 만 |

동일 키를 써도 동작하지만, 유출·과금 리스크를 줄이려면 **분리**를 권장합니다.

### Android 제한용 SHA-1 (디버그)

Windows (PowerShell 예시):

```powershell
keytool -list -v -alias androiddebugkey -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android -keypass android
```

출력의 **SHA1** 지문을 Cloud Console Android 제한에 등록합니다.  
릴리스 빌드는 릴리스 키스토어 SHA-1을 추가로 등록하세요.

패키지 이름: **`com.nineru.trip`** (`apps/mobile/app.config.js` / `app.json`과 일치해야 합니다).

---

## 5. 9ruTrip에 키 넣기

### 모바일 (지도)

파일: `apps/mobile/.env` (gitignored)

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=여기에_모바일_키
```

- `app.config.js`가 **키가 있을 때만** Android/iOS Maps apiKey(Manifest meta-data)로 주입합니다.
- **커스텀 APK / release / USB 빌드**: 키를 넣거나 바꾼 뒤 **반드시 재빌드·재설치**. Manifest는 빌드 타임 값이라, 설치 후 `.env`만 바꿔도 네이티브 키는 갱신되지 않습니다.
- Expo Go / Metro만 쓰는 경우: `npx expo start -c` 후 재로드 (단, Android Google Maps 타일은 네이티브 키가 있는 개발/프로덕션 빌드가 필요).

참고 템플릿: `apps/mobile/.env.example`

### API 서버 (Directions)

파일: `apps/api/.env` (gitignored)

```bash
GOOGLE_MAPS_API_KEY=여기에_서버_키
```

- Android 제한이 걸린 모바일 키만 넣으면 Directions가 실패할 수 있습니다 → **서버 키(Android 제한 없음)** 권장.
- 키 변경 후 API 프로세스 재시작 (`npm run api`).

참고 템플릿: `apps/api/.env.example`, 루트 `.env.example`

---

## 6. 검증

### API

```bash
npm run api
# 다른 터미널
curl http://localhost:3011/health
```

응답에 `"googleMapsConfigured": true` 가 보이면 서버 키가 로드된 것입니다.

### 모바일

1. `apps/mobile/.env`에 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` 설정.
2. **APK/개발 빌드 재생성·재설치** (Manifest 키 반영).
3. Plan 상단 지도 / 전체지도에서 타일이 정상인지 확인.
4. 키가 없으면 Android는 “지도 키 없음” 목록 placeholder만 표시되고 **크래시하지 않아야** 합니다.

### Directions 스모크 (선택)

```bash
curl -X POST http://localhost:3011/trip/compare-transport ^
  -H "Content-Type: application/json" ^
  -d "{\"from\":{\"lat\":35.6812,\"lng\":139.7671},\"to\":{\"lat\":35.6581,\"lng\":139.7017}}"
```

`engine`에 `directions`가 포함되면 Directions 호출이 성공한 것입니다.

실기기 전체 사이클: [`E2E-CHECKLIST.md`](./E2E-CHECKLIST.md).

---

## 7. Next (이후 · 이 문서 범위 밖)

아래는 **보류**이며, 키 발급 가이드를 막지 않습니다.

- Places Nearby로 숙소/관광 후보 자동 보강 (현재는 정적 POI + Gemini)
- Routes API 고도화, 실시간 교통 레이어
- 네이티브 SMS 인박스, 계정 동기화
- 국내 Naver Maps SDK 실연동

---

## 체크리스트

- [ ] Cloud 프로젝트 + 결제 연결
- [ ] Maps SDK for Android, Directions API 활성화
- [ ] 모바일 키: `com.nineru.trip` + SHA-1 + Maps SDK만
- [ ] 서버 키: Directions만 (IP 제한 선택)
- [ ] `apps/mobile/.env` / `apps/api/.env` 설정 (커밋 안 함)
- [ ] 모바일: 키 반영 후 **APK 재빌드·재설치**
- [ ] `GET /health` → `googleMapsConfigured: true`
- [ ] 재빌드 후 지도 타일 확인 (키 없으면 Android placeholder, 크래시 없음)
