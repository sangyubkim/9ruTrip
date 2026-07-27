import { isKnownCityId, resolveCity } from "./cities.mjs";
import { lodgingScoreBreakdown } from "./transport.mjs";

const LOCATION_BASED_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";
const SEARCH_STAY_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/searchStay2";
const DETAIL_COMMON_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/detailCommon2";
const DETAIL_INTRO_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/detailIntro2";
const TOUR_API_TIMEOUT_MS = 10_000;
const TOUR_API_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_RADIUS_M = 20_000;
const DETAIL_CONCURRENCY = 4;
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

/** TourAPI HTML/공백 정리 */
export function cleanTourText(value, maxLen = 160) {
  const s = String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return undefined;
  return s.slice(0, maxLen);
}

/**
 * detailIntro2 + detailCommon2 → 앱 장소 상세 필드.
 * 숙소 가격 필드는 TourAPI에 없으므로 넣지 않음(가짜 1박가 금지).
 */
export function parseTourDetailFields(category, intro = {}, common = {}) {
  const addr = cleanTourText(
    [common.addr1, common.addr2].filter(Boolean).join(" "),
    160,
  );
  const commonTel = cleanTourText(common.tel, 40);

  if (category === "food") {
    const first = cleanTourText(intro.firstmenu, 80);
    const treat = cleanTourText(intro.treatmenu, 120);
    const officialMenu =
      [first, treat].filter(Boolean).join(" · ") || undefined;
    return {
      address: addr,
      phone: cleanTourText(intro.infocenterfood, 40) || commonTel,
      openingHours: cleanTourText(intro.opentimefood, 160),
      restDate: cleanTourText(intro.restdatefood, 80),
      officialMenu,
      ...(first ? { signatureFood: first } : {}),
    };
  }

  if (category === "attraction") {
    return {
      address: addr,
      phone: cleanTourText(intro.infocenter, 60) || commonTel,
      openingHours: cleanTourText(intro.usetime, 160),
      restDate: cleanTourText(intro.restdate, 80),
      admissionFee: cleanTourText(intro.usefee, 120),
    };
  }

  if (category === "hotel") {
    const reservationUrlRaw = cleanTourText(intro.reservationurl, 200);
    const reservationLodging = cleanTourText(intro.reservationlodging, 120);
    const reservationUrl =
      reservationUrlRaw && /^https?:\/\//i.test(reservationUrlRaw)
        ? reservationUrlRaw
        : undefined;
    const reservationInfo =
      reservationLodging ||
      (reservationUrlRaw && !reservationUrl ? reservationUrlRaw : undefined);
    return {
      address: addr,
      phone: cleanTourText(intro.infocenterlodging, 40) || commonTel,
      checkInTime: cleanTourText(intro.checkintime, 40),
      checkOutTime: cleanTourText(intro.checkouttime, 40),
      ...(reservationUrl ? { reservationUrl } : {}),
      ...(reservationInfo ? { reservationInfo } : {}),
    };
  }

  return {
    address: addr,
    phone: commonTel,
  };
}

function pickDefined(details) {
  const out = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

export async function fetchTourPlaceDetails({
  contentId,
  category,
  serviceKey,
} = {}) {
  const key = String(serviceKey || "").trim();
  const id = String(contentId || "").trim();
  const typeId = TOUR_CONTENT_TYPE[category];
  if (!key || !id || !typeId) return {};

  const cacheKey = `detail|${id}|${category}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const [commonItems, introItems] = await Promise.all([
    // TourAPI 4.3: detailCommon2 YN 파라미터 제거 — 넣으면 빈 응답
    tourApiGet(
      DETAIL_COMMON_ENDPOINT,
      {
        contentId: id,
      },
      key,
    ).catch(() => []),
    tourApiGet(
      DETAIL_INTRO_ENDPOINT,
      {
        contentId: id,
        contentTypeId: typeId,
      },
      key,
    ).catch(() => []),
  ]);

  const details = pickDefined(
    parseTourDetailFields(
      category,
      introItems[0] || {},
      commonItems[0] || {},
    ),
  );
  cacheSet(cacheKey, details);
  return details;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const limit = Math.max(1, Math.min(concurrency, list.length));
  const results = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/** contentId/place id 기준 상세 보강 (동시성 제한 + 캐시) */
export async function enrichTourPlacesWithDetails(
  places,
  serviceKey,
  { concurrency = DETAIL_CONCURRENCY } = {},
) {
  const key = String(serviceKey || "").trim();
  if (!key || !Array.isArray(places) || !places.length) return places || [];

  return mapWithConcurrency(places, concurrency, async (place) => {
    if (!place) return place;
    const contentId =
      String(place.contentId || "").trim() ||
      (String(place.id || "").startsWith("tour-")
        ? String(place.id).slice("tour-".length)
        : "");
    const category = place.category;
    if (!contentId || !TOUR_CONTENT_TYPE[category]) return place;
    try {
      const details = await fetchTourPlaceDetails({
        contentId,
        category,
        serviceKey: key,
      });
      if (!Object.keys(details).length) return place;
      const next = { ...place, ...details };
      if (
        category === "food" &&
        details.officialMenu &&
        !place.signatureFood
      ) {
        next.signatureFood =
          details.signatureFood || details.officialMenu.split(" · ")[0];
      }
      if (category === "hotel") {
        // TourAPI는 숙박 요금 없음 — 가짜/기본 1박가 유지 금지
        next.estimatedCost = 0;
        delete next.pricePerPerson;
      }
      return next;
    } catch {
      return place;
    }
  });
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
  lat,
  lng,
} = {}) {
  const key = String(serviceKey || "").trim();
  const typeId = TOUR_CONTENT_TYPE[category];
  if (!key || !typeId || !isDomesticCityId(cityId)) return [];

  const city = resolveCity(cityId);
  const mapY =
    Number.isFinite(Number(lat)) ? Number(lat) : city.center.lat;
  const mapX =
    Number.isFinite(Number(lng)) ? Number(lng) : city.center.lng;
  const cacheKey = `near|${cityId}|${category}|${numOfRows}|${radius}|${mapY.toFixed(4)},${mapX.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const items = await tourApiGet(
    LOCATION_BASED_ENDPOINT,
    {
      mapX: String(mapX),
      mapY: String(mapY),
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
  lat,
  lng,
} = {}) {
  const key = String(serviceKey || "").trim();
  if (!key || !isDomesticCityId(cityId)) return [];

  const city = resolveCity(cityId);
  const mapY =
    Number.isFinite(Number(lat)) ? Number(lat) : city.center.lat;
  const mapX =
    Number.isFinite(Number(lng)) ? Number(lng) : city.center.lng;
  const cacheKey = `stay|${cityId}|${numOfRows}|${mapY.toFixed(4)},${mapX.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let items = [];
  try {
    items = await tourApiGet(
      SEARCH_STAY_ENDPOINT,
      {
        mapX: String(mapX),
        mapY: String(mapY),
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
      lat: mapY,
      lng: mapX,
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
    "영업시간·입장료·숙소 1박 가격을 추측해 넣지 마세요. 모르면 estimatedCost는 0.",
    ...lines,
  ].join("\n");
}

export function tourPlacesToSuggestItems(places, { partySize = 2 } = {}) {
  void partySize;
  return (places || []).map((place, index) => {
    const isHotel = place.category === "hotel";
    const isFood = place.category === "food";
    // 숙소: 가격 출처 없으면 0 (120000 등 기본가 금지)
    // 맛집: 메뉴 보강 전 임시 단가 / 관광: 무료·미상은 0
    const estimatedCost = isHotel
      ? 0
      : Number(place.estimatedCost) > 0
        ? Number(place.estimatedCost)
        : isFood
          ? 15000
          : 0;
    return {
      id: place.id || `tour-suggest-${index}`,
      name: place.name,
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      estimatedCost,
      notes: place.notes || place.address,
      cityId: place.cityId,
      dayIndex: 0,
      order: index,
      reviewSummary: "한국관광공사 TourAPI",
      contentId: place.contentId,
      address: place.address,
      phone: place.phone,
      openingHours: place.openingHours,
      restDate: place.restDate,
      officialMenu: place.officialMenu,
      signatureFood: place.signatureFood,
      admissionFee: place.admissionFee,
      checkInTime: place.checkInTime,
      checkOutTime: place.checkOutTime,
      reservationUrl: place.reservationUrl,
      reservationInfo: place.reservationInfo,
      ...(Number(place.pricePerPerson) > 0 && !isHotel
        ? { pricePerPerson: Number(place.pricePerPerson) }
        : {}),
    };
  });
}

export function tourStaysToLodgingCandidates(
  stays,
  { nights = 2, partySize = 2, topN = 5, cityId = "seoul" } = {},
) {
  void partySize;
  const n = Math.max(1, Number(nights) || 1);
  const scored = (stays || []).map((stay, i) => {
    // TourAPI 숙소는 공식 1박가가 없으므로 0 (가짜 기본가 금지)
    const estimatedCost = 0;
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
      reviewSummary: "한국관광공사 TourAPI",
      contentId: stay.contentId,
      address: stay.address,
      phone: stay.phone,
      checkInTime: stay.checkInTime,
      checkOutTime: stay.checkOutTime,
      reservationUrl: stay.reservationUrl,
      reservationInfo: stay.reservationInfo,
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
  lat,
  lng,
} = {}) {
  if (!isDomesticCityId(cityId) || !String(serviceKey || "").trim()) return [];
  let list = [];
  if (category === "hotel") {
    const stays = await fetchTourStaysNearCity({
      cityId,
      serviceKey,
      numOfRows: limit,
      lat,
      lng,
    });
    list = stays.slice(0, limit);
  } else if (category === "attraction" || category === "food") {
    const places = await fetchTourPlacesNearCity({
      cityId,
      category,
      serviceKey,
      numOfRows: limit,
      lat,
      lng,
    });
    list = places.slice(0, limit);
  } else if (!category) {
    const places = await fetchTourPlacesNearCity({
      cityId,
      category: "attraction",
      serviceKey,
      numOfRows: limit,
      lat,
      lng,
    });
    list = places.slice(0, limit);
  } else {
    return [];
  }

  const withDetails = await enrichTourPlacesWithDetails(list, serviceKey);
  return tourPlacesToSuggestItems(withDetails, { partySize });
}
