# 9ruTrip

모바일 여행 플래너 (Expo / React Native). **해외 MVP: 도쿄(기본) + 오사카(선택)** — Google Maps. 국내(네이버)는 스캐폴드.

9ruDocs(`D:\01_Project\9ruDocs`)와 같은 모노레포 패턴을 따르며, `Step` / `BlogDraft` 호환 타입으로 WordPress 발행 흐름에 연결할 수 있습니다.

## 아키텍처

```
D:\01_Project\9ruTrip\
  apps/mobile/     Expo SDK 55 · Android first
  apps/api/        Gemini 일정 생성 + BlogDraft 내보내기 + Directions(선택)
  packages/shared/ Trip / Step / BlogDraft 타입 (9ruDocs 호환)
```

**공유 전략:** `@9rutrip/shared`의 `Step`/`BlogDraft`는 `@9rudocs/shared`와 동일 스키마. 상세는 `packages/shared/README.md`. 물리 병합은 선택(보류).

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
# (선택) .env.example → .env 에 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
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

`apps/mobile/app.config.js`가 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`를
`android.config.googleMaps.apiKey` / `ios.config.googleMapsApiKey` / `extra.googleMapsApiKey`로 주입합니다.

```bash
# apps/mobile/.env (gitignored)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key

# API Directions용 (선택, 동일 키 가능)
# apps/api/.env
GOOGLE_MAPS_API_KEY=your_key
```

키가 없으면 지도는 graceful degrade(힌트 표시 + 기본 지도/제한 모드), 교통 추정은 **하버사인 폴백**. 가짜 키를 넣지 마세요.

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

- **가이드 알람 / 다음 액션**: 여행 중(`active`) 다음 미완료 장소 배너 + 임박 시 인앱 Alert · Android 로컬 알림
- **AI 재루트 ON/OFF**: `POST /trip/reroute`
- **SMS 경비 파싱**: 붙여넣기 → `POST /trip/parse-sms` + 로컬 폴백
- **WordPress 직접 발행**: `POST /wordpress/publish` (Application Password)
- **교통 glance + 숙소 점수**: `travelFromPrev*` / `lodgingScore` (하버사인)

## P2 (구현됨)

1. **Google Maps 키 배선**: `app.config.js` + `apps/mobile/.env.example` → Android/iOS Maps apiKey. 키 없이도 MapScreen 동작.
2. **WP E2E**: `WP_SITE_URL`/`WP_BASE_URL` 별칭, 에러 `hint` 강화. blog-pipeline과 동일 패턴.
3. **실시간 교통**: Maps 키 있으면 Google Directions, 없으면 하버사인. 일정 생성·DnD 후 `forceRecalc`로 재계산.
4. **SMS 실사용 경로**: 클립보드 붙여넣기 + Android share intentFilter 문서. 인박스 자동 읽기는 커스텀 빌드 필요 (`apps/mobile/docs/SMS.md`).
5. **숙소 Top N**: `lodgingCandidates` + scoreBreakdown(centrality/price/ratingProxy). Plan에서 선택 시 동선 재계산.
6. **카테고리 DnD UX**: 맛집/관광/숙소 필터 칩 + 카테고리별 장소 추가 제안.
7. **Naver Maps 어댑터 스캐폴드**: `mapProvider` google|naver, `NAVER_MAP_CLIENT_ID` env. 도쿄/오사카는 Google.
8. **다도시 라이트**: 오사카 선택 가능. `@9rutrip/shared` ↔ 9ruDocs 스키마 노트 (`packages/shared/README.md`).

## 이후 (보류)

- 국내 도시 실연동 (Naver Maps SDK)
- 네이티브 SMS 인박스 (expo-dev-client + 권한 플러그인)
- 물리 모노레포 병합 / Routes API 고도화

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 + Gemini/WP/Maps 설정 여부 |
| POST | `/trip/itinerary` | `{ cityId, nights, days, partySize }` → 일정 + lodgingCandidates |
| POST | `/trip/reroute` | 당일 남은 일정 재생성 |
| POST | `/trip/export-draft` | BlogDraft 호환 JSON |
| POST | `/trip/parse-sms` | 카드 SMS 파싱 |
| POST | `/trip/enrich-transport` | `{ places, forceRecalc? }` → 이동시간/비용 |
| POST | `/trip/suggest-places` | `{ cityId, category }` → 카테고리 제안 |
| POST | `/wordpress/publish` | BlogDraft 또는 `{ trip, status }` → WP 발행 |

## 환경 변수 (비밀 제외)

| 변수 | 위치 | 설명 |
|------|------|------|
| `GEMINI_API_KEY` | `apps/api/.env` | Google AI Studio |
| `GEMINI_MODEL` | `apps/api/.env` | 기본 `gemini-flash-lite-latest` |
| `PORT` | `apps/api/.env` | 기본 `3011` |
| `WP_SITE_URL` / `WP_BASE_URL` | `apps/api/.env` | WordPress (둘 다 허용) |
| `WP_USERNAME` / `WP_APP_PASSWORD` | `apps/api/.env` | Application Password |
| `GOOGLE_MAPS_API_KEY` | `apps/api/.env` | Directions (선택) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `apps/mobile/.env` | 지도 + app.config 주입 |
| `EXPO_PUBLIC_API_BASE_URL` | 모바일 | API 주소 오버라이드 |
| `NAVER_MAP_CLIENT_ID` | API/모바일 | 국내 맵 스캐폴드 |

### P2 빠른 테스트

1. API: `npm run api` → `GET http://localhost:3011/health` (`wordpressConfigured` / `googleMapsConfigured`)
2. 일정: `POST /trip/itinerary` `{ "cityId":"tokyo","nights":2,"days":3,"partySize":2 }` → `lodgingCandidates`, `travelFromPrev*`
3. DnD: Plan에서 순서 변경 → 교통 재계산 (키 없으면 haversine)
4. 숙소: 후보 탭 → 선택 → 호텔 교체
5. 카테고리: 맛집/관광/숙소 칩 + 「+추가」
6. 경비: 클립보드 붙여넣기 → SMS 파싱
7. WP: 리뷰 1개+ → 요약에서 임시글 (자격증명 필요)
8. 지도: 키 없이 MapScreen 열기 → 힌트만, 크래시 없음
9. 오사카: 여행 만들기에서 오사카 선택

### P1 빠른 테스트

1. 가이드알람 ON → 다음 액션 배너
2. AI재루트 ON → 이탈·재루트
3. SMS 예문 붙여넣기 → 경비 추가
