import type { ItineraryPlace, TravelDiaryEntry, Trip } from "../types";
import { tripCitiesLabel } from "../types";
import { CATEGORY_LABEL, currencyForCity } from "./cost";

export function tripToDiaryEntry(
  trip: Trip,
  syncStatus: TravelDiaryEntry["syncStatus"] = "local",
): TravelDiaryEntry {
  const completedAt = trip.updatedAt || new Date().toISOString();
  const cities = trip.cities ?? [];
  const cityIds = cities.length ? cities.map((city) => city.cityId) : [trip.cityId];
  const cityNames = cities.length
    ? cities.map((city) => city.cityName)
    : [trip.cityName];

  return {
    id: `diary-${trip.id}`,
    tripId: trip.id,
    title: tripCitiesLabel(trip),
    cityIds,
    cityNames,
    cityId: trip.cityId,
    ...(trip.startDate ? { startDate: trip.startDate } : {}),
    ...(trip.endDate ? { endDate: trip.endDate } : {}),
    nights: trip.nights,
    days: trip.days,
    completedAt,
    partySize: trip.partySize,
    ...(trip.plannedBudget > 0
      ? { plannedBudget: trip.plannedBudget, currency: currencyForCity(trip.cityId) }
      : {}),
    coverPlaceName: trip.places[0]?.name,
    placeCount: trip.places.length,
    places: trip.places,
    ...(cities.length ? { cities } : {}),
    origin: trip.origin ?? null,
    endPoint: trip.endPoint ?? null,
    ...(trip.briefing ? { briefing: trip.briefing } : {}),
    ...(trip.routeOutline ? { routeOutline: trip.routeOutline } : {}),
    updatedAt: completedAt,
    syncStatus,
  };
}

/** 오래된 다이어리(장소 미저장)는 로컬 Trip으로 보강 */
export function enrichDiaryEntry(
  entry: TravelDiaryEntry,
  trips: Trip[],
): TravelDiaryEntry {
  if (entry.places && entry.places.length > 0 && entry.briefing) return entry;
  const trip = trips.find((t) => t.id === entry.tripId);
  if (!trip) return entry;
  const fromTrip = tripToDiaryEntry(trip, entry.syncStatus ?? "local");
  return {
    ...fromTrip,
    ...entry,
    places: entry.places?.length ? entry.places : fromTrip.places,
    briefing: entry.briefing || fromTrip.briefing,
    routeOutline: entry.routeOutline || fromTrip.routeOutline,
    cities: entry.cities?.length ? entry.cities : fromTrip.cities,
    origin: entry.origin ?? fromTrip.origin,
    endPoint: entry.endPoint ?? fromTrip.endPoint,
    cityId: entry.cityId || fromTrip.cityId,
  };
}

export type DiaryRouteLegSummary = {
  dayIndex: number;
  placeId: string;
  orderLabel: string;
  placeName: string;
  summary: string;
};

/** 장소·이동시간·메모로 Day별 경로 요약 생성 */
export function buildDiaryRouteSummaries(
  places: ItineraryPlace[],
): DiaryRouteLegSummary[] {
  const sorted = [...places].sort(
    (a, b) => a.dayIndex - b.dayIndex || a.order - b.order,
  );
  return sorted.map((place, index) => {
    const bits: string[] = [];
    const category =
      CATEGORY_LABEL[place.category] ?? place.category ?? "장소";
    bits.push(category);
    if (place.plannedTime) bits.push(`${place.plannedTime} 예정`);
    if (
      Number.isFinite(place.travelFromPrevMinutes) &&
      (place.travelFromPrevMinutes ?? 0) > 0
    ) {
      bits.push(`이전에서 약 ${place.travelFromPrevMinutes}분`);
    }
    if (place.notes?.trim()) bits.push(place.notes.trim());
    else if (place.aiReason?.trim()) bits.push(place.aiReason.trim());
    else if (place.reviewSummary?.trim()) bits.push(place.reviewSummary.trim());
    else if (place.signatureFood?.trim()) {
      bits.push(`시그니처 ${place.signatureFood.trim()}`);
    }

    return {
      dayIndex: place.dayIndex,
      placeId: place.id,
      orderLabel: `${index + 1}`,
      placeName: place.name,
      summary: bits.join(" · "),
    };
  });
}

export function groupDiaryByYear(entries: TravelDiaryEntry[]) {
  return entries.reduce<Record<string, TravelDiaryEntry[]>>((groups, entry) => {
    const year = (entry.startDate || entry.completedAt || "기타").slice(0, 4);
    (groups[year] ??= []).push(entry);
    return groups;
  }, {});
}
