import type { ItineraryPlace, Trip } from "../types";

export type NextAction = {
  place: ItineraryPlace;
  dayLabel: string;
  minutesUntil: number | null;
  isDue: boolean;
  isOverdue: boolean;
};

function parsePlannedMinutes(plannedTime?: string): number | null {
  if (!plannedTime || !/^\d{1,2}:\d{2}$/.test(plannedTime)) return null;
  const [h, m] = plannedTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** 오늘(기기 로컬) 기준 다음 미완료 장소 */
export function getNextAction(trip: Trip, now = new Date()): NextAction | null {
  const completed = new Set(trip.completedPlaceIds ?? []);
  const pending = [...trip.places]
    .filter((p) => !completed.has(p.id) && p.category !== "hotel")
    .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);

  if (pending.length === 0) return null;

  const place = pending[0];
  const planned = parsePlannedMinutes(place.plannedTime);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let minutesUntil: number | null = null;
  let isDue = false;
  let isOverdue = false;

  if (planned != null) {
    minutesUntil = planned - nowMin;
    isDue = minutesUntil <= 15 && minutesUntil >= -5;
    isOverdue = minutesUntil < -5;
  }

  return {
    place,
    dayLabel: `Day ${place.dayIndex + 1}`,
    minutesUntil,
    isDue,
    isOverdue,
  };
}

const MODE_SHORT: Record<string, string> = {
  walking: "도보",
  transit: "대중교통",
  taxi: "택시",
};

/** Plan 리스트 CTA: "이동 · 비교 ›" 중심 (분·비용은 보조). */
export function formatTravelGlance(place: ItineraryPlace): string | null {
  const mins = place.travelFromPrevMinutes;
  const cost = place.travelFromPrevCost;
  if (mins == null && cost == null) return null;
  if ((mins ?? 0) <= 0 && (cost ?? 0) <= 0) return null;
  const detail: string[] = [];
  const modeLabel = place.preferredTransportMode
    ? MODE_SHORT[place.preferredTransportMode]
    : null;
  if (modeLabel) detail.push(modeLabel);
  if (mins != null && mins > 0) detail.push(`~${mins}분`);
  if (cost != null && cost > 0) detail.push(`~¥${cost.toLocaleString("ja-JP")}`);
  if (detail.length === 0) return "이동 · 비교 ›";
  return `이동 · ${detail.join(" · ")} · 비교 ›`;
}
