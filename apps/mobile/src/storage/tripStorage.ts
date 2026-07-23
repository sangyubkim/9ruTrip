import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Trip } from "../types";
import {
  buildCityLegs,
  createDefaultChecklist,
  getCityMeta,
  MVP_CITY,
} from "../types";

const KEY = "@9rutrip/trips";

function normalizeTrip(data: Trip): Trip {
  const cityId = data.cityId === "osaka" ? "osaka" : "tokyo";
  const cities =
    Array.isArray(data.cities) && data.cities.length > 0
      ? data.cities.map((c) => ({
          cityId: (c.cityId === "osaka" ? "osaka" : "tokyo") as
            | "tokyo"
            | "osaka",
          cityName:
            c.cityName ||
            getCityMeta(c.cityId === "osaka" ? "osaka" : "tokyo").nameKo,
          dayIndexes: Array.isArray(c.dayIndexes) ? c.dayIndexes : [],
        }))
      : buildCityLegs([cityId], Math.max(1, data.days || 1));

  return {
    ...data,
    cityId,
    cityName: data.cityName || getCityMeta(cityId).nameKo,
    cities,
    aiRerouteEnabled: data.aiRerouteEnabled ?? true,
    guideAlarmsEnabled: data.guideAlarmsEnabled ?? true,
    completedPlaceIds: Array.isArray(data.completedPlaceIds)
      ? data.completedPlaceIds
      : [],
    places: Array.isArray(data.places)
      ? data.places.map((p) => ({
          ...p,
          cityId:
            p.cityId === "osaka" || p.cityId === "tokyo"
              ? p.cityId
              : undefined,
        }))
      : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    lodgingCandidates: Array.isArray(data.lodgingCandidates)
      ? data.lodgingCandidates
      : [],
    preferredLodgingId: data.preferredLodgingId ?? null,
    mapProvider: data.mapProvider ?? "google",
    checklist:
      Array.isArray(data.checklist) && data.checklist.length > 0
        ? data.checklist.map((c) => ({
            id: String(c.id),
            label: String(c.label || ""),
            checked: Boolean(c.checked),
          }))
        : createDefaultChecklist(),
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

/** 로컬 복제 — 새 id, planning 상태, 완료/리뷰/경비 초기화(일정·숙소 후보는 유지) */
export async function duplicateTrip(source: Trip): Promise<Trip[]> {
  const now = new Date().toISOString();
  const copy: Trip = {
    ...normalizeTrip(source),
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "planning",
    completedPlaceIds: [],
    expenses: [],
    reviews: [],
    checklist: createDefaultChecklist(),
    createdAt: now,
    updatedAt: now,
  };
  return upsertTrip(copy);
}

export function createEmptyTrip(input: {
  cityId?: import("../types").MvpCityId;
  cityIds?: import("../types").MvpCityId[];
  nights: number;
  days: number;
  partySize: number;
}): Trip {
  const now = new Date().toISOString();
  const cityIds =
    input.cityIds && input.cityIds.length > 0
      ? input.cityIds
      : [input.cityId === "osaka" ? ("osaka" as const) : ("tokyo" as const)];
  const primary = cityIds[0] === "osaka" ? "osaka" : "tokyo";
  const city = getCityMeta(primary);
  const cities = buildCityLegs(cityIds, input.days);
  const label =
    cities.length > 1
      ? cities.map((c) => c.cityName).join(" · ")
      : city.nameKo;
  return {
    id: `trip-${Date.now()}`,
    cityId: primary,
    cityName: label,
    cities,
    nights: input.nights,
    days: input.days,
    partySize: input.partySize,
    places: [],
    expenses: [],
    reviews: [],
    lodgingCandidates: [],
    preferredLodgingId: null,
    mapProvider: city.mapProvider,
    plannedBudget: 0,
    status: "planning",
    aiRerouteEnabled: true,
    guideAlarmsEnabled: true,
    completedPlaceIds: [],
    checklist: createDefaultChecklist(),
    createdAt: now,
    updatedAt: now,
  };
}

// keep MVP_CITY referenced for tree-shake-friendly import side-effect none
void MVP_CITY;
