import type {
  RouteBriefing,
  RouteBriefingPreference,
  Trip,
  TripPreferenceWeights,
} from "../types";
import { getCityMeta, tripCitiesLabel } from "../types";

export type { RouteBriefing, RouteBriefingPreference };
export type { RouteBriefingFestival } from "../types";

const PREF_LABELS: { key: keyof TripPreferenceWeights; label: string }[] = [
  { key: "food", label: "맛집" },
  { key: "attraction", label: "명소" },
  { key: "activity", label: "액티비티" },
  { key: "cost", label: "비용" },
  { key: "minTravel", label: "최소 이동" },
];

export const FALLBACK_SCHEDULE_RULE =
  "식사 11–14시·18–20시 · 명소·식당 체류 약 1시간 · 이동은 차량 기준 반영";

/**
 * API routeBriefing이 있으면 그대로, 없으면 trip 필드로 최소 구조화 패널을 만든다.
 * (구버전 여행에는 축제 메타가 없을 수 있음)
 */
export function resolveRouteBriefing(trip: Trip): RouteBriefing {
  if (trip.routeBriefing?.routeSummary) {
    return trip.routeBriefing;
  }
  return buildRouteBriefingFromTrip(trip);
}

export function buildRouteBriefingFromTrip(trip: Trip): RouteBriefing {
  const outline =
    trip.routeOutline ||
    [
      trip.origin?.name,
      tripCitiesLabel(trip),
      ...(trip.stopoverCityIds ?? []).map(
        (id) => `(경유 ${getCityMeta(id).nameKo})`,
      ),
      trip.endPoint?.name,
    ]
      .filter(Boolean)
      .join(" → ");

  const dayAssignments =
    trip.cities && trip.cities.length > 0
      ? trip.cities
          .map(
            (c) =>
              `${c.cityName} ${c.dayIndexes.length}일 (Day ${c.dayIndexes.map((d) => d + 1).join(",")})`,
          )
          .join(" · ")
      : trip.cityName
        ? `${trip.cityName} ${trip.days}일`
        : undefined;

  const preferences = trip.preferences
    ? PREF_LABELS.map(({ key, label }) => ({
        key,
        label,
        value: trip.preferences?.[key] ?? 3,
      }))
    : undefined;

  const mainRequest = trip.mainRequest || trip.userRequest;
  const extraRequest = trip.extraRequest;
  const seed = trip.seedCourse?.title
    ? {
        title: trip.seedCourse.title,
        source: trip.seedCourse.source || "한국관광공사",
        stopCount: trip.seedCourse.stopCount,
        routeSummary: trip.seedCourse.routeSummary,
        usedAsSeed: true as const,
      }
    : null;

  return {
    routeSummary: outline || trip.cityName,
    ...(dayAssignments ? { dayAssignments } : {}),
    durationLabel: `${trip.nights}박 ${trip.days}일`,
    requests: {
      ...(mainRequest ? { mainRequest } : {}),
      ...(extraRequest ? { extraRequest } : {}),
      ...(preferences ? { preferences } : {}),
      reflected: Boolean(mainRequest || extraRequest || preferences),
    },
    festivals: [],
    festivalsReflected: false,
    seedCourse: seed,
    courseReflected: Boolean(seed),
    scheduleRule: FALLBACK_SCHEDULE_RULE,
  };
}
