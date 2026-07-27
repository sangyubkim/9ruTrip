import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import {
  buildFallbackItinerary,
  finalizePlaceChain,
} from "./itinerary.mjs";
import { ensureDailyMealSlots } from "./meal-slots.mjs";
import { enrichPlacesWithTransport } from "./transport.mjs";
import { isKnownCityId, resolveCity } from "./cities.mjs";
import { fetchTourPlacePool } from "./tourapi.mjs";
import { groundDomesticPlaces } from "./place-ground.mjs";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function compactPlace(p) {
  return {
    name: String(p?.name || ""),
    category: String(p?.category || "other"),
    plannedTime: p?.plannedTime ? String(p.plannedTime) : undefined,
    cityId: isKnownCityId(p?.cityId) ? p.cityId : undefined,
    lat: Number(p?.lat) || undefined,
    lng: Number(p?.lng) || undefined,
  };
}

/**
 * 인접 Day(day-1, day+1) 일정을 재생성 컨텍스트로 요약.
 * 순수 헬퍼 — 단위 테스트용.
 */
export function neighborDayContext(places, dayIndex) {
  const day = Math.max(0, Number(dayIndex) || 0);
  const list = Array.isArray(places) ? places : [];
  const ofDay = (d) =>
    list
      .filter((p) => Number(p?.dayIndex) === d)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(compactPlace);

  return {
    previousDay: day > 0 ? ofDay(day - 1) : [],
    nextDay: ofDay(day + 1),
  };
}

function normalizePlace(p, i, days, center, cityId, dayIndex) {
  const clampedDay = Math.min(
    Math.max(0, Number(p.dayIndex ?? dayIndex)),
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
    dayIndex: clampedDay,
    order: Number.isFinite(Number(p.order)) ? Number(p.order) : i,
    cityId: isKnownCityId(p.cityId) ? p.cityId : cityId,
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

function resolveTargetCityId(trip, dayIndex, bodyCityId) {
  if (isKnownCityId(bodyCityId)) return bodyCityId;
  const dayLeg = Array.isArray(trip.cities)
    ? trip.cities.find(
        (c) =>
          Array.isArray(c.dayIndexes) && c.dayIndexes.includes(dayIndex),
      )
    : null;
  if (isKnownCityId(dayLeg?.cityId)) return dayLeg.cityId;
  if (isKnownCityId(trip.cityId)) return trip.cityId;
  return "seoul";
}

/** targetCityId가 오면 trip.cities의 해당 day 배정을 맞춘다 (finalize/meal용). */
function citiesWithDayAssignment(trip, dayIndex, cityId) {
  const city = resolveCity(cityId);
  const base = Array.isArray(trip.cities)
    ? trip.cities.map((c) => ({
        cityId: c.cityId,
        cityName: c.cityName || resolveCity(c.cityId).nameKo,
        dayIndexes: (c.dayIndexes || []).filter((d) => d !== dayIndex),
      }))
    : [
        {
          cityId: isKnownCityId(trip.cityId) ? trip.cityId : cityId,
          cityName: resolveCity(
            isKnownCityId(trip.cityId) ? trip.cityId : cityId,
          ).nameKo,
          dayIndexes: Array.from({ length: Number(trip.days) || 1 }, (_, i) => i).filter(
            (d) => d !== dayIndex,
          ),
        },
      ];

  let legs = base.filter((c) => c.dayIndexes.length > 0 || c.cityId === cityId);
  const target = legs.find((c) => c.cityId === cityId);
  if (target) {
    target.dayIndexes = [...target.dayIndexes, dayIndex].sort((a, b) => a - b);
  } else {
    legs = [
      ...legs,
      {
        cityId,
        cityName: city.nameKo,
        dayIndexes: [dayIndex],
      },
    ];
  }
  return legs.filter((c) => c.dayIndexes.length > 0);
}

function buildFallbackDayPlaces({
  dayIndex,
  days,
  nights,
  partySize,
  cityId,
}) {
  const fb = buildFallbackItinerary({
    nights: Math.max(1, Math.min(nights, 1)),
    days: 1,
    partySize,
    cityId,
  });
  const needHotel = days > 1 && nights > 0 && dayIndex < days - 1;
  return (fb.places || [])
    .filter((p) => needHotel || p.category !== "hotel")
    .map((p, i) => ({
      ...p,
      id: uid("place"),
      dayIndex,
      order: i,
      cityId,
    }));
}

/**
 * 도시 배정 변경 후 해당 Day 일정을 통째로 재생성.
 * 전·후 Day 일정을 참고 컨텍스트로 넘긴다.
 */
export async function regenerateDayItinerary(body, env) {
  const trip = body?.trip;
  if (!trip || !Array.isArray(trip.places)) {
    throw new Error("trip with places is required");
  }

  const days = Math.min(15, Math.max(1, Number(trip.days) || 1));
  const partySize = Math.min(12, Math.max(1, Number(trip.partySize) || 2));
  const nights = Math.min(14, Math.max(0, Number(trip.nights) || 0));
  const dayIndex = Math.min(
    Math.max(0, Number(body?.dayIndex ?? 0)),
    days - 1,
  );
  const cityId = resolveTargetCityId(trip, dayIndex, body?.targetCityId);
  const city = resolveCity(cityId);
  const domestic = city.region === "domestic" || city.countryId === "kr";
  const currency = domestic ? "KRW" : "JPY";
  const regionLabel = domestic
    ? `한국 ${city.nameKo}`
    : `${city.countryNameKo || city.countryId} ${city.nameKo}`;
  const lodgingReturnTime = String(
    trip.lodgingReturnTime || body?.lodgingReturnTime || "21:00",
  ).slice(0, 8);
  const neighbors = neighborDayContext(trip.places, dayIndex);

  const keepPlaces = trip.places.filter((p) => p.dayIndex !== dayIndex);
  let newPlaces = buildFallbackDayPlaces({
    dayIndex,
    days,
    nights,
    partySize,
    cityId,
  });
  let engine = "fallback";
  let summary = `Day ${dayIndex + 1} · ${city.nameKo} 일정 재생성 (폴백)`;

  if (env.geminiApiKey) {
    try {
      const needHotel = days > 1 && nights > 0 && dayIndex < days - 1;
      const prompt = `당신은 ${regionLabel} 여행 일정 플래너입니다.
사용자가 Day ${dayIndex + 1}의 배정 도시를 ${city.nameKo}로 바꿨습니다.
해당 Day 일정만 새로 만들고, 전날·다음날 일정은 참고만 하세요(복사 금지).

조건:
- 도시: ${city.nameKo} (${cityId})
- 통화: ${currency}
- partySize: ${partySize}, nights: ${nights}, days: ${days}
- 숙소 복귀 시각: ${lodgingReturnTime}
- 이동 수단: 차(car) 기준, 이동 시간·비용 현실적으로
- food·attraction 체류는 기본 약 60분. hotel은 저녁 숙박(1시간 방문 체류 규칙 제외)
- 점심 식사(food)는 11:00–14:00(목표 12:00), 저녁 식사(food)는 18:00–20:00(목표 18:30)에 배치
- 숙소 규칙: ${
        needHotel
          ? "이 Day는 마지막 날이 아니므로 hotel 1곳 포함(저녁 복귀)"
          : "마지막 날 또는 당일치기이므로 hotel 제외"
      }
- 반드시 ${city.nameKo} 및 인근 명소만 제안
- attraction·food 위주로 4~6곳 정도

전날(Day ${dayIndex}) 참고(없으면 빈 배열):
${JSON.stringify(neighbors.previousDay)}

다음날(Day ${dayIndex + 2}) 참고(없으면 빈 배열):
${JSON.stringify(neighbors.nextDay)}

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
        systemHint: `${city.nameKo} day regenerate planner. Return valid JSON only. Prefer ${currency}.`,
        timeoutMs: env.llmTimeoutMs,
      });
      const parsed = parseJsonLoose(text);
      const raw = Array.isArray(parsed.places) ? parsed.places : [];
      if (raw.length > 0) {
        newPlaces = raw.map((p, i) =>
          normalizePlace(
            { ...p, dayIndex },
            i,
            days,
            city.center,
            cityId,
            dayIndex,
          ),
        );
        if (domestic) {
          const tourKey = String(env.tourApiServiceKey || "").trim();
          let tourPool = { attraction: [], food: [], hotel: [] };
          if (tourKey) {
            try {
              tourPool = await fetchTourPlacePool({
                cityIds: [cityId],
                serviceKey: tourKey,
                perCategory: 12,
              });
            } catch {
              tourPool = { attraction: [], food: [], hotel: [] };
            }
          }
          newPlaces = await groundDomesticPlaces(newPlaces, {
            tourPool,
            mapsApiKey: env.googleMapsApiKey || "",
            partySize,
          });
        }
        engine = eng;
        summary = String(parsed.summary || summary);
      }
    } catch (err) {
      console.error("[regenerate-day] Gemini failed:", err?.message || err);
    }
  }

  const cities = citiesWithDayAssignment(trip, dayIndex, cityId);
  const merged = finalizePlaceChain([...keepPlaces, ...newPlaces], {
    days,
    nights,
    lodgingCandidates: Array.isArray(trip.lodgingCandidates)
      ? trip.lodgingCandidates
      : [],
    preferredLodgingId: trip.preferredLodgingId || null,
    cityId,
    cities,
    partySize,
  });

  const startHour = (() => {
    const m = String(trip.startTime || "09:00").match(/^(\d{1,2})/);
    const h = m ? Number(m[1]) : 9;
    return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9;
  })();
  const startMinutes = (() => {
    const m = String(trip.startTime || "09:00").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return startHour * 60;
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    return h * 60 + min;
  })();

  let tourPoolForMeals = { food: [] };
  if (domestic) {
    const tourKey = String(env.tourApiServiceKey || "").trim();
    if (tourKey) {
      try {
        tourPoolForMeals = await fetchTourPlacePool({
          cityIds: [cityId],
          serviceKey: tourKey,
          perCategory: 8,
        });
      } catch {
        tourPoolForMeals = { food: [] };
      }
    }
  }

  const withMeals = ensureDailyMealSlots(merged, {
    days,
    startHour,
    tourPool: tourPoolForMeals,
    partySize,
    cities,
    cityId,
  });

  const originLat = Number(trip.startLat);
  const originLng = Number(trip.startLng);
  const enriched = await enrichPlacesWithTransport(withMeals, {
    mapsApiKey: env.googleMapsApiKey || "",
    forceRecalc: true,
    cityId,
    startHour,
    startMinutes,
    lodgingReturnTime,
    origin:
      Number.isFinite(originLat) && Number.isFinite(originLng)
        ? { lat: originLat, lng: originLng }
        : null,
    outboundTransportMode: trip.outboundTransportMode || "car",
  });

  const plannedBudget = enriched.reduce((s, p) => {
    const c = Math.max(0, Number(p.estimatedCost) || 0);
    if (p.category === "food" || p.category === "attraction") {
      return s + c * Math.max(1, partySize);
    }
    return s + c;
  }, 0);

  return {
    places: enriched,
    plannedBudget,
    summary,
    engine,
    dayIndex,
    cityId,
    replacedCount: enriched.filter((p) => p.dayIndex === dayIndex).length,
    neighborContext: neighbors,
  };
}
