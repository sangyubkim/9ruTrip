import { haversineKm } from "./geo";

/** 장소명 비교용 정규화 (공백·괄호 제거) */
export function normalizePlaceName(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}「」『』·・.,'"′″]/g, "");
}

/** 이름 유사: 완전 일치 또는 한쪽이 다른 쪽을 포함(최소 2글자) */
export function namesSimilar(a: string, b: string): boolean {
  const na = normalizePlaceName(a);
  const nb = normalizePlaceName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

const PROXIMITY_KM = 0.15; // ~150m

export type PlaceMatchLike = {
  name: string;
  category?: string;
  contentId?: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
};

function hasCoords(p: PlaceMatchLike): p is PlaceMatchLike & { lat: number; lng: number } {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

function nearEnough(a: PlaceMatchLike, b: PlaceMatchLike): boolean {
  if (!hasCoords(a) || !hasCoords(b)) return false;
  return haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= PROXIMITY_KM;
}

/**
 * 일정 내 동일 장소 여부.
 * - contentId / googlePlaceId 일치
 * - 이름+카테고리 (카테고리 없으면 이름만)
 * - 이름 유사 + 좌표 근접(~150m)
 */
export function isSamePlace(a: PlaceMatchLike, b: PlaceMatchLike): boolean {
  const aCid = String(a.contentId || "").trim();
  const bCid = String(b.contentId || "").trim();
  if (aCid && bCid && aCid === bCid) return true;

  const aGid = String(a.googlePlaceId || "").trim();
  const bGid = String(b.googlePlaceId || "").trim();
  if (aGid && bGid && aGid === bGid) return true;

  const nameOk = namesSimilar(a.name, b.name);
  if (!nameOk) return false;

  if (!a.category || !b.category || a.category === b.category) return true;
  return nearEnough(a, b);
}

/** 여행 전체(또는 지정 목록)에서 중복 장소 찾기 */
export function findDuplicatePlace<T extends PlaceMatchLike>(
  places: T[],
  candidate: PlaceMatchLike,
): T | undefined {
  return places.find((p) => isSamePlace(p, candidate));
}

/** 추천 코스 경유지가 일정 places에 포함되는지 */
export function isWaypointInPlaces(
  places: PlaceMatchLike[],
  waypoint: { name: string; contentId?: string; lat?: number; lng?: number },
): boolean {
  const cid = String(waypoint.contentId || "").trim();
  if (cid && places.some((p) => String(p.contentId || "").trim() === cid)) {
    return true;
  }
  return places.some(
    (p) =>
      namesSimilar(p.name, waypoint.name) ||
      (hasCoords(p) &&
        Number.isFinite(waypoint.lat) &&
        Number.isFinite(waypoint.lng) &&
        haversineKm(
          { lat: p.lat, lng: p.lng },
          { lat: waypoint.lat!, lng: waypoint.lng! },
        ) <= PROXIMITY_KM &&
        namesSimilar(p.name, waypoint.name)),
  );
}

export type CourseWaypointLike = {
  order?: number;
  name: string;
  contentId?: string;
  lat?: number;
  lng?: number;
};

export type SeedCourseInclusionItem = {
  name: string;
  order: number;
  contentId?: string;
  included: boolean;
};

export type SeedCourseInclusion = {
  title: string;
  includedCount: number;
  totalCount: number;
  items: SeedCourseInclusionItem[];
};

/** routeSummary "A → B → C" 로부터 경유지명 복원 (상세 없을 때 폴백) */
export function waypointsFromRouteSummary(
  summary?: string | null,
): CourseWaypointLike[] {
  const raw = String(summary || "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*→\s*/)
    .map((name, i) => ({ name: name.trim(), order: i + 1 }))
    .filter((w) => w.name.length > 0);
}

export function computeSeedCourseInclusion(
  title: string,
  waypoints: CourseWaypointLike[],
  places: PlaceMatchLike[],
): SeedCourseInclusion {
  const items: SeedCourseInclusionItem[] = waypoints
    .filter((w) => w?.name)
    .map((w, i) => ({
      name: w.name,
      order: Number.isFinite(Number(w.order)) ? Number(w.order) : i + 1,
      contentId: w.contentId,
      included: isWaypointInPlaces(places, w),
    }))
    .sort((a, b) => a.order - b.order);
  const includedCount = items.filter((x) => x.included).length;
  return {
    title,
    includedCount,
    totalCount: items.length,
    items,
  };
}
