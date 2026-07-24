import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import { enrichPlacesWithTransport } from "./transport.mjs";
import { isKnownCityId, resolveCity } from "./cities.mjs";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePlace(p, i, days, center) {
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

  const cityId = isKnownCityId(trip.cityId) ? trip.cityId : "seoul";
  const city = resolveCity(cityId);
  const domestic = city.region === "domestic" || city.countryId === "kr";
  const currency = domestic ? "KRW" : "JPY";
  const regionLabel = domestic
    ? `한국 ${city.nameKo}`
    : `${city.countryNameKo || city.countryId} ${city.nameKo}`;
  const hubName = domestic ? `${city.nameKo} 중심` : `${city.nameKo} 중심역`;

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
    city,
    domestic,
  });

  let newPlaces = fallbackNew;
  let engine = "fallback";
  let summary = `Day ${dayIndex + 1} 재루트 (폴백) · ${reason}`;

  if (env.geminiApiKey) {
    try {
      const prompt = `당신은 ${regionLabel} 여행 재루트 플래너입니다.
이미 방문한 장소는 유지하고, Day ${dayIndex + 1}의 남은 일정만 새로 제안하세요.

조건:
- 도시: ${city.nameKo} (${cityId})
- 통화: ${currency}
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
- 시작 좌표(마지막 완료지 또는 ${hubName}): ${JSON.stringify(
        last
          ? { lat: last.lat, lng: last.lng, name: last.name }
          : { lat: city.center.lat, lng: city.center.lng, name: hubName },
      )}
- 남은 슬롯 약 ${remainingSlots}개 (hotel 제외 위주)
- 동선이 자연스럽고 이동 시간/비용도 현실적으로 (${currency})
- 반드시 ${city.nameKo} 및 인근 국내 명소만 제안

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
        systemHint: `${city.nameKo} reroute planner. Return valid JSON only. Prefer ${currency}.`,
        timeoutMs: env.llmTimeoutMs,
      });
      const parsed = parseJsonLoose(text);
      const raw = Array.isArray(parsed.places) ? parsed.places : [];
      if (raw.length > 0) {
        newPlaces = raw.map((p, i) =>
          normalizePlace({ ...p, dayIndex }, i, days, city.center),
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
    cityId,
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

function buildFallbackRemaining({
  dayIndex,
  partySize,
  from,
  count,
  startOrder,
  city,
  domestic,
}) {
  const { lat, lng } = city.center;
  const meal = domestic ? 15000 * partySize : 3500 * partySize;
  const snack = domestic ? 8000 * partySize : 2000 * partySize;
  const pool = [
    {
      name: `${city.nameKo} 중심 산책`,
      category: "attraction",
      lat,
      lng,
      estimatedCost: 0,
      notes: "재루트 · 가벼운 산책",
    },
    {
      name: `${city.nameKo} 현지 맛집`,
      category: "food",
      lat: lat + 0.004,
      lng: lng + 0.003,
      estimatedCost: meal,
      notes: "재루트 · 식사",
    },
    {
      name: `${city.nameKo} 카페·간식`,
      category: "food",
      lat: lat - 0.003,
      lng: lng + 0.002,
      estimatedCost: snack,
      notes: "재루트 · 휴식",
    },
    {
      name: `${city.nameKo} 전망 포인트`,
      category: "attraction",
      lat: lat + 0.006,
      lng: lng - 0.002,
      estimatedCost: 0,
      notes: "재루트 · 포토스팟",
    },
    {
      name: `${city.nameKo} 공원·휴식`,
      category: "attraction",
      lat: lat - 0.005,
      lng: lng - 0.004,
      estimatedCost: 0,
      notes: "재루트 · 휴식",
    },
  ];

  const sorted = [...pool].sort((a, b) => {
    if (!from) return 0;
    const da = (a.lat - from.lat) ** 2 + (a.lng - from.lng) ** 2;
    const db = (b.lat - from.lat) ** 2 + (b.lng - from.lng) ** 2;
    return da - db;
  });

  return sorted.slice(0, count).map((t, i) => ({
    id: uid("place"),
    ...t,
    dayIndex,
    order: startOrder + i,
  }));
}
