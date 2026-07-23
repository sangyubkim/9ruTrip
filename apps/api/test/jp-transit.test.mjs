import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildGoogleTransitDeepLink,
  buildTransitDeepLinks,
  buildYahooTransitDeepLink,
  buildYahooTransitSearchDeepLink,
  estimateTransitLeg,
  parseNavitimeRoute,
  tryNavitimeTransit,
} from "../lib/jp-transit.mjs";
import { compareLegTransport, estimateLegByModeHaversine } from "../lib/transport.mjs";

const FROM = { lat: 35.6812, lng: 139.7671, name: "東京駅" };
const TO = { lat: 35.6581, lng: 139.7017, name: "渋谷駅" };

describe("jp-transit deep link builders", () => {
  it("builds Yahoo map.yahoo.co.jp train URL with lat/lng", () => {
    const url = buildYahooTransitDeepLink(FROM, TO);
    assert.ok(url.startsWith("https://map.yahoo.co.jp/route/train?"));
    const u = new URL(url);
    assert.equal(u.searchParams.get("fromLat"), "35.6812");
    assert.equal(u.searchParams.get("fromLon"), "139.7671");
    assert.equal(u.searchParams.get("toLat"), "35.6581");
    assert.equal(u.searchParams.get("toLon"), "139.7017");
    assert.ok(u.searchParams.get("from")?.includes("東京"));
    assert.ok(u.searchParams.get("to")?.includes("渋谷"));
  });

  it("builds Yahoo transit.yahoo.co.jp search URL with flatlon", () => {
    const url = buildYahooTransitSearchDeepLink(FROM, TO);
    assert.ok(url.startsWith("https://transit.yahoo.co.jp/search/result?"));
    const u = new URL(url);
    assert.equal(u.searchParams.get("flatlon"), "139.7671,35.6812,degree");
    assert.equal(u.searchParams.get("tlatlon"), "139.7017,35.6581,degree");
  });

  it("builds Google Maps transit directions URL", () => {
    const url = buildGoogleTransitDeepLink(FROM, TO);
    const u = new URL(url);
    assert.equal(u.searchParams.get("travelmode"), "transit");
    assert.equal(u.searchParams.get("destination"), "35.6581,139.7017");
    assert.equal(u.searchParams.get("origin"), "35.6812,139.7671");
  });

  it("buildTransitDeepLinks returns google + yahoo", () => {
    const links = buildTransitDeepLinks(FROM, TO);
    assert.ok(links.google.includes("google.com/maps"));
    assert.ok(links.yahoo.includes("map.yahoo.co.jp"));
    assert.ok(links.yahooSearch.includes("transit.yahoo.co.jp"));
  });

  it("returns empty string for invalid coords", () => {
    assert.equal(buildYahooTransitDeepLink(null, TO), "");
    assert.equal(buildGoogleTransitDeepLink(FROM, { lat: NaN, lng: 1 }), "");
  });
});

describe("jp-transit fallback chain", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("tryNavitimeTransit stubs when provider unset", async () => {
    const r = await tryNavitimeTransit(FROM, TO, { env: {} });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "provider_not_navitime");
  });

  it("tryNavitimeTransit stubs when key missing", async () => {
    const r = await tryNavitimeTransit(FROM, TO, {
      env: { JP_TRANSIT_PROVIDER: "navitime" },
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "missing_api_key");
  });

  it("tryNavitimeTransit stubs when host missing (no fake success)", async () => {
    const r = await tryNavitimeTransit(FROM, TO, {
      env: {
        JP_TRANSIT_PROVIDER: "navitime",
        NAVITIME_API_KEY: "test-key-not-real",
      },
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "missing_host_or_cid");
  });

  it("estimateTransitLeg falls through to haversine + deepLinks", async () => {
    const base = estimateLegByModeHaversine(FROM, TO, "transit");
    const r = await estimateTransitLeg(FROM, TO, {
      baseEstimate: base,
      env: {},
    });
    assert.equal(r.mode, "transit");
    assert.equal(r.engine, "haversine:transit");
    assert.ok(r.minutes > 0);
    assert.ok(r.deepLinks?.google);
    assert.ok(r.deepLinks?.yahoo);
    assert.ok(r.deepLink.includes("yahoo"));
    assert.ok(String(r.note).includes("파트너") || String(r.note).includes("추정"));
  });

  it("parseNavitimeRoute reads summary.move.time", () => {
    const parsed = parseNavitimeRoute({
      items: [
        {
          summary: {
            move: {
              type: "move",
              time: 42,
              reference_fare: { lowest_total_ic: 210 },
            },
          },
        },
      ],
    });
    assert.equal(parsed?.engine, "partner:navitime");
    assert.equal(parsed?.minutes, 42);
    assert.equal(parsed?.estimatedCost, 210);
  });

  it("parseNavitimeRoute returns null on unexpected shape", () => {
    assert.equal(parseNavitimeRoute({}), null);
    assert.equal(parseNavitimeRoute({ items: [{ summary: {} }] }), null);
  });

  it("tryNavitimeTransit wires HTTP when host+key set and parses OK", async () => {
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).includes("route_transit"));
      assert.ok(String(url).includes("start="));
      assert.equal(init?.headers?.["x-rapidapi-key"], "test-key");
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              summary: {
                move: {
                  time: 33,
                  reference_fare: { lowest_total_ic: 178 },
                },
              },
            },
          ],
        }),
      };
    };

    const r = await tryNavitimeTransit(FROM, TO, {
      env: {
        JP_TRANSIT_PROVIDER: "navitime",
        NAVITIME_API_KEY: "test-key",
        NAVITIME_API_HOST: "navitime-route-totalnavi.p.rapidapi.com",
      },
    });
    assert.equal(r.ok, true);
    assert.equal(r.result?.engine, "partner:navitime");
    assert.equal(r.result?.minutes, 33);
    assert.equal(r.result?.estimatedCost, 178);
  });

  it("compareLegTransport attaches deepLinks on transit", async () => {
    const { options } = await compareLegTransport(FROM, TO, "");
    const transit = options.find((o) => o.mode === "transit");
    assert.ok(transit);
    assert.equal(transit.engine, "haversine:transit");
    assert.ok(transit.deepLinks?.yahoo);
    assert.ok(transit.deepLinks?.google);
    assert.ok(transit.note);
  });
});
