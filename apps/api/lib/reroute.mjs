import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import { enrichPlacesWithTransport } from "./transport.mjs";
import { isKnownCityId } from "./cities.mjs";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePlace(p, i, days) {
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
    lat: Number(p.lat) || 35.681236,
    lng: Number(p.lng) || 139.767125,
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
}

/**
 * 남은 일정 재생성 — completedPlaceIds 는 유지, 해당 day의 나머지 교체
 */
export async function rerouteItinerary(body, env) {
  const trip = body?.trip;
  if (!trip || !Array.isArray(trip.places)) {
    throw new Error("trip with places is required");
  }

  const days = Math.min(15, Math.max(1, Number(trip.days) || 1));
  const partySize = Math.min(12, Math.max(1, Number(trip.partySize) || 2));
  const nights = Math.min(14, Math.max(1, Number(trip.nights) || 1));
  const dayIndex = Math.min(
    Math.max(0, Number(body?.dayIndex ?? 0)),
    days - 1,
  );
  const reason = String(body?.reason || "사용자가 동선을 벗어남").slice(0, 200);
  const completedIds = new Set(
    Array.isArray(body?.completedPlaceIds)
      ? body.completedPlaceIds.map(String)
      : [],
  );

  const keepPlaces = trip.places.filter(
    (p) => p.dayIndex !== dayIndex || completedIds.has(String(p.id)),
  );
  const completedToday = trip.places
    .filter((p) => p.dayIndex === dayIndex && completedIds.has(String(p.id)))
    .sort((a, b) => a.order - b.order);

  const last = completedToday[completedToday.length - 1];
  const remainingSlots = Math.max(
    2,
    4 - completedToday.filter((p) => p.category !== "hotel").length,
  );

  const fallbackNew = buildFallbackRemaining({
    dayIndex,
    partySize,
    from: last,
    count: remainingSlots,
    startOrder: completedToday.length,
  });

  let newPlaces = fallbackNew;
  let engine = "fallback";
  let summary = `Day ${dayIndex + 1} 재루트 (폴백) · ${reason}`;

  if (env.geminiApiKey) {
    try {
      const prompt = `당신은 도쿄 여행 재루트 플래너입니다.
이미 방문한 장소는 유지하고, Day ${dayIndex + 1}의 남은 일정만 새로 제안하세요.

조건:
- partySize: ${partySize}, nights: ${nights}, days: ${days}
- 재루트 이유: ${reason}
- 이미 완료된 장소: ${JSON.stringify(
        completedToday.map((p) => ({
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          plannedTime: p.plannedTime,
        })),
      )}
- 시작 좌표(마지막 완료지 또는 도쿄역): ${JSON.stringify(
        last
          ? { lat: last.lat, lng: last.lng, name: last.name }
          : { lat: 35.681236, lng: 139.767125, name: "도쿄역" },
      )}
- 남은 슬롯 약 ${remainingSlots}개 (hotel 제외 위주)
- 동선이 자연스럽고 이동 시간/비용도 현실적으로

반드시 JSON만:
{
  "summary": "한국어 한 줄",
  "places": [
    {
      "id": "string",
      "name": "한국어",
      "category": "attraction|food|hotel|transport|other",
      "lat": number,
      "lng": number,
      "estimatedCost": number,
      "notes": "짧은 팁",
      "dayIndex": ${dayIndex},
      "order": number,
      "plannedTime": "HH:mm",
      "travelFromPrevMinutes": number,
      "travelFromPrevCost": number
    }
  ]
}`;

      const { text, engine: eng } = await geminiComplete({
        apiKey: env.geminiApiKey,
        model: env.geminiModel,
        prompt,
        systemHint: "Tokyo reroute planner. Return valid JSON only.",
        timeoutMs: env.llmTimeoutMs,
      });
      const parsed = parseJsonLoose(text);
      const raw = Array.isArray(parsed.places) ? parsed.places : [];
      if (raw.length > 0) {
        newPlaces = raw.map((p, i) =>
          normalizePlace({ ...p, dayIndex }, i, days),
        );
        engine = eng;
        summary = String(parsed.summary || summary);
      }
    } catch (err) {
      console.error("[reroute] Gemini failed:", err?.message || err);
    }
  }

  const merged = [...keepPlaces, ...newPlaces];
  const enriched = await enrichPlacesWithTransport(merged, {
    mapsApiKey: env.googleMapsApiKey || "",
    forceRecalc: true,
    cityId: isKnownCityId(trip.cityId) ? trip.cityId : "tokyo",
  });
  const plannedBudget = enriched.reduce((s, p) => s + (p.estimatedCost || 0), 0);

  return {
    places: enriched,
    plannedBudget,
    summary,
    engine,
    dayIndex,
    replacedCount: newPlaces.length,
  };
}

function buildFallbackRemaining({ dayIndex, partySize, from, count, startOrder }) {
  const pool = [
    {
      name: "긴자 산책",
      category: "attraction",
      lat: 35.6717,
      lng: 139.765,
      estimatedCost: 0,
      notes: "재루트 · 쇼핑거리",
    },
    {
      name: "스시잔마이 긴자",
      category: "food",
      lat: 35.6712,
      lng: 139.7645,
      estimatedCost: 3500 * partySize,
      notes: "재루트 · 식사",
    },
    {
      name: "도쿄역 키타테 그랑스타",
      category: "food",
      lat: 35.6815,
      lng: 139.7672,
      estimatedCost: 2000 * partySize,
      notes: "재루트 · 에키벤/간식",
    },
    {
      name: "마루노우치 야외조각",
      category: "attraction",
      lat: 35.681,
      lng: 139.7635,
      estimatedCost: 0,
      notes: "재루트 · 가벼운 산책",
    },
    {
      name: "요요기 공원",
      category: "attraction",
      lat: 35.671,
      lng: 139.6948,
      estimatedCost: 0,
      notes: "재루트 · 휴식",
    },
  ];

  // from 근처 우선 정렬
  const sorted = [...pool].sort((a, b) => {
    if (!from) return 0;
    const da =
      (a.lat - from.lat) ** 2 + (a.lng - from.lng) ** 2;
    const db =
      (b.lat - from.lat) ** 2 + (b.lng - from.lng) ** 2;
    return da - db;
  });

  return sorted.slice(0, count).map((t, i) => ({
    id: uid("place"),
    ...t,
    dayIndex,
    order: startOrder + i,
  }));
}
