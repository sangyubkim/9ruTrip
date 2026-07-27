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
  dayIndex?: number;
  cityId?: string;
  notes?: string;
  aiReason?: string;
};

/** 포함 Day 표시: dayIndex(0-based) → "Day N", 미매칭 → "미포함" */
export type InclusionDayLabel = `Day ${number}` | "미포함";

export function formatInclusionDayLabel(
  dayIndex?: number | null,
): InclusionDayLabel {
  if (dayIndex == null || !Number.isFinite(Number(dayIndex)) || Number(dayIndex) < 0) {
    return "미포함";
  }
  return `Day ${Math.floor(Number(dayIndex)) + 1}`;
}

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

/** 추천 코스 경유지와 일치하는 일정 장소 (첫 매칭) */
export function findPlaceForWaypoint<T extends PlaceMatchLike>(
  places: T[],
  waypoint: { name: string; contentId?: string; lat?: number; lng?: number },
): T | undefined {
  const cid = String(waypoint.contentId || "").trim();
  if (cid) {
    const byId = places.find((p) => String(p.contentId || "").trim() === cid);
    if (byId) return byId;
  }
  return places.find(
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

/** 추천 코스 경유지가 일정 places에 포함되는지 */
export function isWaypointInPlaces(
  places: PlaceMatchLike[],
  waypoint: { name: string; contentId?: string; lat?: number; lng?: number },
): boolean {
  return Boolean(findPlaceForWaypoint(places, waypoint));
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
  /** 포함 Day (예: "Day 2") 또는 "미포함" */
  dayLabel: InclusionDayLabel;
};

export type SeedCourseInclusion = {
  title: string;
  includedCount: number;
  totalCount: number;
  items: SeedCourseInclusionItem[];
};

export type FestivalLike = {
  name: string;
  cityId?: string;
  cityName?: string;
  startDate?: string;
  endDate?: string;
};

export type FestivalInclusionItem = {
  name: string;
  included: boolean;
  dayLabel: InclusionDayLabel;
  cityName?: string;
  /** 매칭된 일정 장소명 (축제명과 다를 때) */
  placeName?: string;
};

export type FestivalInclusion = {
  includedCount: number;
  totalCount: number;
  items: FestivalInclusionItem[];
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
    .map((w, i) => {
      const matched = findPlaceForWaypoint(places, w);
      const included = Boolean(matched);
      return {
        name: w.name,
        order: Number.isFinite(Number(w.order)) ? Number(w.order) : i + 1,
        contentId: w.contentId,
        included,
        dayLabel: included
          ? formatInclusionDayLabel(matched?.dayIndex)
          : "미포함",
      };
    })
    .sort((a, b) => a.order - b.order);
  const includedCount = items.filter((x) => x.included).length;
  return {
    title,
    includedCount,
    totalCount: items.length,
    items,
  };
}

function placeMentionsFestival(place: PlaceMatchLike, festivalName: string): boolean {
  const blob = `${place.notes || ""} ${place.aiReason || ""}`;
  if (!blob.trim()) return false;
  const nFest = normalizePlaceName(festivalName);
  if (!nFest || nFest.length < 2) return false;
  return normalizePlaceName(blob).includes(nFest) || namesSimilar(blob, festivalName);
}

/** 축제 ↔ 일정 장소 매칭 (이름·도시·notes/aiReason) */
export function findPlaceForFestival<T extends PlaceMatchLike>(
  places: T[],
  festival: FestivalLike,
): T | undefined {
  const festName = String(festival.name || "").trim();
  if (!festName) return undefined;
  const festCity = String(festival.cityId || "").trim();

  const scored = places
    .map((p) => {
      let score = 0;
      if (namesSimilar(p.name, festName)) score += 3;
      if (placeMentionsFestival(p, festName)) score += 2;
      if (festCity && p.cityId && String(p.cityId) === festCity) score += 1;
      return { p, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.p;
}

/** 선택 축제가 일정에 반영됐는지 + Day 라벨 */
export function computeFestivalInclusion(
  festivals: FestivalLike[],
  places: PlaceMatchLike[],
): FestivalInclusion {
  const items: FestivalInclusionItem[] = (festivals || [])
    .filter((f) => f?.name)
    .map((f) => {
      const matched = findPlaceForFestival(places, f);
      const included = Boolean(matched);
      return {
        name: f.name,
        cityName: f.cityName,
        included,
        dayLabel: included
          ? formatInclusionDayLabel(matched?.dayIndex)
          : "미포함",
        ...(matched && !namesSimilar(matched.name, f.name)
          ? { placeName: matched.name }
          : {}),
      };
    });
  const includedCount = items.filter((x) => x.included).length;
  return {
    includedCount,
    totalCount: items.length,
    items,
  };
}
