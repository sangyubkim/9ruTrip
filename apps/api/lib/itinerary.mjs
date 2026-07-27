import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import {
  isKnownCityId,
  resolveCity as resolveCityFromCatalog,
} from "./cities.mjs";
import {
  buildLodgingCandidates,
  enrichPlacesWithTransport,
  findLodgingCatalogEntry,
  haversineKm,
  lodgingRecommendTip,
  lodgingScoreBreakdown,
  normalizeOutboundTransportMode,
  OUTBOUND_MODE_LABEL,
} from "./transport.mjs";
import {
  enrichTourPlacesWithDetails,
  fetchTourPlacePool,
  formatTourPoolForPrompt,
  suggestViaTourApi,
  tourPlacesToSuggestItems,
  tourStaysToLodgingCandidates,
} from "./tourapi.mjs";
import { groundDomesticPlaces } from "./place-ground.mjs";
import { ensureDailyMealSlots } from "./meal-slots.mjs";
import {
  formatCourseSeedForPrompt,
  injectCourseWaypointsIntoPool,
  normalizeTourCourseSeed,
} from "./tour-courses.mjs";

const PLACE_DETAIL_KEYS = [
  "address",
  "phone",
  "openingHours",
  "restDate",
  "officialMenu",
  "admissionFee",
  "checkInTime",
  "checkOutTime",
  "reservationUrl",
  "reservationInfo",
  "contentId",
  "googlePlaceId",
];

function pickPlaceDetails(source) {
  const out = {};
  for (const key of PLACE_DETAIL_KEYS) {
    if (source?.[key] != null && source[key] !== "") out[key] = source[key];
  }
  return out;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidCityId(cityId) {
  return isKnownCityId(cityId);
}

function isDomesticCity(cityId) {
  if (!isKnownCityId(cityId)) return true;
  const c = resolveCityFromCatalog(cityId);
  return c.region === "domestic" || c.countryId === "kr";
}

/** 일본 열도 대략 lng > 132 */
function looksLikeJapanPlaces(places) {
  const withLng = (places || []).filter((p) =>
    Number.isFinite(Number(p?.lng)),
  );
  if (withLng.length === 0) return false;
  const jp = withLng.filter((p) => Number(p.lng) > 132).length;
  return jp / withLng.length >= 0.5;
}

function parseStartHour(startTime) {
  if (startTime == null || startTime === "") return 9;
  if (typeof startTime === "number" && Number.isFinite(startTime)) {
    return Math.min(23, Math.max(0, Math.floor(startTime)));
  }
  const m = String(startTime).match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 9;
  return Math.min(23, Math.max(0, Number(m[1])));
}

/** 자정 기준 분 (HH:mm) — 첫 관광 plannedTime = start + outbound */
function parseStartMinutes(startTime) {
  if (startTime == null || startTime === "") return 9 * 60;
  if (typeof startTime === "number" && Number.isFinite(startTime)) {
    const h = Math.min(23, Math.max(0, Math.floor(startTime)));
    return h * 60;
  }
  const m = String(startTime).match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 9 * 60;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2] || 0)));
  return h * 60 + min;
}

function resolveCity(cityId) {
  const c = resolveCityFromCatalog(
    isValidCityId(cityId) ? cityId : "seoul",
  );
  return {
    id: c.id,
    nameKo: c.nameKo,
    center: c.center,
    mapProvider: c.mapProvider,
    currency: c.currency,
    region: c.region,
    countryId: c.countryId,
  };
}

function fallbackTemplates(cityId, partySize) {
  if (cityId === "busan") {
    return [
      {
        name: "해운대 해수욕장",
        category: "attraction",
        lat: 35.1587,
        lng: 129.1604,
        estimatedCost: 0,
        notes: "해변 산책",
      },
      {
        name: "광안리 해변",
        category: "attraction",
        lat: 35.1532,
        lng: 129.1186,
        estimatedCost: 0,
        notes: "광안대교 야경",
      },
      {
        name: "자갈치시장",
        category: "food",
        lat: 35.0966,
        lng: 129.0306,
        estimatedCost: 25000,
        notes: "해산물",
        signatureFood: "회·씨앗호떡",
      },
      {
        name: "감천문화마을",
        category: "attraction",
        lat: 35.0975,
        lng: 129.0104,
        estimatedCost: 0,
        notes: "알록달록 골목",
        mustVisit: true,
      },
      {
        name: "태종대",
        category: "attraction",
        lat: 35.0526,
        lng: 129.0879,
        estimatedCost: 0,
        notes: "절벽·다누비열차",
      },
      {
        name: "국제시장",
        category: "food",
        lat: 35.101,
        lng: 129.0305,
        estimatedCost: 15000,
        notes: "부산 먹거리",
        signatureFood: "씨앗호떡·비빔당면",
      },
    ];
  }
  if (cityId === "jeju") {
    return [
      {
        name: "성산일출봉",
        category: "attraction",
        lat: 33.4581,
        lng: 126.9425,
        estimatedCost: 5000,
        notes: "일출·분화구",
        mustVisit: true,
      },
      {
        name: "흑돼지거리",
        category: "food",
        lat: 33.512,
        lng: 126.527,
        estimatedCost: 35000,
        notes: "제주 흑돼지",
        signatureFood: "흑돼지 오겹살",
      },
      {
        name: "한라산 국립공원 (어리목)",
        category: "attraction",
        lat: 33.3925,
        lng: 126.4942,
        estimatedCost: 0,
        notes: "등산·자연",
        mustVisit: true,
      },
      {
        name: "협재해수욕장",
        category: "attraction",
        lat: 33.394,
        lng: 126.2395,
        estimatedCost: 0,
        notes: "에메랄드 해변",
      },
      {
        name: "동문시장",
        category: "food",
        lat: 33.5126,
        lng: 126.528,
        estimatedCost: 20000,
        notes: "올레국수·감귤",
        signatureFood: "고기국수",
      },
      {
        name: "카멜리아힐",
        category: "attraction",
        lat: 33.2895,
        lng: 126.3685,
        estimatedCost: 8000,
        notes: "정원·동백",
      },
    ];
  }
  if (cityId === "osaka") {
    return [
      {
        name: "오사카성",
        category: "attraction",
        lat: 34.6873,
        lng: 135.5262,
        estimatedCost: 600,
        notes: "성 공원",
      },
      {
        name: "도톤보리",
        category: "food",
        lat: 34.6686,
        lng: 135.5013,
        estimatedCost: 2500,
        notes: "타코야키·라멘",
      },
      {
        name: "신세카이·츠텐카쿠",
        category: "attraction",
        lat: 34.6525,
        lng: 135.5063,
        estimatedCost: 800,
        notes: "레트로 거리",
      },
      {
        name: "우메다 스카이빌딩",
        category: "attraction",
        lat: 34.7055,
        lng: 135.4904,
        estimatedCost: 1500,
        notes: "전망대",
      },
      {
        name: "구로몬 시장",
        category: "food",
        lat: 34.6668,
        lng: 135.5061,
        estimatedCost: 3000,
        notes: "해산물",
      },
      {
        name: "유니버설 스튜디오 재팬 (외부)",
        category: "attraction",
        lat: 34.6654,
        lng: 135.4323,
        estimatedCost: 0,
        notes: "선택 일정",
      },
    ];
  }
  if (cityId === "tokyo") {
    return [
      {
        name: "센소지 (아사쿠사)",
        category: "attraction",
        lat: 35.714765,
        lng: 139.796655,
        estimatedCost: 0,
        notes: "아침 방문 추천 (해외)",
      },
      {
        name: "나카미세도리 먹거리",
        category: "food",
        lat: 35.7115,
        lng: 139.7962,
        estimatedCost: 1500,
        notes: "길거리 음식",
      },
      {
        name: "도쿄 스카이트리",
        category: "attraction",
        lat: 35.710063,
        lng: 139.8107,
        estimatedCost: 2300,
        notes: "전망대",
      },
      {
        name: "시부야 스크램블",
        category: "attraction",
        lat: 35.6595,
        lng: 139.7005,
        estimatedCost: 0,
        notes: "저녁 산책",
      },
      {
        name: "이치란 라멘 시부야",
        category: "food",
        lat: 35.6598,
        lng: 139.7004,
        estimatedCost: 1200,
        notes: "저녁 식사",
      },
      {
        name: "메이지진구",
        category: "attraction",
        lat: 35.676398,
        lng: 139.699325,
        estimatedCost: 0,
        notes: "아침 산책",
      },
      {
        name: "하라주쿠 타케시타도리",
        category: "attraction",
        lat: 35.6702,
        lng: 139.7027,
        estimatedCost: 2000,
        notes: "쇼핑·간식",
      },
      {
        name: "신주쿠 골든가이",
        category: "food",
        lat: 35.6938,
        lng: 139.7015,
        estimatedCost: 4000,
        notes: "이자카야",
      },
      {
        name: "우에노 공원·국립박물관",
        category: "attraction",
        lat: 35.7156,
        lng: 139.7745,
        estimatedCost: 1000,
        notes: "문화 일정",
      },
      {
        name: "아키하바라",
        category: "attraction",
        lat: 35.7023,
        lng: 139.7745,
        estimatedCost: 3000,
        notes: "서브컬처·쇼핑",
      },
      {
        name: "츠키지 장외시장",
        category: "food",
        lat: 35.6654,
        lng: 139.7707,
        estimatedCost: 3500,
        notes: "해산물 아침",
      },
      {
        name: "오다이바 팀랩 플래닛",
        category: "attraction",
        lat: 35.6265,
        lng: 139.7825,
        estimatedCost: 3800,
        notes: "미디어아트",
      },
    ];
  }
  if (cityId === "seoul") {
    return [
      {
        name: "경복궁",
        category: "attraction",
        lat: 37.5796,
        lng: 126.977,
        estimatedCost: 3000,
        notes: "조선 왕궁",
        mustVisit: true,
      },
      {
        name: "광장시장",
        category: "food",
        lat: 37.5701,
        lng: 126.9997,
        estimatedCost: 15000,
        notes: "빈대떡·육회",
        signatureFood: "마약김밥·육회",
      },
      {
        name: "남산서울타워",
        category: "attraction",
        lat: 37.5512,
        lng: 126.9882,
        estimatedCost: 16000,
        notes: "전망·야경",
        mustVisit: true,
      },
      {
        name: "홍대",
        category: "attraction",
        lat: 37.5563,
        lng: 126.922,
        estimatedCost: 0,
        notes: "거리공연·카페",
      },
      {
        name: "북촌한옥마을",
        category: "attraction",
        lat: 37.5826,
        lng: 126.9831,
        estimatedCost: 0,
        notes: "한옥 골목",
        mustVisit: true,
      },
      {
        name: "명동",
        category: "attraction",
        lat: 37.5636,
        lng: 126.9869,
        estimatedCost: 20000,
        notes: "쇼핑·길거리음식",
      },
      {
        name: "한강공원 (여의도)",
        category: "attraction",
        lat: 37.5285,
        lng: 126.9326,
        estimatedCost: 0,
        notes: "피크닉·자전거",
      },
      {
        name: "광화문 고궁 인근 한식",
        category: "food",
        lat: 37.572,
        lng: 126.9769,
        estimatedCost: 18000,
        notes: "한정식·비빔밥",
        signatureFood: "비빔밥",
      },
    ];
  }

  // 기타 도시: 카탈로그 중심 좌표 기반 일반 폴백
  const city = resolveCity(cityId);
  const { lat, lng } = city.center;
  const domestic = isDomesticCity(city.id);
  const meal = domestic ? 15000 : 3000;
  return [
    {
      name: `${city.nameKo} 대표 명소`,
      category: "attraction",
      lat,
      lng,
      estimatedCost: 0,
      notes: "시내 핵심 스팟",
      mustVisit: true,
    },
    {
      name: `${city.nameKo} 현지 맛집`,
      category: "food",
      lat: lat + 0.004,
      lng: lng + 0.003,
      estimatedCost: meal,
      notes: "현지 식사",
    },
    {
      name: `${city.nameKo} 산책·전망`,
      category: "attraction",
      lat: lat - 0.003,
      lng: lng + 0.002,
      estimatedCost: 0,
      notes: "가벼운 이동",
    },
    {
      name: `${city.nameKo} 카페·휴식`,
      category: "food",
      lat: lat + 0.002,
      lng: lng - 0.004,
      estimatedCost: Math.round(meal * 0.5),
      notes: "휴식",
    },
    {
      name: `${city.nameKo} 야경·포토`,
      category: "attraction",
      lat: lat - 0.005,
      lng: lng - 0.002,
      estimatedCost: 0,
      notes: "저녁 동선",
    },
  ];
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/**
 * 숙박일(숙소 포함 Day) 인덱스.
 * 당일치기(days<=1 또는 nights<=0)는 빈 배열.
 * 그 외에는 마지막 날을 제외한 0..min(nights, days-1)-1.
 */
export function overnightDayIndexes(days, nights) {
  const d = Math.max(1, Math.floor(Number(days) || 1));
  const n = Math.max(0, Math.floor(Number(nights) || 0));
  if (d <= 1 || n <= 0) return [];
  const count = Math.min(n, d - 1);
  return Array.from({ length: count }, (_, i) => i);
}

/** Day 체인으로 복사된 아침 출발 슬롯 — 저녁 숙박으로 치지 않음 */
export function isChainDeparturePlace(p) {
  if (!p || p.category !== "hotel") return false;
  const notes = String(p.notes || "");
  return /전날|연결\s*출발|출발$/.test(notes) && !(Number(p.estimatedCost) > 0);
}

function cityIdForDayFromLegs(cities, dayIndex, fallbackCityId) {
  if (Array.isArray(cities)) {
    const leg = cities.find(
      (c) =>
        Array.isArray(c?.dayIndexes) && c.dayIndexes.includes(dayIndex),
    );
    if (leg && isValidCityId(leg.cityId)) return leg.cityId;
  }
  return isValidCityId(fallbackCityId) ? fallbackCityId : "seoul";
}

/**
 * 당일치기가 아니면 마지막 날 제외 각 Day에 hotel이 있도록 보강.
 */
export function ensureOvernightHotels(
  places,
  {
    days,
    nights,
    lodgingCandidates = [],
    preferredLodgingId = null,
    cityId = "seoul",
    cities,
    partySize = 2,
  } = {},
) {
  const overnight = overnightDayIndexes(days, nights);
  const list = Array.isArray(places) ? [...places] : [];
  if (!overnight.length) return list;

  const lodgingCache = new Map();
  const lodgingFor = (cid) => {
    if (lodgingCache.has(cid)) return lodgingCache.get(cid);
    let pool = (lodgingCandidates || []).filter(
      (c) => c && (!c.cityId || c.cityId === cid),
    );
    if (!pool.length && lodgingCandidates?.length && cid === cityId) {
      pool = lodgingCandidates;
    }
    if (!pool.length) {
      pool = buildLodgingCandidates({
        nights: Math.max(1, nights),
        partySize,
        topN: 3,
        cityId: cid,
      });
    }
    lodgingCache.set(cid, pool);
    return pool;
  };

  const perNightCost = (cand) => {
    const total = Math.max(0, Number(cand?.estimatedCost) || 0);
    return nights > 0 ? Math.round(total / nights) : total;
  };

  for (const d of overnight) {
    const hasStayHotel = list.some(
      (p) =>
        Number(p.dayIndex) === d &&
        p.category === "hotel" &&
        !isChainDeparturePlace(p),
    );
    if (hasStayHotel) continue;

    const cid = cityIdForDayFromLegs(cities, d, cityId);
    const pool = lodgingFor(cid);
    const preferred =
      pool.find((c) => c.id === preferredLodgingId) || pool[0];
    if (!preferred) continue;

    const dayOrders = list
      .filter((p) => Number(p.dayIndex) === d)
      .map((p) => Number(p.order) || 0);
    const nextOrder = dayOrders.length ? Math.max(...dayOrders) + 1 : 0;

    const perNight = perNightCost(preferred);
    const party = Math.max(1, Number(partySize) || 1);
    list.push({
      id: uid("hotel"),
      name: preferred.name,
      category: "hotel",
      lat: preferred.lat,
      lng: preferred.lng,
      estimatedCost: perNight,
      notes: preferred.notes || "숙소 복귀",
      dayIndex: d,
      order: nextOrder,
      cityId: cid,
      lodgingScore: preferred.lodgingScore,
      scoreBreakdown: preferred.scoreBreakdown,
      breakfastIncluded:
        typeof preferred.breakfastIncluded === "boolean"
          ? preferred.breakfastIncluded
          : undefined,
      pricePerPerson:
        Number(preferred.pricePerPerson) > 0
          ? Math.round(Number(preferred.pricePerPerson))
          : Math.round(perNight / party),
    });
  }

  list.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  list.forEach((p, i) => {
    p.order = i;
  });
  return list;
}

function samePlaceApprox(a, b) {
  if (!a || !b) return false;
  const na = String(a.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const nb = String(b.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  // 이름 우선 — 숙소와 인근 명소가 좌표만으로 같다고 오인되지 않게 함
  if (na && nb) return na === nb;
  const dLat = Math.abs(Number(a.lat) - Number(b.lat));
  const dLng = Math.abs(Number(a.lng) - Number(b.lng));
  return (
    Number.isFinite(dLat) &&
    Number.isFinite(dLng) &&
    dLat < 0.0008 &&
    dLng < 0.0008
  );
}

/**
 * 숙박 Day의 hotel을 그날 마지막(저녁 복귀)으로 배치.
 */
export function placeOvernightHotelsAtDayEnd(places, { days, nights } = {}) {
  const overnight = new Set(overnightDayIndexes(days, nights));
  if (!overnight.size || !Array.isArray(places)) {
    return Array.isArray(places) ? [...places] : [];
  }
  const byDay = new Map();
  for (const p of places) {
    const d = Number(p.dayIndex) || 0;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push({ ...p });
  }
  const out = [];
  for (const d of [...byDay.keys()].sort((a, b) => a - b)) {
    const arr = byDay.get(d);
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (overnight.has(d)) {
      const hotels = arr.filter((p) => p.category === "hotel");
      const rest = arr.filter((p) => p.category !== "hotel");
      // 저녁 숙박 우선 — 체인 출발(아침) hotel은 숙박으로 쓰지 않음
      const stayHotels = hotels.filter((p) => !isChainDeparturePlace(p));
      const lastHotel =
        stayHotels[stayHotels.length - 1] || hotels[hotels.length - 1];
      const dayList = lastHotel ? [...rest, lastHotel] : rest;
      dayList.forEach((p, i) => {
        p.order = i;
        out.push(p);
      });
    } else {
      arr.forEach((p, i) => {
        p.order = i;
        out.push(p);
      });
    }
  }
  out.forEach((p, i) => {
    p.order = i;
  });
  return out;
}

/**
 * Day 체인: 전날 마지막 장소 = 다음날 시작 장소.
 * 저녁 숙소를 옮기지 않고, 아침에 복사본을 앞에 삽입한다.
 */
/** 체인 아침 출발 슬롯 — 전날 저녁 plannedTime/이동값을 남기지 않음 */
function clearChainDepartureSchedule(p) {
  if (!p) return p;
  delete p.plannedTime;
  p.travelFromPrevMinutes = 0;
  p.travelFromPrevCost = 0;
  p.transportOptions = undefined;
  p.preferredTransportMode = undefined;
  p.transportEngine = undefined;
  return p;
}

export function chainDayStarts(places) {
  if (!Array.isArray(places) || places.length === 0) return [];
  const byDay = new Map();
  for (const p of places) {
    const d = Number(p.dayIndex) || 0;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push({ ...p });
  }
  for (const arr of byDay.values()) {
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  const dayKeys = [...byDay.keys()].sort((a, b) => a - b);
  for (let i = 1; i < dayKeys.length; i++) {
    const prevList = byDay.get(dayKeys[i - 1]);
    if (!prevList?.length) continue;
    if (!byDay.has(dayKeys[i])) byDay.set(dayKeys[i], []);
    const list = byDay.get(dayKeys[i]);
    const prevLast = prevList[prevList.length - 1];
    const first = list[0];
    if (first && samePlaceApprox(first, prevLast)) {
      if (!first.notes || !/전날|연결|출발/.test(String(first.notes))) {
        first.notes = first.notes
          ? `${first.notes} · 전날 연결 출발`
          : "전날 마지막 장소에서 출발";
      }
      // 전날 저녁 시각이 다음날 아침으로 남지 않도록 비움 → enrich가 startTime 부여
      clearChainDepartureSchedule(first);
      continue;
    }

    list.unshift(
      clearChainDepartureSchedule({
        ...prevLast,
        id: uid("chain"),
        dayIndex: dayKeys[i],
        order: -1,
        estimatedCost: 0,
        notes: "전날 마지막 장소 · 출발",
      }),
    );
  }

  const out = [];
  for (const d of dayKeys) {
    const arr = byDay.get(d) || [];
    arr.forEach((p, i) => {
      p.dayIndex = d;
      p.order = i;
      out.push(p);
    });
  }
  out.forEach((p, i) => {
    p.order = i;
  });
  return out;
}

/** 숙소 보강 + Day 끝 배치 + Day 체인 */
export function finalizePlaceChain(places, opts = {}) {
  const withHotels = ensureOvernightHotels(places, opts);
  const atEnd = placeOvernightHotelsAtDayEnd(withHotels, opts);
  return chainDayStarts(atEnd);
}

/** Gemini 실패 시에도 앱이 동작하도록 폴백 일정 */
export function buildFallbackItinerary({
  nights,
  days,
  partySize,
  cityId = "seoul",
  placeTemplates,
  lodgingCandidates: providedLodging,
} = {}) {
  const city = resolveCity(cityId);
  const templates =
    Array.isArray(placeTemplates) && placeTemplates.length
      ? placeTemplates
      : fallbackTemplates(city.id, partySize);

  const lodgingCandidates =
    Array.isArray(providedLodging) && providedLodging.length
      ? providedLodging
      : buildLodgingCandidates({
          nights: Math.max(1, nights),
          partySize,
          topN: 5,
          cityId: city.id,
        });

  const preferred = lodgingCandidates[0];
  const perDay = Math.max(2, Math.ceil(templates.length / days));
  const places = [];
  let ti = 0;

  for (let day = 0; day < days; day++) {
    for (let o = 0; o < perDay && ti < templates.length; o++, ti++) {
      const t = templates[ti];
      places.push({
        id: uid("place"),
        ...t,
        dayIndex: day,
        order: o,
        cityId: city.id,
      });
    }
  }

  const chained = finalizePlaceChain(places, {
    days,
    nights,
    lodgingCandidates,
    preferredLodgingId: preferred?.id,
    cityId: city.id,
    partySize,
  });

  return {
    places: chained,
    lodgingCandidates,
    preferredLodgingId: preferred?.id || null,
    plannedBudget: 0,
    summary: `${city.nameKo} ${nights}박 ${days}일 · ${partySize}명 기본 코스 (오프라인 폴백)`,
    engine: "fallback",
    cityId: city.id,
    cities: [
      {
        cityId: city.id,
        cityName: city.nameKo,
        dayIndexes: Array.from({ length: days }, (_, i) => i),
      },
    ],
    mapProvider: city.mapProvider,
  };
}

/**
 * 멀티시티 폴백: Day를 도시별로 나눠 각 도시 코스를 이어 붙임.
 * cityIds 예: ["tokyo","osaka"] → 전반 도쿄, 후반 오사카
 */
export function buildMultiCityFallbackItinerary({
  nights,
  days,
  partySize,
  cityIds = ["seoul", "busan"],
  placeTemplatesByCity,
  lodgingCandidatesByCity,
}) {
  const unique = [...new Set(cityIds)].filter(isValidCityId);
  if (unique.length <= 1) {
    const cid = unique[0] || "seoul";
    return buildFallbackItinerary({
      nights,
      days,
      partySize,
      cityId: cid,
      placeTemplates: placeTemplatesByCity?.[cid],
      lodgingCandidates: lodgingCandidatesByCity?.[cid],
    });
  }

  const split = Math.max(1, Math.ceil(days / unique.length));
  const legs = [];
  let cursor = 0;
  for (let i = 0; i < unique.length; i++) {
    const id = unique[i];
    const isLast = i === unique.length - 1;
    const count = isLast ? days - cursor : Math.min(split, days - cursor);
    const dayIndexes = Array.from({ length: Math.max(0, count) }, (_, j) => cursor + j);
    cursor += count;
    const city = resolveCity(id);
    legs.push({ cityId: city.id, cityName: city.nameKo, dayIndexes });
  }

  const allPlaces = [];
  let lodgingCandidates = [];
  let preferredLodgingId = null;

  for (const leg of legs) {
    const legDays = Math.max(1, leg.dayIndexes.length);
    const legNights = Math.max(1, legDays - (leg === legs[legs.length - 1] ? 0 : 0));
    const part = buildFallbackItinerary({
      nights: Math.max(1, Math.min(nights, legNights || 1)),
      days: legDays,
      partySize,
      cityId: leg.cityId,
      placeTemplates: placeTemplatesByCity?.[leg.cityId],
      lodgingCandidates: lodgingCandidatesByCity?.[leg.cityId],
    });
    if (!lodgingCandidates.length) {
      lodgingCandidates = part.lodgingCandidates || [];
      preferredLodgingId = part.preferredLodgingId;
    }
    const dayMap = leg.dayIndexes;
    for (const p of part.places) {
      const mappedDay = dayMap[Math.min(p.dayIndex, dayMap.length - 1)] ?? dayMap[0];
      allPlaces.push({
        ...p,
        id: uid("place"),
        dayIndex: mappedDay,
        cityId: leg.cityId,
      });
    }
  }

  allPlaces.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  allPlaces.forEach((p, i) => {
    p.order = i;
  });

  const chained = finalizePlaceChain(allPlaces, {
    days,
    nights,
    lodgingCandidates,
    preferredLodgingId,
    cityId: legs[0].cityId,
    cities: legs,
    partySize,
  });

  const names = legs.map((l) => l.cityName).join(" · ");
  const primary = resolveCity(legs[0].cityId);
  return {
    places: chained,
    lodgingCandidates,
    preferredLodgingId,
    plannedBudget: 0,
    summary: `${names} ${nights}박 ${days}일 · ${partySize}명 멀티시티 폴백`,
    engine: "fallback-multicity",
    cityId: legs[0].cityId,
    cities: legs,
    mapProvider: primary.mapProvider,
  };
}

/** @deprecated */
export function buildTokyoFallback(opts) {
  return buildFallbackItinerary({ ...opts, cityId: "tokyo" });
}

function normalizePlaceCategory(raw) {
  const c = String(raw || "")
    .trim()
    .toLowerCase();
  if (["attraction", "food", "hotel", "transport", "other"].includes(c)) {
    return c;
  }
  if (
    c === "lodging" ||
    c === "숙소" ||
    c === "ホテル" ||
    c.includes("hotel") ||
    c.includes("숙소")
  ) {
    return "hotel";
  }
  if (c.includes("food") || c.includes("restaurant") || c.includes("맛집")) {
    return "food";
  }
  if (c.includes("attraction") || c.includes("관광") || c.includes("sight")) {
    return "attraction";
  }
  return "other";
}

function normalizePlaces(rawPlaces, { days, partySize, center }) {
  if (!Array.isArray(rawPlaces)) return [];
  return rawPlaces.map((p, i) => {
    const dayIndex = Math.min(
      Math.max(0, Number(p.dayIndex ?? 0)),
      Math.max(0, days - 1),
    );
    const category = normalizePlaceCategory(p.category);
    const estimatedCost = Math.max(0, Number(p.estimatedCost) || 0);
    return {
      id: String(p.id || uid("place")),
      name: String(p.name || `장소 ${i + 1}`),
      category,
      lat: Number(p.lat) || center.lat,
      lng: Number(p.lng) || center.lng,
      estimatedCost,
      notes: p.notes ? String(p.notes) : undefined,
      dayIndex,
      order: Number.isFinite(Number(p.order)) ? Number(p.order) : i,
      plannedTime: p.plannedTime ? String(p.plannedTime) : undefined,
      travelFromPrevMinutes:
        Number(p.travelFromPrevMinutes) >= 0
          ? Number(p.travelFromPrevMinutes)
          : undefined,
      travelFromPrevCost:
        Number(p.travelFromPrevCost) >= 0
          ? Number(p.travelFromPrevCost)
          : undefined,
      travelFromPrevCostKind:
        p.travelFromPrevCostKind === "toll" ||
        p.travelFromPrevCostKind === "fare"
          ? p.travelFromPrevCostKind
          : undefined,
      lodgingScore:
        Number(p.lodgingScore) > 0 ? Number(p.lodgingScore) : undefined,
      scoreBreakdown: p.scoreBreakdown ?? undefined,
      cityId: isValidCityId(p.cityId) ? p.cityId : undefined,
      breakfastIncluded:
        typeof p.breakfastIncluded === "boolean"
          ? p.breakfastIncluded
          : undefined,
      pricePerPerson:
        category === "hotel" && !(estimatedCost > 0)
          ? undefined
          : Number(p.pricePerPerson) > 0
            ? Number(p.pricePerPerson)
            : undefined,
      signatureFood: p.signatureFood
        ? String(p.signatureFood).slice(0, 80)
        : undefined,
      reviewSummary: p.reviewSummary
        ? String(p.reviewSummary).slice(0, 120)
        : undefined,
      ...pickPlaceDetails(p),
    };
  });
}

export async function generateItinerary(body, env) {
  // Number(undefined)===NaN 이고 NaN??fallback 이 안 되므로 clampInt 사용
  const nights = clampInt(body?.nights, 0, 14, 2);
  const days = clampInt(body?.days, 1, 15, Math.max(1, nights + 1));
  const partySize = clampInt(body?.partySize, 1, 12, 2);
  const rawCityIds = Array.isArray(body?.cityIds) ? body.cityIds : [];
  const cityIds = [
    ...new Set([body?.cityId, ...rawCityIds].filter(isValidCityId)),
  ];
  if (cityIds.length === 0) cityIds.push("seoul");
  const cityId = isValidCityId(cityIds[0]) ? cityIds[0] : "seoul";
  const city = resolveCity(cityId);
  const mapsApiKey = env.googleMapsApiKey || "";
  const tourApiServiceKey = String(env.tourApiServiceKey || "").trim();
  const isMulti = cityIds.length > 1;
  const domestic = isDomesticCity(cityId) || cityIds.every(isDomesticCity);
  const currency = domestic ? "KRW" : "JPY";
  // 프롬프트 cityId enum은 요청 도시만 — 전체 카탈로그(도쿄 포함)를 넣으면 모델이 이탈함
  const cityEnum = cityIds.join("|");

  let tourPool = { attraction: [], food: [], hotel: [] };
  if (domestic && tourApiServiceKey) {
    try {
      tourPool = await fetchTourPlacePool({
        cityIds,
        serviceKey: tourApiServiceKey,
        perCategory: 12,
      });
      // 숙소 후보 상세(체크인/전화/주소) — 상위만 보강
      if (tourPool.hotel?.length) {
        tourPool = {
          ...tourPool,
          hotel: await enrichTourPlacesWithDetails(
            tourPool.hotel.slice(0, 8),
            tourApiServiceKey,
          ),
        };
      }
    } catch {
      tourPool = { attraction: [], food: [], hotel: [] };
    }
  }
  const seedCourse = domestic
    ? normalizeTourCourseSeed(body, cityIds)
    : null;
  if (seedCourse?.waypoints?.length) {
    const injected = injectCourseWaypointsIntoPool(
      tourPool,
      seedCourse.waypoints,
      seedCourse.cityId || cityId,
    );
    tourPool = injected.pool;
  }
  const coursePromptBlock = seedCourse
    ? formatCourseSeedForPrompt(seedCourse)
    : "";
  const tourLodgingCandidates = tourStaysToLodgingCandidates(tourPool.hotel, {
    nights: Math.max(1, nights),
    partySize,
    topN: 5,
    cityId,
  });
  const tourPromptBlock = formatTourPoolForPrompt(tourPool);
  const placeTemplatesByCity = {};
  const lodgingCandidatesByCity = {};
  for (const cid of cityIds.filter(isDomesticCity)) {
    const cityAttractions = tourPool.attraction.filter((p) => p.cityId === cid);
    const cityFood = tourPool.food.filter((p) => p.cityId === cid);
    const merged = tourPlacesToSuggestItems(
      [...cityAttractions, ...cityFood],
      { partySize },
    ).map(({ id, dayIndex, order, ...rest }) => rest);
    if (merged.length) placeTemplatesByCity[cid] = merged;
    const cityHotels = tourPool.hotel.filter((p) => p.cityId === cid);
    const lod = tourStaysToLodgingCandidates(cityHotels, {
      nights: Math.max(1, nights),
      partySize,
      topN: 5,
      cityId: cid,
    });
    if (lod.length) lodgingCandidatesByCity[cid] = lod;
  }
  const fallbackOpts = {
    nights,
    days,
    partySize,
    cityId,
    placeTemplates: placeTemplatesByCity[cityId],
    lodgingCandidates:
      lodgingCandidatesByCity[cityId] || tourLodgingCandidates,
  };
  const multiFallbackOpts = {
    nights,
    days,
    partySize,
    cityIds,
    placeTemplatesByCity,
    lodgingCandidatesByCity,
  };
  const originName =
    body?.origin && typeof body.origin === "object"
      ? String(body.origin.address || body.origin.name || "").trim()
      : "";
  const startAddress = body?.startAddress
    ? String(body.startAddress).trim()
    : originName;
  const startLat = Number(
    body?.startLat ?? body?.origin?.lat ?? Number.NaN,
  );
  const startLng = Number(
    body?.startLng ?? body?.origin?.lng ?? Number.NaN,
  );
  const startTime = body?.startTime;
  const startHour = parseStartHour(startTime);
  const startMinutes = parseStartMinutes(startTime);
  const outboundTransportMode = normalizeOutboundTransportMode(
    body?.outboundTransportMode,
  );
  const lodgingReturnTime = (() => {
    const raw = String(body?.lodgingReturnTime || "21:00").trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "21:00";
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  })();
  const userRequest = String(
    body?.userRequest || body?.mainRequest || body?.extraRequest || "",
  ).trim();
  const preferredFestivals = Array.isArray(body?.preferredFestivals)
    ? body.preferredFestivals
        .filter(
          (festival) =>
            festival &&
            typeof festival.name === "string" &&
            isValidCityId(festival.cityId) &&
            isDomesticCity(festival.cityId),
        )
        .slice(0, 6)
        .map((festival) => ({
          name: String(festival.name).slice(0, 80),
          cityId: festival.cityId,
          startDate: String(festival.startDate || ""),
          endDate: String(festival.endDate || ""),
        }))
    : [];
  const routeOutline =
    [startAddress || null, ...cityIds.map((id) => resolveCity(id).nameKo)]
      .filter(Boolean)
      .join(" → ") || city.nameKo;

  const finish = async (base) => {
    const lodgingCandidates =
      Array.isArray(base.lodgingCandidates) && base.lodgingCandidates.length
        ? base.lodgingCandidates
        : tourLodgingCandidates.length
          ? tourLodgingCandidates
          : buildLodgingCandidates({ nights, partySize, topN: 5, cityId });
    const preferredLodgingId =
      base.preferredLodgingId || lodgingCandidates[0]?.id || null;
    const cities =
      base.cities ||
      [
        {
          cityId,
          cityName: city.nameKo,
          dayIndexes: Array.from({ length: days }, (_, i) => i),
        },
      ];
    const chained = finalizePlaceChain(base.places, {
      days,
      nights,
      lodgingCandidates,
      preferredLodgingId,
      cityId: base.cityId || city.id,
      cities,
      partySize,
    });
    const withBreakfast = applyHotelBreakfastMeta(chained, {
      cityId: base.cityId || city.id,
      partySize,
    });
    const withMeals = ensureDailyMealSlots(withBreakfast, {
      days,
      startHour,
      tourPool,
      partySize,
      cities,
      cityId: base.cityId || city.id,
    });
    const mealsInserted = withMeals !== withBreakfast;
    const originPoint =
      Number.isFinite(startLat) && Number.isFinite(startLng)
        ? { lat: startLat, lng: startLng }
        : null;
    const enriched = await enrichPlacesWithTransport(withMeals, {
      mapsApiKey,
      forceRecalc: mealsInserted,
      cityId,
      startHour,
      startMinutes,
      lodgingReturnTime,
      origin: originPoint,
      outboundTransportMode,
    });
    const partyCost = (p) => {
      const c = Math.max(0, Number(p.estimatedCost) || 0);
      if (p.category === "food" || p.category === "attraction") {
        return c * Math.max(1, partySize);
      }
      return c;
    };
    const plannedBudget =
      Number(base.plannedBudget) > 0
        ? Number(base.plannedBudget)
        : enriched.reduce((s, p) => s + partyCost(p), 0);
    const summary = base.summary;
    const briefing =
      String(base.briefing || summary || "").trim() ||
      `${routeOutline} · ${nights}박 ${days}일 추천 일정`;
    return {
      places: enriched,
      lodgingCandidates,
      preferredLodgingId,
      plannedBudget,
      summary,
      briefing,
      routeOutline: base.routeOutline || routeOutline,
      engine: base.engine,
      cityId: base.cityId || city.id,
      cities,
      mapProvider: city.mapProvider,
      transportEngine: mapsApiKey ? "directions+haversine" : "haversine",
      ...(seedCourse
        ? {
            seedCourse: {
              contentId: seedCourse.contentId,
              title: seedCourse.title,
              source: "한국관광공사",
              stopCount: seedCourse.stopCount,
              routeSummary: seedCourse.routeSummary,
            },
          }
        : {}),
    };
  };

  if (!env.geminiApiKey) {
    return finish(
      isMulti
        ? buildMultiCityFallbackItinerary(multiFallbackOpts)
        : buildFallbackItinerary(fallbackOpts),
    );
  }

  const multiHint = isMulti
    ? `\n- 멀티시티: ${cityIds.join(" → ")}. Day를 도시별로 나눠 배치하고 각 place에 cityId를 넣으세요.`
    : "";
  const startHints = [
    startAddress ? `- 출발지 주소: ${startAddress}` : "",
    Number.isFinite(startLat) && Number.isFinite(startLng)
      ? `- 출발 좌표: ${startLat}, ${startLng}`
      : "",
    startTime != null && String(startTime).trim()
      ? `- 출발/일정 시작 시각: ${String(startTime)} (하루 시작 기준 약 ${startHour}시)`
      : "",
    `- 출발→첫 여행지 이동수단: ${OUTBOUND_MODE_LABEL[outboundTransportMode] || outboundTransportMode} (첫 관광 시작 시각은 이동 시간 이후)`,
    userRequest
      ? `- 사용자 요청(반드시 일정·장소 선택에 적극 반영): ${userRequest}`
      : "",
    preferredFestivals.length
      ? `- 선택 축제(반드시 해당 개최 도시 일정에 실제 축제 방문 장소로 포함): ${JSON.stringify(preferredFestivals)}`
      : "",
    coursePromptBlock ? `- ${coursePromptBlock.split("\n")[0]}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const regionLabel = domestic
    ? `한국 ${isMulti ? cityIds.map((id) => resolveCity(id).nameKo).join("·") : city.nameKo}`
    : `일본 ${isMulti ? cityIds.map((id) => resolveCity(id).nameKo).join("·") : city.nameKo}`;
  const costUnit = currency === "KRW" ? "원" : "엔";

  const prompt = `당신은 ${regionLabel} 여행 플래너입니다. 아래 조건으로 현실적인 일정 JSON을 만드세요.

조건:
- cityId: ${cityId}
- cityIds: ${JSON.stringify(cityIds)}
- nights: ${nights}
- days: ${days}
- partySize: ${partySize}
- 통화: ${currency}
- 하루 3~5개 장소, 이동 동선이 합리적이게
- 음식/관광/숙소 균형
- 장소 간 이동(travelFromPrevMinutes)은 차로 이동 시간 기준으로 추정
- food·attraction 체류는 기본 약 60분. hotel은 저녁 숙박이며 1시간 방문 체류 규칙을 적용하지 마세요
- 숙소 규칙: ${
    days <= 1 || nights <= 0
      ? "당일치기이므로 hotel을 넣지 마세요"
      : `당일치기가 아니므로 마지막 날(dayIndex ${days - 1})을 제외한 dayIndex 0~${days - 2} 각 Day places에 hotel을 1곳씩 포함(저녁 숙소 복귀). 총 ${Math.min(nights, days - 1)}박`
  }
- Day 체인: 각 Day의 마지막 장소가 다음날 첫 장소와 같아야 합니다(보통 숙소). dayIndex N 마지막 → dayIndex N+1 첫 슬롯.
- 하루 시작 시각 기준 약 ${startHour}시, 숙소 복귀는 저녁에 배치
- 식사 일정: 하루 시작 시각이 허용하면 점심 food 1곳(11:00–14:00, 가급적 12:00) + 저녁 food 1곳(18:00–20:00, 가급적 18:30). startHour가 14시 이후면 점심 생략, 20시 이후면 저녁도 생략
- lat/lng는 해당 도시 실제 좌표${multiHint}${startHints ? `\n${startHints}` : ""}

반드시 이 JSON 스키마만 반환:
{
  "summary": "한 줄 요약 (한국어)",
  "plannedBudget": number,
  "preferredLodgingId": "string",
  "cities": [{"cityId":"${cityEnum}","cityName":"문자열","dayIndexes":[0]}],
  "lodgingCandidates": [
    {
      "id": "string",
      "name": "숙소명",
      "category": "hotel",
      "lat": number,
      "lng": number,
      "estimatedCost": number,
      "notes": "팁",
      "lodgingScore": number,
      "scoreBreakdown": { "centrality": number, "priceEstimate": number, "ratingProxy": number },
      "breakfastIncluded": true,
      "pricePerPerson": number
    }
  ],
  "places": [
    {
      "id": "string",
      "name": "한국어 장소명",
      "category": "attraction|food|hotel|transport|other",
      "lat": number,
      "lng": number,
      "estimatedCost": number,
      "notes": "짧은 팁",
      "dayIndex": 0,
      "order": 0,
      "cityId": "${cityEnum}",
      "plannedTime": "HH:mm",
      "travelFromPrevMinutes": number,
      "travelFromPrevCost": number,
      "lodgingScore": number,
      "breakfastIncluded": true,
      "pricePerPerson": number
    }
  ]
}

dayIndex는 0부터 ${days - 1}까지.
food·attraction의 estimatedCost는 1인 가격. hotel estimatedCost는 알려진 1박 요금만(모르면 0).
lodgingCandidates의 estimatedCost는 ${nights}박 총액(모르면 0). lodgingCandidates는 Top 3~5, scoreBreakdown 포함.
hotel·lodgingCandidates: breakfastIncluded는 조식 포함 여부(불확실하면 필드 생략). 조식 식비·1박 가격은 추측하지 마세요. pricePerPerson은 알려진 1박 숙박 인당만(${partySize}명 기준).
금지: 영업시간·휴무·입장료·숙소 1박 가격·조식 식비를 추측·발명하지 마세요. 모르면 estimatedCost=0, 시간 필드는 생략.
plannedBudget는 인원(${partySize}명) 기준 총액(맛집·관광은 1인×인원).
plannedTime은 하루 일정 순서에 맞는 도착/시작 시각. hotel은 가능하면 저녁(숙소 복귀) 시각.
점심 food plannedTime은 11:00–14:00(선호 12:00), 저녁 food는 18:00–20:00(선호 18:30).
travelFromPrev*는 직전 장소→현재 이동 분/${costUnit}(첫 장소는 0).
${
  coursePromptBlock ? `\n${coursePromptBlock}\n` : ""
}${
  tourPromptBlock
    ? `\n${tourPromptBlock}\n중요: places의 name·lat·lng는 위 TourAPI 목록에서만 그대로 복사하세요. 목록에 없는 상호·관광지를 만들지 마세요.`
    : "\n중요: 실제로 존재하는 상호·관광지만 사용하세요. 추측으로 상호명을 만들지 마세요."
}`;

  try {
    const { text, engine } = await geminiComplete({
      apiKey: env.geminiApiKey,
      model: env.geminiModel,
      prompt,
      systemHint: `You are a ${city.nameKo} travel planner. Return valid JSON only. Never invent place names, opening hours, or hotel nightly prices.`,
      timeoutMs: env.llmTimeoutMs,
    });

    const parsed = parseJsonLoose(text);
    let places = normalizePlaces(parsed.places, {
      days,
      partySize,
      center: city.center,
    });
    // 국내 요청인데 일본 좌표가 대부분이거나 장소가 없으면 폴백
    if (
      places.length === 0 ||
      (domestic && looksLikeJapanPlaces(places))
    ) {
      if (domestic && places.length > 0) {
        console.warn(
          "[itinerary] Gemini returned Japan coords for domestic trip — using fallback",
        );
      }
      return finish(
        isMulti
          ? buildMultiCityFallbackItinerary(multiFallbackOpts)
          : buildFallbackItinerary(fallbackOpts),
      );
    }

    if (domestic) {
      places = await groundDomesticPlaces(places, {
        tourPool,
        mapsApiKey,
        partySize,
      });
      if (places.length === 0) {
        console.warn(
          "[itinerary] No verified domestic places after grounding — using fallback",
        );
        return finish(
          isMulti
            ? buildMultiCityFallbackItinerary(multiFallbackOpts)
            : buildFallbackItinerary(fallbackOpts),
        );
      }
      if (tourApiServiceKey) {
        places = await enrichTourPlacesWithDetails(places, tourApiServiceKey);
      }
    }

    places.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
    places.forEach((p, i) => {
      p.order = i;
      if (!p.cityId || !cityIds.includes(p.cityId)) p.cityId = cityId;
    });

    const party = Math.max(1, Number(partySize) || 1);
    let lodgingCandidates = Array.isArray(parsed.lodgingCandidates)
      ? parsed.lodgingCandidates
          .filter((c) => c && c.name)
          .map((c, i) => {
            const estimatedCost = Math.max(0, Number(c.estimatedCost) || 0);
            const catalogHit = findLodgingCatalogEntry(cityId, c.name);
            const breakfastIncluded =
              typeof c.breakfastIncluded === "boolean"
                ? c.breakfastIncluded
                : typeof catalogHit?.breakfastIncluded === "boolean"
                  ? catalogHit.breakfastIncluded
                  : undefined;
            const perNight =
              nights > 0 ? Math.round(estimatedCost / nights) : estimatedCost;
            const pricePerPerson =
              Number(c.pricePerPerson) > 0
                ? Math.round(Number(c.pricePerPerson))
                : perNight > 0
                  ? Math.round(perNight / party)
                  : undefined;
            return {
              id: String(c.id || `lodging-cand-${i + 1}`),
              name: String(c.name),
              category: "hotel",
              lat: Number(c.lat) || city.center.lat,
              lng: Number(c.lng) || city.center.lng,
              estimatedCost,
              notes: c.notes ? String(c.notes) : undefined,
              dayIndex: 0,
              order: 0,
              lodgingScore: Number(c.lodgingScore) || 70,
              scoreBreakdown: c.scoreBreakdown || {
                centrality: Number(c.lodgingScore) || 70,
                priceEstimate: 70,
                ratingProxy: 70,
              },
              breakfastIncluded,
              pricePerPerson,
            };
          })
      : [];

    if (lodgingCandidates.length === 0) {
      lodgingCandidates = tourLodgingCandidates.length
        ? tourLodgingCandidates
        : buildLodgingCandidates({
            nights,
            partySize,
            topN: 5,
            cityId,
          });
    }

    const citiesFromParsed = Array.isArray(parsed.cities)
      ? parsed.cities
          .filter(
            (c) =>
              c &&
              isValidCityId(c.cityId) &&
              cityIds.includes(c.cityId) &&
              (!domestic || isDomesticCity(c.cityId)),
          )
          .map((c) => ({
            cityId: c.cityId,
            cityName: String(c.cityName || resolveCity(c.cityId).nameKo),
            dayIndexes: Array.isArray(c.dayIndexes)
              ? c.dayIndexes.map(Number).filter((n) => n >= 0)
              : [],
          }))
      : undefined;

    const defaultCities = isMulti
      ? buildMultiCityFallbackItinerary(multiFallbackOpts).cities
      : [
          {
            cityId,
            cityName: city.nameKo,
            dayIndexes: Array.from({ length: days }, (_, i) => i),
          },
        ];

    let summary = String(
      parsed.summary || `${city.nameKo} ${nights}박 ${days}일 AI 일정`,
    );
    // 국내 요청인데 요약에 일본 도시명이 남으면 교체
    if (
      domestic &&
      /도쿄|오사카|교토|동경|tokyo|osaka|kyoto/i.test(summary)
    ) {
      summary = `${cityIds.map((id) => resolveCity(id).nameKo).join(" · ")} ${nights}박 ${days}일 AI 일정`;
    }

    return finish({
      places,
      lodgingCandidates,
      preferredLodgingId:
        parsed.preferredLodgingId || lodgingCandidates[0]?.id || null,
      plannedBudget: parsed.plannedBudget,
      summary,
      engine,
      cityId,
      cities: citiesFromParsed?.length ? citiesFromParsed : defaultCities,
    });
  } catch (err) {
    console.error(
      "[itinerary] Gemini failed, using fallback:",
      err?.message || err,
    );
    return finish(
      isMulti
        ? buildMultiCityFallbackItinerary(multiFallbackOpts)
        : buildFallbackItinerary(fallbackOpts),
    );
  }
}

const PLACES_CATEGORY_TYPE = {
  food: "restaurant",
  attraction: "tourist_attraction",
  hotel: "lodging",
};

const GOOGLE_DETAILS_CACHE = new Map();
const GOOGLE_DETAILS_TTL_MS = 12 * 60 * 60 * 1000;

function googleDetailsCacheGet(placeId) {
  const hit = GOOGLE_DETAILS_CACHE.get(placeId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    GOOGLE_DETAILS_CACHE.delete(placeId);
    return null;
  }
  return hit.value;
}

function googleDetailsCacheSet(placeId, value) {
  GOOGLE_DETAILS_CACHE.set(placeId, {
    value,
    expiresAt: Date.now() + GOOGLE_DETAILS_TTL_MS,
  });
}

/** Google Place Details → 영업시간·전화·주소 (가격은 채우지 않음) */
async function fetchGooglePlaceDetails(placeId, apiKey) {
  const id = String(placeId || "").trim();
  const key = String(apiKey || "").trim();
  if (!id || !key) return {};
  const cached = googleDetailsCacheGet(id);
  if (cached) return cached;

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  url.searchParams.set("place_id", id);
  url.searchParams.set(
    "fields",
    "formatted_address,formatted_phone_number,international_phone_number,opening_hours,website",
  );
  url.searchParams.set("language", "ko");
  url.searchParams.set("key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return {};
    const data = await res.json();
    if (data.status !== "OK" || !data.result) return {};
    const r = data.result;
    const weekday = Array.isArray(r.opening_hours?.weekday_text)
      ? r.opening_hours.weekday_text.join(" / ").slice(0, 160)
      : undefined;
    const details = pickPlaceDetails({
      address: r.formatted_address
        ? String(r.formatted_address).slice(0, 160)
        : undefined,
      phone: String(
        r.formatted_phone_number || r.international_phone_number || "",
      )
        .trim()
        .slice(0, 40) || undefined,
      openingHours: weekday || undefined,
      reservationUrl: r.website
        ? String(r.website).slice(0, 200)
        : undefined,
      googlePlaceId: id,
    });
    googleDetailsCacheSet(id, details);
    return details;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function enrichGooglePlacesWithDetails(places, apiKey) {
  if (!apiKey || !Array.isArray(places) || !places.length) return places || [];
  const out = new Array(places.length);
  const concurrency = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < places.length) {
      const index = cursor;
      cursor += 1;
      const place = places[index];
      const placeId = place?.googlePlaceId || place?.placeId;
      if (!placeId) {
        out[index] = place;
        continue;
      }
      const details = await fetchGooglePlaceDetails(placeId, apiKey);
      out[index] = { ...place, ...details };
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, places.length) },
      () => worker(),
    ),
  );
  return out;
}

/**
 * Google Places Text Search (선택) — 키·쿼터 허용 시.
 * 실패하면 null → 정적 POI 폴백.
 * 숙소: price_level 있을 때만 추정, 없으면 estimatedCost=0 (가짜 기본가 금지).
 */
async function suggestViaGooglePlaces({
  city,
  category,
  partySize = 2,
  apiKey,
  lat,
  lng,
  nearQuery = "",
}) {
  if (!apiKey || !category) return null;
  const type = PLACES_CATEGORY_TYPE[category];
  if (!type) return null;
  void partySize;

  const near = String(nearQuery || "").trim();
  const catLabel =
    category === "food" ? "맛집" : category === "hotel" ? "호텔" : "관광명소";
  const query = near
    ? `${near} ${catLabel}`
    : Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? catLabel
      : `${city.nameKo} ${catLabel}`;

  const region = isDomesticCity(city.id) ? "kr" : "jp";
  const domestic = isDomesticCity(city.id);
  const centerLat = Number.isFinite(Number(lat))
    ? Number(lat)
    : city.center.lat;
  const centerLng = Number.isFinite(Number(lng))
    ? Number(lng)
    : city.center.lng;

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("location", `${centerLat},${centerLng}`);
  url.searchParams.set("radius", "10000");
  url.searchParams.set("type", type);
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", region);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return null;
  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) return null;

  const mapped = results.slice(0, 8).map((r, i) => {
    const loc = r.geometry?.location;
    const hasPriceLevel =
      r.price_level != null && Number.isFinite(Number(r.price_level));
    const lvl = hasPriceLevel ? Number(r.price_level) : null;
    let estimatedCost = 0;
    if (category === "hotel") {
      // 숙소: price_level 없으면 0 — 120000/18000 기본가 금지
      estimatedCost =
        lvl != null
          ? domestic
            ? 80000 + lvl * 25000
            : 10000 + lvl * 8000
          : 0;
    } else if (category === "food") {
      estimatedCost =
        lvl != null
          ? Math.round(domestic ? 8000 + lvl * 7000 : 800 + lvl * 1200)
          : domestic
            ? 15000
            : 2000;
    } else {
      estimatedCost =
        lvl != null
          ? Math.round(domestic ? 2000 + lvl * 3000 : 500 + lvl * 700)
          : domestic
            ? 5000
            : 1000;
    }
    const rating = Number(r.rating);
    const ratingsTotal = Number(r.user_ratings_total);
    const hasRating = Number.isFinite(rating);
    const reviewSummary = hasRating
      ? `평점 ${rating}${Number.isFinite(ratingsTotal) ? ` (${ratingsTotal}명)` : ""}`
      : undefined;
    const address = r.formatted_address
      ? String(r.formatted_address).slice(0, 160)
      : undefined;
    // 숙소 notes는 주소가 아니라 추천 tip으로 채움 (모달 중복 방지)
    const notes =
      category === "hotel"
        ? `${city.nameKo} 숙소`
        : address
          ? address.slice(0, 80)
          : "Places";
    return {
      id: uid(`places-${i}`),
      name: String(r.name || "장소"),
      category,
      lat: Number(loc?.lat) || centerLat,
      lng: Number(loc?.lng) || centerLng,
      estimatedCost,
      notes,
      address,
      rating: hasRating ? rating : undefined,
      reviewSummary,
      mustVisit: hasRating && rating >= 4.5,
      dayIndex: 0,
      order: 0,
      googlePlaceId: r.place_id || undefined,
      priceLevel: lvl != null ? lvl : undefined,
    };
  });

  return enrichGooglePlacesWithDetails(mapped, apiKey);
}

/** 이름·노트에서 조식 힌트 (확실할 때만) */
function inferBreakfastFromText(name, notes) {
  const t = `${name || ""} ${notes || ""}`;
  if (/조식\s*포함|조식제공|조식\s*무료|breakfast\s*included|free\s*breakfast/i.test(t)) {
    return { breakfastIncluded: true };
  }
  if (
    /조식\s*불포함|조식\s*별도|조식\s*미제공|breakfast\s*not|no\s*breakfast|without\s*breakfast/i.test(
      t,
    )
  ) {
    return { breakfastIncluded: false };
  }
  return {};
}

/** 일정 hotel 장소에 조식 포함 여부 보강 (카탈로그·힌트). 조식 식비는 발명하지 않음. */
function applyHotelBreakfastMeta(places, { cityId, partySize = 2 } = {}) {
  const party = Math.max(1, Number(partySize) || 1);
  return (places || []).map((p) => {
    if (!p || p.category !== "hotel") return p;
    const cid = isValidCityId(p.cityId) ? p.cityId : cityId;
    const catalogHit = findLodgingCatalogEntry(cid, p.name);
    const fromText = inferBreakfastFromText(p.name, p.notes);
    const breakfastIncluded =
      typeof p.breakfastIncluded === "boolean"
        ? p.breakfastIncluded
        : typeof fromText.breakfastIncluded === "boolean"
          ? fromText.breakfastIncluded
          : typeof catalogHit?.breakfastIncluded === "boolean"
            ? catalogHit.breakfastIncluded
            : undefined;
    const estimatedCost = Math.max(0, Number(p.estimatedCost) || 0);
    const pricePerPerson =
      Number(p.pricePerPerson) > 0
        ? Math.round(Number(p.pricePerPerson))
        : estimatedCost > 0
          ? Math.round(estimatedCost / party)
          : undefined;
    const next = {
      ...p,
      breakfastIncluded,
      ...(pricePerPerson != null ? { pricePerPerson } : {}),
    };
    delete next.breakfastPricePerPerson;
    return next;
  });
}

/**
 * 숙소 후보에 lodgingScore / tip + 조식 보강.
 * Gemini는 조식만 추정 — 1박 가격(roomPrice)은 발명하지 않음.
 */
async function enrichHotelSuggests(
  places,
  {
    cityId,
    cityNameKo,
    nights = 2,
    partySize = 2,
    city,
    geminiApiKey = "",
    geminiModel,
    llmTimeoutMs,
  } = {},
) {
  const party = Math.max(1, Number(partySize) || 1);
  const year = new Date().getFullYear();

  const scored = (places || []).map((p) => {
    if (p.category !== "hotel") return p;
    const { lodgingScore, scoreBreakdown } = lodgingScoreBreakdown(p, {
      cityId,
      nights,
    });
    const tip = lodgingRecommendTip(
      { ...p, lodgingScore, scoreBreakdown },
      cityNameKo,
    );
    const catalogHit = findLodgingCatalogEntry(cityId, p.name);
    const fromText = inferBreakfastFromText(p.name, p.notes);
    const breakfastIncluded =
      typeof p.breakfastIncluded === "boolean"
        ? p.breakfastIncluded
        : typeof fromText.breakfastIncluded === "boolean"
          ? fromText.breakfastIncluded
          : typeof catalogHit?.breakfastIncluded === "boolean"
            ? catalogHit.breakfastIncluded
            : undefined;
    const estimatedCost = Math.max(0, Number(p.estimatedCost) || 0);
    const pricePerPerson =
      Number(p.pricePerPerson) > 0
        ? Math.round(Number(p.pricePerPerson))
        : estimatedCost > 0
          ? Math.round(estimatedCost / party)
          : undefined;
    const next = {
      ...p,
      lodgingScore,
      scoreBreakdown,
      notes: tip,
      aiReason: tip,
      breakfastIncluded,
      estimatedCost,
      ...(pricePerPerson != null ? { pricePerPerson } : {}),
    };
    delete next.breakfastPricePerPerson;
    return next;
  });

  const hotels = scored.filter((p) => p.category === "hotel");
  if (!geminiApiKey || hotels.length === 0) return scored;

  try {
    const prompt = `당신은 ${cityNameKo || city?.nameKo || ""} 호텔 가이드입니다. ${year}년 현재 기준입니다.
아래 숙소 각각에 대해 조식 제공 여부만 알려주세요. 확실하지 않으면 breakfastIncluded를 null로 두세요.
숙박 1박 가격·조식 식비·객실요금은 절대 추측하지 마세요(가격 필드를 만들지 마세요).

숙소: ${JSON.stringify(
      hotels.map((p) => ({ id: p.id, name: p.name })),
    )}

반드시 JSON만:
{
  "items": [
    {
      "id": "문자열",
      "breakfastIncluded": true
    }
  ]
}
- breakfastIncluded: 요금에 조식 포함이면 true, 불포함이면 false, 모르면 null
- 조식 식비·1박 가격 필드는 넣지 마세요`;

    const { text } = await geminiComplete({
      apiKey: geminiApiKey,
      model: geminiModel,
      prompt,
      systemHint:
        "Hotel breakfastIncluded only. Return valid JSON. Never invent breakfast prices, room prices, or nightly rates.",
      timeoutMs: llmTimeoutMs || 25000,
    });
    const parsed = parseJsonLoose(text);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const byId = new Map(
      items
        .filter((it) => it && it.id)
        .map((it) => [String(it.id), it]),
    );

    return scored.map((p) => {
      if (p.category !== "hotel") return p;
      const hit = byId.get(String(p.id));
      if (!hit) return p;
      const breakfastIncluded =
        hit.breakfastIncluded === true || hit.breakfastIncluded === false
          ? hit.breakfastIncluded
          : p.breakfastIncluded;
      const next = {
        ...p,
        breakfastIncluded,
      };
      delete next.breakfastPricePerPerson;
      return next;
    });
  } catch (err) {
    console.warn(
      "[suggest] enrichHotelSuggests breakfast failed:",
      err?.message || err,
    );
    return scored;
  }
}

/**
 * 맛집 후보에 대표 메뉴 + 현재 기준 1인·총 예상 가격을 채움 (Gemini).
 * 실패 시 price_level 기반 추정가 유지.
 */
async function enrichFoodMenus(
  places,
  {
    city,
    partySize = 2,
    geminiApiKey,
    geminiModel,
    llmTimeoutMs,
  } = {},
) {
  if (!Array.isArray(places) || places.length === 0) return places;
  const domestic = isDomesticCity(city.id);
  const currency = domestic ? "KRW" : "JPY";
  const year = new Date().getFullYear();

  const fallbackSignature = (name) => {
    const n = String(name || "");
    if (/비빔|한정식|한식/.test(n)) return "비빔밥·한정식";
    if (/회|횟집|수산|해물|게장/.test(n)) return "모둠회·해산물";
    if (/갈비|고기|삼겹|흑돼지|불고기/.test(n)) return "고기 구이";
    if (/국수|면|밀면|냉면|칼국수/.test(n)) return "면 요리";
    if (/카페|커피|디저트/.test(n)) return "시그니처 음료·디저트";
    if (/치킨|닭/.test(n)) return "치킨";
    if (/피자|파스타|이탈리/.test(n)) return "파스타·피자";
    return `${city.nameKo} 대표 메뉴`;
  };

  const applyFallback = (list) =>
    list.map((p) => {
      if (p.category !== "food") return p;
      const per =
        p.priceLevel != null
          ? domestic
            ? 9000 + Number(p.priceLevel) * 8000
            : 900 + Number(p.priceLevel) * 1300
          : domestic
            ? 15000
            : 2000;
      const estimatedCost =
        Number(p.estimatedCost) > 0
          ? Number(p.estimatedCost)
          : Math.round(per);
      return {
        ...p,
        signatureFood: p.signatureFood || fallbackSignature(p.name),
        estimatedCost,
      };
    });

  if (!geminiApiKey) return applyFallback(places);

  try {
    const prompt = `당신은 ${city.nameKo} 현지 맛집 가이드입니다. ${year}년 현재 가격 감각으로 답하세요.
아래 식당 각각에 대해 대표 메뉴 1개와 1인 예상 가격을 알려주세요.

통화: ${currency} (${currency === "KRW" ? "원" : "엔"})
식당: ${JSON.stringify(
      places
        .filter((p) => p.category === "food")
        .map((p) => ({ id: p.id, name: p.name })),
    )}

반드시 JSON만:
{
  "items": [
    { "id": "문자열", "signatureFood": "대표 메뉴명", "pricePerPerson": number }
  ]
}
pricePerPerson은 ${currency} 숫자만. 관광객 기준 현실적인 ${year}년 현지 가격.`;

    const { text } = await geminiComplete({
      apiKey: geminiApiKey,
      model: geminiModel,
      prompt,
      systemHint:
        "Korean restaurant menu and price estimator. Return valid JSON only.",
      timeoutMs: llmTimeoutMs || 25000,
    });
    const parsed = parseJsonLoose(text);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const byId = new Map(
      items
        .filter((it) => it && it.id)
        .map((it) => [
          String(it.id),
          {
            signatureFood: String(it.signatureFood || "").trim(),
            pricePerPerson: Number(it.pricePerPerson),
          },
        ]),
    );

    return places.map((p) => {
      if (p.category !== "food") return p;
      const hit = byId.get(String(p.id));
      const pricePer =
        hit && Number.isFinite(hit.pricePerPerson) && hit.pricePerPerson > 0
          ? hit.pricePerPerson
          : null;
      const estimatedCost = pricePer
        ? Math.round(pricePer)
        : Number(p.estimatedCost) > 0
          ? Number(p.estimatedCost)
          : Math.round(domestic ? 15000 : 2000);
      return {
        ...p,
        signatureFood:
          (hit?.signatureFood &&
          !/^(establishment|point of interest|food|restaurant)/i.test(
            hit.signatureFood,
          )
            ? hit.signatureFood
            : null) ||
          p.signatureFood ||
          fallbackSignature(p.name),
        estimatedCost,
      };
    });
  } catch (err) {
    console.warn(
      "[suggest] enrichFoodMenus failed:",
      err?.message || err,
    );
    return applyFallback(places);
  }
}

function staticSuggestPool(cityId, partySize) {
  if (cityId === "busan") {
    return [
      {
        name: "자갈치시장",
        category: "food",
        lat: 35.0966,
        lng: 129.0306,
        estimatedCost: 25000,
        notes: "해산물 시장",
        signatureFood: "회·씨앗호떡",
        rating: 4.4,
        reviewSummary: "평점 4.4 · 현지 해산물",
      },
      {
        name: "밀면 본점 거리 (냉정)",
        category: "food",
        lat: 35.1512,
        lng: 129.0605,
        estimatedCost: 12000,
        notes: "부산 밀면",
        signatureFood: "밀면",
        rating: 4.5,
        mustVisit: true,
        reviewSummary: "평점 4.5 · 부산 대표 면요리",
      },
      {
        name: "해운대 해수욕장",
        category: "attraction",
        lat: 35.1587,
        lng: 129.1604,
        estimatedCost: 0,
        notes: "해변",
        rating: 4.6,
        mustVisit: true,
        reviewSummary: "평점 4.6 · 부산 대표 해변",
      },
      {
        name: "감천문화마을",
        category: "attraction",
        lat: 35.0975,
        lng: 129.0104,
        estimatedCost: 0,
        notes: "컬러풀 골목",
        rating: 4.5,
        mustVisit: true,
        reviewSummary: "평점 4.5 · 포토스팟",
      },
      {
        name: "태종대",
        category: "attraction",
        lat: 35.0526,
        lng: 129.0879,
        estimatedCost: 0,
        notes: "절벽 산책",
        rating: 4.4,
        reviewSummary: "평점 4.4",
      },
      {
        name: "파라다이스 호텔 부산",
        category: "hotel",
        lat: 35.1602,
        lng: 129.1655,
        estimatedCost: 170000,
        notes: "해운대 해변",
        rating: 4.5,
        mustVisit: true,
        reviewSummary: "평점 4.5 · 오션뷰",
      },
      {
        name: "아바니 센트럴 부산",
        category: "hotel",
        lat: 35.1578,
        lng: 129.0585,
        estimatedCost: 100000,
        notes: "서면 허브",
        rating: 4.3,
        reviewSummary: "평점 4.3",
      },
    ];
  }
  if (cityId === "jeju") {
    return [
      {
        name: "흑돼지거리",
        category: "food",
        lat: 33.512,
        lng: 126.527,
        estimatedCost: 35000,
        notes: "제주 흑돼지",
        signatureFood: "흑돼지 오겹살",
        rating: 4.5,
        mustVisit: true,
        reviewSummary: "평점 4.5 · 제주 대표 고기",
      },
      {
        name: "동문시장",
        category: "food",
        lat: 33.5126,
        lng: 126.528,
        estimatedCost: 20000,
        notes: "올레국수·감귤",
        signatureFood: "고기국수",
        rating: 4.3,
        reviewSummary: "평점 4.3",
      },
      {
        name: "성산일출봉",
        category: "attraction",
        lat: 33.4581,
        lng: 126.9425,
        estimatedCost: 5000,
        notes: "UNESCO 일출",
        rating: 4.7,
        mustVisit: true,
        reviewSummary: "평점 4.7 · 필수 명소",
      },
      {
        name: "협재해수욕장",
        category: "attraction",
        lat: 33.394,
        lng: 126.2395,
        estimatedCost: 0,
        notes: "에메랄드 해변",
        rating: 4.6,
        mustVisit: true,
        reviewSummary: "평점 4.6",
      },
      {
        name: "한라산 어리목",
        category: "attraction",
        lat: 33.3925,
        lng: 126.4942,
        estimatedCost: 0,
        notes: "등산 코스",
        rating: 4.6,
        mustVisit: true,
        reviewSummary: "평점 4.6",
      },
      {
        name: "메종 글래드 제주",
        category: "hotel",
        lat: 33.4855,
        lng: 126.4895,
        estimatedCost: 150000,
        notes: "공항·시내",
        rating: 4.4,
        reviewSummary: "평점 4.4",
      },
      {
        name: "롯데호텔 제주",
        category: "hotel",
        lat: 33.2485,
        lng: 126.4108,
        estimatedCost: 180000,
        notes: "중문 리조트",
        rating: 4.5,
        mustVisit: true,
        reviewSummary: "평점 4.5",
      },
    ];
  }
  if (cityId === "osaka") {
    return [
      {
        name: "이쿠노 코리아타운",
        category: "food",
        lat: 34.6555,
        lng: 135.542,
        estimatedCost: 2000,
        notes: "한식·거리음식",
      },
      {
        name: "구로몬 시장",
        category: "food",
        lat: 34.6668,
        lng: 135.5061,
        estimatedCost: 3000,
        notes: "해산물·아침",
      },
      {
        name: "타코야키 도톤보리 본점 거리",
        category: "food",
        lat: 34.6687,
        lng: 135.5013,
        estimatedCost: 800,
        notes: "간식",
        signatureFood: "타코야키",
      },
      {
        name: "아베노하루카스 전망대",
        category: "attraction",
        lat: 34.6456,
        lng: 135.5135,
        estimatedCost: 1800,
        notes: "초고층 전망",
      },
      {
        name: "스미요시타이샤",
        category: "attraction",
        lat: 34.6126,
        lng: 135.4929,
        estimatedCost: 0,
        notes: "신사",
      },
      {
        name: "오사카성 공원",
        category: "attraction",
        lat: 34.6873,
        lng: 135.5262,
        estimatedCost: 600,
        notes: "성·산책",
        mustVisit: true,
        rating: 4.5,
      },
      {
        name: "우메다 스카이빌딩",
        category: "attraction",
        lat: 34.7055,
        lng: 135.4904,
        estimatedCost: 1500,
        notes: "공중정원",
      },
      {
        name: "스위소텔 난카이 오사카",
        category: "hotel",
        lat: 34.6638,
        lng: 135.5019,
        estimatedCost: 28000,
        notes: "난바 직결 숙소",
      },
      {
        name: "호텔 닛코 오사카",
        category: "hotel",
        lat: 34.6725,
        lng: 135.5012,
        estimatedCost: 24000,
        notes: "신사이바시",
      },
      {
        name: "호텔 한큐 리스파이어 오사카",
        category: "hotel",
        lat: 34.7058,
        lng: 135.4988,
        estimatedCost: 22000,
        notes: "우메다 허브",
      },
    ];
  }
  if (cityId === "tokyo") {
    return [
      {
        name: "츠지한 아사쿠사",
        category: "food",
        lat: 35.7118,
        lng: 139.7948,
        estimatedCost: 1800,
        notes: "모노자야키",
        signatureFood: "모노자야키",
      },
      {
        name: "이치란 라멘 시부야",
        category: "food",
        lat: 35.6598,
        lng: 139.7004,
        estimatedCost: 1200,
        notes: "돈코츠 라멘",
        signatureFood: "돈코츠 라멘",
      },
      {
        name: "스시 잔마이 토요스",
        category: "food",
        lat: 35.645,
        lng: 139.7845,
        estimatedCost: 4500,
        notes: "회전·단품 스시",
        signatureFood: "스시",
      },
      {
        name: "긴자 교자 로쿠포쿠",
        category: "food",
        lat: 35.6712,
        lng: 139.7645,
        estimatedCost: 2200,
        notes: "교자",
        signatureFood: "교자",
      },
      {
        name: "도쿄타워",
        category: "attraction",
        lat: 35.6586,
        lng: 139.7454,
        estimatedCost: 1200,
        notes: "전망",
        mustVisit: true,
        rating: 4.5,
      },
      {
        name: "센소지 (아사쿠사)",
        category: "attraction",
        lat: 35.714765,
        lng: 139.796655,
        estimatedCost: 0,
        notes: "사찰",
        mustVisit: true,
        rating: 4.6,
      },
      {
        name: "도쿄 스카이트리",
        category: "attraction",
        lat: 35.710063,
        lng: 139.8107,
        estimatedCost: 2300,
        notes: "전망대",
      },
      {
        name: "메이지진구",
        category: "attraction",
        lat: 35.676398,
        lng: 139.699325,
        estimatedCost: 0,
        notes: "숲길 산책",
      },
      {
        name: "오모테산도 힐즈",
        category: "attraction",
        lat: 35.6672,
        lng: 139.7095,
        estimatedCost: 0,
        notes: "산책·쇼핑",
      },
      {
        name: "시부야 엑셀 호텔 도큐",
        category: "hotel",
        lat: 35.6585,
        lng: 139.7013,
        estimatedCost: 26000,
        notes: "시부야역 숙소",
      },
      {
        name: "호텔 그라치에 신주쿠",
        category: "hotel",
        lat: 35.6942,
        lng: 139.7006,
        estimatedCost: 18000,
        notes: "신주쿠 허브",
      },
      {
        name: "리치몬드 호텔 아사쿠사",
        category: "hotel",
        lat: 35.7129,
        lng: 139.7938,
        estimatedCost: 15000,
        notes: "아사쿠사",
      },
    ];
  }
  // seoul default
  return [
    {
      name: "광장시장",
      category: "food",
      lat: 37.5701,
      lng: 126.9997,
      estimatedCost: 15000,
      notes: "빈대떡·육회",
      signatureFood: "마약김밥·육회",
      rating: 4.5,
      mustVisit: true,
      reviewSummary: "평점 4.5 · 전통시장 먹거리",
    },
    {
      name: "이태원/경리단 맛집 거리",
      category: "food",
      lat: 37.5345,
      lng: 126.9945,
      estimatedCost: 25000,
      notes: "다양한 세계요리",
      signatureFood: "퓨전 다이닝",
      rating: 4.4,
      reviewSummary: "평점 4.4",
    },
    {
      name: "홍대 길거리 음식",
      category: "food",
      lat: 37.5563,
      lng: 126.922,
      estimatedCost: 12000,
      notes: "핫도그·분식",
      signatureFood: "길거리 간식",
      rating: 4.3,
      reviewSummary: "평점 4.3",
    },
    {
      name: "경복궁",
      category: "attraction",
      lat: 37.5796,
      lng: 126.977,
      estimatedCost: 3000,
      notes: "조선 왕궁",
      rating: 4.7,
      mustVisit: true,
      reviewSummary: "평점 4.7 · 필수 명소",
    },
    {
      name: "남산서울타워",
      category: "attraction",
      lat: 37.5512,
      lng: 126.9882,
      estimatedCost: 16000,
      notes: "전망·야경",
      rating: 4.5,
      mustVisit: true,
      reviewSummary: "평점 4.5",
    },
    {
      name: "북촌한옥마을",
      category: "attraction",
      lat: 37.5826,
      lng: 126.9831,
      estimatedCost: 0,
      notes: "한옥 골목",
      rating: 4.5,
      mustVisit: true,
      reviewSummary: "평점 4.5",
    },
    {
      name: "한강공원 (여의도)",
      category: "attraction",
      lat: 37.5285,
      lng: 126.9326,
      estimatedCost: 0,
      notes: "피크닉",
      rating: 4.4,
      reviewSummary: "평점 4.4",
    },
    {
      name: "롯데호텔 서울",
      category: "hotel",
      lat: 37.5651,
      lng: 126.9808,
      estimatedCost: 180000,
      notes: "명동·을지로",
      rating: 4.5,
      mustVisit: true,
      reviewSummary: "평점 4.5",
    },
    {
      name: "글래드 여의도",
      category: "hotel",
      lat: 37.5254,
      lng: 126.9177,
      estimatedCost: 110000,
      notes: "여의도·한강",
      rating: 4.3,
      reviewSummary: "평점 4.3",
    },
    {
      name: "호텔 더블유 홍대",
      category: "hotel",
      lat: 37.5558,
      lng: 126.9235,
      estimatedCost: 90000,
      notes: "홍대입구",
      rating: 4.2,
      reviewSummary: "평점 4.2",
    },
  ];
}

/** 카테고리별 삽입용 제안 장소 (TourAPI → Places → 정적 POI) */
export async function suggestPlacesByCategory({
  cityId = "seoul",
  category,
  partySize = 2,
  mapsApiKey = "",
  tourApiServiceKey = "",
  geminiApiKey = "",
  geminiModel,
  llmTimeoutMs,
  lat,
  lng,
  nearQuery = "",
} = {}) {
  const city = resolveCity(cityId);
  const domestic = isDomesticCity(city.id);
  const tourKey = String(tourApiServiceKey || "").trim();
  const centerLat = Number.isFinite(Number(lat)) ? Number(lat) : undefined;
  const centerLng = Number.isFinite(Number(lng)) ? Number(lng) : undefined;
  const near = String(nearQuery || "").trim();

  if (domestic && tourKey) {
    try {
      let fromTour = await suggestViaTourApi({
        cityId: city.id,
        category,
        partySize,
        serviceKey: tourKey,
        limit: 12,
        lat: centerLat,
        lng: centerLng,
      });
      if (fromTour?.length) {
        if (category === "food") {
          fromTour = await enrichFoodMenus(fromTour, {
            city,
            partySize,
            geminiApiKey,
            geminiModel,
            llmTimeoutMs,
          });
        }
        if (category === "hotel") {
          fromTour = await enrichHotelSuggests(fromTour, {
            cityId: city.id,
            cityNameKo: city.nameKo,
            nights: 2,
            partySize,
            city,
            geminiApiKey,
            geminiModel,
            llmTimeoutMs,
          });
        }
        return { places: fromTour, source: "tourapi" };
      }
    } catch {
      /* Google / static fallback */
    }
  }

  if (mapsApiKey) {
    try {
      let fromPlaces = await suggestViaGooglePlaces({
        city,
        category,
        partySize,
        apiKey: mapsApiKey,
        lat: centerLat,
        lng: centerLng,
        nearQuery: near,
      });
      if (fromPlaces?.length) {
        if (category === "food") {
          fromPlaces = await enrichFoodMenus(fromPlaces, {
            city,
            partySize,
            geminiApiKey,
            geminiModel,
            llmTimeoutMs,
          });
        }
        if (category === "hotel") {
          fromPlaces = await enrichHotelSuggests(fromPlaces, {
            cityId: city.id,
            cityNameKo: city.nameKo,
            nights: 2,
            partySize,
            city,
            geminiApiKey,
            geminiModel,
            llmTimeoutMs,
          });
        }
        return { places: fromPlaces, source: "places" };
      }
    } catch {
      /* static fallback */
    }
  }

  const pool = staticSuggestPool(city.id, partySize);
  let filtered = category
    ? pool.filter((p) => p.category === category)
    : pool;
  if (
    centerLat != null &&
    centerLng != null &&
    filtered.some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  ) {
    filtered = [...filtered].sort(
      (a, b) =>
        haversineKm(
          { lat: centerLat, lng: centerLng },
          { lat: a.lat, lng: a.lng },
        ) -
        haversineKm(
          { lat: centerLat, lng: centerLng },
          { lat: b.lat, lng: b.lng },
        ),
    );
  }
  let places = filtered.map((p) => ({
    id: uid("suggest"),
    ...p,
    dayIndex: 0,
    order: 0,
  }));
  if (category === "food") {
    places = await enrichFoodMenus(places, {
      city,
      partySize,
      geminiApiKey,
      geminiModel,
      llmTimeoutMs,
    });
  }
  if (category === "hotel") {
    places = await enrichHotelSuggests(places, {
      cityId: city.id,
      cityNameKo: city.nameKo,
      nights: 2,
      partySize,
      city,
      geminiApiKey,
      geminiModel,
      llmTimeoutMs,
    });
  }
  return { places, source: "static" };
}
