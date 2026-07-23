import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Trip } from "../types";
import { MVP_CITY } from "../types";

const KEY = "@9rutrip/trips";

function normalizeTrip(data: Trip): Trip {
  return {
    ...data,
    aiRerouteEnabled: data.aiRerouteEnabled ?? true,
    guideAlarmsEnabled: data.guideAlarmsEnabled ?? true,
    completedPlaceIds: Array.isArray(data.completedPlaceIds)
      ? data.completedPlaceIds
      : [],
    places: Array.isArray(data.places) ? data.places : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
  };
}

function isValidTrip(data: unknown): data is Trip {
  if (!data || typeof data !== "object") return false;
  const t = data as Trip;
  return (
    typeof t.id === "string" &&
    Array.isArray(t.places) &&
    Array.isArray(t.expenses) &&
    Array.isArray(t.reviews)
  );
}

export async function loadTrips(): Promise<Trip[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      await AsyncStorage.removeItem(KEY);
      return [];
    }
    return parsed.filter(isValidTrip).map(normalizeTrip);
  } catch {
    await AsyncStorage.removeItem(KEY);
    return [];
  }
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(trips));
}

export async function upsertTrip(trip: Trip): Promise<Trip[]> {
  const trips = await loadTrips();
  const idx = trips.findIndex((t) => t.id === trip.id);
  const next = [...trips];
  const normalized = normalizeTrip(trip);
  if (idx >= 0) next[idx] = normalized;
  else next.unshift(normalized);
  await saveTrips(next);
  return next;
}

export async function deleteTrip(id: string): Promise<Trip[]> {
  const trips = (await loadTrips()).filter((t) => t.id !== id);
  await saveTrips(trips);
  return trips;
}

export function createEmptyTrip(input: {
  nights: number;
  days: number;
  partySize: number;
}): Trip {
  const now = new Date().toISOString();
  return {
    id: `trip-${Date.now()}`,
    cityId: MVP_CITY.id,
    cityName: MVP_CITY.nameKo,
    nights: input.nights,
    days: input.days,
    partySize: input.partySize,
    places: [],
    expenses: [],
    reviews: [],
    plannedBudget: 0,
    status: "planning",
    aiRerouteEnabled: true,
    guideAlarmsEnabled: true,
    completedPlaceIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
