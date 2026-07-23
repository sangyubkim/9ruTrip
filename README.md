# 9ruTrip

모바일 여행 플래너 (Expo / React Native). **MVP 도시: 도쿄(Tokyo)** — 해외 1개 도시, Google Maps.

9ruDocs(`D:\01_Project\9ruDocs`)와 같은 모노레포 패턴을 따르며, `Step` / `BlogDraft` 호환 타입으로 WordPress 발행 흐름에 연결할 수 있습니다.

## 아키텍처

```
D:\01_Project\9ruTrip\
  apps/mobile/     Expo SDK 55 · Android first
  apps/api/        Gemini 일정 생성 + BlogDraft 내보내기
  packages/shared/ Trip / Step / BlogDraft 타입 (9ruDocs 호환)
```

**공유 전략:** Cursor 워크스페이스가 `9ruTrip`이므로 독립 모노레포로 구성했습니다. `@9rutrip/shared`의 `Step`/`BlogDraft`는 `@9rudocs/shared`와 동일 스키마입니다. 이후 패키지를 물리적으로 합치거나 npm link로 공유하기 쉽습니다.

## AI 설정

blog-pipeline과 동일한 Gemini 설정을 사용합니다.

1. `C:\Users\Intellian\Local Sites\9ruinfo\tools\blog-pipeline\.env`에서 `GEMINI_API_KEY`, `GEMINI_MODEL` 확인
2. `apps/api/.env`에 복사 (루트 `.env.example` 참고)
3. **절대 커밋하지 마세요** (`.gitignore`에 `.env` 포함)

검증됨: Gemini `gemini-flash-lite-latest` 스모크 테스트 성공 (2026-07).

## 실행 방법

```bash
# 루트
cd D:\01_Project\9ruTrip
npm install

# shared 빌드
npm run shared:build

# API (포트 3011)
# apps/api/.env 에 GEMINI_API_KEY 설정 후
npm run api

# 모바일 (다른 터미널)
cd apps/mobile
npm install
npm start
# Android: a 키 또는 npm run android
```

### API Base URL

| 환경 | URL |
|------|-----|
| Android 에뮬레이터 | `http://10.0.2.2:3011` (앱 기본값) |
| iOS 시뮬 / 웹 | `http://localhost:3011` |
| 실기기 | PC의 LAN IP, 예: `http://192.168.x.x:3011` |

앱 홈 → **API 설정**에서 변경·헬스체크 가능.

### Google Maps

해외 MVP는 Google Maps (`react-native-maps` + `PROVIDER_GOOGLE`).

```bash
# apps/mobile 실행 전 (선택)
set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
```

키가 없으면 기기/Expo Go 기본 지도로 동작할 수 있으나, 프로덕션 빌드에는 Android/iOS Google Maps API 키가 필요합니다. (`app.json`의 `android.config.googleMaps.apiKey` / `ios.config.googleMapsApiKey`에도 넣을 수 있음)

## P0 (구현됨)

- Expo Android 앱 셸
- 여행 생성: 도쿄 고정, 박/일/인원
- Gemini AI 초기 일정 (실패 시 도쿄 폴백 코스)
- Day 타임라인 + 롱프레스 드래그 앤 드롭 정렬
- Google Maps 기본 뷰 + 장소 마커
- AsyncStorage 로컬 저장
- 여행 중 사진+리뷰 캡처 (Step 호환)
- 현금 수동 경비 + 계획 vs 실제 요약
- `/trip/export-draft` → 9ruDocs BlogDraft 호환 초안

## P1 (구현됨)

- **가이드 알람 / 다음 액션**: 여행 중(`active`) 다음 미완료 장소 배너 + 임박 시 인앱 Alert · Android 로컬 알림(`expo-notifications`, 권한 허용 시)
- **AI 재루트 ON/OFF**: Trip에 `aiRerouteEnabled` 저장 · `이탈·재루트` → `POST /trip/reroute`로 당일 남은 일정 재생성
- **SMS 경비 파싱 (Android-first)**: 카드 SMS 붙여넣기 → 금액/가맹점 파싱 (`POST /trip/parse-sms` + 로컬 폴백). 네이티브 SMS 인박스 자동 읽기는 Expo 제한으로 보류
- **WordPress 직접 발행**: 요약 화면에서 WP 임시글 / 바로 게시 → `POST /wordpress/publish` (9ruDocs와 동일 Application Password 패턴)
- **교통 glance + 숙소 점수**: 장소 간 `travelFromPrevMinutes` / `travelFromPrevCost`, hotel `lodgingScore` (하버사인 추정 보강)

## 이후 (보류)

- 국내(네이버 맵) / 다도시
- 네이티브 SMS 인박스 권한(커스텀 dev client)
- 실시간 교통 API · 맛집 DnD 고도화

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 + Gemini/WP 설정 여부 |
| POST | `/trip/itinerary` | `{ cityId, nights, days, partySize }` → 일정 |
| POST | `/trip/reroute` | `{ trip, dayIndex, completedPlaceIds?, reason? }` → 남은 일정 재생성 |
| POST | `/trip/export-draft` | `{ trip }` → BlogDraft 호환 JSON |
| POST | `/trip/parse-sms` | `{ text }` → 카드 SMS 파싱 |
| POST | `/trip/enrich-transport` | `{ places }` → 이동시간/비용 보강 |
| POST | `/wordpress/publish` | BlogDraft 또는 `{ trip, status }` → WP 발행 |

## 환경 변수 (비밀 제외)

| 변수 | 위치 | 설명 |
|------|------|------|
| `GEMINI_API_KEY` | `apps/api/.env` | Google AI Studio |
| `GEMINI_MODEL` | `apps/api/.env` | 기본 `gemini-flash-lite-latest` |
| `PORT` | `apps/api/.env` | 기본 `3011` |
| `WP_SITE_URL` / `WP_USERNAME` / `WP_APP_PASSWORD` | `apps/api/.env` | WordPress 직접 발행 |
| `EXPO_PUBLIC_API_BASE_URL` | 모바일 | API 주소 오버라이드 |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | 모바일 | Google Maps |

### P1 빠른 테스트

1. API: `npm run api` → `GET http://localhost:3011/health`
2. 일정: `POST /trip/itinerary` 후 장소의 `plannedTime` / `travelFromPrev*` 확인
3. 앱: 여행 시작 → 가이드알람 ON → 다음 액션 배너 / 완료 버튼
4. AI재루트 ON → **이탈·재루트** (완료 장소는 유지)
5. 경비: SMS 예문 붙여넣기 → 파싱 → 경비 추가
6. 요약: 리뷰 1개 이상 → WP 임시글 (`.env` WP 자격증명 필요)

