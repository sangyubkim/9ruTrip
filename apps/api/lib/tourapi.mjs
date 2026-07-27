import { isKnownCityId, resolveCity } from "./cities.mjs";
import { lodgingScoreBreakdown } from "./transport.mjs";

const LOCATION_BASED_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";
const SEARCH_STAY_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/searchStay2";
const TOUR_API_TIMEOUT_MS = 10_000;
const TOUR_API_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_RADIUS_M = 20_000;
const tourCache = new Map();

export const TOUR_CONTENT_TYPE = {
  attraction: "12",
  food: "39",
  hotel: "32",
};

function decodedServiceKey(serviceKey) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function tourApiItems(data) {
  const items = data?.response?.body?.items?.item;
  return Array.isArray(items) ? items : items ? [items] : [];
}

function cacheGet(key) {
  const hit = tourCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    tourCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  tourCache.set(key, {
    value,
    expiresAt: Date.now() + TOUR_API_CACHE_TTL_MS,
  });
}

export function clearTourApiCache() {
  tourCache.clear();
}

async function tourApiGet(endpoint, params, serviceKey) {
  const search = new URLSearchParams({
    serviceKey: decodedServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "9ruTrip",
    _type: "json",
    ...params,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOUR_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${endpoint}?${search}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`TourAPI ${response.status}`);
    const data = await response.json();
    const header = data?.response?.header;
    if (header?.resultCode && header.resultCode !== "0000") {
      throw new Error(`TourAPI ${header.resultCode}: ${header.resultMsg || ""}`);
    }
    return tourApiItems(data);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTourPlace(item, category) {
  const contentId = String(item?.contentid || "").trim();
  const name = String(item?.title || "").trim();
  const lat = Number(item?.mapy);
  const lng = Number(item?.mapx);
  if (
    !contentId ||
    !name ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return {
    id: `tour-${contentId}`,
    contentId,
    name: name.slice(0, 80),
    category,
    lat,
    lng,
    notes: String(item?.addr1 || "").trim().slice(0, 120) || undefined,
    address: String(item?.addr1 || "").trim().slice(0, 120) || undefined,
  };
}

function isDomesticCityId(cityId) {
  if (!isKnownCityId(cityId)) return false;
  const city = resolveCity(cityId);
  return city.region === "domestic" || city.countryId === "kr";
}

/**
 * 도시 중심 기준 위치기반 목록 (관광 12 / 음식 39 / 숙박 32)
 */
export async function fetchTourPlacesNearCity({
  cityId,
  category,
  serviceKey,
  numOfRows = 20,
  radius = DEFAULT_RADIUS_M,
} = {}) {
  const key = String(serviceKey || "").trim();
  const typeId = TOUR_CONTENT_TYPE[category];
  if (!key || !typeId || !isDomesticCityId(cityId)) return [];

  const city = resolveCity(cityId);
  const cacheKey = `near|${cityId}|${category}|${numOfRows}|${radius}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const items = await tourApiGet(
    LOCATION_BASED_ENDPOINT,
    {
      mapX: String(city.center.lng),
      mapY: String(city.center.lat),
      radius: String(radius),
      contentTypeId: typeId,
      arrange: "E",
      numOfRows: String(numOfRows),
      pageNo: "1",
    },
    key,
  );

  const places = items
    .map((item) => normalizeTourPlace(item, category))
    .filter(Boolean)
    .map((place) => ({ ...place, cityId }));

  if (places.length) cacheSet(cacheKey, places);
  return places;
}

/**
 * 숙박 전용 API (searchStay2) — 실패 시 locationBasedList2(32)로 폴백
 */
export async function fetchTourStaysNearCity({
  cityId,
  serviceKey,
  numOfRows = 15,
} = {}) {
  const key = String(serviceKey || "").trim();
  if (!key || !isDomesticCityId(cityId)) return [];

  const city = resolveCity(cityId);
  const cacheKey = `stay|${cityId}|${numOfRows}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let items = [];
  try {
    items = await tourApiGet(
      SEARCH_STAY_ENDPOINT,
      {
        mapX: String(city.center.lng),
        mapY: String(city.center.lat),
        radius: String(DEFAULT_RADIUS_M),
        arrange: "E",
        numOfRows: String(numOfRows),
        pageNo: "1",
      },
      key,
    );
  } catch {
    items = [];
  }

  let places = items
    .map((item) => normalizeTourPlace(item, "hotel"))
    .filter(Boolean)
    .map((place) => ({ ...place, cityId }));

  if (!places.length) {
    places = await fetchTourPlacesNearCity({
      cityId,
      category: "hotel",
      serviceKey: key,
      numOfRows,
    });
  }

  if (places.length) cacheSet(cacheKey, places);
  return places;
}

export async function fetchTourPlacePool({
  cityIds,
  serviceKey,
  perCategory = 12,
} = {}) {
  const ids = [...new Set((cityIds || []).filter(isDomesticCityId))];
  const empty = { attraction: [], food: [], hotel: [] };
  if (!String(serviceKey || "").trim() || !ids.length) return empty;

  const attraction = [];
  const food = [];
  const hotel = [];

  await Promise.all(
    ids.map(async (cityId) => {
      const [a, f, h] = await Promise.all([
        fetchTourPlacesNearCity({
          cityId,
          category: "attraction",
          serviceKey,
          numOfRows: perCategory,
        }).catch(() => []),
        fetchTourPlacesNearCity({
          cityId,
          category: "food",
          serviceKey,
          numOfRows: perCategory,
        }).catch(() => []),
        fetchTourStaysNearCity({
          cityId,
          serviceKey,
          numOfRows: Math.max(5, Math.floor(perCategory / 2)),
        }).catch(() => []),
      ]);
      attraction.push(...a);
      food.push(...f);
      hotel.push(...h);
    }),
  );

  return { attraction, food, hotel };
}

export function formatTourPoolForPrompt(pool, { maxPerCategory = 10 } = {}) {
  const lines = [];
  const sections = [
    ["attraction", "실존 관광지(TourAPI)"],
    ["food", "실존 맛집(TourAPI)"],
    ["hotel", "실존 숙소(TourAPI)"],
  ];
  for (const [key, label] of sections) {
    const list = (pool?.[key] || []).slice(0, maxPerCategory);
    if (!list.length) continue;
    lines.push(`${label}:`);
    for (const place of list) {
      lines.push(
        `- [${place.cityId}] ${place.name} (${place.lat}, ${place.lng}) id=${place.id}`,
      );
    }
  }
  if (!lines.length) return "";
  return [
    "아래 TourAPI 실존 장소 목록에서 우선 선택하세요. 목록에 없는 이름은 만들지 마세요.",
    "좌표는 목록 값을 그대로 사용하세요.",
    ...lines,
  ].join("\n");
}

export function tourPlacesToSuggestItems(places, { partySize = 2 } = {}) {
  const party = Math.max(1, Number(partySize) || 1);
  return (places || []).map((place, index) => {
    const base =
      place.category === "hotel"
        ? 120000
        : place.category === "food"
          ? 15000
          : 0;
    return {
      id: place.id || `tour-suggest-${index}`,
      name: place.name,
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      estimatedCost: place.category === "hotel" ? base : base,
      notes: place.notes || place.address,
      cityId: place.cityId,
      dayIndex: 0,
      order: index,
      reviewSummary: "한국관광공사 TourAPI",
      pricePerPerson:
        place.category === "hotel" ? Math.round(base / party) : undefined,
    };
  });
}

export function tourStaysToLodgingCandidates(
  stays,
  { nights = 2, partySize = 2, topN = 5, cityId = "seoul" } = {},
) {
  const party = Math.max(1, Number(partySize) || 1);
  const n = Math.max(1, Number(nights) || 1);
  const partyFactor = 1 + Math.max(0, party - 2) * 0.15;
  const scored = (stays || []).map((stay, i) => {
    const basePerNight = 120000;
    const estimatedCost = Math.round(basePerNight * n * partyFactor);
    const pricePerPerson = Math.round((basePerNight * partyFactor) / party);
    const place = {
      id: stay.id || `tour-lodging-${i + 1}`,
      name: stay.name,
      category: "hotel",
      lat: stay.lat,
      lng: stay.lng,
      estimatedCost,
      notes: stay.notes || `${n}박 · TourAPI 숙소`,
      dayIndex: 0,
      order: 0,
      cityId: stay.cityId || cityId,
      pricePerPerson,
      reviewSummary: "한국관광공사 TourAPI",
    };
    const { lodgingScore, scoreBreakdown } = lodgingScoreBreakdown(place, {
      nights: n,
      cityId: place.cityId,
    });
    return { ...place, lodgingScore, scoreBreakdown };
  });
  scored.sort((a, b) => b.lodgingScore - a.lodgingScore);
  return scored.slice(0, topN);
}

export async function suggestViaTourApi({
  cityId,
  category,
  partySize = 2,
  serviceKey,
  limit = 12,
} = {}) {
  if (!isDomesticCityId(cityId) || !String(serviceKey || "").trim()) return [];
  if (category === "hotel") {
    const stays = await fetchTourStaysNearCity({
      cityId,
      serviceKey,
      numOfRows: limit,
    });
    return tourPlacesToSuggestItems(stays.slice(0, limit), { partySize });
  }
  if (category !== "attraction" && category !== "food" && category) {
    return [];
  }
  const places = await fetchTourPlacesNearCity({
    cityId,
    category: category || "attraction",
    serviceKey,
    numOfRows: limit,
  });
  return tourPlacesToSuggestItems(places.slice(0, limit), { partySize });
}
