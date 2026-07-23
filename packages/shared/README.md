# @9rutrip/shared

Trip / Step / BlogDraft 타입. **Step·BlogDraft는 9ruDocs `@9rudocs/shared`와 동일 스키마**.

## 9ruDocs 연결

| 방식 | 설명 |
|------|------|
| 문서 호환 (현재) | 필드 이름·의미를 맞춤. WP Application Password 패턴 동일 |
| symlink / npm link | `packages/shared`를 9ruDocs workspace에 링크 |
| 물리 병합 | 상위 모노레포 — 선택 사항, 리스크 있어 보류 |

`tripReviewsToBlogDraft(trip)` → BlogDraft → `POST /wordpress/publish`

환경: `WP_SITE_URL`(또는 `WP_BASE_URL`) / `WP_USERNAME` / `WP_APP_PASSWORD`

## 도시 / 맵

- `tokyo` (기본), `osaka` (해외 선택) → `mapProvider: "google"`
- 국내(`seoul` stub) → `mapProvider: "naver"` (`maps.ts` 스캐폴드)
