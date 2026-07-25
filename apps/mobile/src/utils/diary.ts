import type { TravelDiaryEntry, Trip } from "../types";
import { tripCitiesLabel } from "../types";
import { currencyForCity } from "./cost";

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
    updatedAt: completedAt,
    syncStatus,
  };
}

export function groupDiaryByYear(entries: TravelDiaryEntry[]) {
  return entries.reduce<Record<string, TravelDiaryEntry[]>>((groups, entry) => {
    const year = (entry.startDate || entry.completedAt || "기타").slice(0, 4);
    (groups[year] ??= []).push(entry);
    return groups;
  }, {});
}
