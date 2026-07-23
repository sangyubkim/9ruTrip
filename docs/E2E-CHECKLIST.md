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

## 3. 교통 수단 비교 (P3-1)

- [ ] 두 번째 이후 장소의 **이동 glance** 탭 → 바텀시트
- [ ] 도보 / 대중교통 / 택시 분·비용 3열 표시
- [ ] 모드 선택 → glance·`travelFromPrev*` 갱신, 재진입 시 선택 유지
- [ ] DnD로 순서 변경 → 교통 재계산 후에도 비교 시트 동작
- [ ] 키 없음: `haversine:*` 추정 / 키 있음: `directions:*` (API `/health`의 `googleMapsConfigured`)

## 4. 숙소 · 카테고리 · DnD

- [ ] 숙소 후보 선택 → 호텔 교체 + 동선 재계산
- [ ] 맛집/관광/숙소 필터 칩 + 「+추가」
- [ ] 필터=전체에서 롱프레스 DnD → 순서·이동시간 갱신
- [ ] 필터 켠 상태 DnD 시 안내 Alert

## 5. 여행 중 사이클

- [ ] **여행 시작** → status `active`
- [ ] 가이드알람 ON → 다음 액션 배너
- [ ] 장소 **완료** 표시
- [ ] AI재루트 ON → 이탈·재루트
- [ ] 리뷰 캡처(사진+캡션) 1건 이상
- [ ] 경비: 수동 추가 + SMS 예문 붙여넣기 파싱
- [ ] 요약: 계획 vs 실제
- [ ] (선택) WordPress 임시글 발행 — WP 자격증명 필요
- [ ] **여행 종료** → status `done`
- [ ] 앱 재시작 후 AsyncStorage로 여행 복원

## 6. API 스모크 (PC)

```bash
# 헬스
curl http://localhost:3011/health

# 구간 비교 (좌표)
curl -X POST http://localhost:3011/trip/compare-transport ^
  -H "Content-Type: application/json" ^
  -d "{\"from\":{\"lat\":35.6812,\"lng\":139.7671},\"to\":{\"lat\":35.6581,\"lng\":139.7017}}"
```

- [ ] `options`에 walking / transit / taxi 3개
- [ ] `googleMapsConfigured: false`이면 engine이 haversine 계열

## 블로커 / 알려진 제한

| 항목 | 상태 |
|------|------|
| Google Maps / Directions 키 | 로컬에 없으면 추정·기본 지도만 |
| Naver Maps SDK | 스캐폴드만 (해외 MVP는 Google) |
| GPS 이탈 힌트 | P3에서 보류 |
| 네이티브 SMS 인박스 | 문서화만 (`apps/mobile/docs/SMS.md`) |
