import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import {
  buildLodgingCandidates,
  enrichPlacesWithTransport,
} from "./transport.mjs";

const TOKYO_CENTER = { lat: 35.681236, lng: 139.767125 };
const OSAKA_CENTER = { lat: 34.6937, lng: 135.5023 };

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveCity(cityId) {
  if (cityId === "osaka") {
    return {
      id: "osaka",
      nameKo: "오사카",
      center: OSAKA_CENTER,
      mapProvider: "google",
    };
  }
  return {
    id: "tokyo",
    nameKo: "도쿄",
    center: TOKYO_CENTER,
    mapProvider: "google",
  };
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
    : [
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
      ];

  const lodgingCandidates = isOsaka
    ? [
        {
          id: "lodging-cand-1",
          name: "난바 호텔 (추천)",
          category: "hotel",
          lat: 34.6661,
          lng: 135.5005,
          estimatedCost: 16000 * nights,
          notes: `${nights}박 · 도톤보리 접근`,
          dayIndex: 0,
          order: 0,
          lodgingScore: 88,
          scoreBreakdown: {
            centrality: 90,
            priceEstimate: 78,
            ratingProxy: 85,
          },
        },
        {
          id: "lodging-cand-2",
          name: "우메다 비즈니스 호텔",
          category: "hotel",
          lat: 34.7055,
          lng: 135.4983,
          estimatedCost: 14000 * nights,
          notes: `${nights}박 · JR 허브`,
          dayIndex: 0,
          order: 0,
          lodgingScore: 82,
          scoreBreakdown: {
            centrality: 86,
            priceEstimate: 85,
            ratingProxy: 75,
          },
        },
        {
          id: "lodging-cand-3",
          name: "신사이바시 스테이",
          category: "hotel",
          lat: 34.6748,
          lng: 135.5015,
          estimatedCost: 18000 * nights,
          notes: `${nights}박 · 쇼핑 중심`,
          dayIndex: 0,
          order: 0,
          lodgingScore: 80,
          scoreBreakdown: {
            centrality: 84,
            priceEstimate: 70,
            ratingProxy: 82,
          },
        },
      ]
    : buildLodgingCandidates({ nights, partySize, topN: 5 });

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
  });

  return {
    places,
    lodgingCandidates,
    preferredLodgingId: preferred.id,
    plannedBudget: 0,
    summary: `${city.nameKo} ${nights}박 ${days}일 · ${partySize}명 기본 코스 (오프라인 폴백)`,
    engine: "fallback",
    cityId: city.id,
    mapProvider: city.mapProvider,
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
    };
  });
}

export async function generateItinerary(body, env) {
  const nights = Math.min(14, Math.max(1, Number(body?.nights) || 2));
  const days = Math.min(15, Math.max(1, Number(body?.days) || nights + 1));
  const partySize = Math.min(12, Math.max(1, Number(body?.partySize) || 2));
  const cityId = body?.cityId === "osaka" ? "osaka" : "tokyo";
  const city = resolveCity(cityId);
  const mapsApiKey = env.googleMapsApiKey || "";

  const finish = async (base) => {
    const enriched = await enrichPlacesWithTransport(base.places, {
      mapsApiKey,
      forceRecalc: false,
    });
    const lodgingCandidates =
      Array.isArray(base.lodgingCandidates) && base.lodgingCandidates.length
        ? base.lodgingCandidates
        : cityId === "tokyo"
          ? buildLodgingCandidates({ nights, partySize, topN: 5 })
          : base.lodgingCandidates || [];
    const preferredLodgingId =
      base.preferredLodgingId || lodgingCandidates[0]?.id || null;
    const plannedBudget =
      Number(base.plannedBudget) > 0
        ? Number(base.plannedBudget)
        : enriched.reduce((s, p) => s + p.estimatedCost, 0);
    return {
      places: enriched,
      lodgingCandidates,
      preferredLodgingId,
      plannedBudget,
      summary: base.summary,
      engine: base.engine,
      cityId: city.id,
      mapProvider: city.mapProvider,
      transportEngine: mapsApiKey ? "directions+haversine" : "haversine",
    };
  };

  if (!env.geminiApiKey) {
    return finish(buildFallbackItinerary({ nights, days, partySize, cityId }));
  }

  const prompt = `당신은 일본 ${city.nameKo} 여행 플래너입니다. 아래 조건으로 현실적인 일정 JSON을 만드세요.

조건:
- cityId: ${cityId}
- nights: ${nights}
- days: ${days}
- partySize: ${partySize}
- 통화: JPY
- 하루 3~5개 장소, 이동 동선이 합리적이게
- 음식/관광/숙소 균형
- lat/lng는 실제 ${city.nameKo} 좌표

반드시 이 JSON 스키마만 반환:
{
  "summary": "한 줄 요약 (한국어)",
  "plannedBudget": number,
  "preferredLodgingId": "string",
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
      "plannedTime": "HH:mm",
      "travelFromPrevMinutes": number,
      "travelFromPrevCost": number,
      "lodgingScore": number
    }
  ]
}

dayIndex는 0부터 ${days - 1}까지. hotel은 보통 dayIndex 0에 1개, estimatedCost는 ${nights}박 총액.
lodgingCandidates는 Top 3~5, scoreBreakdown 포함.
plannedTime은 하루 일정 순서에 맞는 도착/시작 시각.
travelFromPrev*는 직전 장소→현재 이동 분/엔(첫 장소는 0).`;

  try {
    const { text, engine } = await geminiComplete({
      apiKey: env.geminiApiKey,
      model: env.geminiModel,
      prompt,
      systemHint: `You are a ${city.nameKo} travel planner. Return valid JSON only.`,
      timeoutMs: env.llmTimeoutMs,
    });

    const parsed = parseJsonLoose(text);
    const places = normalizePlaces(parsed.places, {
      days,
      partySize,
      center: city.center,
    });
    if (places.length === 0) {
      return finish(
        buildFallbackItinerary({ nights, days, partySize, cityId }),
      );
    }

    places.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
    places.forEach((p, i) => {
      p.order = i;
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

    if (lodgingCandidates.length === 0 && cityId === "tokyo") {
      lodgingCandidates = buildLodgingCandidates({ nights, partySize, topN: 5 });
    }

    return finish({
      places,
      lodgingCandidates,
      preferredLodgingId:
        parsed.preferredLodgingId || lodgingCandidates[0]?.id || null,
      plannedBudget: parsed.plannedBudget,
      summary: String(parsed.summary || `${city.nameKo} ${nights}박 ${days}일 AI 일정`),
      engine,
    });
  } catch (err) {
    console.error(
      "[itinerary] Gemini failed, using fallback:",
      err?.message || err,
    );
    return finish(buildFallbackItinerary({ nights, days, partySize, cityId }));
  }
}

/** 카테고리별 삽입용 제안 장소 (도쿄 MVP + 오사카) */
export function suggestPlacesByCategory({ cityId = "tokyo", category, partySize = 2 }) {
  const city = resolveCity(cityId);
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
            name: "스미요시타이샤",
            category: "attraction",
            lat: 34.6126,
            lng: 135.4929,
            estimatedCost: 0,
            notes: "신사",
          },
          {
            name: "난바 파크스 인근 호텔",
            category: "hotel",
            lat: 34.6615,
            lng: 135.5028,
            estimatedCost: 15000,
            notes: "숙소 후보",
          },
        ]
      : [
          {
            name: "츠지한 아사쿠사",
            category: "food",
            lat: 35.7118,
            lng: 139.7948,
            estimatedCost: 1800 * partySize,
            notes: "모노자야키",
          },
          {
            name: "긴자 스시",
            category: "food",
            lat: 35.6717,
            lng: 139.7649,
            estimatedCost: 8000 * partySize,
            notes: "고급 식사",
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
            name: "오모테산도 힐즈",
            category: "attraction",
            lat: 35.6672,
            lng: 139.7095,
            estimatedCost: 0,
            notes: "산책·쇼핑",
          },
          {
            name: "시부야 엑셀 호텔",
            category: "hotel",
            lat: 35.6585,
            lng: 139.7013,
            estimatedCost: 20000,
            notes: "숙소 후보",
          },
        ];

  const filtered = category
    ? pool.filter((p) => p.category === category)
    : pool;
  return filtered.map((p) => ({
    id: uid("suggest"),
    ...p,
    dayIndex: 0,
    order: 0,
  }));
}
