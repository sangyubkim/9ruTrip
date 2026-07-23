/**
 * @9rutrip/shared ↔ 9ruDocs 스키마 노트
 *
 * 물리 모노레포 병합은 선택. 지금은 스키마 호환 + 문서/심볼릭 링크로 충분.
 *
 * ## 호환 타입 (동일 필드)
 * - `Step`: id, imageUri, caption, order
 * - `BlogDraft`: id, title, steps, body, excerpt, tags, createdAt, updatedAt
 *
 * 9ruTrip `PlaceReview` = Step + placeId/placeName/rating
 * → `tripReviewsToBlogDraft()` 로 BlogDraft 변환 후
 *   `POST /wordpress/publish` (9ruTrip) 또는 9ruDocs WP 플로우.
 *
 * ## 환경 변수 정렬
 * | 9ruTrip            | blog-pipeline / 9ruDocs |
 * |--------------------|-------------------------|
 * | WP_SITE_URL        | WP_BASE_URL (별칭 허용) |
 * | WP_USERNAME        | WP_USERNAME             |
 * | WP_APP_PASSWORD    | WP_APP_PASSWORD         |
 * | GEMINI_API_KEY     | GEMINI_API_KEY          |
 *
 * ## 공유 패키지 연결 옵션
 * 1. 문서만 (현재) — 스키마를 양쪽에서 복제 유지
 * 2. `npm link` / workspace 심볼릭: `packages/shared` → 9ruDocs
 * 3. 물리 병합: 상위 모노레포 (리스크 큼, 보류)
 */

export const SHARED_SCHEMA_NOTE =
  "Step/BlogDraft compatible with @9rudocs/shared — see packages/shared/README.md";
