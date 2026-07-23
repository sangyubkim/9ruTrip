# Android 실기기 E2E 체크리스트 (9ruTrip)

전체 여행 사이클을 **Android 실기기**에서 검증할 때 사용합니다. API는 PC에서 `npm run api`(포트 3011)로 띄우고, 앱 **API 설정**에서 `http://<PC-LAN-IP>:3011`을 지정하세요.

## 사전 준비

- [ ] `apps/api/.env`에 `GEMINI_API_KEY` 설정
- [ ] (선택) `GOOGLE_MAPS_API_KEY` — Directions 실측. 없으면 haversine 폴백
- [ ] (선택) `apps/mobile/.env`에 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — 지도 타일
- [ ] 루트에서 `npm run shared:build` → `npm run api`
- [ ] `apps/mobile`에서 `npm start` → Android 기기 연결 / Expo Go 또는 dev client
- [ ] 홈 → **API 설정** → 헬스체크 (`ok`, `googleMapsConfigured` 여부 확인)

## 1. 여행 생성

- [ ] 홈 → 여행 만들기 → 도쿄(또는 오사카) · 박/일/인원 입력
- [ ] AI 일정 생성 성공 (실패 시 폴백 코스라도 장소 목록이 채워짐)
- [ ] Plan 진입 시 Day 탭·장소 리스트·상단 압축 지도 표시

## 2. Plan 지도 + 리스트 (P3-2)

- [ ] 상단 지도에 Day 장소 마커 표시
- [ ] 리스트 행 탭 → 해당 마커 하이라이트/카메라 이동
- [ ] 마커 탭 → 리스트 선택 상태 반영
- [ ] Maps 키 없어도 크래시 없이 동작 (힌트만)

## 3. 교통 수단 비교 (P3-1) · Directions 엔진

- [ ] 두 번째 이후 장소의 **「이동 · 비교 ›」** 칩 탭 → 바텀시트
- [ ] 도보 / 대중교통 / 택시 분·비용 3열 표시
- [ ] 모드 선택 → glance·`travelFromPrev*` 갱신, 재진입 시 선택 유지
- [ ] DnD로 순서 변경 → 교통 재계산 후에도 비교 시트 동작
- [ ] **키 없음** (`googleMapsConfigured: false`): 모든 `engine`이 `haversine:*`
- [ ] **키 있음 · 도보/택시**: walking → `directions:walking`, taxi → `directions:driving`
- [ ] **키 있음 · 대중교통(일본)**: Google Maps Platform이 **일본 transit 파트너 제외** → `haversine:transit`이 **정상 기대값** (앱 Maps 소비자 transit과 API는 별개)
- [ ] PC 스모크: `POST /trip/compare-transport` 응답 `options[].engine`만 확인 (키 값 출력 금지)
- [ ] 동일 구간 재요청 시 응답이 빠름 (서버 in-memory Directions 캐시 TTL ~20분)

## 4. 숙소 · 카테고리 · DnD · Day 이동 · Undo

- [ ] 숙소 후보 선택 → 호텔 교체 + 동선 재계산
- [ ] 맛집/관광/숙소 필터 칩 + 「+추가」 → **후보 모달**에서 선택 (Places 또는 정적)
- [ ] **🕒 예정 시각** 탭 → HH:mm 편집 저장
- [ ] **⋯ 더보기 · 여행 설정**: 가이드알람/AI재루트·숙소 후보가 접힌 뒤 펼침
- [ ] **≡ 핸들** 길게 눌러 DnD (행 전체가 아닌 핸들) → 순서·「교통 재계산 중…」
- [ ] 필터(예: 맛집) ON에서 DnD → 필터 목록만 재정렬, 다른 카테고리 상대 위치 유지
- [ ] DnD UX: 핸들 hitSlop·힌트, 필터 중 splice, Day▶, 삭제, ~5초 실행 취소 스낵바
- [ ] `Day▶` → 다른 Day로 이동 → enrich
- [ ] `삭제` → 확인 후 제거 + enrich
- [ ] DnD/이동/삭제 직후 「실행 취소」 → 이전 places 복원

## 5. 여행 중 사이클

- [ ] **여행 시작** → status `active` → **현장** 탭(큰 NextAction: 길안내·완료·재루트)
- [ ] **일정** 탭으로 전환 시 기존 리스트·지도·DnD
- [ ] 가이드알람 ON → 다음 액션 배너
- [ ] 장소 **완료** 표시
- [ ] **길안내** (행 또는 하단) → Google Maps 길찾기/내비 앱 오픈 (선택 장소 또는 다음 장소)
- [ ] **동선 최적화** → before/after 미리보기 → 적용 → enrich
- [ ] AI재루트 ON → **이탈·재루트** → 미리보기 Alert(추가/제거 요약) → 적용/취소
- [ ] 리뷰 캡처(사진+캡션) 1건 이상
- [ ] 경비: 수동 추가 + SMS 예문 붙여넣기 파싱
- [ ] 요약: 계획 vs 실제 + **경비 인사이트** 1–3줄
- [ ] (선택) WordPress 임시글 발행 — WP 자격증명 필요
- [ ] **여행 종료** → status `done`
- [ ] 앱 재시작 후 AsyncStorage로 여행 복원

## 5b. 홈 · 온보딩 · 제안

- [ ] 첫 실행: 온보딩 3단계(만들기 → DnD → 이동비교) → 시작/건너뛰기 후 재진입 시 미표시
- [ ] 홈 카드 길게 누르기 또는 ⋯ → **복제** / **삭제**(확인)
- [ ] 「+맛집/관광 추가」 → Places 응답 시 카드 **Google Places** 뱃지
- [ ] 숙소 후보: 「역세권 근접 / 가격 경쟁력 / 평점」한국어 라인
- [ ] 이동 비교 시트: `haversine:transit` 시 추정 안내 + **Yahoo 환승** / **Google 환승** CTA

## 6. API 스모크 (PC)

```bash
# 헬스
curl http://localhost:3011/health

# 구간 비교 (좌표)
curl -X POST http://localhost:3011/trip/compare-transport ^
  -H "Content-Type: application/json" ^
  -d "{\"from\":{\"lat\":35.6812,\"lng\":139.7671},\"to\":{\"lat\":35.6581,\"lng\":139.7017}}"

# 동선 최적화 (API 재시작 후)
curl -X POST http://localhost:3011/trip/optimize-day ^
  -H "Content-Type: application/json" ^
  -d "{\"cityId\":\"tokyo\",\"dayIndex\":0,\"places\":[{\"id\":\"a\",\"name\":\"도쿄역\",\"category\":\"attraction\",\"lat\":35.6812,\"lng\":139.7671,\"dayIndex\":0,\"order\":0},{\"id\":\"b\",\"name\":\"시부야\",\"category\":\"attraction\",\"lat\":35.6581,\"lng\":139.7017,\"dayIndex\":0,\"order\":1},{\"id\":\"c\",\"name\":\"아사쿠사\",\"category\":\"attraction\",\"lat\":35.7148,\"lng\":139.7967,\"dayIndex\":0,\"order\":2}]}"
```

- [ ] `options`에 walking / transit / taxi 3개
- [ ] `googleMapsConfigured: false`이면 engine이 haversine 계열
- [ ] `googleMapsConfigured: true`이면 walking=`directions:walking`, taxi=`directions:driving`; **일본 transit은 `haversine:transit` 정상** (Platform FAQ: JP transit partners 제외)
- [ ] `optimize-day` → `before`/`after`/`engine`(gemini|nearest-neighbor) (키 값 출력 금지)

## 블로커 / 알려진 제한

| 항목 | 상태 |
|------|------|
| Google Maps / Directions 키 | 로컬에 없으면 추정·기본 지도만 |
| Directions transit (일본) | Platform이 JP transit 파트너 제외 → 항상 ZERO_RESULTS → haversine 추정. `departure_time`·`region=jp`·캐시는 유지(타 지역·walking/driving용) |
| Naver Maps SDK | 스캐폴드만 (해외 MVP는 Google) |
| GPS 이탈 힌트 | 여행 중 재루트 배너로 일부 반영 |
| 네이티브 SMS 인박스 | 문서화만 (`apps/mobile/docs/SMS.md`) |
| Yahoo / NAVITIME 등 JP 대중교통 파트너 | 어댑터+딥링크 구현 (`docs/JP-TRANSIT-PARTNER.md`). 키/HOST 없으면 추정+외부 앱 |
| Places API (New) 전면 재작성 | 보류 — 기존 Places 검색 유지 |
