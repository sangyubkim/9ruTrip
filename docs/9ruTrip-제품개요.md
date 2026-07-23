# 9ruTrip 제품 개요

> 동반 자료: [`9ruTrip-제품개요.pptx`](./9ruTrip-제품개요.pptx)  
> 재생성: `python docs/generate_overview_pptx.py`  
> 저장소: https://github.com/sangyubkim/9ruTrip  
> 기준 커밋: **P3 `9e57e3a`** — Add P3 transport comparison UI and Plan map+list split.

**브랜드 컬러:** `#0c4a6e` · `#0369a1` · `#0f172a` · `#f8fafc` · `#64748b`  
**문서 폰트:** Malgun Gothic (와이드스크린 13.333×7.5)

---

## 1. 커버

**9ruTrip** — AI 여행 플래너 · Plan → Trip → After

- 해외 MVP: 도쿄(기본) + 오사카(선택)
- Expo / React Native · Gemini · Google Maps
- P0–P3 구현 완료 · 9ruDocs BlogDraft 호환

---

## 2. 비전 & 포지셔닝

9ruTrip은 Gemini로 초기 일정을 만들고, 현장에서 동선·경비·기록을 관리한 뒤, 여행 후 9ruDocs 호환 BlogDraft / WordPress로 발행까지 이어주는 **모바일 여행 플래너**입니다.

| 축 | 내용 |
|----|------|
| **왜** | 해외 도시 빠른 MVP, AI+수동 DnD, 가이드 알람·재루트, 경비 SMS + 계획 vs 실제 |
| **무엇** | Expo Android-first, API(Gemini·Directions·WP), `@9rutrip/shared`, AsyncStorage |
| **누구** | 개인 여행자/블로거, 9ruDocs 발행 워크플로, Android 실기기 우선 (국내 네이버는 스캐폴드) |

---

## 3. 여행 라이프사이클 — Plan / Trip / After

### PLAN
- 도시·박/일/인원 선택 → Gemini 일정 생성
- Day DnD · 카테고리 필터(맛집/관광/숙소)
- 숙소 Top N · 교통 enrich
- 수단 비교 · Plan 지도(~37% 높이)+리스트

### TRIP (`status: active`)
- 다음 액션 배너 · 가이드 알람(인앱 Alert + Android 로컬 알림)
- AI 재루트 ON/OFF (`POST /trip/reroute`)
- 캡처(사진+리뷰) · 경비(수동 / SMS 붙여넣기)

### AFTER
- 계획 vs 실제 비용 요약
- 사진+리뷰 → Step 호환
- `export-draft` (BlogDraft) · WordPress 임시글/게시
- 9ruDocs 파이프라인 연계

---

## 4. 기능 로드맵 P0–P3 (구현됨)

### P0 MVP
- Expo Android 앱 셸 · 도쿄 일정
- Gemini AI 초기 일정 (실패 시 폴백 코스)
- Day 타임라인 + 롱프레스 DnD
- Google Maps 기본 뷰 + 마커 · AsyncStorage
- 여행 중 사진+리뷰 · 현금 경비 · `/trip/export-draft`

### P1
- 가이드 알람 / 다음 액션
- AI 재루트 · SMS 경비 파싱 · WordPress 직접 발행
- 교통 glance + 숙소 점수 (`travelFromPrev*` / `lodgingScore`)

### P2
- Maps 키 배선 · Directions(키 있으면) / 하버사인 폴백
- 숙소 Top N + scoreBreakdown · 카테고리 DnD UX
- Naver Maps 어댑터 스캐폴드 · 오사카 선택

### P3 (`9e57e3a`)
- 교통 수단 비교 UI (도보/대중교통/택시) · `preferredTransportMode`
- `POST /trip/compare-transport` · enrich의 `transportOptions[]`
- Plan Day 압축 지도 + DnD 리스트 · 마커↔리스트 연동
- `docs/E2E-CHECKLIST.md`

---

## 5. UI 디자인 시스템

### 컬러 토큰 (앱 스크린 기준)

| 토큰 | Hex | 용도 |
|------|-----|------|
| Primary | `#0c4a6e` | Hero, 토글 ON, Primary 버튼 |
| Accent | `#0369a1` | 탭 ON, 링크, CTA 보조 |
| Ink | `#0f172a` | 제목 |
| Background | `#f8fafc` | 시트/카드 배경 |
| Muted | `#64748b` | 메타·부가 문구 |

보조: Hero CTA `#38bdf8`, 보더 `#e2e8f0`, 완료 emerald, 숙소 후보 orange.

### 컴포넌트·레이아웃
- Home: 브랜드 히어로 → 여행 리스트
- Plan: Day 탭 + 필터 + 지도(~37%H) + DnD
- Active: 다음 액션 배너 상단
- 교통: glance → 비교 바텀시트
- After: 요약 스크롤 + 발행 CTA
- Maps/Directions 키 없음 → graceful degrade

---

## 6. 와이어프레임 A — Home / Create / Plan

### Home
```
┌─────────────────────┐
│ 9ruTrip             │
│ MVP · 도쿄          │
│ [새 여행 만들기]    │
│ API 설정            │
├─────────────────────┤
│ 저장된 여행         │
│ 도쿄 · 2박 3일      │
│ 2명 · planning …    │
└─────────────────────┘
```

### Create
```
┌─────────────────────┐
│ ← 뒤로              │
│ 여행 만들기         │
│ [도쿄] [오사카]     │
│ 박수 / 일수 / 인원  │
│ [AI로 일정 생성]    │
└─────────────────────┘
```

### Plan
```
┌─────────────────────┐
│ Day1 Day2 Day3      │
│ 가이드알람 · 재루트 │
│ ┌─ 지도 ~37% ─────┐ │
│ │ 마커 ↔ 리스트   │ │
│ └─────────────────┘ │
│ 전체|맛집|관광|숙소 │
│ ≡ 장소 · glance 탭  │
│ [지도][캡처][경비]… │
└─────────────────────┘
```

---

## 7. 와이어프레임 B — Transport / Active / After

### Transport Compare
- 바텀시트: 도보 / 대중교통 / 택시 (분·비용)
- Directions 또는 haversine engine 힌트
- 선택 → `preferredTransportMode` → glance / `travelFromPrev*` 반영

### Active Trip
- 다음 액션 배너 · 임박 Alert · 로컬 알림
- 완료 체크 · AI 재루트
- 캡처 · 경비(SMS 붙여넣기 / share intent)

### After (Summary)
- 계획 vs 실제 · 카테고리 합계
- BlogDraft 내보내기 · WP 임시글/게시 (리뷰 1개+ 필요)

---

## 8. 화면 목록

| 화면 | 역할 |
|------|------|
| `HomeScreen` | 여행 목록 · 생성/설정 진입 |
| `CreateTripScreen` | 도시·박/일/인원 → itinerary |
| `PlanScreen` | Day DnD · 지도 · 비교시트 · 알람/재루트 |
| `MapScreen` | 전체 지도 (키 없으면 힌트) |
| `CaptureScreen` | 카메라/갤러리 · PlaceReview |
| `ExpensesScreen` | 수동 경비 · SMS 파싱 |
| `SummaryScreen` | 비용 요약 · export-draft · WP |
| `SettingsScreen` | API Base URL · 헬스체크 |

**보조:** `PlanDayMap`, `TransportCompareSheet`, `NextActionBanner`, `useGuideAlarms`

---

## 9. 아키텍처 & API

```
apps/mobile (Expo SDK 55, Android first)
    ↔  HTTP :3011
apps/api (Gemini · Directions/haversine · WP)
    ↔
packages/shared (Trip / Step / BlogDraft · 9ruDocs 호환)
```

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 + Gemini/WP/Maps 설정 |
| POST | `/trip/itinerary` | 일정 + lodgingCandidates |
| POST | `/trip/reroute` | 당일 남은 일정 재생성 |
| POST | `/trip/enrich-transport` | 이동시간/비용 + transportOptions |
| POST | `/trip/compare-transport` | 도보/대중교통/택시 비교 |
| POST | `/trip/suggest-places` | 카테고리 장소 제안 |
| POST | `/trip/parse-sms` | 카드 SMS 파싱 |
| POST | `/trip/export-draft` | BlogDraft 호환 JSON |
| POST | `/wordpress/publish` | WP 임시글/게시 |

API 기본: Android 에뮬 `http://10.0.2.2:3011` · 로컬 `http://localhost:3011`

---

## 10. 충분성 갭 (Sufficiency Gaps)

### 충분한 영역 (P0–P3)
- 도쿄/오사카 AI 일정 + DnD 편집 루프
- 교통 추정 + 수단 비교
- 가이드 알람 · 재루트 · 캡처 · 경비
- BlogDraft/WP 발행 · 키 없을 때 degrade · E2E 체크리스트

### 갭 / 리스크
- 국내 Naver Maps 실연동 미완
- 네이티브 SMS 인박스 자동 읽기 없음
- GPS 이탈(deviation) 힌트 미구현
- Routes API 고도화 · 실시간 혼잡 미반영
- iOS/웹 2차 · 공유 패키지 물리 병합 보류
- Maps/Gemini 키·비용 운영 의존

---

## 11. 다음 단계

1. **국내 연동** — Naver Maps SDK로 국내 도시 실연동  
2. **SMS 네이티브** — expo-dev-client + 권한 플러그인  
3. **이탈 힌트** — GPS deviation → 재루트 제안 (선택)  
4. **플랫폼/품질** — Routes API · iOS 패리티 · 모노레포 병합 검토  

---

## 12. 요약

9ruTrip P0–P3는 **Plan · Trip · After** 핵심 루프를 닫았습니다.  
다음 투자는 **국내 맵 · 네이티브 SMS · 이탈 힌트**입니다.

```bash
C:\Users\Intellian\AppData\Local\Programs\Python\Python312\python.exe docs\generate_overview_pptx.py
```
