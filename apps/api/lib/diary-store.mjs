import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function asStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
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

  return {
    id: `diary-${trip.id}`,
    tripId: trip.id,
    title: resolvedCityNames.join(" · ") || "여행",
    cityIds: resolvedCityIds,
    cityNames: resolvedCityNames,
    ...(typeof trip.startDate === "string" ? { startDate: trip.startDate } : {}),
    ...(typeof trip.endDate === "string" ? { endDate: trip.endDate } : {}),
    nights: Number(trip.nights) || 0,
    days: Number(trip.days) || 1,
    completedAt,
    partySize: Number(trip.partySize) || 1,
    ...(Number(trip.plannedBudget) > 0
      ? { plannedBudget: Number(trip.plannedBudget), currency }
      : {}),
    coverPlaceName: trip.places?.[0]?.name,
    placeCount: Array.isArray(trip.places) ? trip.places.length : 0,
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
  };
}
