/** HH:mm + deltaMinutes (24h wrap). 잘못된 값은 null. */
export function addMinutesToHhmm(hhmm, deltaMinutes) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(String(hhmm))) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total =
    (((h * 60 + m + deltaMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

/**
 * afterIndex 이후 장소 plannedTime += deltaMinutes (숙소 포함).
 * 같은 Day 배열 순서 기준.
 */
export function shiftPlannedTimesAfter(places, afterIndex, deltaMinutes = 60) {
  if (!Array.isArray(places)) return [];
  return places.map((p, i) => {
    if (i <= afterIndex) return p;
    const next = addMinutesToHhmm(p.plannedTime, deltaMinutes);
    return next ? { ...p, plannedTime: next } : p;
  });
}
