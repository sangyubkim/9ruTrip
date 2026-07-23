import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import { enrichPlacesWithTransport } from "./transport.mjs";

const TOKYO_CENTER = { lat: 35.681236, lng: 139.767125 };

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Gemini 실패 시에도 앱이 동작하도록 도쿄 폴백 일정 */
export function buildTokyoFallback({ nights, days, partySize }) {
  const templates = [
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

  // 숙소 1곳 (첫날)
  places.unshift({
    id: uid("place"),
    name: "신주쿠 호텔 (추천 구역)",
    category: "hotel",
    lat: 35.6938,
    lng: 139.7034,
    estimatedCost: 18000 * nights,
    notes: `${nights}박 · 교통 허브`,
    dayIndex: 0,
    order: -1,
  });

  places.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  places.forEach((p, i) => {
    p.order = i;
  });

  const enriched = enrichPlacesWithTransport(places);
  const plannedBudget = enriched.reduce((s, p) => s + p.estimatedCost, 0);

  return {
    places: enriched,
    plannedBudget,
    summary: `도쿄 ${nights}박 ${days}일 · ${partySize}명 기본 코스 (오프라인 폴백)`,
    engine: "fallback",
  };
}

function normalizePlaces(rawPlaces, { days, partySize }) {
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
      lat: Number(p.lat) || TOKYO_CENTER.lat,
      lng: Number(p.lng) || TOKYO_CENTER.lng,
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
    };
  });
}

export async function generateItinerary(body, env) {
  const nights = Math.min(14, Math.max(1, Number(body?.nights) || 2));
  const days = Math.min(15, Math.max(1, Number(body?.days) || nights + 1));
  const partySize = Math.min(12, Math.max(1, Number(body?.partySize) || 2));
  const cityId = body?.cityId === "tokyo" ? "tokyo" : "tokyo";

  if (!env.geminiApiKey) {
    return buildTokyoFallback({ nights, days, partySize });
  }

  const prompt = `당신은 일본 도쿄 여행 플래너입니다. 아래 조건으로 현실적인 일정 JSON을 만드세요.

조건:
- cityId: ${cityId} (도쿄만)
- nights: ${nights}
- days: ${days}
- partySize: ${partySize}
- 통화: JPY
- 하루 3~5개 장소, 이동 동선이 합리적이게
- 음식/관광/숙소 균형
- lat/lng는 실제 도쿄 좌표

반드시 이 JSON 스키마만 반환:
{
  "summary": "한 줄 요약 (한국어)",
  "plannedBudget": number,
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
plannedTime은 하루 일정 순서에 맞는 도착/시작 시각.
travelFromPrev*는 직전 장소→현재 이동 분/엔(첫 장소는 0).
hotel이면 lodgingScore(1-100, 교통편의·위치 추천).`;

  try {
    const { text, engine } = await geminiComplete({
      apiKey: env.geminiApiKey,
      model: env.geminiModel,
      prompt,
      systemHint: "You are a Tokyo travel planner. Return valid JSON only.",
      timeoutMs: env.llmTimeoutMs,
    });

    const parsed = parseJsonLoose(text);
    const places = normalizePlaces(parsed.places, { days, partySize });
    if (places.length === 0) {
      return buildTokyoFallback({ nights, days, partySize });
    }

    places.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
    places.forEach((p, i) => {
      p.order = i;
    });
    const enriched = enrichPlacesWithTransport(places);

    const plannedBudget =
      Number(parsed.plannedBudget) > 0
        ? Number(parsed.plannedBudget)
        : enriched.reduce((s, p) => s + p.estimatedCost, 0);

    return {
      places: enriched,
      plannedBudget,
      summary: String(parsed.summary || `도쿄 ${nights}박 ${days}일 AI 일정`),
      engine,
    };
  } catch (err) {
    console.error("[itinerary] Gemini failed, using fallback:", err?.message || err);
    return buildTokyoFallback({ nights, days, partySize });
  }
}
