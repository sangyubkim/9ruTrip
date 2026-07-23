import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseKoreanCardSms } from "../lib/sms-parse.mjs";
import {
  compareLegTransport,
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
