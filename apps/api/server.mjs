import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readBody, matchRoute } from "./lib/http-util.mjs";
import {
  generateItinerary,
  suggestPlacesByCategory,
} from "./lib/itinerary.mjs";
import { buildExportDraft } from "./lib/export-draft.mjs";
import { rerouteItinerary } from "./lib/reroute.mjs";
import { optimizeDayRoute } from "./lib/optimize-day.mjs";
import { publishToWordPress } from "./lib/wordpress.mjs";
import { parseKoreanCardSms } from "./lib/sms-parse.mjs";
import {
  compareLegTransport,
  enrichPlacesWithTransport,
} from "./lib/transport.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirname, ".env"));
// 루트 .env도 허용
loadEnv(join(__dirname, "../../.env"));

const env = {
  port: Number(process.env.PORT ?? 3011),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:8081,*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
  geminiModel: process.env.GEMINI_MODEL?.trim() ?? "gemini-flash-lite-latest",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 90_000) || 90_000,
  // blog-pipeline 은 WP_BASE_URL, 9ruDocs/9ruTrip 은 WP_SITE_URL
  wpSiteUrl:
    process.env.WP_SITE_URL?.trim() ||
    process.env.WP_BASE_URL?.trim() ||
    "",
  wpUsername: process.env.WP_USERNAME?.trim() ?? "",
  wpAppPassword: process.env.WP_APP_PASSWORD?.trim() ?? "",
  googleMapsApiKey:
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    "",
  naverMapClientId:
    process.env.NAVER_MAP_CLIENT_ID?.trim() ||
    process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ||
    "",
};

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

function corsHeaders(origin) {
  const allowAll = env.corsOrigins.includes("*");
  const allow = allowAll || !origin || env.corsOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": allow
      ? origin || "*"
      : env.corsOrigins[0] || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function send(res, status, body, origin) {
  res.writeHead(status, corsHeaders(origin));
  res.end(JSON.stringify(body));
}

function wpMissingHint() {
  return (
    "WordPress credentials missing. Set WP_SITE_URL (또는 WP_BASE_URL), " +
    "WP_USERNAME, WP_APP_PASSWORD in apps/api/.env " +
    "(blog-pipeline / 9ruDocs 와 동일 Application Password 패턴)."
  );
}

async function handle(req, res) {
  const origin = req.headers.origin ?? "";
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  try {
    if (method === "GET" && matchRoute(url, "/health")) {
      send(
        res,
        200,
        {
          ok: true,
          service: "9rutrip-api",
          mvpCity: "tokyo",
          cities: ["tokyo", "osaka"],
          geminiConfigured: Boolean(env.geminiApiKey),
          wordpressConfigured: Boolean(
            env.wpSiteUrl && env.wpUsername && env.wpAppPassword,
          ),
          googleMapsConfigured: Boolean(env.googleMapsApiKey),
          naverMapsConfigured: Boolean(env.naverMapClientId),
          timestamp: new Date().toISOString(),
        },
        origin,
      );
      return;
    }

    if (method === "GET" && matchRoute(url, "/")) {
      send(
        res,
        200,
        {
          name: "9ruTrip API",
          mvpCity: "Tokyo",
          health: "/health",
          routes: [
            "POST /trip/itinerary",
            "POST /trip/reroute",
            "POST /trip/export-draft",
            "POST /trip/parse-sms",
            "POST /trip/enrich-transport",
            "POST /trip/compare-transport",
            "POST /trip/suggest-places",
            "POST /trip/optimize-day",
            "POST /wordpress/publish",
          ],
        },
        origin,
      );
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/itinerary")) {
      const body = await readBody(req);
      const result = await generateItinerary(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/reroute")) {
      const body = await readBody(req);
      const result = await rerouteItinerary(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/export-draft")) {
      const body = await readBody(req);
      const draft = buildExportDraft(body?.trip ?? body);
      send(
        res,
        200,
        {
          draft,
          next: {
            docsApi: "POST /wordpress/publish (9ruTrip) 또는 9ruDocs WordPress",
            note: "draft.steps / draft.body 는 @9rudocs/shared BlogDraft 와 호환",
          },
        },
        origin,
      );
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/parse-sms")) {
      const body = await readBody(req);
      const parsed = parseKoreanCardSms(body?.text ?? body?.sms ?? "");
      send(res, parsed.ok ? 200 : 400, parsed, origin);
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/enrich-transport")) {
      const body = await readBody(req);
      const places = await enrichPlacesWithTransport(body?.places ?? [], {
        forceRecalc: Boolean(body?.forceRecalc),
        mapsApiKey: env.googleMapsApiKey,
        startHour: Number(body?.startHour) || 9,
        cityId: body?.cityId === "osaka" ? "osaka" : body?.cityId === "tokyo" ? "tokyo" : undefined,
      });
      send(
        res,
        200,
        {
          places,
          transportEngine: env.googleMapsApiKey
            ? "directions+haversine"
            : "haversine",
        },
        origin,
      );
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/compare-transport")) {
      const body = await readBody(req);
      let from = body?.from;
      let to = body?.to;
      const places = Array.isArray(body?.places) ? body.places : null;
      const placeId = body?.placeId;

      if ((!from || !to) && places && placeId) {
        const sorted = [...places].sort(
          (a, b) =>
            (Number(a.dayIndex) || 0) - (Number(b.dayIndex) || 0) ||
            (Number(a.order) || 0) - (Number(b.order) || 0),
        );
        const idx = sorted.findIndex((p) => p.id === placeId);
        if (idx > 0) {
          const cur = sorted[idx];
          const sameDayPrev = [...sorted]
            .slice(0, idx)
            .reverse()
            .find((p) => Number(p.dayIndex) === Number(cur.dayIndex));
          from = sameDayPrev;
          to = cur;
        }
      }

      if (
        !from ||
        !to ||
        !Number.isFinite(Number(from.lat)) ||
        !Number.isFinite(Number(to.lat))
      ) {
        send(
          res,
          400,
          {
            error:
              "from/to 좌표 또는 places+placeId(직전 구간)가 필요합니다.",
          },
          origin,
        );
        return;
      }

      const result = await compareLegTransport(from, to, env.googleMapsApiKey);
      send(
        res,
        200,
        {
          options: result.options,
          engine: result.engine,
          from: {
            lat: Number(from.lat),
            lng: Number(from.lng),
            name: from.name,
          },
          to: { lat: Number(to.lat), lng: Number(to.lng), name: to.name },
          googleMapsConfigured: Boolean(env.googleMapsApiKey),
        },
        origin,
      );
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/suggest-places")) {
      const body = await readBody(req);
      const result = await suggestPlacesByCategory({
        cityId: body?.cityId === "osaka" ? "osaka" : "tokyo",
        category: body?.category,
        partySize: Number(body?.partySize) || 2,
        mapsApiKey: env.googleMapsApiKey,
      });
      send(
        res,
        200,
        {
          places: result.places,
          source: result.source,
          googleMapsConfigured: Boolean(env.googleMapsApiKey),
        },
        origin,
      );
      return;
    }

    if (method === "POST" && matchRoute(url, "/trip/optimize-day")) {
      const body = await readBody(req);
      const result = await optimizeDayRoute(body, env);
      send(res, 200, result, origin);
      return;
    }

    if (method === "POST" && matchRoute(url, "/wordpress/publish")) {
      const body = await readBody(req);
      let payload = body;
      if (body?.trip && !body?.title) {
        const draft = buildExportDraft(body.trip);
        payload = {
          title: draft.title,
          content: draft.body,
          excerpt: draft.excerpt,
          tags: draft.tags,
          status: body.status === "publish" ? "publish" : "draft",
          seo: { metaDescription: draft.excerpt },
          siteUrl: body.siteUrl,
          username: body.username,
          appPassword: body.appPassword,
        };
      }
      try {
        const result = await publishToWordPress(payload, env);
        send(res, 200, result, origin);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status =
          /credentials missing|required/i.test(message) ? 400 : 502;
        const hint = /credentials missing/i.test(message)
          ? wpMissingHint()
          : "WordPress REST 응답 오류. Application Password·사이트 URL·권한을 확인하세요. (9ruDocs와 동일 패턴)";
        send(
          res,
          status,
          {
            error: message,
            hint,
            configured: Boolean(
              env.wpSiteUrl && env.wpUsername && env.wpAppPassword,
            ),
          },
          origin,
        );
      }
      return;
    }

    send(res, 404, { error: "Not found" }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api]", message);
    send(res, 500, { error: message }, origin);
  }
}

http.createServer(handle).listen(env.port, () => {
  console.log(`9ruTrip API http://localhost:${env.port}`);
  console.log(`Gemini configured: ${Boolean(env.geminiApiKey)}`);
  console.log(
    `WordPress configured: ${Boolean(
      env.wpSiteUrl && env.wpUsername && env.wpAppPassword,
    )}`,
  );
  console.log(`Google Maps Directions: ${Boolean(env.googleMapsApiKey)}`);
  console.log(`Naver Maps scaffold: ${Boolean(env.naverMapClientId)}`);
  console.log(`MVP cities: Tokyo (+ Osaka optional)`);
});
