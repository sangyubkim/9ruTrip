import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readBody, matchRoute } from "./lib/http-util.mjs";
import { generateItinerary } from "./lib/itinerary.mjs";
import { buildExportDraft } from "./lib/export-draft.mjs";

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
  wpSiteUrl: process.env.WP_SITE_URL?.trim() ?? "",
  wpUsername: process.env.WP_USERNAME?.trim() ?? "",
  wpAppPassword: process.env.WP_APP_PASSWORD?.trim() ?? "",
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
  const allow =
    allowAll ||
    !origin ||
    env.corsOrigins.includes(origin);
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
          geminiConfigured: Boolean(env.geminiApiKey),
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
            "POST /trip/export-draft",
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

    if (method === "POST" && matchRoute(url, "/trip/export-draft")) {
      const body = await readBody(req);
      const draft = buildExportDraft(body?.trip ?? body);
      send(
        res,
        200,
        {
          draft,
          next: {
            docsApi: "9ruDocs apps/api POST /blog/generate 또는 WordPress publish",
            note: "draft.steps / draft.body 는 @9rudocs/shared BlogDraft 와 호환",
          },
        },
        origin,
      );
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
  console.log(`MVP city: Tokyo`);
});
