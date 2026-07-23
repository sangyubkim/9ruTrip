import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseKoreanCardSms } from "../lib/sms-parse.mjs";
import {
  nearestNeighborOrder,
  optimizeDayRoute,
  pathLengthKm,
} from "../lib/optimize-day.mjs";
import {
  clearDirectionsCache,
  compareLegTransport,
  directionsCacheKey,
  haversineKm,
  lodgingScoreBreakdown,
} from "../lib/transport.mjs";

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
