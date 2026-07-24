import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import {
  buildLodgingCandidates,
  enrichPlacesWithTransport,
} from "./transport.mjs";
import {
  DEFAULT_CITY_ID,
  isKnownCityId,
  resolveCity,
} from "./cities.mjs";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampPref(n, fallback = 3) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(5, Math.max(1, Math.round(v)));
}

function normalizePlaceRef(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || raw.query || "").trim();
  if (!name) return null;
  return {
    name,
    address: raw.address ? String(raw.address) : undefined,
    lat: Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : undefined,
    lng: Number.isFinite(Number(raw.lng)) ? Number(raw.lng) : undefined,
    placeId: raw.placeId ? String(raw.placeId) : undefined,
    query: raw.query ? String(raw.query) : name,
  };
}

/** weights 비율로 Day 분할 (모바일 buildCityLegs와 동일 취지) */
function splitDaysByWeights(cityIds, days, weights) {
  const unique = [...new Set(cityIds)].filter((id) => isKnownCityId(id));
  if (unique.length === 0) unique.push(DEFAULT_CITY_ID);
  if (unique.length === 1) {
    return [
      {
        cityId: unique[0],
        cityName: resolveCity(unique[0]).nameKo,
        dayIndexes: Array.from({ length: days }, (_, i) => i),
      },
    ];
  }
  const n = unique.length;
  const raw =
    Array.isArray(weights) && weights.length >= n
      ? unique.map((_, i) => Math.max(0, Number(weights[i]) || 0))
      : unique.map(() => 1);
  const sum = raw.reduce((a, b) => a + b, 0) || n;
  const ratios = raw.map((w) => w / sum);
  let counts = ratios.map((r) => Math.floor(days * r));
  if (days >= n) {
    for (let i = 0; i < n; i++) if (counts[i] < 1) counts[i] = 1;
  }
  let allocated = counts.reduce((a, b) => a + b, 0);
  while (allocated > days) {
    let maxI = 0;
    for (let i = 1; i < n; i++) if (counts[i] > counts[maxI]) maxI = i;
    if (counts[maxI] <= (days >= n ? 1 : 0)) break;
    counts[maxI] -= 1;
    allocated -= 1;
  }
  const order = ratios
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i);
  let rem = days - allocated;
  let oi = 0;
  while (rem > 0 && oi < order.length * 20) {
    counts[order[oi % order.length]] += 1;
    rem -= 1;
    oi += 1;
  }
  const legs = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const count = Math.max(0, counts[i]);
    legs.push({
      cityId: unique[i],
      cityName: resolveCity(unique[i]).nameKo,
      dayIndexes: Array.from({ length: count }, (_, j) => cursor + j),
    });
    cursor += count;
  }
  while (cursor < days) {
    legs[legs.length - 1].dayIndexes.push(cursor);
    cursor += 1;
  }
  return legs;
}

function buildRouteOutline({ origin, endPoint, cityIds, stopoverCityIds }) {
  const parts = [];
  if (origin?.name) parts.push(origin.name);
  const stops = (stopoverCityIds || []).filter(
    (id) => isKnownCityId(id) && !cityIds.includes(id),
  );
  if (cityIds.length <= 1) {
    for (const id of cityIds) parts.push(resolveCity(id).nameKo);
    for (const id of stops) parts.push(`(경유 ${resolveCity(id).nameKo})`);
  } else {
    parts.push(resolveCity(cityIds[0]).nameKo);
    for (const id of stops) parts.push(`(경유 ${resolveCity(id).nameKo})`);
    for (let i = 1; i < cityIds.length; i++) {
      parts.push(resolveCity(cityIds[i]).nameKo);
    }
  }
  if (endPoint?.name) parts.push(endPoint.name);
  return parts.join(" → ") || resolveCity(cityIds[0]).nameKo;
}

/** Gemini 실패 시에도 앱이 동작하도록 폴백 일정 */
export function buildFallbackItinerary({
  nights,
  days,
  partySize,
  cityId = "tokyo",
}) {
  const city = resolveCity(cityId);
  const isOsaka = city.id === "osaka";
  const isTokyo = city.id === "tokyo";
  const { lat: cLat, lng: cLng } = city.center;

  const templates = isOsaka
    ? [
        {
          name: "오사카성",
          category: "attraction",
          lat: 34.6873,
          lng: 135.5262,
          estimatedCost: 600 * partySize,
          notes: "성 공원",
        },
        {
          name: "도톤보리",
          category: "food",
          lat: 34.6686,
          lng: 135.5013,
          estimatedCost: 2500 * partySize,
          notes: "타코야키·라멘",
        },
        {
          name: "신세카이·츠텐카쿠",
          category: "attraction",
          lat: 34.6525,
          lng: 135.5063,
          estimatedCost: 800 * partySize,
          notes: "레트로 거리",
        },
        {
          name: "우메다 스카이빌딩",
          category: "attraction",
          lat: 34.7055,
          lng: 135.4904,
          estimatedCost: 1500 * partySize,
          notes: "전망대",
        },
        {
          name: "구로몬 시장",
          category: "food",
          lat: 34.6668,
          lng: 135.5061,
          estimatedCost: 3000 * partySize,
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
      ]
    : isTokyo
      ? [
        {
          name: "센소지 (아사쿠사)",
          category: "attraction",
          lat: 35.714765,
          lng: 139.796655,
          estimatedCost: 0,
          notes: "아침 방문 추천",
        },
        {
          name: "나카미세도리 먹거리",
          category: "food",
          lat: 35.7115,
          lng: 139.7962,
          estimatedCost: 1500 * partySize,
          notes: "길거리 음식",
        },
        {
          name: "도쿄 스카이트리",
          category: "attraction",
          lat: 35.710063,
          lng: 139.8107,
          estimatedCost: 2300 * partySize,
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
          estimatedCost: 1200 * partySize,
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
          estimatedCost: 2000 * partySize,
          notes: "쇼핑·간식",
        },
        {
          name: "신주쿠 골든가이",
          category: "food",
          lat: 35.6938,
          lng: 139.7015,
          estimatedCost: 4000 * partySize,
          notes: "이자카야",
        },
        {
          name: "우에노 공원·국립박물관",
          category: "attraction",
          lat: 35.7156,
          lng: 139.7745,
          estimatedCost: 1000 * partySize,
          notes: "문화 일정",
        },
        {
          name: "아키하바라",
          category: "attraction",
          lat: 35.7023,
          lng: 139.7745,
          estimatedCost: 3000 * partySize,
          notes: "서브컬처·쇼핑",
        },
        {
          name: "츠키지 장외시장",
          category: "food",
          lat: 35.6654,
          lng: 139.7707,
          estimatedCost: 3500 * partySize,
          notes: "해산물 아침",
        },
        {
          name: "오다이바 팀랩 플래닛",
          category: "attraction",
          lat: 35.6265,
          lng: 139.7825,
          estimatedCost: 3800 * partySize,
          notes: "미디어아트",
        },
      ]
    : [
        {
          name: `${city.nameKo} 시내 명소`,
          category: "attraction",
          lat: cLat + 0.008,
          lng: cLng + 0.006,
          estimatedCost: 1500 * partySize,
          notes: "대표 명소",
        },
        {
          name: `${city.nameKo} 로컬 맛집`,
          category: "food",
          lat: cLat - 0.004,
          lng: cLng + 0.003,
          estimatedCost: 2500 * partySize,
          notes: "현지 식사",
        },
        {
          name: `${city.nameKo} 산책 코스`,
          category: "attraction",
          lat: cLat + 0.003,
          lng: cLng - 0.005,
          estimatedCost: 0,
          notes: "도보 탐방",
        },
        {
          name: `${city.nameKo} 마켓·쇼핑`,
          category: "attraction",
          lat: cLat - 0.006,
          lng: cLng - 0.002,
          estimatedCost: 2000 * partySize,
          notes: "쇼핑",
        },
        {
          name: `${city.nameKo} 카페`,
          category: "food",
          lat: cLat + 0.002,
          lng: cLng + 0.004,
          estimatedCost: 1200 * partySize,
          notes: "휴식",
        },
        {
          name: `${city.nameKo} 전망·야경`,
          category: "attraction",
          lat: cLat - 0.002,
          lng: cLng + 0.007,
          estimatedCost: 1800 * partySize,
          notes: "야경",
        },
      ];

  const lodgingCandidates = buildLodgingCandidates({
    nights,
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
      });
    }
  }

  places.unshift({
    id: preferred.id || uid("place"),
    name: preferred.name,
    category: "hotel",
    lat: preferred.lat,
    lng: preferred.lng,
    estimatedCost: preferred.estimatedCost,
    notes: preferred.notes,
    dayIndex: 0,
    order: -1,
    lodgingScore: preferred.lodgingScore,
    scoreBreakdown: preferred.scoreBreakdown,
  });

  places.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  places.forEach((p, i) => {
    p.order = i;
    p.cityId = city.id;
  });

  return {
    places,
    lodgingCandidates,
    preferredLodgingId: preferred.id,
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
  cityIds = ["tokyo", "osaka"],
  cityWeights,
}) {
  const unique = [...new Set(cityIds)].filter((id) => isKnownCityId(id));
  if (unique.length <= 1) {
    return buildFallbackItinerary({
      nights,
      days,
      partySize,
      cityId: unique[0] || DEFAULT_CITY_ID,
    });
  }

  const legs = splitDaysByWeights(unique, days, cityWeights);

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

  const names = legs.map((l) => l.cityName).join(" · ");
  return {
    places: allPlaces,
    lodgingCandidates,
    preferredLodgingId,
    plannedBudget: 0,
    summary: `${names} ${nights}박 ${days}일 · ${partySize}명 멀티시티 폴백`,
    engine: "fallback-multicity",
    cityId: legs[0].cityId,
    cities: legs,
    mapProvider: "google",
  };
}

/** @deprecated */
export function buildTokyoFallback(opts) {
  return buildFallbackItinerary({ ...opts, cityId: "tokyo" });
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
      category: ["attraction", "food", "hotel", "transport", "other"].includes(
        p.category,
      )
        ? p.category
        : "other",
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
      cityId: isKnownCityId(p.cityId) ? p.cityId : undefined,
    };
  });
}

export async function generateItinerary(body, env) {
  const nights = Math.min(14, Math.max(1, Number(body?.nights) || 2));
  const days = Math.min(15, Math.max(1, Number(body?.days) || nights + 1));
  const partySize = Math.min(12, Math.max(1, Number(body?.partySize) || 2));
  const rawCityIds = Array.isArray(body?.cityIds) ? body.cityIds : [];
  const cityIds = [
    ...new Set(
      [body?.cityId, ...rawCityIds].filter((id) => isKnownCityId(id)),
    ),
  ];
  if (cityIds.length === 0) cityIds.push(DEFAULT_CITY_ID);
  const cityId = cityIds[0];
  const city = resolveCity(cityId);
  const mapsApiKey = env.googleMapsApiKey || "";
  const isMulti = cityIds.length > 1;
  const origin = normalizePlaceRef(body?.origin);
  const endPoint = normalizePlaceRef(body?.endPoint);
  const stopoverCityIds = [
    ...new Set(
      (Array.isArray(body?.stopoverCityIds) ? body.stopoverCityIds : []).filter(
        (id) => isKnownCityId(id) && !cityIds.includes(id),
      ),
    ),
  ];
  const cityWeights = Array.isArray(body?.cityWeights)
    ? body.cityWeights.map((w) => Number(w) || 0)
    : undefined;
  const preferences = {
    food: clampPref(body?.preferences?.food),
    attraction: clampPref(body?.preferences?.attraction),
    activity: clampPref(body?.preferences?.activity),
    cost: clampPref(body?.preferences?.cost),
    minTravel: clampPref(body?.preferences?.minTravel),
  };
  const mainRequest = String(body?.mainRequest || "").trim().slice(0, 800);
  const extraRequest = String(body?.extraRequest || "").trim().slice(0, 800);
  const weightedLegs = splitDaysByWeights(cityIds, days, cityWeights);
  const routeOutline = buildRouteOutline({
    origin,
    endPoint,
    cityIds,
    stopoverCityIds,
  });

  const finish = async (base) => {
    const enriched = await enrichPlacesWithTransport(base.places, {
      mapsApiKey,
      forceRecalc: false,
      cityId,
    });
    const lodgingCandidates =
      Array.isArray(base.lodgingCandidates) && base.lodgingCandidates.length
        ? base.lodgingCandidates
        : buildLodgingCandidates({ nights, partySize, topN: 5, cityId });
    const preferredLodgingId =
      base.preferredLodgingId || lodgingCandidates[0]?.id || null;
    const plannedBudget =
      Number(base.plannedBudget) > 0
        ? Number(base.plannedBudget)
        : enriched.reduce((s, p) => s + p.estimatedCost, 0);
    const briefing =
      String(base.briefing || base.summary || "").trim() ||
      `${routeOutline} · ${nights}박 ${days}일 추천 일정`;
    return {
      places: enriched,
      lodgingCandidates,
      preferredLodgingId,
      plannedBudget,
      summary: base.summary,
      briefing,
      routeOutline: base.routeOutline || routeOutline,
      engine: base.engine,
      cityId: base.cityId || city.id,
      cities: base.cities || weightedLegs,
      mapProvider: city.mapProvider,
      transportEngine: mapsApiKey ? "directions+haversine" : "haversine",
    };
  };

  const fallbackMulti = () =>
    buildMultiCityFallbackItinerary({
      nights,
      days,
      partySize,
      cityIds,
      cityWeights,
    });

  if (!env.geminiApiKey) {
    const base = isMulti
      ? fallbackMulti()
      : buildFallbackItinerary({ nights, days, partySize, cityId });
    return finish({
      ...base,
      cities: weightedLegs,
      routeOutline,
      briefing: `${routeOutline}. ${base.summary}${
        extraRequest ? ` 추가요청 반영 예정: ${extraRequest}` : ""
      }`,
    });
  }

  const weightHint = isMulti
    ? `\n- 여행지 Day 비중: ${cityIds
        .map(
          (id, i) =>
            `${resolveCity(id).nameKo} ${cityWeights?.[i] ?? Math.round(100 / cityIds.length)}% → Day ${
              weightedLegs[i]?.dayIndexes.map((d) => d + 1).join(",") || "?"
            }`,
        )
        .join(" / ")}`
    : "";

  const stopHint =
    stopoverCityIds.length > 0
      ? `\n- 경유 도시(일정 Day 없이 경로에만): ${stopoverCityIds
          .map((id) => resolveCity(id).nameKo)
          .join(", ")}. places에 경유 도시는 transport 카테고리로 짧게 1곳만 언급.`
      : "";

  const placeHint = [
    origin
      ? `출발: ${origin.name}${origin.address ? ` (${origin.address})` : ""}${
          origin.lat != null ? ` @${origin.lat},${origin.lng}` : ""
        }`
      : null,
    endPoint
      ? `도착: ${endPoint.name}${endPoint.address ? ` (${endPoint.address})` : ""}${
          endPoint.lat != null ? ` @${endPoint.lat},${endPoint.lng}` : ""
        }`
      : null,
  ]
    .filter(Boolean)
    .join("\n- ");

  const prefHint = `선호 가중치(1–5): 맛집=${preferences.food}, 명소=${preferences.attraction}, 액티비티=${preferences.activity}, 비용(높을수록 절약)=${preferences.cost}, 최소이동=${preferences.minTravel}`;

  const priorityBlock = extraRequest
    ? `\n【최우선 추가 요청 — 다른 조건보다 우선】\n${extraRequest}\n`
    : "";
  const mainBlock = mainRequest
    ? `\n주요 요청:\n${mainRequest}\n`
    : "";

  const multiHint = isMulti
    ? `\n- 여행지 도시: ${cityIds.map((id) => resolveCity(id).nameKo).join(" → ")}. Day를 비중대로 나누고 각 place에 cityId를 넣으세요.${weightHint}`
    : "";

  const prompt = `당신은 ${city.countryNameKo || ""} 여행 플래너입니다. 아래 조건으로 현실적인 일정 JSON을 만드세요.
${priorityBlock}${mainBlock}
조건:
- 추천 경로 골격: ${routeOutline}
- cityId: ${cityId}
- cityIds(여행지): ${JSON.stringify(cityIds)}
- stopoverCityIds(경유만): ${JSON.stringify(stopoverCityIds)}
- nights: ${nights}
- days: ${days}
- partySize: ${partySize}
- 통화: ${city.currency || "USD"}
- ${prefHint}
${placeHint ? `- ${placeHint}` : ""}
- 하루 3~5개 장소, 이동 동선이 합리적이게
- 가중치가 높은 카테고리를 더 많이 넣고, 비용·최소이동 가중치가 높으면 저렴하고 가까운 동선 우선
- lat/lng는 해당 도시 실제 좌표${multiHint}${stopHint}

반드시 이 JSON 스키마만 반환:
{
  "summary": "한 줄 요약 (한국어)",
  "briefing": "3~6문장 여행 브리핑 (경로·테마·주의점, 한국어)",
  "routeOutline": "출발→여행지→(경유)→도착 한 줄",
  "plannedBudget": number,
  "preferredLodgingId": "string",
  "cities": [{"cityId":"도시id","cityName":"문자열","dayIndexes":[0]}],
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
      "cityId": "도시id",
      "plannedTime": "HH:mm",
      "travelFromPrevMinutes": number,
      "travelFromPrevCost": number,
      "lodgingScore": number
    }
  ]
}

dayIndex는 0부터 ${days - 1}까지. hotel은 보통 dayIndex 0에 1개, estimatedCost는 ${nights}박 총액.
cities.dayIndexes는 비중 힌트와 최대한 일치: ${JSON.stringify(weightedLegs)}.
lodgingCandidates는 Top 3~5, scoreBreakdown 포함.
plannedTime은 하루 일정 순서에 맞는 도착/시작 시각.
travelFromPrev*는 직전 장소→현재 이동 분/비용(첫 장소는 0).`;

  try {
    const { text, engine } = await geminiComplete({
      apiKey: env.geminiApiKey,
      model: env.geminiModel,
      prompt,
      systemHint: `You are a travel planner. Extra user requests have highest priority. Return valid JSON only.`,
      timeoutMs: env.llmTimeoutMs,
    });

    const parsed = parseJsonLoose(text);
    const places = normalizePlaces(parsed.places, {
      days,
      partySize,
      center: city.center,
    });
    if (places.length === 0) {
      const base = isMulti
        ? fallbackMulti()
        : buildFallbackItinerary({ nights, days, partySize, cityId });
      return finish({
        ...base,
        cities: weightedLegs,
        routeOutline,
        briefing: `${routeOutline}. ${base.summary}`,
      });
    }

    places.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
    places.forEach((p, i) => {
      p.order = i;
      if (!p.cityId) p.cityId = cityId;
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
          .filter((c) => c && isKnownCityId(c.cityId))
          .map((c) => ({
            cityId: c.cityId,
            cityName: String(c.cityName || resolveCity(c.cityId).nameKo),
            dayIndexes: Array.isArray(c.dayIndexes)
              ? c.dayIndexes.map(Number).filter((n) => n >= 0)
              : [],
          }))
          .filter((c) => c.dayIndexes.length > 0)
      : [];

    return finish({
      places,
      lodgingCandidates,
      preferredLodgingId:
        parsed.preferredLodgingId || lodgingCandidates[0]?.id || null,
      plannedBudget: Number(parsed.plannedBudget) || 0,
      summary: String(parsed.summary || `${city.nameKo} 일정`).slice(0, 200),
      briefing: String(
        parsed.briefing || parsed.summary || `${routeOutline} 추천 일정`,
      ).slice(0, 1200),
      routeOutline: String(parsed.routeOutline || routeOutline).slice(0, 300),
      engine,
      cityId,
      cities: citiesFromParsed.length ? citiesFromParsed : weightedLegs,
    });
  } catch (err) {
    console.error("[itinerary] Gemini failed:", err?.message || err);
    const base = isMulti
      ? fallbackMulti()
      : buildFallbackItinerary({ nights, days, partySize, cityId });
    return finish({
      ...base,
      cities: weightedLegs,
      routeOutline,
      briefing: `${routeOutline}. ${base.summary}`,
    });
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

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("location", `${city.center.lat},${city.center.lng}`);
  url.searchParams.set("radius", "10000");
  url.searchParams.set("type", type);
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", "jp");
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
        ? 18000
        : category === "food"
          ? 2000 * partySize
          : 1000 * partySize;
    if (r.price_level != null && Number.isFinite(Number(r.price_level))) {
      const lvl = Number(r.price_level);
      estimatedCost =
        category === "hotel"
          ? 10000 + lvl * 8000
          : category === "food"
            ? Math.round((800 + lvl * 1200) * partySize)
            : Math.round((500 + lvl * 700) * partySize);
    }
    return {
      id: uid(`places-${i}`),
      name: String(r.name || "장소"),
      category,
      lat: Number(loc?.lat) || city.center.lat,
      lng: Number(loc?.lng) || city.center.lng,
      estimatedCost,
      notes: r.formatted_address
        ? String(r.formatted_address).slice(0, 80)
        : r.rating
          ? `평점 ${r.rating}`
          : "Places",
      dayIndex: 0,
      order: 0,
    };
  });
}

/** 카테고리별 삽입용 제안 장소 (Places 선택 → 정적 POI 폴백) */
export async function suggestPlacesByCategory({
  cityId = "tokyo",
  category,
  partySize = 2,
  mapsApiKey = "",
} = {}) {
  const city = resolveCity(cityId);

  if (mapsApiKey) {
    try {
      const fromPlaces = await suggestViaGooglePlaces({
        city,
        category,
        partySize,
        apiKey: mapsApiKey,
      });
      if (fromPlaces?.length) {
        return { places: fromPlaces, source: "places" };
      }
    } catch {
      /* static fallback */
    }
  }

  const pool =
    city.id === "osaka"
      ? [
          {
            name: "이쿠노 코리아타운",
            category: "food",
            lat: 34.6555,
            lng: 135.542,
            estimatedCost: 2000 * partySize,
            notes: "한식·거리음식",
          },
          {
            name: "구로몬 시장",
            category: "food",
            lat: 34.6668,
            lng: 135.5061,
            estimatedCost: 3000 * partySize,
            notes: "해산물·아침",
          },
          {
            name: "타코야키 도톤보리 본점 거리",
            category: "food",
            lat: 34.6687,
            lng: 135.5013,
            estimatedCost: 800 * partySize,
            notes: "간식",
          },
          {
            name: "아베노하루카스 전망대",
            category: "attraction",
            lat: 34.6456,
            lng: 135.5135,
            estimatedCost: 1800 * partySize,
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
            estimatedCost: 600 * partySize,
            notes: "성·산책",
          },
          {
            name: "우메다 스카이빌딩",
            category: "attraction",
            lat: 34.7055,
            lng: 135.4904,
            estimatedCost: 1500 * partySize,
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
        ]
      : city.id === "tokyo"
        ? [
          {
            name: "츠지한 아사쿠사",
            category: "food",
            lat: 35.7118,
            lng: 139.7948,
            estimatedCost: 1800 * partySize,
            notes: "모노자야키",
          },
          {
            name: "이치란 라멘 시부야",
            category: "food",
            lat: 35.6598,
            lng: 139.7004,
            estimatedCost: 1200 * partySize,
            notes: "돈코츠 라멘",
          },
          {
            name: "스시 잔마이 토요스",
            category: "food",
            lat: 35.645,
            lng: 139.7845,
            estimatedCost: 4500 * partySize,
            notes: "회전·단품 스시",
          },
          {
            name: "긴자 교자 로쿠포쿠",
            category: "food",
            lat: 35.6712,
            lng: 139.7645,
            estimatedCost: 2200 * partySize,
            notes: "교자",
          },
          {
            name: "도쿄타워",
            category: "attraction",
            lat: 35.6586,
            lng: 139.7454,
            estimatedCost: 1200 * partySize,
            notes: "전망",
          },
          {
            name: "센소지 (아사쿠사)",
            category: "attraction",
            lat: 35.714765,
            lng: 139.796655,
            estimatedCost: 0,
            notes: "사찰",
          },
          {
            name: "도쿄 스카이트리",
            category: "attraction",
            lat: 35.710063,
            lng: 139.8107,
            estimatedCost: 2300 * partySize,
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
        ]
        : [
            {
              name: `${city.nameKo} 추천 맛집`,
              category: "food",
              lat: city.center.lat + 0.003,
              lng: city.center.lng + 0.002,
              estimatedCost: 2000 * partySize,
              notes: "로컬 식사",
            },
            {
              name: `${city.nameKo} 명소`,
              category: "attraction",
              lat: city.center.lat - 0.002,
              lng: city.center.lng + 0.004,
              estimatedCost: 1500 * partySize,
              notes: "대표 명소",
            },
            {
              name: `${city.nameKo} 산책`,
              category: "attraction",
              lat: city.center.lat + 0.005,
              lng: city.center.lng - 0.003,
              estimatedCost: 0,
              notes: "도보",
            },
            {
              name: `${city.nameKo} 숙소 후보`,
              category: "hotel",
              lat: city.center.lat,
              lng: city.center.lng,
              estimatedCost: 18000,
              notes: "시내",
            },
          ];

  const filtered = category
    ? pool.filter((p) => p.category === category)
    : pool;
  const places = filtered.map((p) => ({
    id: uid("suggest"),
    ...p,
    dayIndex: 0,
    order: 0,
  }));
  return { places, source: "static" };
}
