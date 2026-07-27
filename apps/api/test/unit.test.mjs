import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseKoreanCardSms } from "../lib/sms-parse.mjs";
import {
  nearestNeighborOrder,
  optimizeDayRoute,
  pathLengthKm,
} from "../lib/optimize-day.mjs";
import {
  applyMajorSchedulePostConstraints,
  ensureHotelBookends,
  isScheduleLockedPlace,
  mergeConstrainedDayOrder,
  snapUnlockedFoodToMealWindows,
  splitDayPlacesForReorder,
} from "../lib/schedule-constraints.mjs";
import { rerouteItinerary } from "../lib/reroute.mjs";
import {
  buildLodgingCandidates,
  clearDirectionsCache,
  compareLegTransport,
  defaultStayMinutes,
  directionsCacheKey,
  enrichPlacesWithTransport,
  estimateOutboundLegHaversine,
  haversineKm,
  lodgingScoreBreakdown,
  normalizeOutboundTransportMode,
  pickDefaultTransportMode,
  prependOriginDeparturePlace,
  resolveDayStartMinutes,
} from "../lib/transport.mjs";
import {
  buildFallbackItinerary,
  buildMultiCityFallbackItinerary,
  chainDayStarts,
  ensureOvernightHotels,
  finalizePlaceChain,
  isChainDeparturePlace,
  overnightDayIndexes,
  suggestPlacesByCategory,
} from "../lib/itinerary.mjs";
import { clearFestivalCache, listFestivals } from "../lib/festivals.mjs";
import {
  cleanTourText,
  clearTourApiCache,
  formatTourPoolForPrompt,
  parseTourDetailFields,
  suggestViaTourApi,
  tourPlacesToSuggestItems,
  tourStaysToLodgingCandidates,
} from "../lib/tourapi.mjs";
import {
  clearTourCourseCache,
  fetchTourCourseDetail,
  formatCourseListBriefing,
  formatCourseSeedForPrompt,
  formatCourseWaypointSummary,
  injectCourseWaypointsIntoPool,
  listTourCourses,
  normalizeTourCourseListItem,
  normalizeTourCourseSeed,
  normalizeTourCourseWaypoint,
  resolveTourAreaCode,
} from "../lib/tour-courses.mjs";
import { buildRouteBriefing } from "../lib/route-briefing.mjs";
import {
  ensureDailyMealSlots,
  mealArriveFloorMinutes,
  MEAL_WINDOWS,
} from "../lib/meal-slots.mjs";
import {
  neighborDayContext,
  regenerateDayItinerary,
} from "../lib/regenerate-day.mjs";
import {
  addMinutesToHhmm,
  shiftPlannedTimesAfter,
} from "../lib/shift-planned-times.mjs";

describe("shiftPlannedTimesAfter", () => {
  it("adds 60 minutes to places after insert, including hotel", () => {
    assert.equal(addMinutesToHhmm("10:30", 60), "11:30");
    assert.equal(addMinutesToHhmm("23:45", 60), "00:45");
    assert.equal(addMinutesToHhmm(undefined, 60), null);

    const day = [
      { id: "a", plannedTime: "09:00" },
      { id: "new", plannedTime: undefined },
      { id: "b", plannedTime: "11:00" },
      { id: "h", category: "hotel", plannedTime: "21:00" },
      { id: "c", plannedTime: undefined },
    ];
    const shifted = shiftPlannedTimesAfter(day, 1, 60);
    assert.equal(shifted[0].plannedTime, "09:00");
    assert.equal(shifted[1].plannedTime, undefined);
    assert.equal(shifted[2].plannedTime, "12:00");
    assert.equal(shifted[3].plannedTime, "22:00");
    assert.equal(shifted[4].plannedTime, undefined);
  });
});

describe("festivals", () => {
  it("uses the catalog when TourAPI key is absent", async () => {
    const result = await listFestivals(
      { startDate: "2026-07-25", endDate: "2026-07-28", cityId: "seoul" },
      {},
    );

    assert.equal(result.source, "catalog");
    assert.ok(result.festivals.length > 0);
    assert.ok(result.festivals.every((festival) => festival.id.startsWith("tour-") === false));
  });

  it("normalizes, filters, sorts, and caches TourAPI festivals", async () => {
    clearFestivalCache();
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = async (url) => {
      requestCount += 1;
      const parsedUrl = new URL(url);
      assert.equal(parsedUrl.origin + parsedUrl.pathname, "https://apis.data.go.kr/B551011/KorService2/searchFestival2");
      assert.equal(parsedUrl.searchParams.get("serviceKey"), "encoded/key=");
      assert.equal(parsedUrl.searchParams.get("eventStartDate"), "20260601");
      assert.equal(parsedUrl.searchParams.get("eventEndDate"), "20260604");
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "0000", resultMsg: "OK" },
            body: {
              items: {
                item: [
                  {
                    contentid: "2",
                    title: "늦은 축제",
                    eventstartdate: "20260603",
                    eventenddate: "20260605",
                    mapx: "126.978",
                    mapy: "37.5665",
                    addr1: "서울특별시 중구",
                  },
                  {
                    contentid: "1",
                    title: "이른 축제",
                    eventstartdate: "20260601",
                    eventenddate: "20260602",
                    mapx: "126.99",
                    mapy: "37.57",
                    addr1: "서울특별시 종로구",
                  },
                  {
                    contentid: "outside",
                    title: "기간 밖 축제",
                    eventstartdate: "20260520",
                    eventenddate: "20260530",
                    mapx: "126.978",
                    mapy: "37.5665",
                    addr1: "서울특별시 중구",
                  },
                  {
                    contentid: "invalid-coordinate",
                    title: "좌표 오류 축제",
                    eventstartdate: "20260602",
                    eventenddate: "20260604",
                    mapx: "126.978",
                    mapy: "200",
                    addr1: "서울특별시 중구",
                  },
                  {
                    contentid: "unmapped-city",
                    title: "도시 미매핑 축제",
                    eventstartdate: "20260602",
                    eventenddate: "20260603",
                    mapx: "132",
                    mapy: "36",
                    addr1: "도시 정보 없음",
                  },
                  {
                    contentid: "performance",
                    title: "국악공연 진연",
                    eventstartdate: "20260602",
                    eventenddate: "20260604",
                    mapx: "126.978",
                    mapy: "37.5665",
                    addr1: "서울특별시 중구",
                  },
                  {
                    contentid: "tour",
                    title: "DDP 건축투어",
                    eventstartdate: "20260602",
                    eventenddate: "20260604",
                    mapx: "126.978",
                    mapy: "37.5665",
                    addr1: "서울특별시 중구",
                  },
                ],
              },
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const payload = {
        startDate: "2026-06-01",
        endDate: "2026-06-04",
        lat: 37.5665,
        lng: 126.978,
      };
      const first = await listFestivals(payload, {
        tourApiServiceKey: "encoded%2Fkey%3D",
      });
      const second = await listFestivals(payload, {
        tourApiServiceKey: "encoded%2Fkey%3D",
      });

      assert.equal(first.source, "tourapi");
      assert.deepEqual(
        first.festivals.map((festival) => festival.id),
        ["tour-1", "tour-unmapped-city", "tour-2"],
      );
      assert.equal(first.festivals[1].cityId, "unknown");
      assert.equal(first.festivals[1].cityName, "도시 정보 없음");
      assert.deepEqual(second, first);
      assert.equal(requestCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
      clearFestivalCache();
    }
  });
});

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

  it("pickDefaultTransportMode prefers taxi (car/driving) over walk/transit", () => {
    assert.equal(pickDefaultTransportMode([]), "taxi");
    assert.equal(
      pickDefaultTransportMode([
        { mode: "walking", minutes: 8, estimatedCost: 0, engine: "t" },
        { mode: "transit", minutes: 15, estimatedCost: 1400, engine: "t" },
        { mode: "taxi", minutes: 6, estimatedCost: 6000, engine: "t" },
      ]),
      "taxi",
    );
  });

  it("defaultStayMinutes: food/attraction 60, hotel excluded from 1h visit", () => {
    assert.equal(defaultStayMinutes("food"), 60);
    assert.equal(defaultStayMinutes("attraction"), 60);
    assert.equal(defaultStayMinutes("hotel"), 15);
    assert.notEqual(defaultStayMinutes("hotel"), 60);
  });
});

describe("plannedTime sequential", () => {
  it("does not set last hotel earlier than previous place", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "attr-1",
          name: "관광",
          category: "attraction",
          lat: 36.3,
          lng: 126.5,
          dayIndex: 0,
          order: 0,
          plannedTime: "09:00",
          travelFromPrevMinutes: 0,
          travelFromPrevCost: 0,
        },
        {
          id: "food-1",
          name: "늦은 식당",
          category: "food",
          lat: 36.305,
          lng: 126.505,
          dayIndex: 0,
          order: 1,
          plannedTime: "22:26",
          travelFromPrevMinutes: 15,
          travelFromPrevCost: 0,
          transportOptions: [
            { mode: "taxi", minutes: 15, estimatedCost: 5000, engine: "test" },
          ],
        },
        {
          id: "hotel-1",
          name: "숙소",
          category: "hotel",
          lat: 36.31,
          lng: 126.51,
          dayIndex: 0,
          order: 2,
          plannedTime: "21:00",
          travelFromPrevMinutes: 10,
          travelFromPrevCost: 0,
          transportOptions: [
            { mode: "taxi", minutes: 10, estimatedCost: 5000, engine: "test" },
          ],
        },
      ],
      {
        startHour: 9,
        forceRecalc: false,
        lodgingReturnTime: "21:00",
        cityId: "boryeong",
      },
    );
    const food = places.find((p) => p.id === "food-1");
    const hotel = places.find((p) => p.id === "hotel-1");
    assert.equal(food.plannedTime, "22:26");
    assert.ok(
      hotel.plannedTime >= food.plannedTime,
      `hotel=${hotel.plannedTime} food=${food.plannedTime}`,
    );
  });

  it("enrich: car default mode + 60m stay for attraction/food (hotel not 60)", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "관광A",
          category: "attraction",
          lat: 37.5665,
          lng: 126.978,
          dayIndex: 0,
          order: 0,
          estimatedCost: 0,
        },
        {
          id: "f1",
          name: "맛집",
          category: "food",
          lat: 37.57,
          lng: 126.982,
          dayIndex: 0,
          order: 1,
          estimatedCost: 15000,
        },
        {
          id: "a2",
          name: "관광B",
          category: "attraction",
          lat: 37.575,
          lng: 126.985,
          dayIndex: 0,
          order: 2,
          estimatedCost: 0,
        },
        {
          id: "h1",
          name: "숙소",
          category: "hotel",
          lat: 37.58,
          lng: 126.99,
          dayIndex: 0,
          order: 3,
          estimatedCost: 120000,
        },
      ],
      {
        startHour: 9,
        forceRecalc: true,
        lodgingReturnTime: "21:00",
        cityId: "seoul",
      },
    );

    const a1 = places.find((p) => p.id === "a1");
    const f1 = places.find((p) => p.id === "f1");
    const a2 = places.find((p) => p.id === "a2");
    const h1 = places.find((p) => p.id === "h1");

    assert.equal(a1.plannedTime, "09:00");
    assert.equal(f1.preferredTransportMode, "taxi");
    assert.equal(a2.preferredTransportMode, "taxi");
    assert.ok(Number(f1.travelFromPrevMinutes) > 0);
    assert.ok(
      f1.transportOptions?.some((o) => o.mode === "taxi"),
      "taxi option present for car-based time",
    );

    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    // attraction 체류 60 + 이동 → food 도착
    assert.equal(
      toMin(f1.plannedTime),
      toMin(a1.plannedTime) +
        defaultStayMinutes("attraction") +
        Number(f1.travelFromPrevMinutes),
    );
    // food 체류 60 + 이동 → 다음 attraction
    assert.equal(
      toMin(a2.plannedTime),
      toMin(f1.plannedTime) +
        defaultStayMinutes("food") +
        Number(a2.travelFromPrevMinutes),
    );
    // hotel은 1시간 체류 규칙 제외 — 순차 도착(직전+체류+이동), 21:00 강제 없음
    assert.equal(
      toMin(h1.plannedTime),
      toMin(a2.plannedTime) +
        defaultStayMinutes("attraction") +
        Number(h1.travelFromPrevMinutes),
    );
    assert.notEqual(defaultStayMinutes("hotel"), 60);
  });

  it("enrich keeps lunch/dinner in meal windows and does not jump 16:00→21:00 without dinner", async () => {
    const base = [
      {
        id: "a1",
        name: "명소A",
        category: "attraction",
        lat: 37.57,
        lng: 126.98,
        cityId: "seoul",
        dayIndex: 0,
        order: 0,
        plannedTime: "10:00",
        estimatedCost: 0,
      },
      {
        id: "a2",
        name: "명소B",
        category: "attraction",
        lat: 37.58,
        lng: 126.99,
        cityId: "seoul",
        dayIndex: 0,
        order: 1,
        plannedTime: "16:00",
        estimatedCost: 0,
      },
      {
        id: "h1",
        name: "호텔",
        category: "hotel",
        lat: 37.56,
        lng: 126.98,
        cityId: "seoul",
        dayIndex: 0,
        order: 2,
        plannedTime: "21:00",
        estimatedCost: 120000,
      },
    ];
    const withMeals = ensureDailyMealSlots(base, {
      days: 1,
      startHour: 9,
      tourPool: {
        food: [
          {
            id: "f-l",
            name: "점심식당",
            lat: 37.571,
            lng: 126.981,
            cityId: "seoul",
            estimatedCost: 12000,
          },
          {
            id: "f-d",
            name: "저녁식당",
            lat: 37.572,
            lng: 126.982,
            cityId: "seoul",
            estimatedCost: 18000,
          },
        ],
      },
      cityId: "seoul",
    });
    const places = await enrichPlacesWithTransport(withMeals, {
      startHour: 9,
      forceRecalc: true,
      lodgingReturnTime: "21:00",
      cityId: "seoul",
    });
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    const foods = places.filter((p) => p.category === "food");
    assert.equal(foods.length, 2);
    const lunch = foods.find(
      (p) =>
        toMin(p.plannedTime) >= MEAL_WINDOWS.lunch.startMin &&
        toMin(p.plannedTime) <= MEAL_WINDOWS.lunch.endMin,
    );
    const dinner = foods.find(
      (p) =>
        toMin(p.plannedTime) >= MEAL_WINDOWS.dinner.startMin &&
        toMin(p.plannedTime) <= MEAL_WINDOWS.dinner.endMin,
    );
    assert.ok(lunch, "lunch remains in 11:00–14:00 after enrich");
    assert.ok(dinner, "dinner remains in 18:00–20:00 after enrich");
    assert.equal(defaultStayMinutes("food"), 60);
    assert.equal(defaultStayMinutes("attraction"), 60);

    const hotel = places.find((p) => p.category === "hotel");
    const dayOrdered = places
      .filter((p) => p.dayIndex === 0)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const hotelIdx = dayOrdered.findIndex((p) => p.id === hotel.id);
    const beforeHotel = dayOrdered[hotelIdx - 1];
    assert.equal(beforeHotel.category, "food");
    assert.ok(
      toMin(beforeHotel.plannedTime) >= MEAL_WINDOWS.dinner.startMin,
      "last stop before hotel should be dinner, not a 16:00 attraction gap",
    );
    assert.equal(
      toMin(hotel.plannedTime),
      toMin(beforeHotel.plannedTime) +
        defaultStayMinutes(beforeHotel.category) +
        Number(hotel.travelFromPrevMinutes),
    );
  });

  it("hotel plannedTime follows sequential (18:30+60+20 → 19:50), not 21:00 floor", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "f1",
          name: "저녁",
          category: "food",
          lat: 37.5,
          lng: 127.0,
          dayIndex: 0,
          order: 0,
          plannedTime: "18:30",
          notes: "저녁 식사",
          travelFromPrevMinutes: 0,
          travelFromPrevCost: 0,
        },
        {
          id: "h1",
          name: "숙소",
          category: "hotel",
          lat: 37.51,
          lng: 127.01,
          dayIndex: 0,
          order: 1,
          plannedTime: "21:00",
          travelFromPrevMinutes: 20,
          travelFromPrevCost: 5000,
          transportOptions: [
            { mode: "taxi", minutes: 20, estimatedCost: 5000, engine: "test" },
          ],
        },
      ],
      {
        startHour: 18,
        startMinutes: 18 * 60 + 30,
        forceRecalc: false,
        lodgingReturnTime: "21:00",
        cityId: "seoul",
      },
    );
    const hotel = places.find((p) => p.id === "h1");
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    // 18:30 + food stay 60 + travel 20 = 19:50 (not clamped to 21:00)
    assert.equal(hotel.plannedTime, "19:50");
    assert.ok(toMin(hotel.plannedTime) < 21 * 60);
    assert.notEqual(hotel.plannedTime, "21:00");
  });

  it("hotel plannedTime does not clamp back to 21:00 when sequential is 22:30", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "f1",
          name: "늦은 저녁",
          category: "food",
          lat: 37.5,
          lng: 127.0,
          dayIndex: 0,
          order: 0,
          plannedTime: "21:10",
          notes: "저녁 식사",
          travelFromPrevMinutes: 0,
          travelFromPrevCost: 0,
        },
        {
          id: "h1",
          name: "숙소",
          category: "hotel",
          lat: 37.51,
          lng: 127.01,
          dayIndex: 0,
          order: 1,
          plannedTime: "21:00",
          travelFromPrevMinutes: 20,
          travelFromPrevCost: 5000,
          transportOptions: [
            { mode: "taxi", minutes: 20, estimatedCost: 5000, engine: "test" },
          ],
        },
      ],
      {
        startHour: 21,
        startMinutes: 21 * 60 + 10,
        forceRecalc: false,
        lodgingReturnTime: "21:00",
        cityId: "seoul",
      },
    );
    const hotel = places.find((p) => p.id === "h1");
    // food 21:10 + stay 60 + travel 20 = 22:30
    assert.equal(hotel.plannedTime, "22:30");
    assert.notEqual(hotel.plannedTime, "21:00");
  });

  it("hotel follows late-night sequential (03:07) and does not snap to 21:00", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "f1",
          name: "심야 식사",
          category: "food",
          lat: 37.5,
          lng: 127.0,
          dayIndex: 0,
          order: 0,
          plannedTime: "03:07",
          travelFromPrevMinutes: 0,
          travelFromPrevCost: 0,
        },
        {
          id: "h1",
          name: "숙소",
          category: "hotel",
          lat: 37.51,
          lng: 127.01,
          dayIndex: 0,
          order: 1,
          plannedTime: "21:00",
          travelFromPrevMinutes: 23,
          travelFromPrevCost: 8000,
          transportOptions: [
            { mode: "taxi", minutes: 23, estimatedCost: 8000, engine: "test" },
          ],
        },
      ],
      {
        startHour: 3,
        startMinutes: 3 * 60 + 7,
        forceRecalc: false,
        lodgingReturnTime: "21:00",
        cityId: "seoul",
      },
    );
    const hotel = places.find((p) => p.id === "h1");
    // 03:07 + food stay 60 + taxi 23 = 04:30 (old max(seq,21:00) wrongly kept 21:00)
    assert.equal(hotel.plannedTime, "04:30");
    assert.notEqual(hotel.plannedTime, "21:00");
  });

  it("hotel plannedTime shifts past 21:00 when sequential arrival is later", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "관광",
          category: "attraction",
          lat: 37.5,
          lng: 127.0,
          dayIndex: 0,
          order: 0,
          plannedTime: "20:00",
          travelFromPrevMinutes: 0,
          travelFromPrevCost: 0,
        },
        {
          id: "f1",
          name: "저녁",
          category: "food",
          lat: 37.505,
          lng: 127.005,
          dayIndex: 0,
          order: 1,
          plannedTime: "21:30",
          notes: "저녁 식사",
          travelFromPrevMinutes: 20,
          travelFromPrevCost: 5000,
          transportOptions: [
            { mode: "taxi", minutes: 20, estimatedCost: 5000, engine: "test" },
          ],
        },
        {
          id: "h1",
          name: "숙소",
          category: "hotel",
          lat: 37.51,
          lng: 127.01,
          dayIndex: 0,
          order: 2,
          plannedTime: "21:00",
          travelFromPrevMinutes: 25,
          travelFromPrevCost: 6000,
          transportOptions: [
            { mode: "taxi", minutes: 25, estimatedCost: 6000, engine: "test" },
          ],
        },
      ],
      {
        startHour: 20,
        forceRecalc: false,
        lodgingReturnTime: "21:00",
        cityId: "seoul",
      },
    );
    const food = places.find((p) => p.id === "f1");
    const hotel = places.find((p) => p.id === "h1");
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    assert.ok(toMin(food.plannedTime) >= MEAL_WINDOWS.dinner.preferMin);
    const expectedHotelMin =
      toMin(food.plannedTime) +
      defaultStayMinutes("food") +
      Number(hotel.travelFromPrevMinutes);
    assert.ok(
      toMin(hotel.plannedTime) >= expectedHotelMin,
      `hotel=${hotel.plannedTime} expected>=${expectedHotelMin}`,
    );
    assert.ok(
      toMin(hotel.plannedTime) > 21 * 60,
      `hotel should pass 21:00, got ${hotel.plannedTime}`,
    );
  });

  it("resolveDayStartMinutes: HH:mm / hour-as-minutes guard / null", () => {
    assert.equal(resolveDayStartMinutes({ startTime: "09:00" }), 9 * 60);
    assert.equal(resolveDayStartMinutes({ startHour: 9 }), 9 * 60);
    // 시(9)를 분으로 오인 → 00:09 방지
    assert.equal(
      resolveDayStartMinutes({ startHour: 9, startMinutes: 9 }),
      9 * 60,
    );
    assert.equal(
      resolveDayStartMinutes({ startMinutes: 9 * 60 + 30, startHour: 9 }),
      9 * 60 + 30,
    );
    // startTime 우선 — 의도적 00:09 유지
    assert.equal(resolveDayStartMinutes({ startTime: "00:09", startHour: 9 }), 9);
    assert.equal(resolveDayStartMinutes({ startMinutes: null, startHour: 9 }), 9 * 60);
    assert.equal(resolveDayStartMinutes({}), 9 * 60);
  });

  it("default 09:00 first place; no accidental 00:xx when start is 09:00", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "관광",
          category: "attraction",
          lat: 37.57,
          lng: 126.98,
          dayIndex: 0,
          order: 0,
          plannedTime: "00:09",
        },
      ],
      { startHour: 9, startTime: "09:00", forceRecalc: true },
    );
    assert.equal(places[0].plannedTime, "09:00");
    assert.notEqual(places[0].plannedTime, "00:09");

    const confused = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "관광",
          category: "attraction",
          lat: 37.57,
          lng: 126.98,
          dayIndex: 0,
          order: 0,
          plannedTime: "23:50",
        },
      ],
      { startHour: 9, startMinutes: 9, forceRecalc: true },
    );
    assert.equal(confused[0].plannedTime, "09:00");
  });

  it("first place arrival = startTime + outbound from origin", async () => {
    const seoul = { lat: 37.5665, lng: 126.978 };
    const busan = { lat: 35.1796, lng: 129.0756 };
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "부산 관광",
          category: "attraction",
          lat: busan.lat,
          lng: busan.lng,
          dayIndex: 0,
          order: 0,
          plannedTime: "00:09",
        },
      ],
      {
        startHour: 9,
        startMinutes: 9 * 60,
        startTime: "09:00",
        forceRecalc: true,
        origin: seoul,
        outboundTransportMode: "car",
      },
    );
    const first = places[0];
    assert.ok(Number(first.travelFromPrevMinutes) > 0);
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    assert.equal(
      toMin(first.plannedTime),
      9 * 60 + Number(first.travelFromPrevMinutes),
    );
    assert.ok(toMin(first.plannedTime) >= 9 * 60 + 25);
    assert.ok(!String(first.plannedTime).startsWith("00:"));
  });

  it("startTime 09:00 + ~60min outbound → first ~10:00", async () => {
    // 자차 휴리스틱: (dist/75)*60+18 ≈ 60 → dist≈52.5km
    const origin = { lat: 37.5665, lng: 126.978 };
    const near = { lat: 37.5665 + 52.5 / 111, lng: 126.978 };
    const leg = estimateOutboundLegHaversine(origin, near, "car");
    assert.ok(leg.minutes >= 50 && leg.minutes <= 75, `leg=${leg.minutes}`);

    const places = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "근교 관광",
          category: "attraction",
          lat: near.lat,
          lng: near.lng,
          dayIndex: 0,
          order: 0,
          plannedTime: "19:30",
        },
      ],
      {
        startTime: "09:00",
        startHour: 9,
        startMinutes: 9 * 60,
        forceRecalc: true,
        origin,
        outboundTransportMode: "car",
      },
    );
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    const first = places[0];
    assert.equal(
      toMin(first.plannedTime),
      9 * 60 + Number(first.travelFromPrevMinutes),
    );
    assert.ok(
      toMin(first.plannedTime) >= 9 * 60 + 50 &&
        toMin(first.plannedTime) <= 9 * 60 + 75,
      `expected ~10:00, got ${first.plannedTime}`,
    );
    assert.notEqual(first.plannedTime, "19:30");
  });

  it("large outbound still clocks from startTime 09:00 (departure card)", async () => {
    const seoul = { lat: 37.5665, lng: 126.978 };
    const busan = { lat: 35.1796, lng: 129.0756 };
    const core = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "부산 관광",
          category: "attraction",
          lat: busan.lat,
          lng: busan.lng,
          dayIndex: 0,
          order: 0,
          plannedTime: "19:30",
        },
      ],
      {
        startTime: "09:00",
        forceRecalc: true,
        origin: seoul,
        outboundTransportMode: "car",
      },
    );
    const places = prependOriginDeparturePlace(core, {
      startTime: "09:00",
      startAddress: "서울",
      origin: { ...seoul, name: "서울" },
      outboundTransportMode: "car",
    });
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    const dep = places[0];
    const poi = places[1];
    assert.equal(dep.plannedTime, "09:00");
    assert.match(String(dep.notes || ""), /여행\s*출발/);
    assert.ok(Number(poi.travelFromPrevMinutes) > 120);
    assert.equal(
      toMin(poi.plannedTime),
      9 * 60 + Number(poi.travelFromPrevMinutes),
    );
    assert.ok(toMin(poi.plannedTime) > 12 * 60);
    assert.notEqual(poi.plannedTime, "19:30");
  });

  it("re-enrich keeps departure at startTime and POI = start + outbound", async () => {
    const seoul = { lat: 37.5665, lng: 126.978 };
    const dest = { lat: 37.5, lng: 127.2 };
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "origin-depart-x",
          name: "서울",
          category: "transport",
          lat: seoul.lat,
          lng: seoul.lng,
          dayIndex: 0,
          order: 0,
          estimatedCost: 0,
          notes: "여행 출발 · 자차",
          plannedTime: "19:30",
        },
        {
          id: "a1",
          name: "관광",
          category: "attraction",
          lat: dest.lat,
          lng: dest.lng,
          dayIndex: 0,
          order: 1,
          plannedTime: "19:30",
        },
      ],
      {
        startTime: "09:00",
        forceRecalc: true,
        origin: seoul,
        outboundTransportMode: "car",
      },
    );
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + m;
    };
    assert.equal(places[0].plannedTime, "09:00");
    assert.ok(Number(places[1].travelFromPrevMinutes) > 0);
    assert.equal(
      toMin(places[1].plannedTime),
      9 * 60 + Number(places[1].travelFromPrevMinutes),
    );
  });

  it("startTime 10:30 respected for day start without origin", async () => {
    const places = await enrichPlacesWithTransport(
      [
        {
          id: "a1",
          name: "관광",
          category: "attraction",
          lat: 37.57,
          lng: 126.98,
          dayIndex: 0,
          order: 0,
          plannedTime: "00:09",
        },
      ],
      {
        startHour: 9,
        startMinutes: 9,
        startTime: "10:30",
        forceRecalc: true,
      },
    );
    assert.equal(places[0].plannedTime, "10:30");
  });

  it("mealArriveFloorMinutes detects lunch/dinner labels and windows", () => {
    assert.equal(
      mealArriveFloorMinutes({
        category: "food",
        notes: "점심 식사",
        plannedTime: "10:00",
      }),
      MEAL_WINDOWS.lunch.preferMin,
    );
    assert.equal(
      mealArriveFloorMinutes({
        category: "food",
        notes: "저녁 식사",
      }),
      MEAL_WINDOWS.dinner.preferMin,
    );
    assert.equal(
      mealArriveFloorMinutes({
        category: "attraction",
        notes: "점심 식사",
      }),
      null,
    );
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
    assert.ok(res.after.length >= 3);
    const ids = res.places
      .filter((p) => p.dayIndex === 0)
      .map((p) => p.id);
    assert.ok(ids.includes("a") && ids.includes("b") && ids.includes("c"));
  });

  it("pathLengthKm is positive for multi-stop", () => {
    assert.ok(pathLengthKm(sample) > 5);
  });

  it("preserves origin departure and completed places at front", async () => {
    const places = [
      {
        id: "origin",
        name: "우리집",
        category: "transport",
        notes: "여행 출발 · 자차",
        lat: 37.5,
        lng: 127.0,
        dayIndex: 0,
        order: 0,
        estimatedCost: 0,
        plannedTime: "09:00",
      },
      {
        id: "done1",
        name: "완료명소",
        category: "attraction",
        lat: 37.55,
        lng: 126.98,
        dayIndex: 0,
        order: 1,
        estimatedCost: 0,
        plannedTime: "10:00",
      },
      {
        id: "far",
        name: "먼곳",
        category: "attraction",
        lat: 37.7,
        lng: 127.2,
        dayIndex: 0,
        order: 2,
        estimatedCost: 0,
      },
      {
        id: "near",
        name: "가까운곳",
        category: "attraction",
        lat: 37.56,
        lng: 126.99,
        dayIndex: 0,
        order: 3,
        estimatedCost: 0,
      },
      {
        id: "hotel1",
        name: "숙소",
        category: "hotel",
        lat: 37.57,
        lng: 126.98,
        dayIndex: 0,
        order: 4,
        estimatedCost: 120000,
      },
    ];
    const res = await optimizeDayRoute(
      {
        places,
        dayIndex: 0,
        cityId: "seoul",
        completedPlaceIds: ["done1"],
      },
      { geminiApiKey: "" },
    );
    const day = res.places
      .filter((p) => p.dayIndex === 0)
      .sort((a, b) => a.order - b.order);
    assert.equal(day[0].id, "origin");
    assert.equal(day[1].id, "done1");
    assert.equal(day[0].plannedTime, "09:00");
    const hotel = day.filter((p) => p.category === "hotel").pop();
    assert.equal(hotel?.id, "hotel1");
    assert.equal(day[day.length - 1].category, "hotel");
  });

  it("puts hotel last; single food snaps to lunch only", async () => {
    const places = [
      {
        id: "h",
        name: "호텔",
        category: "hotel",
        lat: 37.5,
        lng: 127.0,
        dayIndex: 0,
        order: 0,
        estimatedCost: 100000,
      },
      {
        id: "a1",
        name: "명소A",
        category: "attraction",
        lat: 37.51,
        lng: 127.01,
        dayIndex: 0,
        order: 1,
        estimatedCost: 0,
      },
      {
        id: "a2",
        name: "명소B",
        category: "attraction",
        lat: 37.52,
        lng: 127.02,
        dayIndex: 0,
        order: 2,
        estimatedCost: 0,
      },
      {
        id: "f1",
        name: "맛집1",
        category: "food",
        lat: 37.515,
        lng: 127.015,
        dayIndex: 0,
        order: 3,
        estimatedCost: 15000,
        plannedTime: "15:00",
      },
    ];
    const res = await optimizeDayRoute(
      { places, dayIndex: 0, cityId: "seoul", completedPlaceIds: [] },
      { geminiApiKey: "" },
    );
    const day = res.places
      .filter((p) => p.dayIndex === 0)
      .sort((a, b) => a.order - b.order);
    assert.equal(day[day.length - 1].category, "hotel");
    const foods = day.filter((p) => p.category === "food");
    assert.equal(foods.length, 1);
    const m = String(foods[0].plannedTime || "").match(/^(\d{1,2}):(\d{2})$/);
    const mins = m ? Number(m[1]) * 60 + Number(m[2]) : null;
    assert.ok(mins != null && mins >= 11 * 60 && mins <= 14 * 60);
  });
});

describe("schedule-constraints", () => {
  const toMin = (t) => {
    const m = String(t || "").match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  it("locks origin departure and completed ids", () => {
    const origin = {
      id: "o",
      category: "transport",
      notes: "여행 출발 · 기차",
      estimatedCost: 0,
    };
    const done = { id: "d1", category: "attraction" };
    assert.equal(isScheduleLockedPlace(origin, new Set()), true);
    assert.equal(isScheduleLockedPlace(done, new Set(["d1"])), true);
    assert.equal(isScheduleLockedPlace(done, new Set()), false);
  });

  it("split/merge keeps locked prefix and hotel suffix", () => {
    const dayPlaces = [
      {
        id: "o",
        category: "transport",
        notes: "여행 출발",
        estimatedCost: 0,
        order: 0,
      },
      { id: "c", category: "attraction", order: 1 },
      { id: "a", category: "attraction", order: 2 },
      { id: "h", category: "hotel", order: 3, estimatedCost: 1 },
    ];
    const { locked, movable, stayHotels, morningHotels } =
      splitDayPlacesForReorder(dayPlaces, ["c"]);
    assert.deepEqual(
      locked.map((p) => p.id),
      ["o", "c"],
    );
    assert.deepEqual(
      movable.map((p) => p.id),
      ["a"],
    );
    assert.deepEqual(
      stayHotels.map((p) => p.id),
      ["h"],
    );
    assert.equal(morningHotels.length, 0);
    const merged = mergeConstrainedDayOrder(locked, movable, stayHotels, {
      morningHotels,
      dayIndex: 0,
    });
    assert.deepEqual(
      merged.map((p) => p.id),
      ["o", "c", "a", "h"],
    );
  });

  it("Day2+ bookends: chain hotel first and stay hotel last", () => {
    const day = [
      { id: "a", category: "attraction", order: 0, dayIndex: 1 },
      {
        id: "stay",
        category: "hotel",
        notes: "숙박",
        estimatedCost: 90000,
        order: 1,
        dayIndex: 1,
      },
      {
        id: "chain",
        category: "hotel",
        notes: "전날 마지막 장소 · 출발",
        estimatedCost: 0,
        order: 2,
        dayIndex: 1,
      },
    ];
    const out = ensureHotelBookends(day, { dayIndex: 1 });
    assert.equal(out[0].id, "chain");
    assert.equal(out[out.length - 1].id, "stay");
  });

  it("Day1 keeps non-hotel start; stay hotel last", () => {
    const day = [
      {
        id: "origin",
        category: "transport",
        notes: "여행 출발 · 자차",
        estimatedCost: 0,
        order: 0,
      },
      { id: "a", category: "attraction", order: 1 },
      {
        id: "stay",
        category: "hotel",
        estimatedCost: 90000,
        order: 2,
      },
    ];
    const out = ensureHotelBookends(day, {
      dayIndex: 0,
      completedPlaceIds: [],
    });
    assert.equal(out[0].id, "origin");
    assert.equal(out[out.length - 1].id, "stay");
  });

  it("1 food → lunch window only", () => {
    const day = [
      { id: "f1", category: "food", plannedTime: "19:00", order: 0 },
    ];
    const out = snapUnlockedFoodToMealWindows(day, { startHour: 9 });
    const mins = toMin(out[0].plannedTime);
    assert.ok(mins >= 11 * 60 && mins <= 14 * 60);
    assert.ok(!(mins >= 18 * 60 && mins <= 20 * 60));
  });

  it("2 foods → one lunch and one dinner", () => {
    const day = [
      { id: "f1", category: "food", plannedTime: "15:00", order: 0 },
      { id: "f2", category: "food", plannedTime: undefined, order: 1 },
    ];
    const out = snapUnlockedFoodToMealWindows(day, { startHour: 9 });
    const mins = out.map((p) => toMin(p.plannedTime));
    assert.ok(mins.some((n) => n >= 11 * 60 && n <= 14 * 60));
    assert.ok(mins.some((n) => n >= 18 * 60 && n <= 20 * 60));
  });

  it("applyMajorSchedulePostConstraints Day2 hotel start+end, no food insert", () => {
    const places = [
      {
        id: "stay",
        name: "호텔",
        category: "hotel",
        dayIndex: 1,
        order: 0,
        estimatedCost: 1,
        notes: "숙박",
      },
      {
        id: "a",
        name: "명소",
        category: "attraction",
        dayIndex: 1,
        order: 1,
        estimatedCost: 0,
      },
      {
        id: "chain",
        name: "전날숙소",
        category: "hotel",
        dayIndex: 1,
        order: 2,
        estimatedCost: 0,
        notes: "전날 마지막 장소 · 출발",
      },
    ];
    const out = applyMajorSchedulePostConstraints(places, {
      dayIndex: 1,
      days: 2,
      startHour: 9,
    });
    const day = out
      .filter((p) => p.dayIndex === 1)
      .sort((a, b) => a.order - b.order);
    assert.equal(day[0].id, "chain");
    assert.equal(day[day.length - 1].id, "stay");
    assert.equal(day.filter((p) => p.category === "food").length, 0);
  });
});

describe("reroute locks departure", () => {
  it("keeps origin departure when regenerating remaining day", async () => {
    const trip = {
      days: 1,
      nights: 0,
      partySize: 2,
      cityId: "seoul",
      startTime: "09:00",
      places: [
        {
          id: "origin",
          name: "출발지",
          category: "transport",
          notes: "여행 출발 · 자차",
          lat: 37.5,
          lng: 127.0,
          dayIndex: 0,
          order: 0,
          estimatedCost: 0,
          plannedTime: "09:00",
        },
        {
          id: "done",
          name: "완료",
          category: "attraction",
          lat: 37.55,
          lng: 126.99,
          dayIndex: 0,
          order: 1,
          estimatedCost: 0,
          plannedTime: "10:00",
        },
        {
          id: "old",
          name: "옛일정",
          category: "attraction",
          lat: 37.56,
          lng: 126.98,
          dayIndex: 0,
          order: 2,
          estimatedCost: 0,
        },
      ],
    };
    const res = await rerouteItinerary(
      {
        trip,
        dayIndex: 0,
        reason: "test",
        completedPlaceIds: ["done"],
      },
      { geminiApiKey: "" },
    );
    const day = res.places
      .filter((p) => p.dayIndex === 0)
      .sort((a, b) => a.order - b.order);
    assert.ok(day.some((p) => p.id === "origin"));
    assert.ok(day.some((p) => p.id === "done"));
    assert.ok(!day.some((p) => p.id === "old"));
    assert.equal(day[0].id, "origin");
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

describe("ensureDailyMealSlots", () => {
  const baseDay = [
    {
      id: "a1",
      name: "명소A",
      category: "attraction",
      lat: 37.57,
      lng: 126.98,
      cityId: "seoul",
      dayIndex: 0,
      order: 0,
      plannedTime: "10:00",
      estimatedCost: 0,
    },
    {
      id: "a2",
      name: "명소B",
      category: "attraction",
      lat: 37.58,
      lng: 126.99,
      cityId: "seoul",
      dayIndex: 0,
      order: 1,
      plannedTime: "15:00",
      estimatedCost: 0,
    },
    {
      id: "h1",
      name: "호텔",
      category: "hotel",
      lat: 37.56,
      lng: 126.98,
      cityId: "seoul",
      dayIndex: 0,
      order: 2,
      plannedTime: "21:00",
      estimatedCost: 120000,
    },
  ];

  const tourPool = {
    food: [
      {
        id: "f-lunch",
        name: "서울 점심식당",
        lat: 37.571,
        lng: 126.981,
        cityId: "seoul",
        estimatedCost: 12000,
      },
      {
        id: "f-dinner",
        name: "서울 저녁식당",
        lat: 37.572,
        lng: 126.982,
        cityId: "seoul",
        estimatedCost: 18000,
      },
    ],
  };

  it("inserts lunch and dinner food in meal windows when missing", () => {
    const result = ensureDailyMealSlots(baseDay, {
      days: 1,
      startHour: 9,
      tourPool,
      partySize: 2,
      cityId: "seoul",
    });
    const foods = result.filter((p) => p.category === "food");
    assert.equal(foods.length, 2);

    const lunch = foods.find((p) => {
      const m = String(p.plannedTime).match(/^(\d+):(\d+)$/);
      const mins = Number(m[1]) * 60 + Number(m[2]);
      return mins >= MEAL_WINDOWS.lunch.startMin && mins <= MEAL_WINDOWS.lunch.endMin;
    });
    const dinner = foods.find((p) => {
      const m = String(p.plannedTime).match(/^(\d+):(\d+)$/);
      const mins = Number(m[1]) * 60 + Number(m[2]);
      return (
        mins >= MEAL_WINDOWS.dinner.startMin && mins <= MEAL_WINDOWS.dinner.endMin
      );
    });
    assert.ok(lunch, "lunch food in 11:00–14:00");
    assert.ok(dinner, "dinner food in 18:00–20:00");
    assert.equal(lunch.plannedTime, "12:00");
    assert.equal(dinner.plannedTime, "18:30");
    assert.equal(lunch.name, "서울 점심식당");
    assert.equal(dinner.name, "서울 저녁식당");
    assert.equal(lunch.estimatedCost, 12000);
  });

  it("does not duplicate lunch when day already has food in 11–14", () => {
    const withLunch = [
      baseDay[0],
      {
        id: "food-existing",
        name: "기존 점심",
        category: "food",
        lat: 37.57,
        lng: 126.98,
        cityId: "seoul",
        dayIndex: 0,
        order: 1,
        plannedTime: "12:30",
        estimatedCost: 15000,
        notes: "점심 식사",
      },
      { ...baseDay[1], order: 2 },
      { ...baseDay[2], order: 3 },
    ];
    const result = ensureDailyMealSlots(withLunch, {
      days: 1,
      startHour: 9,
      tourPool,
      partySize: 2,
      cityId: "seoul",
    });
    const lunchFoods = result.filter((p) => {
      if (p.category !== "food") return false;
      const m = String(p.plannedTime).match(/^(\d+):(\d+)$/);
      if (!m) return false;
      const mins = Number(m[1]) * 60 + Number(m[2]);
      return mins >= MEAL_WINDOWS.lunch.startMin && mins <= MEAL_WINDOWS.lunch.endMin;
    });
    assert.equal(lunchFoods.length, 1);
    assert.equal(lunchFoods[0].name, "기존 점심");
    const dinnerFoods = result.filter((p) => {
      if (p.category !== "food") return false;
      const m = String(p.plannedTime).match(/^(\d+):(\d+)$/);
      if (!m) return false;
      const mins = Number(m[1]) * 60 + Number(m[2]);
      return (
        mins >= MEAL_WINDOWS.dinner.startMin && mins <= MEAL_WINDOWS.dinner.endMin
      );
    });
    assert.equal(dinnerFoods.length, 1);
  });

  it("skips lunch for late startHour but still adds dinner before 20:00", () => {
    const result = ensureDailyMealSlots(baseDay, {
      days: 1,
      startHour: 15,
      tourPool,
      partySize: 2,
      cityId: "seoul",
    });
    const foods = result.filter((p) => p.category === "food");
    assert.equal(foods.length, 1);
    const mins = (() => {
      const m = String(foods[0].plannedTime).match(/^(\d+):(\d+)$/);
      return Number(m[1]) * 60 + Number(m[2]);
    })();
    assert.ok(
      mins >= MEAL_WINDOWS.dinner.startMin && mins <= MEAL_WINDOWS.dinner.endMin,
    );
    assert.equal(foods[0].plannedTime, "18:30");
  });

  it("returns the same array reference when meals already satisfied", () => {
    const full = [
      baseDay[0],
      {
        id: "l",
        name: "점심",
        category: "food",
        lat: 37.57,
        lng: 126.98,
        cityId: "seoul",
        dayIndex: 0,
        order: 1,
        plannedTime: "12:00",
        estimatedCost: 15000,
      },
      { ...baseDay[1], order: 2 },
      {
        id: "d",
        name: "저녁",
        category: "food",
        lat: 37.57,
        lng: 126.98,
        cityId: "seoul",
        dayIndex: 0,
        order: 3,
        plannedTime: "18:30",
        estimatedCost: 15000,
      },
      { ...baseDay[2], order: 4 },
    ];
    const result = ensureDailyMealSlots(full, {
      days: 1,
      startHour: 9,
      tourPool,
      cityId: "seoul",
    });
    assert.equal(result, full);
  });
});

describe("neighborDayContext / regenerate-day", () => {
  const samplePlaces = [
    {
      id: "d0-a",
      name: "남산타워",
      category: "attraction",
      dayIndex: 0,
      order: 0,
      cityId: "seoul",
      lat: 37.55,
      lng: 126.98,
      plannedTime: "10:00",
    },
    {
      id: "d0-f",
      name: "명동 점심",
      category: "food",
      dayIndex: 0,
      order: 1,
      cityId: "seoul",
      lat: 37.56,
      lng: 126.98,
      plannedTime: "12:00",
    },
    {
      id: "d1-a",
      name: "해운대",
      category: "attraction",
      dayIndex: 1,
      order: 0,
      cityId: "busan",
      lat: 35.16,
      lng: 129.16,
      plannedTime: "11:00",
    },
    {
      id: "d2-a",
      name: "감천문화마을",
      category: "attraction",
      dayIndex: 2,
      order: 0,
      cityId: "busan",
      lat: 35.1,
      lng: 129.01,
      plannedTime: "10:30",
    },
  ];

  it("summarizes previous and next day places for context", () => {
    const ctx = neighborDayContext(samplePlaces, 1);
    assert.equal(ctx.previousDay.length, 2);
    assert.equal(ctx.previousDay[0].name, "남산타워");
    assert.equal(ctx.nextDay.length, 1);
    assert.equal(ctx.nextDay[0].name, "감천문화마을");
  });

  it("returns empty previousDay for the first day", () => {
    const ctx = neighborDayContext(samplePlaces, 0);
    assert.deepEqual(ctx.previousDay, []);
    assert.equal(ctx.nextDay.length, 1);
    assert.equal(ctx.nextDay[0].name, "해운대");
  });

  it("regenerates only the target day with fallback engine", async () => {
    const trip = {
      cityId: "seoul",
      days: 3,
      nights: 2,
      partySize: 2,
      startTime: "09:00",
      lodgingReturnTime: "21:00",
      outboundTransportMode: "car",
      cities: [
        { cityId: "seoul", cityName: "서울", dayIndexes: [0] },
        { cityId: "busan", cityName: "부산", dayIndexes: [1, 2] },
      ],
      places: samplePlaces,
    };
    const res = await regenerateDayItinerary(
      { trip, dayIndex: 1, targetCityId: "jeju" },
      {},
    );
    assert.equal(res.dayIndex, 1);
    assert.equal(res.cityId, "jeju");
    assert.equal(res.engine, "fallback");
    assert.ok(res.replacedCount > 0);
    const day1 = res.places.filter((p) => p.dayIndex === 1);
    const other = res.places.filter((p) => p.dayIndex !== 1);
    assert.ok(day1.length > 0);
    // 전날 연결 출발 호텔은 이전 도시일 수 있음 — 신규 본일정은 제주
    const core = day1.filter(
      (p) => !String(p.notes || "").includes("전날") && !String(p.notes || "").includes("출발"),
    );
    assert.ok(core.length > 0);
    assert.ok(core.every((p) => p.cityId === "jeju"));
    assert.ok(other.some((p) => p.id === "d0-a"));
    assert.ok(other.some((p) => p.id === "d2-a"));
    assert.ok(!res.places.some((p) => p.id === "d1-a"));
    assert.equal(res.neighborContext.previousDay[0].name, "남산타워");
    assert.equal(res.neighborContext.nextDay[0].name, "감천문화마을");
  });
});

describe("place grounding", () => {
  it("scores similar names and rejects unrelated ones", async () => {
    const { placeNameSimilarity, groundDomesticPlaces } = await import(
      "../lib/place-ground.mjs"
    );
    assert.ok(placeNameSimilarity("대한다원", "대한다원 보성녹차밭") >= 0.55);
    assert.ok(
      placeNameSimilarity("보성녹차떡갈비명가", "대한다원") < 0.45,
    );

    const grounded = await groundDomesticPlaces(
      [
        {
          id: "fake",
          name: "보성녹차떡갈비명가",
          category: "food",
          lat: 34.7,
          lng: 127.0,
          cityId: "boseong",
          dayIndex: 0,
          order: 0,
          estimatedCost: 20000,
        },
      ],
      {
        tourPool: {
          attraction: [],
          food: [
            {
              id: "tour-food-1",
              name: "보성녹차밭근처식당",
              category: "food",
              lat: 34.71,
              lng: 127.08,
              cityId: "boseong",
            },
          ],
          hotel: [],
        },
        mapsApiKey: "",
      },
    );
    assert.equal(grounded.length, 1);
    assert.equal(grounded[0].id, "tour-food-1");
    assert.equal(grounded[0].grounded, "tourapi");
  });
});

describe("tourapi places", () => {
  it("parses TourAPI detailIntro/common fields without inventing hotel price", () => {
    assert.equal(cleanTourText("오전 09:00<br />~18:00"), "오전 09:00 ~18:00");

    const food = parseTourDetailFields(
      "food",
      {
        opentimefood: "11:00~21:00",
        restdatefood: "매주 월요일",
        firstmenu: "비빔밥",
        treatmenu: "된장찌개",
        infocenterfood: "02-111-2222",
      },
      { addr1: "서울 종로구", tel: "02-000-0000" },
    );
    assert.equal(food.openingHours, "11:00~21:00");
    assert.equal(food.restDate, "매주 월요일");
    assert.equal(food.phone, "02-111-2222");
    assert.equal(food.address, "서울 종로구");
    assert.equal(food.officialMenu, "비빔밥 · 된장찌개");
    assert.equal(food.signatureFood, "비빔밥");

    const attraction = parseTourDetailFields(
      "attraction",
      {
        usetime: "09:00~18:00",
        restdate: "화요일",
        usefee: "성인 3,000원",
        infocenter: "02-333-4444",
      },
      { addr1: "서울 중구" },
    );
    assert.equal(attraction.openingHours, "09:00~18:00");
    assert.equal(attraction.restDate, "화요일");
    assert.equal(attraction.admissionFee, "성인 3,000원");
    assert.equal(attraction.phone, "02-333-4444");

    const hotel = parseTourDetailFields(
      "hotel",
      {
        checkintime: "15:00",
        checkouttime: "11:00",
        infocenterlodging: "02-555-6666",
        reservationurl: "https://example.com/book",
      },
      { addr1: "서울 강남구", tel: "02-999-0000" },
    );
    assert.equal(hotel.checkInTime, "15:00");
    assert.equal(hotel.checkOutTime, "11:00");
    assert.equal(hotel.phone, "02-555-6666");
    assert.equal(hotel.address, "서울 강남구");
    assert.equal(hotel.reservationUrl, "https://example.com/book");
    assert.equal(hotel.estimatedCost, undefined);
  });

  it("formats prompt pool and lodging candidates from TourAPI stays", () => {
    const pool = {
      attraction: [
        {
          id: "tour-1",
          name: "남산타워",
          cityId: "seoul",
          lat: 37.55,
          lng: 126.98,
        },
      ],
      food: [],
      hotel: [
        {
          id: "tour-h1",
          name: "서울호텔",
          cityId: "seoul",
          lat: 37.56,
          lng: 126.98,
          notes: "중구",
        },
      ],
    };
    const prompt = formatTourPoolForPrompt(pool);
    assert.match(prompt, /남산타워/);
    assert.match(prompt, /TourAPI/);
    assert.match(prompt, /1박 가격을 추측/);
    const lodging = tourStaysToLodgingCandidates(pool.hotel, {
      nights: 2,
      partySize: 2,
      topN: 3,
      cityId: "seoul",
    });
    assert.equal(lodging.length, 1);
    assert.equal(lodging[0].category, "hotel");
    // TourAPI 숙소는 공식 요금 없음 — 가짜 120000 금지
    assert.equal(lodging[0].estimatedCost, 0);
    assert.equal(lodging[0].pricePerPerson, undefined);

    const suggestHotels = tourPlacesToSuggestItems(
      [
        {
          id: "tour-h1",
          name: "서울호텔",
          category: "hotel",
          lat: 37.56,
          lng: 126.98,
          cityId: "seoul",
        },
      ],
      { partySize: 2 },
    );
    assert.equal(suggestHotels[0].estimatedCost, 0);
    assert.equal(suggestHotels[0].pricePerPerson, undefined);

    const score = lodgingScoreBreakdown(
      { lat: 37.56, lng: 126.98, estimatedCost: 0, notes: "테스트" },
      { nights: 2, cityId: "seoul" },
    );
    assert.equal(score.scoreBreakdown.priceEstimate, 50);
  });

  it("suggestViaTourApi maps locationBasedList2 items", async () => {
    clearTourApiCache();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "0000", resultMsg: "OK" },
            body: {
              items: {
                item: [
                  {
                    contentid: "attr-1",
                    title: "경복궁",
                    mapx: "126.977",
                    mapy: "37.579",
                    addr1: "서울특별시 종로구",
                  },
                ],
              },
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    try {
      const places = await suggestViaTourApi({
        cityId: "seoul",
        category: "attraction",
        serviceKey: "test-key",
      });
      assert.equal(places.length, 1);
      assert.equal(places[0].id, "tour-attr-1");
      assert.equal(places[0].name, "경복궁");
      assert.equal(places[0].category, "attraction");

      const suggested = await suggestPlacesByCategory({
        cityId: "seoul",
        category: "attraction",
        tourApiServiceKey: "test-key",
      });
      assert.equal(suggested.source, "tourapi");
      assert.equal(suggested.places[0].name, "경복궁");

      clearTourApiCache();
      let usedMapY = "";
      let usedMapX = "";
      let listCalls = 0;
      let detailCalls = 0;
      globalThis.fetch = async (input) => {
        const u = new URL(String(input));
        const isList = u.pathname.includes("locationBasedList2");
        const isDetail =
          u.pathname.includes("detailIntro2") ||
          u.pathname.includes("detailCommon2");
        if (isList) {
          listCalls += 1;
          usedMapY = u.searchParams.get("mapY") || "";
          usedMapX = u.searchParams.get("mapX") || "";
        }
        if (isDetail) detailCalls += 1;
        const item = isDetail
          ? {
              contentid: "attr-2",
              usetime: "09:00~18:00",
              restdate: "월요일",
              usefee: "무료",
              infocenter: "02-123-4567",
              addr1: "서울",
              tel: "02-123-4567",
            }
          : {
              contentid: "attr-2",
              title: "근처명소",
              mapx: "126.99",
              mapy: "37.5",
              addr1: "서울",
            };
        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "0000", resultMsg: "OK" },
              body: {
                items: {
                  item: [item],
                },
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      };
      const near = await suggestViaTourApi({
        cityId: "seoul",
        category: "attraction",
        serviceKey: "test-key",
        lat: 37.5,
        lng: 127.0,
      });
      assert.equal(usedMapY, "37.5");
      assert.equal(usedMapX, "127");
      assert.equal(listCalls, 1);
      assert.ok(detailCalls >= 1);
      assert.equal(near[0].name, "근처명소");
      assert.equal(near[0].openingHours, "09:00~18:00");
      assert.equal(near[0].admissionFee, "무료");
      assert.equal(near[0].phone, "02-123-4567");
    } finally {
      globalThis.fetch = originalFetch;
      clearTourApiCache();
    }
  });
});

describe("tour courses (contentTypeId=25)", () => {
  it("maps cityId to TourAPI areaCode", () => {
    assert.equal(resolveTourAreaCode("seoul"), "1");
    assert.equal(resolveTourAreaCode("busan"), "6");
    assert.equal(resolveTourAreaCode("daegu"), "4");
    assert.equal(resolveTourAreaCode("jeju"), "39");
    assert.equal(resolveTourAreaCode("suwon"), "31");
    assert.equal(resolveTourAreaCode("gyeongju"), "35");
    assert.equal(resolveTourAreaCode("tokyo"), null);
  });

  it("normalizes course list items and waypoints without inventing coords", () => {
    const listed = normalizeTourCourseListItem(
      {
        contentid: "12345",
        title: "한강 산책 코스",
        addr1: "서울 영등포구",
        mapy: "37.52",
        mapx: "126.93",
      },
      "seoul",
    );
    assert.equal(listed.contentId, "12345");
    assert.equal(listed.title, "한강 산책 코스");
    assert.equal(listed.badge, "관광공사");
    assert.equal(listed.lat, 37.52);
    assert.equal(listed.lng, 126.93);
    // list API addr1은 개요가 아님 — overview로 쓰지 않음
    assert.equal(listed.overview, undefined);
    assert.equal(listed.address, "서울 영등포구");

    const withOverview = normalizeTourCourseListItem(
      {
        contentid: "999",
        title: "개요있는 코스",
        overview: "<b>한강</b>을 따라 걷는 도심 산책 코스입니다.<br>여의도부터",
        distance: "5km",
        taketime: "2시간",
        theme: "산책",
      },
      "seoul",
    );
    assert.equal(withOverview.overview, "한강을 따라 걷는 도심 산책 코스입니다. 여의도부터");
    assert.equal(withOverview.distance, "5km");
    assert.equal(withOverview.takeTime, "2시간");
    assert.equal(withOverview.theme, "산책");

    const withCoords = normalizeTourCourseWaypoint(
      {
        subnum: 1,
        subname: "여의도공원",
        subcontentid: "111",
        mapy: "37.528",
        mapx: "126.932",
        subdetailoverview: "한강 뷰",
      },
      0,
    );
    assert.equal(withCoords.order, 1);
    assert.equal(withCoords.name, "여의도공원");
    assert.equal(withCoords.contentId, "111");
    assert.equal(withCoords.lat, 37.528);

    const noCoords = normalizeTourCourseWaypoint(
      { subnum: 2, subname: "좌표없음명소", subcontentid: "222" },
      1,
    );
    assert.equal(noCoords.name, "좌표없음명소");
    assert.equal(noCoords.lat, undefined);
    assert.equal(noCoords.lng, undefined);

    assert.equal(
      formatCourseWaypointSummary([withCoords, noCoords]),
      "여의도공원 → 좌표없음명소",
    );
  });

  it("formats list briefing from overview and truncates", () => {
    assert.equal(formatCourseListBriefing(""), undefined);
    assert.equal(formatCourseListBriefing(null), undefined);
    assert.equal(
      formatCourseListBriefing("한강 뷰를 즐기는 산책 코스"),
      "한강 뷰를 즐기는 산책 코스",
    );
    assert.equal(
      formatCourseListBriefing("A".repeat(200), 80)?.length,
      80,
    );
    assert.equal(
      formatCourseListBriefing("소개<br>문구 &amp; 테마"),
      "소개 문구 & 테마",
    );
  });

  it("enriches course list with detailCommon2 overview", async () => {
    clearTourCourseCache();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const u = new URL(String(input));
      let item;
      if (u.pathname.includes("areaBasedList2")) {
        item = {
          contentid: "c-100",
          title: "서울 한강 코스",
          addr1: "서울 영등포구",
          mapy: "37.52",
          mapx: "126.93",
        };
      } else if (u.pathname.includes("detailCommon2")) {
        // TourAPI 4.3: YN 파라미터 없어야 정상 응답
        assert.equal(u.searchParams.get("mapinfoYN"), null);
        assert.equal(u.searchParams.get("defaultYN"), null);
        item = {
          contentid: "c-100",
          title: "서울 한강 코스",
          overview: "여의도에서 시작해 한강을 따라 걷는 공식 추천 코스입니다.",
          addr1: "서울 영등포구",
        };
      } else if (u.pathname.includes("detailIntro2")) {
        item = {
          contentid: "c-100",
          distance: "8km",
          taketime: "3시간",
          theme: "도심산책",
        };
      } else {
        item = {};
      }
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "0000", resultMsg: "OK" },
            body: { items: { item: [item] } },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const { courses, source } = await listTourCourses({
        cityId: "seoul",
        serviceKey: "test-key",
        limit: 4,
      });
      assert.equal(source, "areaBasedList2");
      assert.equal(courses.length, 1);
      assert.equal(courses[0].contentId, "c-100");
      assert.match(courses[0].overview || "", /한강을 따라/);
      assert.equal(courses[0].distance, "8km");
      assert.equal(courses[0].takeTime, "3시간");
      assert.equal(courses[0].theme, "도심산책");
      // addr1을 overview로 쓰지 않음
      assert.notEqual(courses[0].overview, "서울 영등포구");
    } finally {
      globalThis.fetch = originalFetch;
      clearTourCourseCache();
    }
  });

  it("fills waypoint coords from detailCommon2 when detailInfo2 lacks mapx/mapy", async () => {
    clearTourCourseCache();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const u = new URL(String(input));
      let item;
      if (u.pathname.includes("detailInfo2")) {
        item = [
          {
            subnum: "0",
            subcontentid: "111",
            subname: "하회마을",
            subdetailoverview: "세계문화유산",
          },
          {
            subnum: "1",
            subcontentid: "222",
            subname: "병산서원",
            subdetailoverview: "서원",
          },
          {
            subnum: "2",
            subname: "좌표없는임의스탑",
            subdetailoverview: "설명만",
          },
        ];
      } else if (u.pathname.includes("detailCommon2")) {
        assert.equal(u.searchParams.get("mapinfoYN"), null);
        const cid = u.searchParams.get("contentId");
        if (cid === "course-1") {
          item = {
            contentid: "course-1",
            title: "안동 하회마을 코스",
            overview: "하회 일대",
            mapy: "36.54",
            mapx: "128.52",
          };
        } else if (cid === "111") {
          item = {
            contentid: "111",
            title: "하회마을",
            mapy: "36.539",
            mapx: "128.517",
            addr1: "경북 안동시",
          };
        } else if (cid === "222") {
          item = {
            contentid: "222",
            title: "병산서원",
            mapy: "36.542",
            mapx: "128.553",
          };
        } else {
          item = {};
        }
      } else if (u.pathname.includes("detailIntro2")) {
        item = { distance: "5km", taketime: "3시간" };
      } else {
        item = {};
      }
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "0000", resultMsg: "OK" },
            body: {
              items: {
                item: Array.isArray(item) ? item : [item],
              },
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const detail = await fetchTourCourseDetail({
        contentId: "course-1",
        cityId: "andong",
        serviceKey: "test-key",
      });
      assert.equal(detail.title, "안동 하회마을 코스");
      assert.equal(detail.waypoints.length, 3);
      assert.equal(detail.waypoints[0].name, "하회마을");
      assert.equal(detail.waypoints[0].lat, 36.539);
      assert.equal(detail.waypoints[0].lng, 128.517);
      assert.equal(detail.waypoints[1].lat, 36.542);
      assert.equal(detail.waypoints[2].lat, undefined);
      assert.ok(
        detail.waypoints.some(
          (w) => Number.isFinite(w.lat) && Number.isFinite(w.lng),
        ),
      );
    } finally {
      globalThis.fetch = originalFetch;
      clearTourCourseCache();
    }
  });

  it("injects seeded waypoints into tour pool and formats prompt", () => {
    clearTourCourseCache();
    const seed = normalizeTourCourseSeed({
      tourCourse: {
        contentId: "c1",
        title: "서울 핵심 코스",
        cityId: "seoul",
        waypoints: [
          { order: 1, name: "경복궁", contentId: "a1", lat: 37.5796, lng: 126.977 },
          { order: 2, name: "좌표없음", contentId: "a2" },
          { order: 3, name: "북촌", lat: 37.5826, lng: 126.983 },
        ],
      },
    });
    assert.equal(seed.contentId, "c1");
    assert.equal(seed.waypoints.length, 3);

    const { pool, seeded } = injectCourseWaypointsIntoPool(
      { attraction: [{ id: "tour-x", name: "기존", cityId: "seoul", lat: 1, lng: 2 }], food: [], hotel: [] },
      seed.waypoints,
      "seoul",
    );
    assert.equal(seeded.length, 2);
    assert.equal(pool.attraction[0].name, "경복궁");
    assert.equal(pool.attraction[0].mustVisit, true);
    assert.ok(!pool.attraction.some((p) => p.name === "좌표없음"));

    const prompt = formatCourseSeedForPrompt(seed);
    assert.match(prompt, /한국관광공사 추천 코스 시드/);
    assert.match(prompt, /경복궁/);
    assert.match(prompt, /북촌/);
    assert.ok(!prompt.includes("좌표없음"));
  });
});

describe("buildRouteBriefing", () => {
  it("builds structured sections from trip input and seed", () => {
    const rb = buildRouteBriefing({
      originLabel: "서울역",
      endLabel: "서울역",
      cityIds: ["busan", "jeju"],
      cities: [
        { cityId: "busan", cityName: "부산", dayIndexes: [0, 1] },
        { cityId: "jeju", cityName: "제주", dayIndexes: [2] },
      ],
      nights: 2,
      days: 3,
      mainRequest: "해산물 위주로",
      extraRequest: "아이와 함께",
      preferences: { food: 5, attraction: 3, activity: 2, cost: 4, minTravel: 3 },
      preferredFestivals: [
        {
          name: "부산불꽃축제",
          cityId: "busan",
          startDate: "2026-10-01",
          endDate: "2026-10-05",
        },
      ],
      seedCourse: {
        title: "부산 해변 코스",
        source: "한국관광공사",
        stopCount: 4,
        routeSummary: "해운대 → 광안리",
      },
      outboundTransportMode: "train",
    });

    assert.match(rb.routeSummary, /서울역/);
    assert.match(rb.routeSummary, /부산/);
    assert.match(rb.routeSummary, /제주/);
    assert.equal(rb.durationLabel, "2박 3일");
    assert.match(rb.dayAssignments, /부산 2일/);
    assert.equal(rb.requests.mainRequest, "해산물 위주로");
    assert.equal(rb.requests.extraRequest, "아이와 함께");
    assert.equal(rb.requests.reflected, true);
    assert.equal(rb.requests.preferences.find((p) => p.key === "food")?.value, 5);
    assert.equal(rb.festivalsReflected, true);
    assert.equal(rb.festivals[0].name, "부산불꽃축제");
    assert.equal(rb.festivals[0].cityName, "부산");
    assert.equal(rb.courseReflected, true);
    assert.equal(rb.seedCourse.title, "부산 해변 코스");
    assert.equal(rb.seedCourse.stopCount, 4);
    assert.equal(rb.seedCourse.usedAsSeed, true);
    assert.match(rb.scheduleRule, /11–14/);
    assert.match(rb.scheduleRule, /기차/);
  });

  it("marks empty request/festival/course as not reflected", () => {
    const rb = buildRouteBriefing({
      cityIds: ["seoul"],
      nights: 1,
      days: 2,
      routeOutline: "집 → 서울 → 집",
    });
    assert.equal(rb.routeSummary, "집 → 서울 → 집");
    assert.equal(rb.requests.reflected, false);
    assert.equal(rb.festivalsReflected, false);
    assert.equal(rb.courseReflected, false);
    assert.equal(rb.seedCourse, null);
    assert.match(rb.scheduleRule, /체류/);
  });
});
