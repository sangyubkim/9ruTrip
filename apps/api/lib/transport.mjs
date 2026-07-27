import { isKnownCityId, resolveCity } from "./cities.mjs";
import { estimateTransitLeg } from "./jp-transit.mjs";
import { mealArriveFloorMinutes } from "./meal-slots.mjs";

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

/** 출발지 → 첫 여행지 장거리 이동수단 */
export const OUTBOUND_TRANSPORT_MODES = ["car", "train", "bus", "flight"];

export const OUTBOUND_MODE_LABEL = {
  car: "자차",
  train: "기차",
  bus: "버스",
  flight: "비행기",
};

export function normalizeOutboundTransportMode(raw) {
  const m = String(raw || "").trim().toLowerCase();
  if (OUTBOUND_TRANSPORT_MODES.includes(m)) return m;
  return "car";
}

/**
 * 국내 출발→첫 목적지 하버사인 휴리스틱
 * - car: 톨비 + 이동 분
 * - train/bus/flight: 교통비 + 이동 분
 */
export function estimateOutboundLegHaversine(from, to, mode = "car") {
  const outboundMode = normalizeOutboundTransportMode(mode);
  if (!from || !to) {
    return {
      mode: outboundMode,
      modeLabel: OUTBOUND_MODE_LABEL[outboundMode],
      minutes: 0,
      estimatedCost: 0,
      costKind: outboundMode === "car" ? "toll" : "fare",
      engine: "none",
      note: `${OUTBOUND_MODE_LABEL[outboundMode]} · ${
        outboundMode === "car" ? "톨비" : "교통비"
      }`,
    };
  }
  const km = haversineKm(
    { lat: Number(from.lat), lng: Number(from.lng) },
    { lat: Number(to.lat), lng: Number(to.lng) },
  );
  const dist = Number.isFinite(km) ? Math.max(0, km) : 0;

  if (outboundMode === "car") {
    // 고속도로 체감 ~75km/h + 시내 접근 버퍼
    const minutes = Math.max(25, Math.round((dist / 75) * 60 + 18));
    // 거리 기반 톨비 프록시 (단거리는 낮게)
    const toll =
      dist < 15
        ? 0
        : Math.round(1200 + Math.max(0, dist - 15) * 105);
    return {
      mode: "car",
      modeLabel: "자차",
      minutes,
      estimatedCost: Math.max(0, toll),
      costKind: "toll",
      engine: "haversine:outbound:car",
      note: "자차 · 톨비",
      distanceKm: dist,
    };
  }

  if (outboundMode === "train") {
    const minutes = Math.max(40, Math.round((dist / 105) * 60 + 35));
    const fare = Math.round(4500 + dist * 95);
    return {
      mode: "train",
      modeLabel: "기차",
      minutes,
      estimatedCost: Math.max(5000, fare),
      costKind: "fare",
      engine: "haversine:outbound:train",
      note: "기차 · 교통비",
      distanceKm: dist,
    };
  }

  if (outboundMode === "bus") {
    const minutes = Math.max(50, Math.round((dist / 68) * 60 + 28));
    const fare = Math.round(2800 + dist * 58);
    return {
      mode: "bus",
      modeLabel: "버스",
      minutes,
      estimatedCost: Math.max(3500, fare),
      costKind: "fare",
      engine: "haversine:outbound:bus",
      note: "버스 · 교통비",
      distanceKm: dist,
    };
  }

  // flight — 단거리는 기차 추정으로 폴백
  if (dist < 160) {
    const train = estimateOutboundLegHaversine(from, to, "train");
    return {
      ...train,
      mode: "flight",
      modeLabel: "비행기",
      note: "비행기(단거리) · 기차 추정 · 교통비",
      engine: "haversine:outbound:flight-short",
    };
  }
  // 공항 수속·이동 + 순항
  const airMin = Math.max(50, Math.round((dist / 720) * 60));
  const minutes = 55 + airMin + 40;
  const fare = Math.round(65000 + dist * 35);
  return {
    mode: "flight",
    modeLabel: "비행기",
    minutes,
    estimatedCost: Math.max(70000, Math.min(180000, fare)),
    costKind: "fare",
    engine: "haversine:outbound:flight",
    note: "비행기 · 교통비",
    distanceKm: dist,
  };
}

/**
 * Maps 키가 있으면 car→driving / train·bus→transit, flight는 휴리스틱
 */
/**
 * Directions가 환승 대기·우회로 비정상적으로 길면 하버사인 폴백 사용.
 * (예: 서울→태백 대중교통 API가 10시간+로 나와 09:00 출발이 19:30 도착처럼 보임)
 */
function pickOutboundMinutes(dirMinutes, fallbackMinutes, distanceKm) {
  const dir = Number(dirMinutes) || 0;
  const fb = Math.max(0, Number(fallbackMinutes) || 0);
  if (!(dir > 0)) return fb;
  const dist = Number(distanceKm) || 0;
  const bloated =
    dist > 0 &&
    dist < 350 &&
    dir > 8 * 60 &&
    fb > 0 &&
    dir > fb * 2;
  return bloated ? fb : dir;
}

export async function estimateOutboundLeg(from, to, mode, apiKey = "") {
  const outboundMode = normalizeOutboundTransportMode(mode);
  const fallback = estimateOutboundLegHaversine(from, to, outboundMode);
  if (!from || !to || !apiKey || outboundMode === "flight") {
    return fallback;
  }

  try {
    if (outboundMode === "car") {
      const opt = await estimateLegByModeDirections(from, to, "taxi", apiKey);
      const km =
        fallback.distanceKm ??
        haversineKm(
          { lat: Number(from.lat), lng: Number(from.lng) },
          { lat: Number(to.lat), lng: Number(to.lng) },
        );
      const toll =
        km < 15 ? 0 : Math.round(1200 + Math.max(0, km - 15) * 105);
      const minutes = Math.max(
        25,
        pickOutboundMinutes(opt.minutes, fallback.minutes, km),
      );
      return {
        mode: "car",
        modeLabel: "자차",
        minutes,
        estimatedCost: Math.max(0, toll),
        costKind: "toll",
        engine: String(opt.engine || "").startsWith("directions:")
          ? "directions:outbound:car"
          : fallback.engine,
        note: "자차 · 톨비",
        distanceKm: km,
      };
    }

    // train / bus — transit Directions + 모드별 요금 휴리스틱
    const opt = await estimateLegByModeDirections(from, to, "transit", apiKey);
    const usedDirections = String(opt.engine || "").startsWith("directions:");
    const minutes = Math.max(
      outboundMode === "bus" ? 50 : 40,
      pickOutboundMinutes(
        opt.minutes,
        fallback.minutes,
        fallback.distanceKm,
      ),
    );
    // Directions fare가 있으면 우선, 없으면 모드 휴리스틱
    const fareFromApi =
      usedDirections && Number(opt.estimatedCost) > 2000
        ? Number(opt.estimatedCost)
        : fallback.estimatedCost;
    return {
      mode: outboundMode,
      modeLabel: OUTBOUND_MODE_LABEL[outboundMode],
      minutes,
      estimatedCost: Math.max(0, fareFromApi),
      costKind: "fare",
      engine: usedDirections
        ? `directions:outbound:${outboundMode}`
        : fallback.engine,
      note: `${OUTBOUND_MODE_LABEL[outboundMode]} · 교통비`,
      distanceKm: fallback.distanceKm,
    };
  } catch {
    return fallback;
  }
}

/**
 * 모드별 하버사인 추정 (키 없을 때 / Directions 실패 시)
 * - walking: ~4.5km/h, 비용 0
 * - transit: 도쿄 지하철형 분·요금
 * - taxi: 도심 속도 + 기본요금·거리요금 추정
 */
export function estimateLegByModeHaversine(from, to, mode, opts = {}) {
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

  const region =
    opts.region || directionsRegionFromCoords(from, to) || "kr";
  const domestic = region !== "jp";

  if (mode === "walking") {
    return {
      mode: "walking",
      minutes: Math.max(3, Math.round(km * 14)),
      estimatedCost: 0,
      engine: "haversine:walking",
    };
  }

  if (mode === "taxi") {
    // 국내: 기본요금≈4800원 + km당≈1000원 / 일본: ¥500 + ¥120/km
    const minutes = Math.max(5, Math.round(km * 2.8 + 4));
    const cost = domestic
      ? Math.round(4800 + Math.max(0, km) * 1000)
      : Math.round(500 + Math.max(0, km) * 120);
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
  const cost = domestic
    ? km < 0.9
      ? 0
      : Math.round(1400 + Math.min(km, 25) * 120)
    : km < 0.9
      ? 0
      : Math.round(170 + Math.min(km, 25) * 18);
  return {
    mode: "transit",
    minutes: Math.max(3, minutes),
    estimatedCost: Math.max(0, cost),
    engine: "haversine:transit",
  };
}

/**
 * 장소 간 이동 레거시 단일 값 — 차로(taxi→driving) 기준
 */
export function estimateLegHaversine(from, to) {
  if (!from || !to) {
    return {
      travelFromPrevMinutes: 0,
      travelFromPrevCost: 0,
      transportEngine: "none",
    };
  }
  const pick = estimateLegByModeHaversine(from, to, "taxi");
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
function directionsRegionFromCoords(from, to) {
  const lng = Number(from?.lng ?? to?.lng);
  // 일본 열도 대략 lng > 132
  if (Number.isFinite(lng) && lng > 132) return "jp";
  return "kr";
}

async function fetchDirectionsOnce(
  origin,
  destination,
  apiMode,
  apiKey,
  region = "kr",
) {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", apiMode);
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", region);
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

function parseDirectionsLeg(leg, mode, apiMode, region = "kr") {
  const seconds = Number(leg.duration?.value) || 0;
  const meters = Number(leg.distance?.value) || 0;
  const minutes = Math.max(3, Math.round(seconds / 60));
  const km = meters / 1000;
  const domestic = region !== "jp";

  let cost = 0;
  if (mode === "walking") {
    cost = 0;
  } else if (mode === "taxi") {
    cost = domestic
      ? Math.round(4800 + Math.max(0, km) * 1000)
      : Math.round(500 + Math.max(0, km) * 120);
  } else if (leg.fare?.value != null && Number.isFinite(Number(leg.fare.value))) {
    cost = Math.round(Number(leg.fare.value));
  } else if (meters > 900) {
    cost = domestic
      ? Math.round(1400 + Math.min(km, 25) * 120)
      : Math.round(170 + Math.min(km, 25) * 18);
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
  const region = directionsRegionFromCoords(from, to);
  const maxAttempts = 2;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { httpOk, data } = await fetchDirectionsOnce(
        origin,
        destination,
        apiMode,
        apiKey,
        region,
      );
      const status = data?.status;

      if (status === "OK" && data.routes?.[0]?.legs?.[0]) {
        const result = parseDirectionsLeg(
          data.routes[0].legs[0],
          mode,
          apiMode,
          region,
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
        region,
      );
      if (httpOk && data?.status === "OK" && data.routes?.[0]?.legs?.[0]) {
        const result = parseDirectionsLeg(
          data.routes[0].legs[0],
          mode,
          apiMode,
          region,
        );
        setCachedDirection(cacheKey, result);
        return result;
      }
    } catch {
      /* fall through */
    }
  }

  const fallback = estimateLegByModeHaversine(from, to, mode, { region });
  // Directions 실패 결과도 캐시 (특히 JP transit ZERO_RESULTS)
  setCachedDirection(cacheKey, fallback);
  return fallback;
}

/**
 * Google Directions API (차로/driving 우선, 실패 시 transit → walking → haversine)
 * 레거시 단일 값 경로 — 비교 UI는 compareLegTransport 사용
 */
export async function estimateLegDirections(from, to, apiKey) {
  if (!apiKey || !from || !to) return estimateLegHaversine(from, to);

  for (const mode of ["taxi", "transit", "walking"]) {
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

/**
 * 기본 추천 모드: 차로 이동(taxi→Directions driving) 기준.
 * 비교 UI의 walking/transit은 사용자가 수동 선택 가능.
 */
export function pickDefaultTransportMode(options) {
  if (!Array.isArray(options) || options.length === 0) return "taxi";
  const taxi = options.find((o) => o.mode === "taxi");
  if (taxi) return "taxi";
  return options[0]?.mode || "taxi";
}

/**
 * 카테고리별 기본 체류(분).
 * food·attraction = 60분. hotel은 방문 체류 1시간 규칙 제외(짧은 버퍼만).
 */
export function defaultStayMinutes(category) {
  const c = String(category || "");
  if (c === "hotel") return 15;
  if (c === "food" || c === "attraction") return 60;
  return 75;
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
      mode: "taxi",
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

const SEOUL_HUBS = [
  { name: "gangnam", lat: 37.4979, lng: 127.0276, w: 1 },
  { name: "seoul-station", lat: 37.5547, lng: 126.9707, w: 0.95 },
  { name: "hongdae", lat: 37.5563, lng: 126.922, w: 0.92 },
  { name: "myeongdong", lat: 37.5636, lng: 126.9869, w: 0.9 },
];

const BUSAN_HUBS = [
  { name: "seomyeon", lat: 35.1576, lng: 129.059, w: 1 },
  { name: "haeundae", lat: 35.1587, lng: 129.1604, w: 0.95 },
  { name: "nampo", lat: 35.098, lng: 129.0324, w: 0.9 },
  { name: "centum", lat: 35.1695, lng: 129.131, w: 0.88 },
];

const JEJU_HUBS = [
  { name: "jeju-city", lat: 33.4996, lng: 126.5312, w: 1 },
  { name: "seogwipo", lat: 33.2541, lng: 126.5601, w: 0.92 },
  { name: "jungmun", lat: 33.245, lng: 126.412, w: 0.9 },
  { name: "airport", lat: 33.5071, lng: 126.4927, w: 0.88 },
];

function hubsForCity(cityId) {
  switch (cityId) {
    case "seoul":
      return SEOUL_HUBS;
    case "busan":
      return BUSAN_HUBS;
    case "jeju":
    case "seogwipo":
      return JEJU_HUBS;
    case "osaka":
      return OSAKA_HUBS;
    case "tokyo":
      return TOKYO_HUBS;
    default: {
      if (isKnownCityId(cityId)) {
        const c = resolveCity(cityId);
        return [
          {
            name: "center",
            lat: Number(c.center?.lat),
            lng: Number(c.center?.lng),
            w: 1,
          },
        ];
      }
      return SEOUL_HUBS;
    }
  }
}

function isDomesticCityId(cityId) {
  if (!isKnownCityId(cityId)) {
    return cityId !== "tokyo" && cityId !== "osaka";
  }
  const c = resolveCity(cityId);
  return c.region === "domestic" || c.countryId === "kr";
}

/**
 * lat/lng로 대략 도시 추정 (명시 cityId 없을 때)
 * - 일본(lng>132)을 먼저 분리해 오사카↔부산 혼동 방지
 */
export function inferCityIdFromLat(lat, lng) {
  const n = Number(lat);
  const g = Number(lng);
  if (!Number.isFinite(n)) return "seoul";
  if (Number.isFinite(g) && g > 132) {
    return n < 35.2 ? "osaka" : "tokyo";
  }
  if (n > 36.5) return "seoul";
  if (n > 34.5 && Number.isFinite(g) && g > 128) return "busan";
  if (n < 34) return "jeju";
  return "seoul";
}

/** 숙소 점수 분해 (centrality / price / rating proxy) — 허브는 cityId별 */
export function lodgingScoreBreakdown(
  place,
  { nights = 2, cityId } = {},
) {
  const resolved = isKnownCityId(cityId)
    ? cityId
    : inferCityIdFromLat(place?.lat, place?.lng);
  const hubs = hubsForCity(resolved);
  const domestic = isDomesticCityId(resolved);

  let centrality = 40;
  for (const h of hubs) {
    if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) continue;
    const km = haversineKm(
      { lat: Number(place.lat), lng: Number(place.lng) },
      h,
    );
    const score = Math.round(
      Math.max(35, Math.min(98, (1 - Math.min(km, 8) / 8) * 100 * h.w)),
    );
    if (score > centrality) centrality = score;
  }

  // 가격 미상(0)이면 중간 점수 — 120000 등 가짜 1박가로 채우지 않음
  const rawCost = Number(place.estimatedCost);
  const hasCost = Number.isFinite(rawCost) && rawCost > 0;
  const perNight = hasCost
    ? nights > 0
      ? rawCost / nights
      : rawCost
    : null;
  // 저렴할수록 높은 점수 (국내 KRW 8만~18만 / 해외 JPY 8k~35k)
  const priceLo = domestic ? 80000 : 8000;
  const priceHi = domestic ? 180000 : 35000;
  const priceSpan = priceHi - priceLo;
  const priceEstimate = hasCost
    ? Math.round(
        Math.max(
          20,
          Math.min(
            95,
            95 -
              ((Math.min(Math.max(perNight, priceLo), priceHi) - priceLo) /
                priceSpan) *
                75,
          ),
        ),
      )
    : 50;

  // Google 평점 우선, 없으면 허브 근접 + 노트 키워드 프록시
  const notes = String(place.notes || place.name || "").toLowerCase();
  const realRating = Number(place.rating);
  let ratingProxy;
  if (Number.isFinite(realRating) && realRating > 0) {
    ratingProxy = Math.round(
      40 + (Math.min(5, Math.max(1, realRating)) - 1) * 14.5,
    );
  } else {
    ratingProxy = 70 + Math.round((centrality - 50) * 0.25);
    if (/추천|허브|역앞|편리/.test(notes)) ratingProxy += 8;
    if (/조용|저렴/.test(notes)) ratingProxy += 3;
  }
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

/** scoreBreakdown → 짧은 추천 한 줄 (주소 대신 표시) */
export function lodgingRecommendTip(place, cityNameKo = "") {
  const bd = place?.scoreBreakdown;
  const parts = [];
  const c = Number(bd?.centrality);
  if (c >= 75) parts.push("시내·교통 접근 좋음");
  else if (c >= 55) parts.push("동선 이동 무난");
  else if (Number.isFinite(c)) parts.push("한적한 위치");

  const pe = Number(bd?.priceEstimate);
  if (pe >= 75) parts.push("가격 부담 적음");
  else if (pe < 55 && Number.isFinite(pe)) parts.push("프리미엄 가격대");

  const rating = Number(place?.rating);
  if (Number.isFinite(rating) && rating >= 4.3) parts.push("평점 우수");
  else if (Number.isFinite(rating) && rating >= 3.8) parts.push("평점 무난");

  if (parts.length) return parts.join(" · ");
  const raw = String(place?.notes || "").trim();
  if (raw && !looksLikeAddressNote(raw)) return raw.slice(0, 60);
  return cityNameKo ? `${cityNameKo} 숙소 추천` : "동선·가격·평점 종합 추천";
}

function looksLikeAddressNote(text) {
  const s = String(text || "");
  if (s.length >= 24 && /(시|군|구|로|길|동)\s*\d*/.test(s)) return true;
  if (/특별자치|광역시|도\s/.test(s) && s.length >= 16) return true;
  return false;
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
    breakfastIncluded: false,
  },
  {
    name: "시부야 엑셀 호텔 도큐",
    lat: 35.6585,
    lng: 139.7013,
    basePerNight: 26000,
    notes: "시부야역 직결 · 쇼핑·야경",
    breakfastIncluded: false,
  },
  {
    name: "호텔 메츠 도쿄역 야에스",
    lat: 35.6798,
    lng: 139.7695,
    basePerNight: 24000,
    notes: "도쿄역·신칸센 접근",
    breakfastIncluded: false,
  },
  {
    name: "미츠이 가든 호텔 우에노",
    lat: 35.7112,
    lng: 139.7778,
    basePerNight: 16000,
    notes: "우에노 공원·박물관 인근",
    breakfastIncluded: false,
  },
  {
    name: "리치몬드 호텔 아사쿠사",
    lat: 35.7129,
    lng: 139.7938,
    basePerNight: 15000,
    notes: "센소지·스카이트리 접근",
    breakfastIncluded: false,
  },
  {
    name: "호텔 메츠 이케부쿠로",
    lat: 35.7298,
    lng: 139.7115,
    basePerNight: 13000,
    notes: "JR 이케부쿠로 · 가성비",
    breakfastIncluded: false,
  },
  {
    name: "세라톤 미야코 호텔 도쿄",
    lat: 35.6365,
    lng: 139.7372,
    basePerNight: 32000,
    notes: "시로카네다이 · 조용",
    breakfastIncluded: true,
  },
];

const OSAKA_LODGING_CATALOG = [
  {
    name: "호텔 한큐 리스파이어 오사카",
    lat: 34.7058,
    lng: 135.4988,
    basePerNight: 22000,
    notes: "오사카/우메다역 · JR 허브",
    breakfastIncluded: false,
  },
  {
    name: "스위소텔 난카이 오사카",
    lat: 34.6638,
    lng: 135.5019,
    basePerNight: 28000,
    notes: "난바역 직결 · 도톤보리",
    breakfastIncluded: true,
  },
  {
    name: "호텔 닛코 오사카",
    lat: 34.6725,
    lng: 135.5012,
    basePerNight: 24000,
    notes: "신사이바시 · 쇼핑 중심",
    breakfastIncluded: false,
  },
  {
    name: "크로스 호텔 오사카",
    lat: 34.6695,
    lng: 135.5018,
    basePerNight: 20000,
    notes: "도톤보리 도보 · 야경",
    breakfastIncluded: false,
  },
  {
    name: "신오사카 워싱턴 호텔 플라자",
    lat: 34.7335,
    lng: 135.5002,
    basePerNight: 14000,
    notes: "신오사카 · 신칸센",
    breakfastIncluded: false,
  },
  {
    name: "호텔 아가라 신세카이",
    lat: 34.6528,
    lng: 135.5055,
    basePerNight: 12000,
    notes: "츠텐카쿠·신세카이 · 가성비",
    breakfastIncluded: false,
  },
];

const SEOUL_LODGING_CATALOG = [
  {
    name: "롯데호텔 서울",
    lat: 37.5651,
    lng: 126.9808,
    basePerNight: 180000,
    notes: "명동·을지로 · 추천",
    breakfastIncluded: true,
  },
  {
    name: "호텔 신라 서울",
    lat: 37.5558,
    lng: 127.0052,
    basePerNight: 170000,
    notes: "장충동 · 도심 접근",
    breakfastIncluded: true,
  },
  {
    name: "그랜드 하얏트 서울",
    lat: 37.5392,
    lng: 126.997,
    basePerNight: 160000,
    notes: "남산 · 전망",
    breakfastIncluded: true,
  },
  {
    name: "글래드 여의도",
    lat: 37.5254,
    lng: 126.9177,
    basePerNight: 110000,
    notes: "여의도 · 한강 접근",
    breakfastIncluded: false,
  },
  {
    name: "호텔 더블유 홍대",
    lat: 37.5558,
    lng: 126.9235,
    basePerNight: 90000,
    notes: "홍대입구 · 가성비",
    breakfastIncluded: false,
  },
];

const BUSAN_LODGING_CATALOG = [
  {
    name: "파라다이스 호텔 부산",
    lat: 35.1602,
    lng: 129.1655,
    basePerNight: 170000,
    notes: "해운대 해변 · 추천",
    breakfastIncluded: true,
  },
  {
    name: "웨스틴 조선 부산",
    lat: 35.1595,
    lng: 129.1618,
    basePerNight: 160000,
    notes: "해운대 · 바다 전망",
    breakfastIncluded: true,
  },
  {
    name: "호텔 농심",
    lat: 35.1638,
    lng: 129.1682,
    basePerNight: 120000,
    notes: "해운대 · 스파",
    breakfastIncluded: false,
  },
  {
    name: "아바니 센트럴 부산",
    lat: 35.1578,
    lng: 129.0585,
    basePerNight: 100000,
    notes: "서면 허브",
    breakfastIncluded: false,
  },
  {
    name: "토요코인 부산역",
    lat: 35.1152,
    lng: 129.0414,
    basePerNight: 80000,
    notes: "부산역 · 가성비",
    breakfastIncluded: true,
  },
];

const JEJU_LODGING_CATALOG = [
  {
    name: "메종 글래드 제주",
    lat: 33.4855,
    lng: 126.4895,
    basePerNight: 150000,
    notes: "제주공항 · 도심 접근",
    breakfastIncluded: false,
  },
  {
    name: "롯데호텔 제주",
    lat: 33.2485,
    lng: 126.4108,
    basePerNight: 180000,
    notes: "중문 · 리조트",
    breakfastIncluded: true,
  },
  {
    name: "신라호텔 제주",
    lat: 33.2468,
    lng: 126.4125,
    basePerNight: 170000,
    notes: "중문 관광단지",
    breakfastIncluded: true,
  },
  {
    name: "호텔 리젠트 마린 블루",
    lat: 33.5168,
    lng: 126.5255,
    basePerNight: 110000,
    notes: "제주 시내 · 바다",
    breakfastIncluded: false,
  },
  {
    name: "벤티모 호텔 앤 레지던스 제주",
    lat: 33.4902,
    lng: 126.4928,
    basePerNight: 90000,
    notes: "연동 · 가성비",
    breakfastIncluded: false,
  },
];

function lodgingCatalogForCity(cityId) {
  switch (cityId) {
    case "seoul":
      return SEOUL_LODGING_CATALOG;
    case "busan":
      return BUSAN_LODGING_CATALOG;
    case "jeju":
    case "seogwipo":
      return JEJU_LODGING_CATALOG;
    case "osaka":
      return OSAKA_LODGING_CATALOG;
    case "tokyo":
      return TOKYO_LODGING_CATALOG;
    default: {
      if (!isKnownCityId(cityId)) return SEOUL_LODGING_CATALOG;
      const city = resolveCity(cityId);
      if (city.region === "overseas" || city.countryId === "jp") {
        return TOKYO_LODGING_CATALOG;
      }
      const { lat, lng } = city.center;
      const nameKo = city.nameKo;
      return [
        {
          name: `${nameKo} 시내 호텔`,
          lat,
          lng,
          basePerNight: 110000,
          notes: `${nameKo} 중심 · 추천`,
          breakfastIncluded: false,
        },
        {
          name: `${nameKo} 비즈니스 호텔`,
          lat: lat + 0.008,
          lng: lng - 0.005,
          basePerNight: 90000,
          notes: `${nameKo} · 가성비`,
          breakfastIncluded: false,
        },
        {
          name: `${nameKo} 리조트·스테이`,
          lat: lat - 0.01,
          lng: lng + 0.006,
          basePerNight: 140000,
          notes: `${nameKo} · 휴식`,
          breakfastIncluded: true,
        },
      ];
    }
  }
}

function normLodgingName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** 정적 숙소 카탈로그에서 이름 매칭 (조식 메타 보강용) */
export function findLodgingCatalogEntry(cityId, name) {
  const target = normLodgingName(name);
  if (!target) return null;
  const catalog = lodgingCatalogForCity(cityId);
  return (
    catalog.find((c) => normLodgingName(c.name) === target) ||
    catalog.find((c) => {
      const n = normLodgingName(c.name);
      return n.includes(target) || target.includes(n);
    }) ||
    null
  );
}

/** 도시별 숙소 후보 Top N (실존 호텔 좌표 기반 정적 카탈로그) */
export function buildLodgingCandidates({
  nights = 2,
  partySize = 2,
  topN = 5,
  cityId = "seoul",
} = {}) {
  const catalog = lodgingCatalogForCity(cityId);
  const party = Math.max(1, Number(partySize) || 1);

  const partyFactor = 1 + Math.max(0, party - 2) * 0.15;
  const scored = catalog.map((c, i) => {
    const estimatedCost = Math.round(c.basePerNight * nights * partyFactor);
    const pricePerPerson = Math.round(
      (c.basePerNight * partyFactor) / party,
    );
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
      breakfastIncluded:
        typeof c.breakfastIncluded === "boolean"
          ? c.breakfastIncluded
          : undefined,
      pricePerPerson,
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

function isChainDeparturePlaceForEnrich(p) {
  if (!p || p.category !== "hotel") return false;
  const notes = String(p.notes || "");
  return /전날|연결\s*출발|출발$/.test(notes) && !(Number(p.estimatedCost) > 0);
}

/** Day0 일정 맨 앞 — 여행 출발지 카드 (enrich·재계산용) */
export function isOriginDeparturePlace(p) {
  if (!p) return false;
  if (p.category !== "transport" && p.category !== "other") return false;
  const notes = String(p.notes || "");
  return /여행\s*출발|출발지/.test(notes) && !(Number(p.estimatedCost) > 0);
}

/**
 * Day0 맨 앞에 출발 카드 삽입. plannedTime=startTime, 첫 POI의 outbound 이동값은 유지.
 */
export function prependOriginDeparturePlace(
  places,
  {
    startTime = "09:00",
    startAddress = "",
    origin = null,
    outboundTransportMode = "car",
  } = {},
) {
  if (!Array.isArray(places) || places.length === 0) return places;

  const originPoint =
    origin &&
    Number.isFinite(Number(origin.lat)) &&
    Number.isFinite(Number(origin.lng))
      ? { lat: Number(origin.lat), lng: Number(origin.lng) }
      : null;
  const label = String(startAddress || origin?.name || origin?.address || "")
    .trim();
  if (!originPoint && !label) return places;

  const day0 = places
    .filter((p) => (Number(p.dayIndex) || 0) === 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (day0.length === 0) return places;
  if (day0.some(isOriginDeparturePlace)) return places;

  const firstPoi = day0.find((p) => !isOriginDeparturePlace(p)) || day0[0];
  const mode = normalizeOutboundTransportMode(outboundTransportMode);
  const startHhmm = (() => {
    const m = String(startTime || "09:00")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "09:00";
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  })();

  const departure = {
    id: `origin-depart-${Date.now().toString(36)}`,
    name: label || "출발지",
    category: "transport",
    lat: originPoint?.lat ?? (Number(firstPoi.lat) || 0),
    lng: originPoint?.lng ?? (Number(firstPoi.lng) || 0),
    estimatedCost: 0,
    notes: `여행 출발 · ${OUTBOUND_MODE_LABEL[mode] || mode}`,
    dayIndex: 0,
    order: -1,
    plannedTime: startHhmm,
    travelFromPrevMinutes: 0,
    travelFromPrevCost: 0,
    transportEngine: "none",
  };

  const merged = [departure, ...places];
  merged.sort(
    (a, b) =>
      (Number(a.dayIndex) || 0) - (Number(b.dayIndex) || 0) ||
      (a.order ?? 0) - (b.order ?? 0),
  );
  merged.forEach((p, i) => {
    p.order = i;
  });
  return merged;
}

function minutesToHhmm(totalMinutes) {
  const normalized = ((Math.floor(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function hhmmToMinutes(value) {
  const m = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function normalizeLodgingReturnHhmm(value, fallback = "21:00") {
  const m = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * 하루 시작 시각(자정 기준 분).
 * 우선순위: startTime(HH:mm) > startMinutes > startHour(기본 9).
 * startMinutes에 시(0–23)를 분으로 잘못 넣는 경우(예: 9 → 00:09)를 보정.
 * null/"" 은 Number(null)===0 함정으로 자정이 되지 않게 무시.
 */
export function resolveDayStartMinutes({
  startTime,
  startHour = 9,
  startMinutes,
} = {}) {
  const fromTime = (() => {
    const m = String(startTime ?? "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  })();
  if (fromTime != null) return fromTime;

  const hourRaw = Number(startHour);
  const hour = Number.isFinite(hourRaw)
    ? Math.min(23, Math.max(0, Math.floor(hourRaw)))
    : 9;

  if (startMinutes != null && startMinutes !== "") {
    const minsRaw = Number(startMinutes);
    if (Number.isFinite(minsRaw)) {
      let mins = Math.floor(minsRaw);
      // 시(9)를 분(9→00:09)으로 오인한 호출 보정
      if (mins >= 0 && mins <= 23 && mins === hour) {
        mins = mins * 60;
      }
      return Math.max(0, Math.min(24 * 60 - 1, mins));
    }
  }

  return hour * 60;
}

/**
 * day별 순서대로 travelFromPrev* / plannedTime / lodgingScore / transportOptions 보강
 * forceRecalc=true 이면 기존 travelFromPrev* 덮어씀 (DnD 후 재계산)
 * preferredTransportMode 가 있으면 해당 모드의 분·비용을 travelFromPrev*에 반영
 * 하루 첫 장소·체인 출발은 항상 startHour/startMinutes/startTime 기준으로 plannedTime 재부여
 * Day0 첫 장소는 origin+outboundTransportMode 가 있으면 출발→첫 목적지 구간 추정
 * 점심/저녁 food는 식사 창 prefer 시각 이전으로 당기지 않음(순차가 더 늦으면 그대로)
 * 숙박 Day 마지막 숙소는 직전 장소 plannedTime이 있으면 순차 도착만 사용.
 * lodgingReturnTime(기본 21:00) 바닥은 직전 plannedTime이 없을 때만 적용.
 */
export async function enrichPlacesWithTransport(
  places,
  {
    startHour = 9,
    startMinutes,
    startTime,
    forceRecalc = false,
    mapsApiKey = "",
    cityId,
    lodgingReturnTime,
    origin = null,
    outboundTransportMode = "car",
  } = {},
) {
  if (!Array.isArray(places) || places.length === 0) return [];

  const returnHhmm =
    lodgingReturnTime != null && String(lodgingReturnTime).trim()
      ? normalizeLodgingReturnHhmm(lodgingReturnTime, "21:00")
      : null;

  const dayStartMinutes = resolveDayStartMinutes({
    startTime,
    startHour,
    startMinutes,
  });

  const originPoint =
    origin &&
    Number.isFinite(Number(origin.lat)) &&
    Number.isFinite(Number(origin.lng))
      ? { lat: Number(origin.lat), lng: Number(origin.lng) }
      : null;
  const outboundMode = normalizeOutboundTransportMode(outboundTransportMode);

  const byDay = new Map();
  for (const p of places) {
    const d = Number(p.dayIndex) || 0;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(p);
  }

  const out = [];
  for (const [dayIndex, dayList] of [...byDay.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    dayList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let minutesFromStart = dayStartMinutes;
    let prev = null;
    for (let i = 0; i < dayList.length; i++) {
      let p = { ...dayList[i] };
      const isOriginDep = isOriginDeparturePlace(p);
      const isDayStart =
        i === 0 || isChainDeparturePlaceForEnrich(p) || isOriginDep;
      const isOutboundFirst =
        Number(dayIndex) === 0 &&
        i === 0 &&
        originPoint != null &&
        !isChainDeparturePlaceForEnrich(p) &&
        !isOriginDep;
      const outboundFromDeparture =
        Number(dayIndex) === 0 &&
        prev != null &&
        isOriginDeparturePlace(prev) &&
        !isOriginDep;

      if (prev && outboundFromDeparture) {
        const fromPoint =
          originPoint ||
          (Number.isFinite(Number(prev.lat)) &&
          Number.isFinite(Number(prev.lng))
            ? { lat: Number(prev.lat), lng: Number(prev.lng) }
            : null);
        if (fromPoint) {
          const leg = await estimateOutboundLeg(
            fromPoint,
            p,
            outboundMode,
            mapsApiKey,
          );
          p.travelFromPrevMinutes = leg.minutes;
          p.travelFromPrevCost = leg.estimatedCost;
          p.travelFromPrevCostKind = leg.costKind;
          p.transportEngine = leg.engine;
          p.transportOptions = undefined;
          if (leg.note && !(p.notes && String(p.notes).includes(leg.note))) {
            p.notes = p.notes ? `${p.notes} · ${leg.note}` : leg.note;
          }
        } else {
          p.travelFromPrevMinutes = 0;
          p.travelFromPrevCost = 0;
          p.transportEngine = "none";
          p.transportOptions = undefined;
        }
        minutesFromStart += Number(p.travelFromPrevMinutes) || 0;
      } else if (prev) {
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
      } else if (isOutboundFirst) {
        const leg = await estimateOutboundLeg(
          originPoint,
          p,
          outboundMode,
          mapsApiKey,
        );
        p.travelFromPrevMinutes = leg.minutes;
        p.travelFromPrevCost = leg.estimatedCost;
        p.travelFromPrevCostKind = leg.costKind;
        p.transportEngine = leg.engine;
        p.transportOptions = undefined;
        if (leg.note && !(p.notes && String(p.notes).includes(leg.note))) {
          p.notes = p.notes ? `${p.notes} · ${leg.note}` : leg.note;
        }
      } else {
        p.travelFromPrevMinutes = 0;
        p.travelFromPrevCost = 0;
        p.transportEngine = "none";
        p.transportOptions = undefined;
      }

      if (isDayStart) {
        const outboundMins =
          isOutboundFirst && Number(p.travelFromPrevMinutes) > 0
            ? Number(p.travelFromPrevMinutes)
            : 0;
        minutesFromStart = dayStartMinutes + outboundMins;
      }

      // 점심/저녁: 순차 도착이 창 prefer보다 이르면 창까지 대기(forceRecalc가 식사를 오전으로 당기지 않음)
      const mealFloor = mealArriveFloorMinutes(p);
      if (mealFloor != null && !isOriginDep) {
        minutesFromStart = Math.max(minutesFromStart, mealFloor);
      }

      const isLastStayHotel =
        i === dayList.length - 1 &&
        p.category === "hotel" &&
        !isChainDeparturePlaceForEnrich(p);

      // 저녁 숙소: 앞 일정 순차 도착만 사용(기존 21:00 스탬프 유지 금지).
      // lodgingReturnTime 바닥은 직전 plannedTime 없을 때만.
      if (isOriginDep) {
        p.plannedTime = minutesToHhmm(dayStartMinutes);
        minutesFromStart = dayStartMinutes;
      } else if (isLastStayHotel) {
        const hasPrevPlanned =
          prev != null &&
          prev.plannedTime &&
          /^\d{1,2}:\d{2}$/.test(String(prev.plannedTime));
        if (!hasPrevPlanned && returnHhmm) {
          const returnMins = hhmmToMinutes(returnHhmm);
          if (returnMins != null) {
            minutesFromStart = Math.max(minutesFromStart, returnMins);
          }
        }
        p.plannedTime = minutesToHhmm(minutesFromStart);
      } else if (
        forceRecalc ||
        isDayStart ||
        !p.plannedTime ||
        !/^\d{1,2}:\d{2}$/.test(String(p.plannedTime))
      ) {
        p.plannedTime = minutesToHhmm(minutesFromStart);
      } else {
        const existingMins = hhmmToMinutes(p.plannedTime);
        // 직전 도착+이동보다 이르면 역전 — 순차로 보정
        if (existingMins == null || existingMins < minutesFromStart) {
          p.plannedTime = minutesToHhmm(minutesFromStart);
        } else {
          minutesFromStart = existingMins;
        }
      }

      if (!isOriginDep) {
        minutesFromStart += defaultStayMinutes(p.category);
      }

      if (p.category === "hotel") {
        const bd = lodgingScoreBreakdown(p, { cityId });
        if (forceRecalc || !(Number(p.lodgingScore) > 0)) {
          p.lodgingScore = bd.lodgingScore;
        }
        if (!p.scoreBreakdown) p.scoreBreakdown = bd.scoreBreakdown;
      }

      if (
        Number(dayIndex) === 0 &&
        i === 0 &&
        (isOutboundFirst || isOriginDep)
      ) {
        console.info(
          "[enrichPlacesWithTransport] day0 start",
          JSON.stringify({
            dayStartMinutes,
            startTime: startTime || null,
            origin: originPoint,
            outboundMode,
            place: p.name,
            plannedTime: p.plannedTime,
            travelFromPrevMinutes: p.travelFromPrevMinutes ?? 0,
            isOriginDep,
            isOutboundFirst,
          }),
        );
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
