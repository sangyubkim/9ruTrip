/**
 * HH:mm 에 분 단위 오프셋을 더한다. 잘못된 값은 undefined.
 * 24시간을 넘어가면 당일 시각으로 wrap (서버 minutesToHhmm 과 동일).
 */
export function addMinutesToHhmm(
  hhmm: string | undefined,
  deltaMinutes: number,
): string | undefined {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return undefined;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
  const total =
    (((h * 60 + m + deltaMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

/** HH:mm → 자정 기준 분. 잘못된 값은 null. */
export function hhmmToMinutes(hhmm: string | undefined): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/**
 * 같은 Day 일정 배열에서 afterIndex 뒤 장소들의 plannedTime 을 deltaMinutes 만큼 뒤로 민다.
 * 숙소(hotel) 포함. plannedTime 없거나 잘못된 값은 그대로 둔다.
 */
export function shiftPlannedTimesAfter<T extends { plannedTime?: string }>(
  places: T[],
  afterIndex: number,
  deltaMinutes = 60,
): T[] {
  return places.map((p, i) => {
    if (i <= afterIndex) return p;
    const next = addMinutesToHhmm(p.plannedTime, deltaMinutes);
    return next ? { ...p, plannedTime: next } : p;
  });
}

/**
 * 같은 dayIndex 의 미완료 장소들(앞·뒤 모두) plannedTime 을 deltaMinutes 만큼 시프트.
 * 숙소(hotel) 포함. 완료(completedPlaceIds) · excludePlaceId · 유효하지 않은 plannedTime 은 스킵.
 * 편집 카드는 이미 새 시각이 반영된 뒤 excludePlaceId 로 이중 적용을 막는다.
 */
export function shiftPlannedTimesByDelta<
  T extends { id: string; dayIndex: number; plannedTime?: string },
>(
  places: T[],
  opts: {
    dayIndex: number;
    deltaMinutes: number;
    completedPlaceIds?: Iterable<string>;
    excludePlaceId?: string;
  },
): T[] {
  const { dayIndex, deltaMinutes, excludePlaceId } = opts;
  if (!deltaMinutes) return places;
  const completed = new Set(opts.completedPlaceIds ?? []);
  return places.map((p) => {
    if (p.dayIndex !== dayIndex) return p;
    if (excludePlaceId && p.id === excludePlaceId) return p;
    if (completed.has(p.id)) return p;
    const next = addMinutesToHhmm(p.plannedTime, deltaMinutes);
    return next ? { ...p, plannedTime: next } : p;
  });
}

/** enrich 후에도 유지할 id → (원본+delta) HH:mm 맵 */
export function lockedShiftedPlannedTimes(
  places: { id: string; plannedTime?: string }[],
  deltaMinutes = 60,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of places) {
    const next = addMinutesToHhmm(p.plannedTime, deltaMinutes);
    if (next) map.set(p.id, next);
  }
  return map;
}
