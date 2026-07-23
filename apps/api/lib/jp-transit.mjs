/**
 * 일본 대중교통 파트너 어댑터.
 * Google Directions는 JP transit 미지원 → NAVITIME(선택) 또는 추정+외부 앱 deep link.
 *
 * 계약/키 없으면 fake NAVITIME 응답을 만들지 않고 stub → deeplink 폴백.
 */

export const JP_TRANSIT_NOTE_KO =
  "일본 대중교통은 Google Directions API 미지원입니다. 파트너 API 키가 없으면 추정 시간·요금이며, 정확한 환승은 Yahoo/Google 앱에서 확인하세요.";

/**
 * @param {{ lat: number, lng: number, name?: string }} point
 * @param {string} fallbackLabel
 */
function pointLabel(point, fallbackLabel) {
  const name = String(point?.name || "").trim();
  if (name) return name;
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }
  return fallbackLabel;
}

/**
 * Yahoo!乗換案内 / Yahoo!地図 공식 URL 스펙 기반 (lat/lng).
 * @see https://map.yahoo.co.jp/blog/archives/20220218_map_urlspec.html
 */
export function buildYahooTransitDeepLink(from, to) {
  if (!from || !to) return "";
  const fromLat = Number(from.lat);
  const fromLon = Number(from.lng);
  const toLat = Number(to.lat);
  const toLon = Number(to.lng);
  if (
    ![fromLat, fromLon, toLat, toLon].every((n) => Number.isFinite(n))
  ) {
    return "";
  }
  const url = new URL("https://map.yahoo.co.jp/route/train");
  url.searchParams.set("from", pointLabel(from, "出発"));
  url.searchParams.set("to", pointLabel(to, "到着"));
  url.searchParams.set("fromLat", String(fromLat));
  url.searchParams.set("fromLon", String(fromLon));
  url.searchParams.set("toLat", String(toLat));
  url.searchParams.set("toLon", String(toLon));
  return url.toString();
}

/**
 * Yahoo!乗換案内 (transit.yahoo.co.jp) — 좌표를 flatlon/tlatlon에 실음.
 * flatlon 형식: lon,lat,degree (관례)
 */
export function buildYahooTransitSearchDeepLink(from, to) {
  if (!from || !to) return "";
  const fromLat = Number(from.lat);
  const fromLon = Number(from.lng);
  const toLat = Number(to.lat);
  const toLon = Number(to.lng);
  if (
    ![fromLat, fromLon, toLat, toLon].every((n) => Number.isFinite(n))
  ) {
    return "";
  }
  const now = new Date();
  const url = new URL("https://transit.yahoo.co.jp/search/result");
  url.searchParams.set("from", pointLabel(from, "出発"));
  url.searchParams.set("to", pointLabel(to, "到着"));
  url.searchParams.set(
    "flatlon",
    `${fromLon},${fromLat},degree`,
  );
  url.searchParams.set("tlatlon", `${toLon},${toLat},degree`);
  url.searchParams.set("y", String(now.getFullYear()));
  url.searchParams.set("m", String(now.getMonth() + 1).padStart(2, "0"));
  url.searchParams.set("d", String(now.getDate()).padStart(2, "0"));
  url.searchParams.set("hh", String(now.getHours()).padStart(2, "0"));
  const mm = String(now.getMinutes()).padStart(2, "0");
  url.searchParams.set("m1", mm[0]);
  url.searchParams.set("m2", mm[1]);
  url.searchParams.set("type", "1");
  url.searchParams.set("ticket", "ic");
  url.searchParams.set("expkind", "1");
  url.searchParams.set("ws", "3");
  url.searchParams.set("s", "0");
  url.searchParams.set("al", "1");
  url.searchParams.set("shin", "1");
  url.searchParams.set("ex", "1");
  url.searchParams.set("hb", "1");
  url.searchParams.set("lb", "1");
  url.searchParams.set("sr", "1");
  return url.toString();
}

/** Google Maps Directions — travelmode=transit (앱에서는 JP 환승 가능, Directions API와 별개) */
export function buildGoogleTransitDeepLink(from, to) {
  if (!to) return "";
  const toLat = Number(to.lat);
  const toLng = Number(to.lng);
  if (!Number.isFinite(toLat) || !Number.isFinite(toLng)) return "";
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${toLat},${toLng}`);
  url.searchParams.set("travelmode", "transit");
  if (from && Number.isFinite(Number(from.lat)) && Number.isFinite(Number(from.lng))) {
    url.searchParams.set("origin", `${Number(from.lat)},${Number(from.lng)}`);
  }
  return url.toString();
}

export function buildTransitDeepLinks(from, to) {
  return {
    google: buildGoogleTransitDeepLink(from, to),
    yahoo: buildYahooTransitDeepLink(from, to),
    yahooSearch: buildYahooTransitSearchDeepLink(from, to),
  };
}

/**
 * NAVITIME route_transit 호출 시도.
 * HOST/CID는 계약별로 달라 키가 있어도 HOST 없으면 { ok:false }로 폴백.
 *
 * Env:
 * - JP_TRANSIT_PROVIDER=navitime
 * - NAVITIME_API_KEY
 * - NAVITIME_API_HOST (예: api.navitime.co.jp 또는 RapidAPI 호스트)
 * - NAVITIME_CID (직접 계약 시 CID 경로)
 * - NAVITIME_RAPIDAPI_HOST (RapidAPI 사용 시 Host 헤더, 기본=API_HOST)
 *
 * @returns {Promise<{ ok: true, result: object } | { ok: false, reason: string }>}
 */
export async function tryNavitimeTransit(from, to, opts = {}) {
  const env = opts.env || process.env;
  const provider = String(
    opts.provider ?? env.JP_TRANSIT_PROVIDER ?? "",
  )
    .trim()
    .toLowerCase();
  if (provider !== "navitime") {
    return { ok: false, reason: "provider_not_navitime" };
  }

  const apiKey = String(
    opts.apiKey ?? env.NAVITIME_API_KEY ?? "",
  ).trim();
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const host = String(opts.host ?? env.NAVITIME_API_HOST ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
  if (!host) {
    // REST는 문서화되어 있으나 HOST/CID는 계약 전용 — 가짜 응답 금지
    return { ok: false, reason: "missing_host_or_cid" };
  }

  if (!from || !to) {
    return { ok: false, reason: "missing_coordinates" };
  }
  const startLat = Number(from.lat);
  const startLng = Number(from.lng);
  const goalLat = Number(to.lat);
  const goalLng = Number(to.lng);
  if (
    ![startLat, startLng, goalLat, goalLng].every((n) => Number.isFinite(n))
  ) {
    return { ok: false, reason: "invalid_coordinates" };
  }

  const cid = String(opts.cid ?? env.NAVITIME_CID ?? "").trim();
  const basePath = cid
    ? `https://${host}/${cid}/v1/route_transit`
    : `https://${host}/route_transit`;

  const startTime = new Date();
  // NAVITIME: YYYY-MM-DDThh:mm:ss (로컬 벽시계 근사)
  const pad = (n) => String(n).padStart(2, "0");
  const startTimeStr = `${startTime.getFullYear()}-${pad(startTime.getMonth() + 1)}-${pad(startTime.getDate())}T${pad(startTime.getHours())}:${pad(startTime.getMinutes())}:00`;

  const url = new URL(basePath);
  url.searchParams.set("start", `${startLat},${startLng}`);
  url.searchParams.set("goal", `${goalLat},${goalLng}`);
  url.searchParams.set("start_time", startTimeStr);
  url.searchParams.set("datum", "wgs84");
  url.searchParams.set("coord_unit", "degree");
  url.searchParams.set("limit", "1");
  url.searchParams.set("order", "time_optimized");

  const headers = {
    Accept: "application/json",
  };
  const isRapid =
    /rapidapi/i.test(host) ||
    Boolean(String(env.NAVITIME_RAPIDAPI_HOST || "").trim());
  if (isRapid) {
    headers["x-rapidapi-key"] = apiKey;
    headers["x-rapidapi-host"] = String(
      env.NAVITIME_RAPIDAPI_HOST || host,
    ).trim();
  } else {
    // 직접 계약: 키 전달 방식은 계약별로 다를 수 있음 — 일반적 헤더 시도
    headers["X-API-Key"] = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      return {
        ok: false,
        reason: `http_${res.status}`,
      };
    }
    let data;
    try {
      data = await res.json();
    } catch {
      return { ok: false, reason: "invalid_json" };
    }

    const parsed = parseNavitimeRoute(data);
    if (!parsed) {
      return { ok: false, reason: "unexpected_response_shape" };
    }
    return { ok: true, result: parsed };
  } catch (e) {
    return {
      ok: false,
      reason: `network_${e instanceof Error ? e.message : "error"}`,
    };
  }
}

/** NAVITIME items[0].summary.move.time (분) / reference_fare 파싱 — 형태 불명이면 null */
export function parseNavitimeRoute(data) {
  const item = data?.items?.[0] ?? data?.item?.[0] ?? null;
  if (!item) return null;
  const move =
    item.summary?.move ||
    item.summary?.find?.((s) => s?.type === "move") ||
    null;
  if (!move) return null;

  const minutesRaw = Number(move.time);
  if (!Number.isFinite(minutesRaw) || minutesRaw < 0) return null;
  const minutes = Math.max(3, Math.round(minutesRaw));

  let estimatedCost = 0;
  const ref = move.reference_fare || move.fare;
  if (ref) {
    const ic = Number(ref.lowest_total_ic ?? ref.unit_48 ?? ref.ic);
    const ticket = Number(
      ref.lowest_total_ticket ?? ref.unit_0 ?? ref.ticket,
    );
    if (Number.isFinite(ic) && ic > 0) estimatedCost = Math.round(ic);
    else if (Number.isFinite(ticket) && ticket > 0) {
      estimatedCost = Math.round(ticket);
    }
  }

  return {
    mode: "transit",
    minutes,
    estimatedCost: Math.max(0, estimatedCost),
    engine: "partner:navitime",
  };
}

/**
 * 대중교통 구간 추정 (폴백 체인).
 * 1) JP_TRANSIT_PROVIDER=navitime + 키(+HOST) → NAVITIME
 * 2) 하버사인 추정 + Yahoo/Google deep link
 *
 * @param {object} from
 * @param {object} to
 * @param {{ apiKey?: string, baseEstimate?: object, env?: NodeJS.ProcessEnv }} [opts]
 */
export async function estimateTransitLeg(from, to, opts = {}) {
  const deepLinks = buildTransitDeepLinks(from, to);
  const deepLink = deepLinks.yahoo || deepLinks.google || "";

  const partner = await tryNavitimeTransit(from, to, {
    apiKey: opts.apiKey,
    env: opts.env,
  });
  if (partner.ok && partner.result) {
    return {
      ...partner.result,
      deepLink,
      deepLinks: {
        google: deepLinks.google,
        yahoo: deepLinks.yahoo,
      },
      note: "NAVITIME 파트너 API 실측. 상세 환승은 앱 deep link로 확인하세요.",
    };
  }

  // baseEstimate는 transport.compareLegTransport가 넘김 (순환 import 방지)
  const base =
    opts.baseEstimate && opts.baseEstimate.mode === "transit"
      ? opts.baseEstimate
      : {
          mode: "transit",
          minutes: 0,
          estimatedCost: 0,
          engine: "haversine:transit",
        };

  return {
    mode: "transit",
    minutes: Number(base.minutes) || 0,
    estimatedCost: Math.max(0, Number(base.estimatedCost) || 0),
    engine: String(base.engine || "haversine:transit"),
    deepLink,
    deepLinks: {
      google: deepLinks.google,
      yahoo: deepLinks.yahoo,
    },
    note: JP_TRANSIT_NOTE_KO,
    partnerFallbackReason: partner.reason,
  };
}
