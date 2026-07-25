import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import {
  isKnownCityId,
  resolveCity as resolveCityFromCatalog,
} from "./cities.mjs";
import {
  buildLodgingCandidates,
  enrichPlacesWithTransport,
  lodgingRecommendTip,
  lodgingScoreBreakdown,
} from "./transport.mjs";

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

    list.push({
      id: uid("hotel"),
      name: preferred.name,
      category: "hotel",
      lat: preferred.lat,
      lng: preferred.lng,
      estimatedCost: perNightCost(preferred),
      notes: preferred.notes || "숙소 복귀",
      dayIndex: d,
      order: nextOrder,
      cityId: cid,
      lodgingScore: preferred.lodgingScore,
      scoreBreakdown: preferred.scoreBreakdown,
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
      continue;
    }

    list.unshift({
      ...prevLast,
      id: uid("chain"),
      dayIndex: dayKeys[i],
      order: -1,
      estimatedCost: 0,
      notes: "전날 마지막 장소 · 출발",
      travelFromPrevMinutes: 0,
      travelFromPrevCost: 0,
      transportOptions: undefined,
      preferredTransportMode: undefined,
    });
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
}) {
  const city = resolveCity(cityId);
  const templates = fallbackTemplates(city.id, partySize);

  const lodgingCandidates = buildLodgingCandidates({
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
}) {
  const unique = [...new Set(cityIds)].filter(isValidCityId);
  if (unique.length <= 1) {
    return buildFallbackItinerary({
      nights,
      days,
      partySize,
      cityId: unique[0] || "seoul",
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
    return {
      id: String(p.id || uid("place")),
      name: String(p.name || `장소 ${i + 1}`),
      category: normalizePlaceCategory(p.category),
      lat: Number(p.lat) || center.lat,
      lng: Number(p.lng) || center.lng,
      estimatedCost: Math.max(0, Number(p.estimatedCost) || 0),
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
      lodgingScore:
        Number(p.lodgingScore) > 0 ? Number(p.lodgingScore) : undefined,
      scoreBreakdown: p.scoreBreakdown ?? undefined,
      cityId: isValidCityId(p.cityId) ? p.cityId : undefined,
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
  const isMulti = cityIds.length > 1;
  const domestic = isDomesticCity(cityId) || cityIds.every(isDomesticCity);
  const currency = domestic ? "KRW" : "JPY";
  // 프롬프트 cityId enum은 요청 도시만 — 전체 카탈로그(도쿄 포함)를 넣으면 모델이 이탈함
  const cityEnum = cityIds.join("|");
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
  const userRequest = String(
    body?.userRequest || body?.mainRequest || body?.extraRequest || "",
  ).trim();
  const routeOutline =
    [startAddress || null, ...cityIds.map((id) => resolveCity(id).nameKo)]
      .filter(Boolean)
      .join(" → ") || city.nameKo;

  const finish = async (base) => {
    const lodgingCandidates =
      Array.isArray(base.lodgingCandidates) && base.lodgingCandidates.length
        ? base.lodgingCandidates
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
    const enriched = await enrichPlacesWithTransport(chained, {
      mapsApiKey,
      forceRecalc: false,
      cityId,
      startHour,
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
    };
  };

  if (!env.geminiApiKey) {
    return finish(
      isMulti
        ? buildMultiCityFallbackItinerary({
            nights,
            days,
            partySize,
            cityIds,
          })
        : buildFallbackItinerary({ nights, days, partySize, cityId }),
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
    userRequest
      ? `- 사용자 요청(반드시 일정·장소 선택에 적극 반영): ${userRequest}`
      : "",
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
- 숙소 규칙: ${
    days <= 1 || nights <= 0
      ? "당일치기이므로 hotel을 넣지 마세요"
      : `당일치기가 아니므로 마지막 날(dayIndex ${days - 1})을 제외한 dayIndex 0~${days - 2} 각 Day places에 hotel을 1곳씩 포함(저녁 숙소 복귀). 총 ${Math.min(nights, days - 1)}박`
  }
- Day 체인: 각 Day의 마지막 장소가 다음날 첫 장소와 같아야 합니다(보통 숙소). dayIndex N 마지막 → dayIndex N+1 첫 슬롯.
- 하루 시작 시각 기준 약 ${startHour}시, 숙소 복귀는 저녁에 배치
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
      "scoreBreakdown": { "centrality": number, "priceEstimate": number, "ratingProxy": number }
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
      "lodgingScore": number
    }
  ]
}

dayIndex는 0부터 ${days - 1}까지.
food·attraction의 estimatedCost는 1인 가격. hotel estimatedCost는 1박 기준.
lodgingCandidates의 estimatedCost는 ${nights}박 총액. lodgingCandidates는 Top 3~5, scoreBreakdown 포함.
plannedBudget는 인원(${partySize}명) 기준 총액(맛집·관광은 1인×인원).
plannedTime은 하루 일정 순서에 맞는 도착/시작 시각. hotel은 가능하면 저녁(숙소 복귀) 시각.
travelFromPrev*는 직전 장소→현재 이동 분/${costUnit}(첫 장소는 0).`;

  try {
    const { text, engine } = await geminiComplete({
      apiKey: env.geminiApiKey,
      model: env.geminiModel,
      prompt,
      systemHint: `You are a ${city.nameKo} travel planner. Return valid JSON only.`,
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
          ? buildMultiCityFallbackItinerary({
              nights,
              days,
              partySize,
              cityIds,
            })
          : buildFallbackItinerary({ nights, days, partySize, cityId }),
      );
    }

    places.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
    places.forEach((p, i) => {
      p.order = i;
      if (!p.cityId || !cityIds.includes(p.cityId)) p.cityId = cityId;
    });

    let lodgingCandidates = Array.isArray(parsed.lodgingCandidates)
      ? parsed.lodgingCandidates
          .filter((c) => c && c.name)
          .map((c, i) => ({
            id: String(c.id || `lodging-cand-${i + 1}`),
            name: String(c.name),
            category: "hotel",
            lat: Number(c.lat) || city.center.lat,
            lng: Number(c.lng) || city.center.lng,
            estimatedCost: Math.max(0, Number(c.estimatedCost) || 0),
            notes: c.notes ? String(c.notes) : undefined,
            dayIndex: 0,
            order: 0,
            lodgingScore: Number(c.lodgingScore) || 70,
            scoreBreakdown: c.scoreBreakdown || {
              centrality: Number(c.lodgingScore) || 70,
              priceEstimate: 70,
              ratingProxy: 70,
            },
          }))
      : [];

    if (lodgingCandidates.length === 0) {
      lodgingCandidates = buildLodgingCandidates({
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
      ? buildMultiCityFallbackItinerary({
          nights,
          days,
          partySize,
          cityIds,
        }).cities
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
        ? buildMultiCityFallbackItinerary({
            nights,
            days,
            partySize,
            cityIds,
          })
        : buildFallbackItinerary({ nights, days, partySize, cityId }),
    );
  }
}

const PLACES_CATEGORY_TYPE = {
  food: "restaurant",
  attraction: "tourist_attraction",
  hotel: "lodging",
};

/**
 * Google Places Text Search (선택) — 키·쿼터 허용 시.
 * 실패하면 null → 정적 POI 폴백.
 */
async function suggestViaGooglePlaces({
  city,
  category,
  partySize = 2,
  apiKey,
}) {
  if (!apiKey || !category) return null;
  const type = PLACES_CATEGORY_TYPE[category];
  if (!type) return null;

  const query =
    category === "food"
      ? `${city.nameKo} 맛집`
      : category === "hotel"
        ? `${city.nameKo} 호텔`
        : `${city.nameKo} 관광명소`;

  const region = isDomesticCity(city.id) ? "kr" : "jp";
  const domestic = isDomesticCity(city.id);

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("location", `${city.center.lat},${city.center.lng}`);
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

  return results.slice(0, 8).map((r, i) => {
    const loc = r.geometry?.location;
    let estimatedCost =
      category === "hotel"
        ? domestic
          ? 120000
          : 18000
        : category === "food"
          ? domestic
            ? 15000
            : 2000
          : domestic
            ? 5000
            : 1000;
    if (r.price_level != null && Number.isFinite(Number(r.price_level))) {
      const lvl = Number(r.price_level);
      estimatedCost =
        category === "hotel"
          ? domestic
            ? 80000 + lvl * 25000
            : 10000 + lvl * 8000
          : category === "food"
            ? Math.round(
                (domestic ? 8000 + lvl * 7000 : 800 + lvl * 1200),
              )
            : Math.round(
                (domestic ? 2000 + lvl * 3000 : 500 + lvl * 700),
              );
    }
    const rating = Number(r.rating);
    const ratingsTotal = Number(r.user_ratings_total);
    const hasRating = Number.isFinite(rating);
    const reviewSummary = hasRating
      ? `평점 ${rating}${Number.isFinite(ratingsTotal) ? ` (${ratingsTotal}명)` : ""}`
      : undefined;
    // 숙소 notes는 주소가 아니라 추천 tip으로 채움 (모달 중복 방지)
    const notes =
      category === "hotel"
        ? `${city.nameKo} 숙소`
        : r.formatted_address
          ? String(r.formatted_address).slice(0, 80)
          : "Places";
    return {
      id: uid(`places-${i}`),
      name: String(r.name || "장소"),
      category,
      lat: Number(loc?.lat) || city.center.lat,
      lng: Number(loc?.lng) || city.center.lng,
      estimatedCost,
      notes,
      rating: hasRating ? rating : undefined,
      reviewSummary,
      mustVisit: hasRating && rating >= 4.5,
      // signatureFood는 enrichFoodMenus에서 대표 메뉴로 채움
      dayIndex: 0,
      order: 0,
      priceLevel:
        r.price_level != null && Number.isFinite(Number(r.price_level))
          ? Number(r.price_level)
          : undefined,
    };
  });
}

/** 숙소 후보에 lodgingScore / scoreBreakdown / 추천 tip 부여 */
function enrichHotelSuggests(places, { cityId, cityNameKo, nights = 2 }) {
  return (places || []).map((p) => {
    if (p.category !== "hotel") return p;
    const { lodgingScore, scoreBreakdown } = lodgingScoreBreakdown(p, {
      cityId,
      nights,
    });
    const scored = { ...p, lodgingScore, scoreBreakdown };
    const tip = lodgingRecommendTip(scored, cityNameKo);
    return {
      ...scored,
      notes: tip,
      aiReason: tip,
    };
  });
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

/** 카테고리별 삽입용 제안 장소 (Places 선택 → 정적 POI 폴백) */
export async function suggestPlacesByCategory({
  cityId = "seoul",
  category,
  partySize = 2,
  mapsApiKey = "",
  geminiApiKey = "",
  geminiModel,
  llmTimeoutMs,
} = {}) {
  const city = resolveCity(cityId);

  if (mapsApiKey) {
    try {
      let fromPlaces = await suggestViaGooglePlaces({
        city,
        category,
        partySize,
        apiKey: mapsApiKey,
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
          fromPlaces = enrichHotelSuggests(fromPlaces, {
            cityId: city.id,
            cityNameKo: city.nameKo,
            nights: 2,
          });
        }
        return { places: fromPlaces, source: "places" };
      }
    } catch {
      /* static fallback */
    }
  }

  const pool = staticSuggestPool(city.id, partySize);
  const filtered = category
    ? pool.filter((p) => p.category === category)
    : pool;
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
    places = enrichHotelSuggests(places, {
      cityId: city.id,
      cityNameKo: city.nameKo,
      nights: 2,
    });
  }
  return { places, source: "static" };
}
