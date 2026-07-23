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

**키 발급·제한·검증 단계별 가이드:** [`docs/GOOGLE-MAPS-API-KEY.md`](docs/GOOGLE-MAPS-API-KEY.md)

**일본 대중교통 파트너 (NAVITIME / Yahoo deep link):** [`docs/JP-TRANSIT-PARTNER.md`](docs/JP-TRANSIT-PARTNER.md)

`apps/mobile/app.config.js`가 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`를
`android.config.googleMaps.apiKey` / `ios.config.googleMapsApiKey` / `extra.googleMapsApiKey`로 주입합니다.

```bash
# apps/mobile/.env (gitignored) — Maps SDK 전용 키 권장
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_mobile_key

# apps/api/.env — Directions 전용 서버 키 권장 (Android 제한 없음)
GOOGLE_MAPS_API_KEY=your_server_key
```

키가 없으면 지도는 graceful degrade(힌트 표시 + 기본 지도/제한 모드), 교통 추정은 **모드별 하버사인 폴백**(도보/대중교통/택시). Directions 실측이 필요하면 `GOOGLE_MAPS_API_KEY`를 `apps/api/.env`에 설정하세요. **가짜 키·실키 커밋 금지.**

검증: API 재시작 후 `GET /health` → `googleMapsConfigured: true` · Expo 재시작 후 지도 확인.

실기기 전체 사이클: [`docs/E2E-CHECKLIST.md`](docs/E2E-CHECKLIST.md).

## P0 (구현됨)

- Expo Android 앱 셸
- 여행 생성: 도쿄 고정, 박/일/인원
- Gemini AI 초기 일정 (실패 시 도쿄 폴백 코스)
- Day 타임라인 + **≡ 핸들** 롱프레스 DnD 정렬 (`activationDistance`)
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
6. **카테고리 DnD UX**: 맛집/관광/숙소 필터 칩 + 카테고리별 장소 추가 제안. 필터 ON에서도 부분 집합 재정렬 후 당일 시퀀스에 splice.
7. **Naver Maps 어댑터 스캐폴드**: `mapProvider` google|naver, `NAVER_MAP_CLIENT_ID` env. 도쿄/오사카는 Google.
8. **다도시 라이트**: 오사카 선택 가능. `@9rutrip/shared` ↔ 9ruDocs 스키마 노트 (`packages/shared/README.md`).

## P3 (구현됨)

1. **교통 수단 비교 UI**: Plan **「이동 · 비교 ›」** 칩 → 도보/대중교통/택시 분·비용 비교 시트. `preferredTransportMode` 저장 후 glance·`travelFromPrev*` 반영.
2. **비교 API**: `POST /trip/compare-transport` (`from`/`to` 또는 `places`+`placeId`). Maps 키 있으면 Directions(walking/transit/driving), 없으면 모드별 haversine.
3. **enrich 확장**: `/trip/enrich-transport`가 `transportOptions[]`를 채우고, 선호 모드를 travel 필드에 적용.
4. **Plan 지도+리스트**: Day 압축 지도(~37% 높이) + DnD 리스트. 선택 시 마커 하이라이트. 키 없어도 graceful.
5. **E2E 체크리스트**: `docs/E2E-CHECKLIST.md` (Android 실기기 전체 사이클).
6. **Maps 키**: 로컬 `apps/api/.env`에 `GOOGLE_MAPS_API_KEY` 없으면 haversine 폴백 유지. 키를 넣으면 Directions 실측 — **가짜 키 금지**.

### P3 빠른 테스트

1. `GET /health` → `googleMapsConfigured`
2. `POST /trip/compare-transport` `{ "from":{"lat":35.6812,"lng":139.7671}, "to":{"lat":35.6581,"lng":139.7017} }` → options 3개
3. Plan: 「이동 · 비교 ›」 칩 → 모드 선택 → 표시 갱신
4. Plan: 상단 지도 마커 ↔ 리스트 선택 연동
5. ≡ 핸들 DnD / 필터 중 DnD / Day▶ / 삭제 → enrich + 실행 취소

## 테스트

```bash
# API 단위 테스트 (sms-parse · haversine · Directions mock)
npm test
# 또는
npm run test --prefix apps/api

# shared 빌드 + 모바일 tsc
npm run typecheck
```

## 이후 (보류)

- 국내 도시 실연동 (Naver Maps SDK 풀 SDK)
- 네이티브 SMS 인박스 (expo-dev-client + 권한 플러그인)
- 계정 동기화 / 클라우드 백업
- 물리 모노레포 병합 / Routes API 고도화
- SMS 공유 UX 추가 폴리시
- Places API (New) 전면 재작성
- NAVITIME 실계약 HOST/CID 운영 튜닝 (어댑터·딥링크는 구현됨 — `docs/JP-TRANSIT-PARTNER.md`)

## 최근 보완 (P3+)

- Google Maps 키 발급 문서 + `.env.example` 안내
- 도쿄/오사카 숙소·장소 정적 POI 보강, 숙소 점수 허브 도시별
- 여행 중 GPS 이탈 시 재루트 배너 (`aiRerouteEnabled`)
- Plan Day 지도 경로 polyline
- `npm test` (sms-parse / haversine / optimize-day)

### 차별화 · 현장 UX (Sprint A)

- **현장 모드**: `status===active` 시 큰 NextAction 패널(길안내·완료·재루트) + 현장/일정 탭
- **동선 최적화**: `POST /trip/optimize-day` (Gemini 재배치, 폴백 nearest-neighbor) → Plan 「동선 최적화」미리보기 후 enrich
- **숙소 설명**: scoreBreakdown → 「역세권 근접 / 가격 경쟁력 / 평점」한국어 라인
- **JP transit**: 비교 시트 추정 안내 + **Yahoo 환승** / **Google 환승** deep link. 파트너 키 시 `partner:navitime` (`docs/JP-TRANSIT-PARTNER.md`)
- **경비 인사이트**: Summary에 계획 대비·식비/교통 비중 한국어 1–3줄

### UX polish (Sprint B)

- 홈: 길게 누르기 / ⋯ 메뉴 → **삭제·복제**
- 첫 실행 온보딩 3단계 (AsyncStorage `@9rutrip/onboardingSeen`)
- 장소 제안: Places 응답 시 카드 **Google Places** 뱃지

### UX B7–B11 (최근)

- **B7 순서 모드**: 마커 롱프레스 → 순서 모드 + 하단 ≡ 스트립 재정렬(▲▼ 병행). Android 지도 핀 geo-드래그 미사용(불안정).
- **B8 Day↔도시**: 멀티시티 시 Day별 도쿄/오사카 칩 → `cities.dayIndexes` + (선택) `place.cityId` · 지도 중심 갱신.
- **B9 다크 완성**: Capture / Expenses / Summary 테마 토큰 (설정 시스템·라이트·다크).
- **B10 제스처**: ≡만 DnD · 왼쪽 스와이프 삭제 · 드래그 중 스와이프 off · `activeOffsetX`/`failOffsetY` · 리스트 스크롤 유지.
- **B11 모션·a11y**: `FadeIn`/스낵바/NextAction Animated + `AccessibilityInfo` reduce-motion · Label/Role/Hint · 다크 칩 대비.


### Directions transit · 캐시

- transit/driving에 `departure_time=now`, `language=ko`, `region=jp` + 일시 오류 재시도
- from/to/mode in-memory 캐시 (TTL ~20분)
- **일본 대중교통**: Google Maps Platform Directions/Routes는 JP transit 파트너 **미지원** → 키 있어도 `haversine:transit`이 정상. 도보/택시는 `directions:*`
- E2E: 엔진 기대값 + DnD UX (`docs/E2E-CHECKLIST.md`)

### Plan UX (우선 수정)

- **학습 힌트**: 일정 탭 상단 고정 「≡ 길게 = 순서 · 왼쪽 밀기 = 삭제 · 마커 길게 = 순서 모드」+ 첫 Plan 코치마크(`@9rutrip/planCoachSeen`)
- **핸들 DnD**: `≡`만 길게 눌러 순서 변경 (hitSlop·힌트·`activationDistance`)
- **필터+DnD**: 카테고리 필터 ON에서도 필터 목록 내 재정렬 → 전체 Day에 splice (다른 카테고리 상대 위치 유지)
- **Day 이동**: 행의 `Day▶` → 다른 `dayIndex`로 이동 후 order 재부여·enrich
- **실행 취소**: DnD / Day 이동 / 삭제 직후 ~5초 「실행 취소」 스낵바
- **장소 삭제**: 행 `삭제` → 확인 후 enrich
- **낙관적 enrich**: 로컬 순서 즉시 반영 + 「교통 재계산 중…」 인디케이터
- **비교 CTA**: glance를 「이동 · 비교 ›」 칩으로 노출
- **장소 추가**: 후보 모달에서 선택 (Places Text 가능 시 `source=places`, 아니면 정적 POI)
- **예정 시각**: 🕒 탭 → HH:mm 편집
- **여행 설정**: 토글·숙소 후보를 「⋯ 더보기」로 접기
- **길안내**: 행/하단 CTA → Google Maps (Android `google.navigation` 또는 https dir, transit)
- **재루트 미리보기**: AI 재루트 응답 후 장소 변경 요약 Alert → 적용/취소
- **Directions 단위 테스트**: mock fetch로 transit 파라미터·ZERO_RESULTS 캐시·재시도 검증

### UX backlog 7–12 (구현됨)

1. **마커 순서 변경 (#7 / B7)**: 롱프레스 → 「순서 모드」+ 지도 하단 ≡ 스트립(길게→다른 번호 탭) + ▲▼. 리스트·enrich·Undo 동기. **Android `react-native-maps` 핀 geo-드래그는 불안정해 비활성** — 순서 모드/스트립이 대체 UX.
2. **멀티시티 Day 배정 (#8 / B8)**: `Trip.cities[].dayIndexes` 수동 할당 UI(도쿄/오사카 칩). 지도 중심·(선택) 당일 `place.cityId` 갱신 프롬프트.
3. **스와이프 삭제 + 다단계 Undo (#9)**: `Swipeable` 행 삭제. Undo 스택 N=5, 스낵바에 깊이 표시.
4. **날씨·혼잡 (#10)**: Open-Meteo(키 없음) → 「오늘 날씨 · °C · 강수%」 칩 + 시간대 혼잡 휴리스틱.
5. **체크인 체크리스트 (#11)**: 예약번호·여권·WiFi·미팅포인트 — Trip에 저장, Plan ⋯ / 현장 모드 체크박스.
6. **브랜드 모션·다크·a11y (#12 / B9–B11)**: 설정 테마(시스템/라이트/다크) → Capture·Expenses·Summary·NextAction까지 토큰 적용. `FadeIn`/스낵바·NextAction `Animated`(reduce-motion 존중). Swipe↔DnD: ≡만 드래그, 스와이프는 왼쪽·`activeOffsetX`/`failOffsetY`, 드래그 중 스와이프 비활성.


## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 + Gemini/WP/Maps 설정 여부 |
| POST | `/trip/itinerary` | `{ cityId, nights, days, partySize }` → 일정 + lodgingCandidates |
| POST | `/trip/reroute` | 당일 남은 일정 재생성 |
| POST | `/trip/optimize-day` | `{ places, dayIndex, cityId }` → 당일 동선 재배치 (Gemini / NN) |
| POST | `/trip/export-draft` | BlogDraft 호환 JSON |
| POST | `/trip/parse-sms` | 카드 SMS 파싱 |
| POST | `/trip/enrich-transport` | `{ places, forceRecalc? }` → 이동시간/비용 + transportOptions |
| POST | `/trip/compare-transport` | `{ from, to }` 또는 `{ places, placeId }` → 도보/대중교통/택시 비교 |
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
| `JP_TRANSIT_PROVIDER` | `apps/api/.env` | `navitime` 시 파트너 시도 (선택) |
| `NAVITIME_API_KEY` | `apps/api/.env` | NAVITIME/RapidAPI 키 (선택) |
| `NAVITIME_API_HOST` | `apps/api/.env` | 파트너 HOST (없으면 딥링크 폴백) |
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
