import type { ChecklistItem, MvpCityId, Trip, TripCityLeg } from "./types.js";
import { CITIES, getCity } from "./cities.js";

export const DEFAULT_CHECKLIST_LABELS = [
  "예약번호",
  "여권",
  "WiFi",
  "미팅포인트",
] as const;

export function createDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_LABELS.map((label, i) => ({
    id: `check-${i}-${label}`,
    label,
    checked: false,
  }));
}

export function cityIdForDay(trip: Trip, dayIndex: number): MvpCityId {
  const leg = trip.cities?.find((c) => c.dayIndexes.includes(dayIndex));
  if (leg) return leg.cityId;
  const fromPlace = trip.places.find((p) => p.dayIndex === dayIndex)?.cityId;
  if (fromPlace === "osaka" || fromPlace === "tokyo") return fromPlace;
  return trip.cityId === "osaka" ? "osaka" : "tokyo";
}

export function tripCitiesLabel(trip: Trip): string {
  if (trip.cities && trip.cities.length > 1) {
    return trip.cities.map((c) => c.cityName).join(" · ");
  }
  return trip.cityName;
}

export function buildCityLegs(
  cityIds: MvpCityId[],
  days: number,
): TripCityLeg[] {
  const unique = [...new Set(cityIds)].filter(
    (id): id is MvpCityId => id === "tokyo" || id === "osaka",
  );
  if (unique.length === 0) unique.push("tokyo");
  if (unique.length === 1) {
    return [
      {
        cityId: unique[0],
        cityName: getCity(unique[0]).nameKo,
        dayIndexes: Array.from({ length: days }, (_, i) => i),
      },
    ];
  }
  const split = Math.max(1, Math.ceil(days / unique.length));
  const legs: TripCityLeg[] = [];
  let cursor = 0;
  for (let i = 0; i < unique.length; i++) {
    const id = unique[i];
    const isLast = i === unique.length - 1;
    const count = isLast ? days - cursor : Math.min(split, days - cursor);
    const dayIndexes = Array.from(
      { length: Math.max(0, count) },
      (_, j) => cursor + j,
    );
    cursor += count;
    legs.push({
      cityId: id,
      cityName: CITIES[id].nameKo,
      dayIndexes,
    });
  }
  return legs;
}
