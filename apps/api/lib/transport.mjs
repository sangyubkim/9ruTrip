import { estimateTransitLeg } from "./jp-transit.mjs";

/** 하버사인 거리(km) */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const TRANSPORT_MODES = ["walking", "transit", "taxi"];

/**
 * 모드별 하버사인 추정 (키 없을 때 / Directions 실패 시)
 * - walking: ~4.5km/h, 비용 0
 * - transit: 도쿄 지하철형 분·요금
 * - taxi: 도심 속도 + 기본요금·거리요금 추정
 */
export function estimateLegByModeHaversine(from, to, mode) {
  if (!from || !to) {
    return {
      mode,
      minutes: 0,
      estimatedCost: 0,
      engine: "none",
    };
  }
  const km = haversineKm(
    { lat: Number(from.lat), lng: Number(from.lng) },
    { lat: Number(to.lat), lng: Number(to.lng) },
  );
  if (!Number.isFinite(km) || km < 0.05) {
    return {
      mode,
      minutes: 3,
      estimatedCost: 0,
      engine: `haversine:${mode}`,
    };
  }

  if (mode === "walking") {
    return {
      mode: "walking",
      minutes: Math.max(3, Math.round(km * 14)),
      estimatedCost: 0,
      engine: "haversine:walking",
    };
  }

  if (mode === "taxi") {
    // 도심 ~22km/h 상당 + 대기, 기본 ¥500 + ¥120/km 근사
    const minutes = Math.max(5, Math.round(km * 2.8 + 4));
    const cost = Math.round(500 + Math.max(0, km) * 120);
    return {
      mode: "taxi",
      minutes,
      estimatedCost: cost,
      engine: "haversine:taxi",
    };
  }

  // transit (default)
  const minutes =
    km < 1.2 ? Math.round(5 + km * 12) : Math.round(10 + km * 3.5 + 6);
  const cost = km < 0.9 ? 0 : Math.round(170 + Math.min(km, 25) * 18);
  return {
    mode: "transit",
    minutes: Math.max(3, minutes),
    estimatedCost: Math.max(0, cost),
    engine: "haversine:transit",
  };
}

/**
 * 도쿄 기준 간이 교통 추정 (지하철/도보 혼합) — 키 없을 때 폴백
 * 레거시: transit 우선 휴리스틱 단일 값
 */
export function estimateLegHaversine(from, to) {
  if (!from || !to) {
    return {
      travelFromPrevMinutes: 0,
      travelFromPrevCost: 0,
      transportEngine: "none",
    };
  }
  const opt = estimateLegByModeHaversine(from, to, "transit");
  const walk = estimateLegByModeHaversine(from, to, "walking");
  // 짧으면 도보, 길면 대중교통 (기존 동작에 가깝게)
  const km = haversineKm(
    { lat: Number(from.lat), lng: Number(from.lng) },
    { lat: Number(to.lat), lng: Number(to.lng) },
  );
  const pick = Number.isFinite(km) && km < 1.2 ? walk : opt;
  return {
    travelFromPrevMinutes: pick.minutes,
    travelFromPrevCost: pick.estimatedCost,
    transportEngine: pick.engine.startsWith("haversine")
      ? "haversine"
      : pick.engine,
  };
}

/** @deprecated use estimateLegHaversine */
export function estimateLeg(from, to) {
  return estimateLegHaversine(from, to);
}

/** Directions mode 매핑: taxi → driving */
function directionsApiMode(mode) {
  if (mode === "taxi") return "driving";
  return mode;
}

/** 좌표 반올림 (~11m) — 캐시 히트율↑ */
function roundCoord(n) {
  return Math.round(Number(n) * 1e4) / 1e4;
}

const DIRECTIONS_CACHE_TTL_MS = 20 * 60 * 1000; // 20분
/** @type {Map<string, { expires: number, value: object }>} */
const directionsCache = new Map();

export function directionsCacheKey(from, to, mode) {
  return `${roundCoord(from.lat)},${roundCoord(from.lng)}|${roundCoord(to.lat)},${roundCoord(to.lng)}|${mode}`;
}

export function clearDirectionsCache() {
  directionsCache.clear();
}

function getCachedDirection(key) {
  const hit = directionsCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    directionsCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedDirection(key, value) {
  directionsCache.set(key, {
    expires: Date.now() + DIRECTIONS_CACHE_TTL_MS,
    value,
  });
  // 간단 상한: 오래된 항목 정리
  if (directionsCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of directionsCache) {
      if (now > v.expires) directionsCache.delete(k);
    }
  }
}

/** 재시도 대상 (일시 오류만 — ZERO_RESULTS는 JP transit처럼 영구 불가인 경우 많음) */
function shouldRetryDirections(status, httpOk) {
  if (!httpOk) return true;
  return status === "UNKNOWN_ERROR" || status === "OVER_QUERY_LIMIT";
}

/**
 * Directions JSON 1회 호출
 * transit은 departure_time 필수 (없으면 INVALID_REQUEST → haversine 폴백이 잦음)
 */
async function fetchDirectionsOnce(origin, destination, apiMode, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", apiMode);
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", apiKey);
  // transit: departure_time 필수. driving에도 현재 시각 기준 교통 반영
  if (apiMode === "transit" || apiMode === "driving") {
    url.searchParams.set("departure_time", "now");
  }

  const res = await fetch(url.toString());
  const httpOk = res.ok;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = { status: "UNKNOWN_ERROR" };
  }
  return { httpOk, data };
}

function parseDirectionsLeg(leg, mode, apiMode) {
  const seconds = Number(leg.duration?.value) || 0;
  const meters = Number(leg.distance?.value) || 0;
  const minutes = Math.max(3, Math.round(seconds / 60));
  const km = meters / 1000;

  let cost = 0;
  if (mode === "walking") {
    cost = 0;
  } else if (mode === "taxi") {
    cost = Math.round(500 + Math.max(0, km) * 120);
  } else if (leg.fare?.value != null && Number.isFinite(Number(leg.fare.value))) {
    cost = Math.round(Number(leg.fare.value));
  } else if (meters > 900) {
    cost = Math.round(170 + Math.min(km, 25) * 18);
  }

  return {
    mode,
    minutes,
    estimatedCost: Math.max(0, cost),
    engine: `directions:${apiMode}`,
  };
}

/**
 * Google Directions 단일 모드
 * taxi는 driving 결과를 쓰고 요금은 거리 기반 추정
 * — language=ko, region=jp, departure_time=now, 1회 재시도, in-memory TTL 캐시
 */
export async function estimateLegByModeDirections(from, to, mode, apiKey) {
  if (!apiKey || !from || !to) {
    return estimateLegByModeHaversine(from, to, mode);
  }

  const cacheKey = directionsCacheKey(from, to, mode);
  const cached = getCachedDirection(cacheKey);
  if (cached) return { ...cached };

  const origin = `${Number(from.lat)},${Number(from.lng)}`;
  const destination = `${Number(to.lat)},${Number(to.lng)}`;
  const apiMode = directionsApiMode(mode);
  const maxAttempts = 2;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { httpOk, data } = await fetchDirectionsOnce(
        origin,
        destination,
        apiMode,
        apiKey,
      );
      const status = data?.status;

      if (status === "OK" && data.routes?.[0]?.legs?.[0]) {
        const result = parseDirectionsLeg(
          data.routes[0].legs[0],
          mode,
          apiMode,
        );
        setCachedDirection(cacheKey, result);
        return result;
      }

      // INVALID_REQUEST 등은 재시도해도 동일 → 즉시 폴백
      // ZERO_RESULTS(일본 transit 등)도 캐시해 반복 과금·지연 방지
      if (
        attempt < maxAttempts &&
        shouldRetryDirections(status, httpOk)
      ) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
        continue;
      }
      break;
    }
  } catch {
    // network — 한 번 더 시도
    try {
      await new Promise((r) => setTimeout(r, 300));
      const { httpOk, data } = await fetchDirectionsOnce(
        origin,
        destination,
        apiMode,
        apiKey,
      );
      if (httpOk && data?.status === "OK" && data.routes?.[0]?.legs?.[0]) {
        const result = parseDirectionsLeg(
          data.routes[0].legs[0],
          mode,
          apiMode,
        );
        setCachedDirection(cacheKey, result);
        return result;
      }
    } catch {
      /* fall through */
    }
  }

  const fallback = estimateLegByModeHaversine(from, to, mode);
  // Directions 실패 결과도 캐시 (특히 JP transit ZERO_RESULTS)
  setCachedDirection(cacheKey, fallback);
  return fallback;
}

/**
 * Google Directions API (transit 우선, 실패 시 walking → haversine)
 * 레거시 단일 값 경로 — 비교 UI는 compareLegTransport 사용
 */
export async function estimateLegDirections(from, to, apiKey) {
  if (!apiKey || !from || !to) return estimateLegHaversine(from, to);

  for (const mode of ["transit", "walking"]) {
    const opt = await estimateLegByModeDirections(from, to, mode, apiKey);
    if (opt.engine.startsWith("directions:")) {
      return {
        travelFromPrevMinutes: opt.minutes,
        travelFromPrevCost: opt.estimatedCost,
        transportEngine: opt.engine,
      };
    }
  }

  return estimateLegHaversine(from, to);
}

export async function estimateLegSmart(from, to, apiKey) {
  if (apiKey) return estimateLegDirections(from, to, apiKey);
  return estimateLegHaversine(from, to);
}

/** 기본 추천 모드: 짧은 도보 우선, 그 외 대중교통 (택시는 수동 선택) */
export function pickDefaultTransportMode(options) {
  if (!Array.isArray(options) || options.length === 0) return "transit";
  const transit = options.find((o) => o.mode === "transit");
  const walking = options.find((o) => o.mode === "walking");
  if (
    walking &&
    walking.minutes <= 25 &&
    (!transit || walking.minutes <= transit.minutes + 5)
  ) {
    return "walking";
  }
  if (transit) return "transit";
  return options[0]?.mode || "transit";
}

/**
 * 도보 / 대중교통 / 택시 비교
 * Maps 키 있으면 Directions 병렬, 없으면 모드별 haversine
 * transit은 JP 파트너 어댑터로 deepLink / partner:navitime 보강
 */
export async function compareLegTransport(from, to, apiKey) {
  if (!from || !to) {
    return {
      options: TRANSPORT_MODES.map((mode) => ({
        mode,
        minutes: 0,
        estimatedCost: 0,
        engine: "none",
      })),
      engine: "none",
    };
  }

  const options = await Promise.all(
    TRANSPORT_MODES.map((mode) =>
      apiKey
        ? estimateLegByModeDirections(from, to, mode, apiKey)
        : Promise.resolve(estimateLegByModeHaversine(from, to, mode)),
    ),
  );

  const transitIdx = options.findIndex((o) => o.mode === "transit");
  if (transitIdx >= 0) {
    options[transitIdx] = await estimateTransitLeg(from, to, {
      baseEstimate: options[transitIdx],
    });
  }

  const anyDirections = options.some((o) =>
    String(o.engine).startsWith("directions:"),
  );
  const anyPartner = options.some((o) =>
    String(o.engine).startsWith("partner:"),
  );

  return {
    options,
    engine: anyPartner
      ? "partner+haversine"
      : apiKey
        ? anyDirections
          ? "directions+haversine"
          : "haversine"
        : "haversine",
  };
}

/** preferred 모드(또는 기본)로 travelFromPrev* 적용 */
export function applyTransportOption(place, options, preferredMode) {
  const mode =
    preferredMode && TRANSPORT_MODES.includes(preferredMode)
      ? preferredMode
      : pickDefaultTransportMode(options);
  const opt =
    options.find((o) => o.mode === mode) ||
    options[0] || {
      mode: "transit",
      minutes: 0,
      estimatedCost: 0,
      engine: "none",
    };
  return {
    ...place,
    preferredTransportMode: mode,
    transportOptions: options,
    travelFromPrevMinutes: opt.minutes,
    travelFromPrevCost: opt.estimatedCost,
    transportEngine: opt.engine,
  };
}

const TOKYO_HUBS = [
  { name: "shinjuku", lat: 35.6938, lng: 139.7034, w: 1 },
  { name: "tokyo", lat: 35.6812, lng: 139.7671, w: 0.95 },
  { name: "shibuya", lat: 35.6595, lng: 139.7005, w: 0.92 },
  { name: "ueno", lat: 35.7138, lng: 139.777, w: 0.85 },
];

const OSAKA_HUBS = [
  { name: "namba", lat: 34.6661, lng: 135.5005, w: 1 },
  { name: "umeda", lat: 34.7055, lng: 135.4983, w: 0.95 },
  { name: "shinsaibashi", lat: 34.6748, lng: 135.5015, w: 0.92 },
  { name: "tennoji", lat: 34.6472, lng: 135.506, w: 0.85 },
];

/** lat로 대략 도시 추정 (명시 cityId 없을 때) */
function inferCityIdFromLat(lat) {
  const n = Number(lat);
  if (!Number.isFinite(n)) return "tokyo";
  // 오사카(~34.6) vs 도쿄(~35.7)
  return n < 35.2 ? "osaka" : "tokyo";
}

/** 숙소 점수 분해 (centrality / price / rating proxy) — 허브는 cityId별 */
export function lodgingScoreBreakdown(
  place,
  { nights = 2, cityId } = {},
) {
  const resolved =
    cityId === "osaka" || cityId === "tokyo"
      ? cityId
      : inferCityIdFromLat(place?.lat);
  const hubs = resolved === "osaka" ? OSAKA_HUBS : TOKYO_HUBS;

  let centrality = 40;
  for (const h of hubs) {
    const km = haversineKm(
      { lat: Number(place.lat), lng: Number(place.lng) },
      h,
    );
    const score = Math.round(
      Math.max(35, Math.min(98, (1 - Math.min(km, 8) / 8) * 100 * h.w)),
    );
    if (score > centrality) centrality = score;
  }

  const perNight =
    nights > 0
      ? Math.max(1, Number(place.estimatedCost) || 18000) / nights
      : Number(place.estimatedCost) || 18000;
  // 저렴할수록 높은 점수 (¥8k~¥35k/night 기준)
  const priceEstimate = Math.round(
    Math.max(
      20,
      Math.min(95, 95 - ((Math.min(Math.max(perNight, 8000), 35000) - 8000) / 27000) * 75),
    ),
  );

  // 허브 근접 + 노트 키워드로 간이 평점 프록시
  const notes = String(place.notes || place.name || "").toLowerCase();
  let ratingProxy = 70 + Math.round((centrality - 50) * 0.25);
  if (/추천|허브|역앞|편리/.test(notes)) ratingProxy += 8;
  if (/조용|저렴/.test(notes)) ratingProxy += 3;
  ratingProxy = Math.max(40, Math.min(98, ratingProxy));

  const lodgingScore = Math.round(
    centrality * 0.5 + priceEstimate * 0.25 + ratingProxy * 0.25,
  );

  return {
    lodgingScore: Math.max(1, Math.min(100, lodgingScore)),
    scoreBreakdown: {
      centrality,
      priceEstimate,
      ratingProxy,
    },
  };
}

/** 숙소 추천 점수 (도시 교통 허브 근접도 중심, 1–100) */
export function lodgingRecommendScore(place, opts = {}) {
  return lodgingScoreBreakdown(place, opts).lodgingScore;
}

const TOKYO_LODGING_CATALOG = [
  {
    name: "호텔 그라치에 신주쿠",
    lat: 35.6942,
    lng: 139.7006,
    basePerNight: 18000,
    notes: "신주쿠역 도보권 · 추천",
  },
  {
    name: "시부야 엑셀 호텔 도큐",
    lat: 35.6585,
    lng: 139.7013,
    basePerNight: 26000,
    notes: "시부야역 직결 · 쇼핑·야경",
  },
  {
    name: "호텔 메츠 도쿄역 야에스",
    lat: 35.6798,
    lng: 139.7695,
    basePerNight: 24000,
    notes: "도쿄역·신칸센 접근",
  },
  {
    name: "미츠이 가든 호텔 우에노",
    lat: 35.7112,
    lng: 139.7778,
    basePerNight: 16000,
    notes: "우에노 공원·박물관 인근",
  },
  {
    name: "리치몬드 호텔 아사쿠사",
    lat: 35.7129,
    lng: 139.7938,
    basePerNight: 15000,
    notes: "센소지·스카이트리 접근",
  },
  {
    name: "호텔 메츠 이케부쿠로",
    lat: 35.7298,
    lng: 139.7115,
    basePerNight: 13000,
    notes: "JR 이케부쿠로 · 가성비",
  },
  {
    name: "세라톤 미야코 호텔 도쿄",
    lat: 35.6365,
    lng: 139.7372,
    basePerNight: 32000,
    notes: "시로카네다이 · 조용",
  },
];

const OSAKA_LODGING_CATALOG = [
  {
    name: "호텔 한큐 리스파이어 오사카",
    lat: 34.7058,
    lng: 135.4988,
    basePerNight: 22000,
    notes: "오사카/우메다역 · JR 허브",
  },
  {
    name: "스위소텔 난카이 오사카",
    lat: 34.6638,
    lng: 135.5019,
    basePerNight: 28000,
    notes: "난바역 직결 · 도톤보리",
  },
  {
    name: "호텔 닛코 오사카",
    lat: 34.6725,
    lng: 135.5012,
    basePerNight: 24000,
    notes: "신사이바시 · 쇼핑 중심",
  },
  {
    name: "크로스 호텔 오사카",
    lat: 34.6695,
    lng: 135.5018,
    basePerNight: 20000,
    notes: "도톤보리 도보 · 야경",
  },
  {
    name: "신오사카 워싱턴 호텔 플라자",
    lat: 34.7335,
    lng: 135.5002,
    basePerNight: 14000,
    notes: "신오사카 · 신칸센",
  },
  {
    name: "호텔 아가라 신세카이",
    lat: 34.6528,
    lng: 135.5055,
    basePerNight: 12000,
    notes: "츠텐카쿠·신세카이 · 가성비",
  },
];

import { resolveCity } from "./cities.mjs";

/** 도쿄/오사카 숙소 후보 Top N (실존 호텔 좌표 기반 정적 카탈로그). 그 외 도시는 중심점 근처 플레이스홀더 */
export function buildLodgingCandidates({
  nights = 2,
  partySize = 2,
  topN = 5,
  cityId = "tokyo",
} = {}) {
  const city = resolveCity(cityId);
  const catalog =
    cityId === "osaka"
      ? OSAKA_LODGING_CATALOG
      : cityId === "tokyo"
        ? TOKYO_LODGING_CATALOG
        : Array.from({ length: Math.max(3, topN) }, (_, i) => {
            const offset = (i - 1) * 0.004;
            return {
              name: `${city.nameKo} 추천 숙소 ${i + 1}`,
              lat: city.center.lat + offset,
              lng: city.center.lng - offset * 0.5,
              basePerNight: 9000 + i * 2500,
              notes: `${city.nameKo} 시내 · AI 일정용 후보`,
            };
          });

  const partyFactor = 1 + Math.max(0, partySize - 2) * 0.15;
  const scored = catalog.map((c, i) => {
    const estimatedCost = Math.round(c.basePerNight * nights * partyFactor);
    const place = {
      id: `lodging-cand-${i + 1}`,
      name: c.name,
      category: "hotel",
      lat: c.lat,
      lng: c.lng,
      estimatedCost,
      notes: `${nights}박 · ${c.notes}`,
      dayIndex: 0,
      order: 0,
    };
    const { lodgingScore, scoreBreakdown } = lodgingScoreBreakdown(place, {
      nights,
      cityId,
    });
    return { ...place, lodgingScore, scoreBreakdown };
  });

  scored.sort((a, b) => b.lodgingScore - a.lodgingScore);
  return scored.slice(0, topN);
}

/**
 * day별 순서대로 travelFromPrev* / plannedTime / lodgingScore / transportOptions 보강
 * forceRecalc=true 이면 기존 travelFromPrev* 덮어씀 (DnD 후 재계산)
 * preferredTransportMode 가 있으면 해당 모드의 분·비용을 travelFromPrev*에 반영
 */
export async function enrichPlacesWithTransport(
  places,
  {
    startHour = 9,
    forceRecalc = false,
    mapsApiKey = "",
    cityId,
  } = {},
) {
  if (!Array.isArray(places) || places.length === 0) return [];

  const byDay = new Map();
  for (const p of places) {
    const d = Number(p.dayIndex) || 0;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(p);
  }

  const out = [];
  for (const [, dayList] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    dayList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let minutesFromStart = startHour * 60;
    let prev = null;
    for (let i = 0; i < dayList.length; i++) {
      let p = { ...dayList[i] };
      if (prev) {
        const needRecalc =
          forceRecalc ||
          !(Number(p.travelFromPrevMinutes) > 0) ||
          !Number.isFinite(Number(p.travelFromPrevCost)) ||
          !Array.isArray(p.transportOptions) ||
          p.transportOptions.length === 0;
        if (needRecalc) {
          const { options } = await compareLegTransport(prev, p, mapsApiKey);
          p = applyTransportOption(p, options, p.preferredTransportMode);
        } else if (
          p.preferredTransportMode &&
          Array.isArray(p.transportOptions) &&
          p.transportOptions.length > 0
        ) {
          p = applyTransportOption(
            p,
            p.transportOptions,
            p.preferredTransportMode,
          );
        }
        minutesFromStart += Number(p.travelFromPrevMinutes) || 0;
      } else {
        p.travelFromPrevMinutes = 0;
        p.travelFromPrevCost = 0;
        p.transportEngine = "none";
        p.transportOptions = undefined;
      }

      if (
        forceRecalc ||
        !p.plannedTime ||
        !/^\d{1,2}:\d{2}$/.test(String(p.plannedTime))
      ) {
        const hh = Math.floor(minutesFromStart / 60) % 24;
        const mm = minutesFromStart % 60;
        p.plannedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      } else {
        const [h, m] = String(p.plannedTime).split(":").map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
          minutesFromStart = h * 60 + m;
        }
      }

      minutesFromStart +=
        p.category === "food" ? 60 : p.category === "hotel" ? 15 : 75;

      if (p.category === "hotel") {
        const bd = lodgingScoreBreakdown(p, { cityId });
        if (forceRecalc || !(Number(p.lodgingScore) > 0)) {
          p.lodgingScore = bd.lodgingScore;
        }
        if (!p.scoreBreakdown) p.scoreBreakdown = bd.scoreBreakdown;
      }

      out.push(p);
      prev = p;
    }
  }

  out.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  out.forEach((p, i) => {
    p.order = i;
  });
  return out;
}
