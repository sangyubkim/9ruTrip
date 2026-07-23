import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  clearDirectionsCache,
  estimateLegByModeDirections,
} from "../lib/transport.mjs";

const FROM = { lat: 35.6812, lng: 139.7671 };
const TO = { lat: 35.6581, lng: 139.7017 };

function okDirectionsJson({ seconds = 2400, meters = 6500, fare } = {}) {
  const leg = {
    duration: { value: seconds },
    distance: { value: meters },
  };
  if (fare != null) leg.fare = { value: fare };
  return {
    status: "OK",
    routes: [{ legs: [leg] }],
  };
}

describe("Directions estimateLegByModeDirections", () => {
  let originalFetch;

  beforeEach(() => {
    clearDirectionsCache();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearDirectionsCache();
    mock.restoreAll();
  });

  it("sends language=ko region=jp departure_time=now for transit", async () => {
    let calledUrl = "";
    globalThis.fetch = async (url) => {
      calledUrl = String(url);
      return {
        ok: true,
        json: async () =>
          okDirectionsJson({ seconds: 1800, meters: 5000, fare: 210 }),
      };
    };

    const r = await estimateLegByModeDirections(
      FROM,
      TO,
      "transit",
      "test-key-not-real",
    );
    assert.equal(r.engine, "directions:transit");
    assert.ok(r.minutes >= 3);
    assert.equal(r.estimatedCost, 210);

    const u = new URL(calledUrl);
    assert.equal(u.searchParams.get("mode"), "transit");
    assert.equal(u.searchParams.get("language"), "ko");
    assert.equal(u.searchParams.get("region"), "jp");
    assert.equal(u.searchParams.get("departure_time"), "now");
    assert.ok(u.searchParams.get("key"), "key param present");
  });

  it("falls back to haversine on ZERO_RESULTS and caches", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({ status: "ZERO_RESULTS", routes: [] }),
      };
    };

    const a = await estimateLegByModeDirections(
      FROM,
      TO,
      "transit",
      "test-key-not-real",
    );
    assert.equal(a.engine, "haversine:transit");
    assert.equal(calls, 1);

    const b = await estimateLegByModeDirections(
      FROM,
      TO,
      "transit",
      "test-key-not-real",
    );
    assert.equal(b.engine, "haversine:transit");
    assert.equal(calls, 1, "second call should hit cache");
  });

  it("maps taxi to driving mode", async () => {
    let mode = "";
    globalThis.fetch = async (url) => {
      mode = new URL(String(url)).searchParams.get("mode");
      return {
        ok: true,
        json: async () => okDirectionsJson({ seconds: 900, meters: 6000 }),
      };
    };
    const r = await estimateLegByModeDirections(
      FROM,
      TO,
      "taxi",
      "test-key-not-real",
    );
    assert.equal(mode, "driving");
    assert.equal(r.engine, "directions:driving");
    assert.ok(r.estimatedCost > 0);
  });

  it("retries once on UNKNOWN_ERROR then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({ status: "UNKNOWN_ERROR", routes: [] }),
        };
      }
      return {
        ok: true,
        json: async () => okDirectionsJson({ seconds: 600, meters: 800 }),
      };
    };
    const r = await estimateLegByModeDirections(
      FROM,
      TO,
      "walking",
      "test-key-not-real",
    );
    assert.equal(r.engine, "directions:walking");
    assert.equal(calls, 2);
    assert.equal(r.estimatedCost, 0);
  });
});
