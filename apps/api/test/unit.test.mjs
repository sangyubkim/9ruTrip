import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseKoreanCardSms } from "../lib/sms-parse.mjs";
import {
  nearestNeighborOrder,
  optimizeDayRoute,
  pathLengthKm,
} from "../lib/optimize-day.mjs";
import {
  buildLodgingCandidates,
  clearDirectionsCache,
  compareLegTransport,
  directionsCacheKey,
  estimateOutboundLegHaversine,
  haversineKm,
  lodgingScoreBreakdown,
  normalizeOutboundTransportMode,
} from "../lib/transport.mjs";
import {
  buildFallbackItinerary,
  buildMultiCityFallbackItinerary,
  chainDayStarts,
  ensureOvernightHotels,
  finalizePlaceChain,
  isChainDeparturePlace,
  overnightDayIndexes,
} from "../lib/itinerary.mjs";

describe("parseKoreanCardSms", () => {
  it("parses amount and merchant from typical card SMS", () => {
    const r = parseKoreanCardSms(
      "[Web발신]\n신한카드승인\n홍길동\n12,000원 일시불\n07/23 11:20\n스타벅스강남",
    );
    assert.equal(r.ok, true);
    assert.equal(r.amountKrw, 12000);
    assert.ok(r.merchant);
    assert.ok(Number(r.amountJpyEstimate) > 0);
  });

  it("fails on empty text", () => {
    const r = parseKoreanCardSms("");
    assert.equal(r.ok, false);
  });

  it("fails when amount missing", () => {
    const r = parseKoreanCardSms("카드 승인 알림만 있고 금액 없음");
    assert.equal(r.ok, false);
  });
});

describe("haversine + transport compare", () => {
  it("haversineKm tokyo station to shibuya is ~6-8km", () => {
    const km = haversineKm(
      { lat: 35.6812, lng: 139.7671 },
      { lat: 35.6581, lng: 139.7017 },
    );
    assert.ok(km > 5 && km < 10, `km=${km}`);
  });

  it("compareLegTransport returns 3 modes without API key", async () => {
    const { options, engine } = await compareLegTransport(
      { lat: 35.6812, lng: 139.7671 },
      { lat: 35.6581, lng: 139.7017 },
      "",
    );
    assert.equal(engine, "haversine");
    assert.equal(options.length, 3);
    assert.deepEqual(
      options.map((o) => o.mode).sort(),
      ["taxi", "transit", "walking"],
    );
    for (const o of options) {
      assert.ok(o.minutes > 0);
      assert.ok(String(o.engine).startsWith("haversine:"));
    }
    const walk = options.find((o) => o.mode === "walking");
    const taxi = options.find((o) => o.mode === "taxi");
    assert.ok(walk.minutes > taxi.minutes);
  });

  it("directionsCacheKey is stable for rounded coords + mode", () => {
    clearDirectionsCache();
    const a = directionsCacheKey(
      { lat: 35.68121, lng: 139.76714 },
      { lat: 35.65812, lng: 139.70168 },
      "transit",
    );
    const b = directionsCacheKey(
      { lat: 35.68124, lng: 139.76715 },
      { lat: 35.65814, lng: 139.70169 },
      "transit",
    );
    const walk = directionsCacheKey(
      { lat: 35.68121, lng: 139.76714 },
      { lat: 35.65812, lng: 139.70168 },
      "walking",
    );
    assert.equal(a, b);
    assert.notEqual(a, walk);
  });

  it("lodging hubs are city-aware (osaka namba vs tokyo shinjuku)", () => {
    const namba = lodgingScoreBreakdown(
      { lat: 34.6661, lng: 135.5005, estimatedCost: 32000, notes: "추천" },
      { nights: 2, cityId: "osaka" },
    );
    const nambaAsTokyo = lodgingScoreBreakdown(
      { lat: 34.6661, lng: 135.5005, estimatedCost: 32000, notes: "추천" },
      { nights: 2, cityId: "tokyo" },
    );
    assert.ok(
      namba.scoreBreakdown.centrality > nambaAsTokyo.scoreBreakdown.centrality,
      `osaka hub ${namba.scoreBreakdown.centrality} vs tokyo hub ${nambaAsTokyo.scoreBreakdown.centrality}`,
    );
  });

  it("estimateOutboundLegHaversine: seoul→busan car has toll, train has fare", () => {
    assert.equal(normalizeOutboundTransportMode("기차"), "car");
    assert.equal(normalizeOutboundTransportMode("train"), "train");
    const seoul = { lat: 37.5665, lng: 126.978 };
    const busan = { lat: 35.1796, lng: 129.0756 };
    const car = estimateOutboundLegHaversine(seoul, busan, "car");
    const train = estimateOutboundLegHaversine(seoul, busan, "train");
    const flight = estimateOutboundLegHaversine(seoul, busan, "flight");
    assert.equal(car.costKind, "toll");
    assert.ok(car.minutes > 120, `car minutes=${car.minutes}`);
    assert.ok(car.estimatedCost > 10000, `toll=${car.estimatedCost}`);
    assert.match(car.note, /톨비/);
    assert.equal(train.costKind, "fare");
    assert.ok(train.estimatedCost > 20000);
    assert.match(train.note, /교통비/);
    assert.equal(flight.costKind, "fare");
    assert.ok(flight.minutes > 100);
    assert.ok(flight.estimatedCost >= 70000);
  });
});

describe("optimize-day", () => {
  const sample = [
    {
      id: "a",
      name: "도쿄역",
      category: "attraction",
      lat: 35.6812,
      lng: 139.7671,
      dayIndex: 0,
      order: 0,
      estimatedCost: 0,
    },
    {
      id: "b",
      name: "시부야",
      category: "attraction",
      lat: 35.6581,
      lng: 139.7017,
      dayIndex: 0,
      order: 1,
      estimatedCost: 0,
    },
    {
      id: "c",
      name: "아사쿠사",
      category: "attraction",
      lat: 35.7148,
      lng: 139.7967,
      dayIndex: 0,
      order: 2,
      estimatedCost: 0,
    },
  ];

  it("nearestNeighborOrder keeps start and visits all", () => {
    const ordered = nearestNeighborOrder(sample, 0);
    assert.equal(ordered.length, 3);
    assert.equal(ordered[0].id, "a");
    assert.deepEqual(
      ordered.map((p) => p.id).sort(),
      ["a", "b", "c"],
    );
  });

  it("optimizeDayRoute falls back to nearest-neighbor without Gemini", async () => {
    const shuffled = [sample[2], sample[0], sample[1]].map((p, i) => ({
      ...p,
      order: i,
    }));
    const res = await optimizeDayRoute(
      { places: shuffled, dayIndex: 0, cityId: "tokyo" },
      { geminiApiKey: "" },
    );
    assert.equal(res.engine, "nearest-neighbor");
    assert.equal(res.after.length, 3);
    assert.ok(res.pathKmAfter <= res.pathKmBefore + 0.01);
    assert.equal(res.places.filter((p) => p.dayIndex === 0).length, 3);
  });

  it("pathLengthKm is positive for multi-stop", () => {
    assert.ok(pathLengthKm(sample) > 5);
  });
});

describe("multi-city itinerary", () => {
  it("buildMultiCityFallbackItinerary splits days across tokyo+osaka", () => {
    const res = buildMultiCityFallbackItinerary({
      nights: 3,
      days: 4,
      partySize: 2,
      cityIds: ["tokyo", "osaka"],
    });
    assert.equal(res.engine, "fallback-multicity");
    assert.ok(Array.isArray(res.cities) && res.cities.length === 2);
    assert.equal(res.cities[0].cityId, "tokyo");
    assert.equal(res.cities[1].cityId, "osaka");
    const tokyoDays = new Set(res.cities[0].dayIndexes);
    const osakaDays = new Set(res.cities[1].dayIndexes);
    assert.ok(tokyoDays.size >= 1 && osakaDays.size >= 1);
    assert.ok(res.places.length > 0);
    assert.ok(res.places.every((p) => p.cityId === "tokyo" || p.cityId === "osaka"));
    const hasTokyo = res.places.some((p) => p.cityId === "tokyo");
    const hasOsaka = res.places.some((p) => p.cityId === "osaka");
    assert.ok(hasTokyo && hasOsaka);
  });

  it("single-city request still works via buildFallbackItinerary", () => {
    const res = buildFallbackItinerary({
      nights: 2,
      days: 3,
      partySize: 2,
      cityId: "osaka",
    });
    assert.equal(res.cityId, "osaka");
    assert.ok(res.places.every((p) => p.cityId === "osaka"));
  });

  it("overnight days exclude last day; day-trip has none", () => {
    assert.deepEqual(overnightDayIndexes(1, 0), []);
    assert.deepEqual(overnightDayIndexes(2, 1), [0]);
    assert.deepEqual(overnightDayIndexes(3, 2), [0, 1]);
    assert.deepEqual(overnightDayIndexes(4, 2), [0, 1]);
  });

  it("fallback includes hotel on every overnight day except last", () => {
    const res = buildFallbackItinerary({
      nights: 2,
      days: 3,
      partySize: 2,
      cityId: "seoul",
    });
    for (const d of [0, 1]) {
      const dayPlaces = res.places
        .filter((p) => p.dayIndex === d)
        .sort((a, b) => a.order - b.order);
      assert.ok(
        dayPlaces.some((p) => p.category === "hotel"),
        `expected hotel on day ${d}`,
      );
      assert.equal(
        dayPlaces[dayPlaces.length - 1].category,
        "hotel",
        `overnight day ${d} should end with hotel`,
      );
    }
    const lastDay = res.places
      .filter((p) => p.dayIndex === 2)
      .sort((a, b) => a.order - b.order);
    // 마지막 날은 전날 숙소에서 출발(체인)할 수 있으나, 저녁 숙박 hotel은 없음
    assert.ok(lastDay.length > 0);
    assert.notEqual(
      lastDay[lastDay.length - 1].category,
      "hotel",
      "last day should not end with overnight hotel",
    );
  });

  it("adds stay hotel when day only has chain-departure hotel", () => {
    const lod = buildLodgingCandidates({
      nights: 2,
      partySize: 2,
      topN: 3,
      cityId: "seoul",
    });
    const places = [
      {
        id: "h0",
        name: lod[0].name,
        category: "hotel",
        lat: lod[0].lat,
        lng: lod[0].lng,
        estimatedCost: 90000,
        notes: lod[0].notes,
        dayIndex: 0,
        order: 0,
      },
      {
        id: "a0",
        name: "명소A",
        category: "attraction",
        lat: 37.57,
        lng: 126.98,
        estimatedCost: 0,
        dayIndex: 0,
        order: 1,
      },
      {
        id: "chain1",
        name: lod[0].name,
        category: "hotel",
        lat: lod[0].lat,
        lng: lod[0].lng,
        estimatedCost: 0,
        notes: "전날 마지막 장소 · 출발",
        dayIndex: 1,
        order: 0,
      },
      {
        id: "a1",
        name: "명소B",
        category: "attraction",
        lat: 37.56,
        lng: 126.99,
        estimatedCost: 0,
        dayIndex: 1,
        order: 1,
      },
      {
        id: "a2",
        name: "명소C",
        category: "attraction",
        lat: 37.55,
        lng: 127.0,
        estimatedCost: 0,
        dayIndex: 2,
        order: 0,
      },
    ];
    assert.equal(isChainDeparturePlace(places[2]), true);
    const out = finalizePlaceChain(places, {
      days: 3,
      nights: 2,
      lodgingCandidates: lod,
      preferredLodgingId: lod[0].id,
      cityId: "seoul",
      partySize: 2,
    });
    const day1 = out
      .filter((p) => p.dayIndex === 1)
      .sort((a, b) => a.order - b.order);
    const stay = day1.filter(
      (p) => p.category === "hotel" && !isChainDeparturePlace(p),
    );
    assert.ok(stay.length >= 1, "day1 needs a real overnight hotel");
    assert.equal(day1[day1.length - 1].category, "hotel");
    assert.equal(isChainDeparturePlace(day1[day1.length - 1]), false);
  });

  it("ensureOvernightHotels is idempotent and skips day-trips", () => {
    const dayTrip = ensureOvernightHotels(
      [
        {
          id: "a",
          name: "명소",
          category: "attraction",
          lat: 37.5,
          lng: 127,
          estimatedCost: 0,
          dayIndex: 0,
          order: 0,
        },
      ],
      { days: 1, nights: 0, cityId: "seoul" },
    );
    assert.equal(
      dayTrip.filter((p) => p.category === "hotel").length,
      0,
    );

    const once = buildFallbackItinerary({
      nights: 2,
      days: 3,
      partySize: 2,
      cityId: "busan",
    });
    const twice = ensureOvernightHotels(once.places, {
      days: 3,
      nights: 2,
      lodgingCandidates: once.lodgingCandidates,
      preferredLodgingId: once.preferredLodgingId,
      cityId: "busan",
    });
    assert.equal(
      twice.filter((p) => p.category === "hotel").length,
      once.places.filter((p) => p.category === "hotel").length,
    );
  });

  it("chains previous day last place as next day start", () => {
    const res = buildFallbackItinerary({
      nights: 2,
      days: 3,
      partySize: 2,
      cityId: "seoul",
    });
    for (let d = 1; d < 3; d++) {
      const prev = res.places
        .filter((p) => p.dayIndex === d - 1)
        .sort((a, b) => a.order - b.order);
      const cur = res.places
        .filter((p) => p.dayIndex === d)
        .sort((a, b) => a.order - b.order);
      assert.ok(prev.length && cur.length);
      assert.equal(cur[0].name, prev[prev.length - 1].name);
    }
  });

  it("chainDayStarts inserts missing link place", () => {
    const linked = chainDayStarts([
      {
        id: "d0a",
        name: "명소A",
        category: "attraction",
        lat: 37.5,
        lng: 127,
        estimatedCost: 0,
        dayIndex: 0,
        order: 0,
      },
      {
        id: "d0h",
        name: "호텔X",
        category: "hotel",
        lat: 37.51,
        lng: 127.01,
        estimatedCost: 100000,
        dayIndex: 0,
        order: 1,
      },
      {
        id: "d1a",
        name: "명소B",
        category: "attraction",
        lat: 37.52,
        lng: 127.02,
        estimatedCost: 0,
        dayIndex: 1,
        order: 0,
      },
    ]);
    const day1 = linked
      .filter((p) => p.dayIndex === 1)
      .sort((a, b) => a.order - b.order);
    assert.equal(day1[0].name, "호텔X");
    assert.ok(/전날/.test(String(day1[0].notes || "")));
  });

  it("chainDayStarts clears plannedTime on morning chain insert", () => {
    const linked = chainDayStarts([
      {
        id: "d0a",
        name: "명소A",
        category: "attraction",
        lat: 37.5,
        lng: 127,
        estimatedCost: 0,
        dayIndex: 0,
        order: 0,
        plannedTime: "10:00",
      },
      {
        id: "d0h",
        name: "호텔X",
        category: "hotel",
        lat: 37.51,
        lng: 127.01,
        estimatedCost: 100000,
        dayIndex: 0,
        order: 1,
        plannedTime: "18:00",
      },
      {
        id: "d1a",
        name: "명소B",
        category: "attraction",
        lat: 37.52,
        lng: 127.02,
        estimatedCost: 0,
        dayIndex: 1,
        order: 0,
        plannedTime: "09:30",
      },
    ]);
    const day1 = linked
      .filter((p) => p.dayIndex === 1)
      .sort((a, b) => a.order - b.order);
    assert.equal(day1[0].name, "호텔X");
    assert.equal(day1[0].plannedTime, undefined);
    assert.equal(day1[0].travelFromPrevMinutes, 0);
    assert.ok(/전날/.test(String(day1[0].notes || "")));
    // 전날 저녁 숙소 plannedTime은 그대로
    const day0Hotel = linked.find((p) => p.id === "d0h");
    assert.equal(day0Hotel?.plannedTime, "18:00");
  });

  it("chainDayStarts clears plannedTime when day already starts with prev last", () => {
    const linked = chainDayStarts([
      {
        id: "d0h",
        name: "라마다 군산 호텔",
        category: "hotel",
        lat: 35.96,
        lng: 126.71,
        estimatedCost: 90000,
        dayIndex: 0,
        order: 0,
        plannedTime: "18:00",
      },
      {
        id: "d1h",
        name: "라마다 군산 호텔",
        category: "hotel",
        lat: 35.96,
        lng: 126.71,
        estimatedCost: 0,
        dayIndex: 1,
        order: 0,
        plannedTime: "18:00",
        notes: "전날 마지막 장소 · 출발",
      },
      {
        id: "d1a",
        name: "경암동",
        category: "attraction",
        lat: 35.97,
        lng: 126.72,
        estimatedCost: 0,
        dayIndex: 1,
        order: 1,
        plannedTime: "09:30",
      },
    ]);
    const day1 = linked
      .filter((p) => p.dayIndex === 1)
      .sort((a, b) => a.order - b.order);
    assert.equal(day1[0].name, "라마다 군산 호텔");
    assert.equal(day1[0].plannedTime, undefined);
  });
});

/** crowd hour heuristic mirrored from mobile utils/weather.ts */
function crowdHintForHour(hour) {
  if (hour >= 11 && hour <= 13) return "점심 혼잡 가능";
  if (hour >= 17 && hour <= 19) return "저녁 혼잡 가능";
  if (hour >= 9 && hour <= 10) return "오전 이동 여유";
  if (hour >= 14 && hour <= 16) return "오후 관광 피크";
  return "비교적 여유";
}

describe("crowd hint heuristic", () => {
  it("returns lunch crowd at noon", () => {
    assert.equal(crowdHintForHour(12), "점심 혼잡 가능");
  });
  it("returns evening crowd at 18", () => {
    assert.equal(crowdHintForHour(18), "저녁 혼잡 가능");
  });
});
