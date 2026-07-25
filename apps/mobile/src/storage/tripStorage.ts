import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Trip } from "../types";
import {
  buildCityLegs,
  DEFAULT_LODGING_RETURN_TIME,
  DEFAULT_START_TIME,
  getCityMeta,
  MVP_CITY,
} from "../types";
import { isKnownCityId } from "../data/destinations";

const KEY = "@9rutrip/trips";

function normalizeHhmm(
  raw: string | undefined,
  fallback: string,
): string {
  const m = String(raw ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function normalizeTrip(data: Trip): Trip {
  const cityId = isKnownCityId(data.cityId) ? data.cityId : "seoul";
  const cities =
    Array.isArray(data.cities) && data.cities.length > 0
      ? data.cities.map((c) => {
          const cid = isKnownCityId(c.cityId) ? c.cityId : "seoul";
          return {
            cityId: cid,
            cityName: c.cityName || getCityMeta(cid).nameKo,
            dayIndexes: Array.isArray(c.dayIndexes) ? c.dayIndexes : [],
          };
        })
      : buildCityLegs(
          [cityId],
          Math.max(1, data.days || 1),
          data.cityWeights,
        );

  return {
    ...data,
    cityId,
    cityName: data.cityName || getCityMeta(cityId).nameKo,
    cities,
    origin: data.origin ?? null,
    endPoint: data.endPoint ?? null,
    stopoverCityIds: Array.isArray(data.stopoverCityIds)
      ? data.stopoverCityIds.filter(isKnownCityId)
      : [],
    cityWeights: Array.isArray(data.cityWeights) ? data.cityWeights : undefined,
    preferences: data.preferences,
    mainRequest: data.mainRequest,
    extraRequest: data.extraRequest,
    briefing: data.briefing,
    routeOutline: data.routeOutline,
    startTime: normalizeHhmm(data.startTime, DEFAULT_START_TIME),
    outboundTransportMode: (["car", "train", "bus", "flight"] as const).includes(
      data.outboundTransportMode as "car",
    )
      ? data.outboundTransportMode
      : "car",
    lodgingReturnTime: normalizeHhmm(
      data.lodgingReturnTime,
      DEFAULT_LODGING_RETURN_TIME,
    ),
    aiRerouteEnabled: data.aiRerouteEnabled ?? true,
    guideAlarmsEnabled: data.guideAlarmsEnabled ?? true,
    completedPlaceIds: Array.isArray(data.completedPlaceIds)
      ? data.completedPlaceIds
      : [],
    places: Array.isArray(data.places)
      ? data.places.map((p) => ({
          ...p,
          cityId: isKnownCityId(p.cityId) ? p.cityId : undefined,
        }))
      : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    lodgingCandidates: Array.isArray(data.lodgingCandidates)
      ? data.lodgingCandidates
      : [],
    preferredLodgingId: data.preferredLodgingId ?? null,
    mapProvider: data.mapProvider ?? getCityMeta(cityId).mapProvider,
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
  startDate?: string;
  endDate?: string;
  partySize: number;
  origin?: import("../types").PlaceRef | null;
  endPoint?: import("../types").PlaceRef | null;
  stopoverCityIds?: import("../types").MvpCityId[];
  cityWeights?: number[];
  preferences?: import("../types").TripPreferenceWeights;
  mainRequest?: string;
  extraRequest?: string;
  briefing?: string;
  routeOutline?: string;
  startAddress?: string;
  startLat?: number;
  startLng?: number;
  startTime?: string;
  outboundTransportMode?: import("../types").OutboundTransportMode;
  userRequest?: string;
}): Trip {
  const now = new Date().toISOString();
  const cityIds =
    input.cityIds && input.cityIds.length > 0
      ? input.cityIds.filter(isKnownCityId)
      : [isKnownCityId(input.cityId) ? input.cityId! : "seoul"];
  const primary = cityIds[0] ?? "seoul";
  const city = getCityMeta(primary);
  const cities = buildCityLegs(cityIds, input.days, input.cityWeights);
  const label =
    cities.length > 1
      ? cities.map((c) => c.cityName).join(" · ")
      : city.nameKo;
  return {
    id: `trip-${Date.now()}`,
    cityId: primary,
    cityName: label,
    cities,
    origin: input.origin ?? null,
    endPoint: input.endPoint ?? null,
    stopoverCityIds: (input.stopoverCityIds ?? []).filter(isKnownCityId),
    cityWeights: input.cityWeights,
    preferences: input.preferences,
    mainRequest: input.mainRequest,
    extraRequest: input.extraRequest,
    briefing: input.briefing,
    routeOutline: input.routeOutline,
    nights: input.nights,
    days: input.days,
    startDate: input.startDate,
    endDate: input.endDate,
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
    startAddress: input.startAddress,
    startLat: input.startLat,
    startLng: input.startLng,
    startTime: normalizeHhmm(input.startTime, DEFAULT_START_TIME),
    outboundTransportMode: (["car", "train", "bus", "flight"] as const).includes(
      input.outboundTransportMode as "car",
    )
      ? input.outboundTransportMode
      : "car",
    lodgingReturnTime: DEFAULT_LODGING_RETURN_TIME,
    userRequest: input.userRequest,
    createdAt: now,
    updatedAt: now,
  };
}

void MVP_CITY;
