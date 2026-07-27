import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function asStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
}

function snapshotPlaces(places) {
  if (!Array.isArray(places)) return [];
  return places
    .filter((place) => place && typeof place === "object")
    .map((place) => ({
      id: String(place.id || ""),
      name: String(place.name || ""),
      category: place.category || "other",
      lat: Number(place.lat) || 0,
      lng: Number(place.lng) || 0,
      estimatedCost: Number(place.estimatedCost) || 0,
      dayIndex: Number(place.dayIndex) || 0,
      order: Number(place.order) || 0,
      ...(place.cityId ? { cityId: String(place.cityId) } : {}),
      ...(typeof place.plannedTime === "string"
        ? { plannedTime: place.plannedTime }
        : {}),
      ...(Number.isFinite(Number(place.travelFromPrevMinutes))
        ? { travelFromPrevMinutes: Number(place.travelFromPrevMinutes) }
        : {}),
      ...(Number.isFinite(Number(place.travelFromPrevCost))
        ? { travelFromPrevCost: Number(place.travelFromPrevCost) }
        : {}),
      ...(typeof place.notes === "string" && place.notes.trim()
        ? { notes: place.notes.trim() }
        : {}),
      ...(typeof place.aiReason === "string" && place.aiReason.trim()
        ? { aiReason: place.aiReason.trim() }
        : {}),
      ...(typeof place.reviewSummary === "string" && place.reviewSummary.trim()
        ? { reviewSummary: place.reviewSummary.trim() }
        : {}),
      ...(typeof place.signatureFood === "string" && place.signatureFood.trim()
        ? { signatureFood: place.signatureFood.trim() }
        : {}),
    }))
    .filter((place) => place.id && place.name);
}

function snapshotPlaceRef(ref) {
  if (!ref || typeof ref !== "object" || !ref.name) return null;
  return {
    name: String(ref.name),
    ...(typeof ref.address === "string" ? { address: ref.address } : {}),
    ...(Number.isFinite(Number(ref.lat)) ? { lat: Number(ref.lat) } : {}),
    ...(Number.isFinite(Number(ref.lng)) ? { lng: Number(ref.lng) } : {}),
  };
}

export function entryFromTrip(trip) {
  if (!trip?.id || trip.status !== "done") {
    throw new Error("완료된 여행(trip.id, status=done)이 필요합니다.");
  }
  const cities = Array.isArray(trip.cities) ? trip.cities : [];
  const cityIds = asStringArray(cities.map((city) => city?.cityId));
  const cityNames = asStringArray(cities.map((city) => city?.cityName));
  const resolvedCityIds = cityIds.length ? cityIds : asStringArray([trip.cityId]);
  const resolvedCityNames = cityNames.length
    ? cityNames
    : asStringArray([trip.cityName]);
  const completedAt = trip.updatedAt || new Date().toISOString();
  const currency =
    trip.cityId === "tokyo" || trip.cityId === "osaka" ? "JPY" : "KRW";
  const places = snapshotPlaces(trip.places);
  const briefing =
    typeof trip.briefing === "string" && trip.briefing.trim()
      ? trip.briefing.trim()
      : undefined;
  const routeOutline =
    typeof trip.routeOutline === "string" && trip.routeOutline.trim()
      ? trip.routeOutline.trim()
      : undefined;

  return {
    id: `diary-${trip.id}`,
    tripId: trip.id,
    title: resolvedCityNames.join(" · ") || "여행",
    cityIds: resolvedCityIds,
    cityNames: resolvedCityNames,
    ...(trip.cityId ? { cityId: String(trip.cityId) } : {}),
    ...(typeof trip.startDate === "string" ? { startDate: trip.startDate } : {}),
    ...(typeof trip.endDate === "string" ? { endDate: trip.endDate } : {}),
    nights: Number(trip.nights) || 0,
    days: Number(trip.days) || 1,
    completedAt,
    partySize: Number(trip.partySize) || 1,
    ...(Number(trip.plannedBudget) > 0
      ? { plannedBudget: Number(trip.plannedBudget), currency }
      : {}),
    coverPlaceName: places[0]?.name || trip.places?.[0]?.name,
    placeCount: places.length || (Array.isArray(trip.places) ? trip.places.length : 0),
    places,
    ...(cities.length
      ? {
          cities: cities
            .filter((city) => city?.cityId)
            .map((city) => ({
              cityId: String(city.cityId),
              cityName: String(city.cityName || city.cityId),
              dayIndexes: Array.isArray(city.dayIndexes)
                ? city.dayIndexes.map(Number).filter(Number.isFinite)
                : [],
            })),
        }
      : {}),
    origin: snapshotPlaceRef(trip.origin),
    endPoint: snapshotPlaceRef(trip.endPoint),
    ...(briefing ? { briefing } : {}),
    ...(routeOutline ? { routeOutline } : {}),
    updatedAt: completedAt,
    syncStatus: "synced",
  };
}

export function createDiaryStore(filePath) {
  async function load() {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw new Error("다이어리 저장 파일을 읽을 수 없습니다.");
    }
  }

  async function save(entries) {
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  }

  return {
    async list(year) {
      const entries = await load();
      const normalizedYear = /^\d{4}$/.test(String(year ?? ""))
        ? String(year)
        : null;
      return entries
        .filter(
          (entry) =>
            !normalizedYear ||
            String(entry.startDate || entry.completedAt || "").startsWith(
              normalizedYear,
            ),
        )
        .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    },
    async upsertFromTrip(trip) {
      const entry = entryFromTrip(trip);
      const entries = await load();
      const index = entries.findIndex((item) => item.tripId === entry.tripId);
      if (index >= 0) {
        entries[index] = { ...entries[index], ...entry, updatedAt: new Date().toISOString() };
      } else {
        entries.push(entry);
      }
      await save(entries);
      return index >= 0 ? entries[index] : entry;
    },
    async update(id, patch) {
      const allowed = ["notes", "coverPlaceName"];
      const entries = await load();
      const index = entries.findIndex((entry) => entry.id === id);
      if (index < 0) return null;
      for (const key of allowed) {
        if (typeof patch?.[key] === "string") entries[index][key] = patch[key].trim();
      }
      entries[index].updatedAt = new Date().toISOString();
      entries[index].syncStatus = "synced";
      await save(entries);
      return entries[index];
    },
    async remove(id) {
      const entries = await load();
      const next = entries.filter((entry) => entry.id !== id);
      if (next.length === entries.length) return false;
      await save(next);
      return true;
    },
  };
}
