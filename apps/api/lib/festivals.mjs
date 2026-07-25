import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import { isKnownCityId, resolveCity } from "./cities.mjs";

const FESTIVAL_CATALOG = [
  { id: "boryeong-mud", name: "보령머드축제", cityId: "boryeong", startMonth: 7, endMonth: 8, lat: 36.305, lng: 126.516 },
  { id: "jinju-lantern", name: "진주남강유등축제", cityId: "jinju", startMonth: 10, endMonth: 10, lat: 35.184, lng: 128.081 },
  { id: "busan-fireworks", name: "부산불꽃축제", cityId: "busan", startMonth: 11, endMonth: 11, lat: 35.153, lng: 129.119 },
  { id: "gimje-horizon", name: "김제지평선축제", cityId: "gimje", startMonth: 10, endMonth: 10, lat: 35.802, lng: 126.88 },
  { id: "andong-mask", name: "안동국제탈춤페스티벌", cityId: "andong", startMonth: 9, endMonth: 10, lat: 36.568, lng: 128.729 },
  { id: "jeonju-bibimbap", name: "전주비빔밥축제", cityId: "jeonju", startMonth: 10, endMonth: 10, lat: 35.815, lng: 127.153 },
  { id: "gwangalli-eobang", name: "광안리어방축제", cityId: "busan", startMonth: 5, endMonth: 5, lat: 35.154, lng: 129.119 },
  { id: "taebaek-snow", name: "태백산눈축제", cityId: "taebaek", startMonth: 1, endMonth: 2, lat: 37.164, lng: 128.985 },
  { id: "yeosu-nightsea", name: "여수밤바다불꽃축제", cityId: "yeosu", startMonth: 10, endMonth: 10, lat: 34.761, lng: 127.665 },
  { id: "seoul-lantern", name: "서울빛초롱축제", cityId: "seoul", startMonth: 12, endMonth: 12, lat: 37.57, lng: 126.978 },
  { id: "jeju-fire", name: "제주들불축제", cityId: "jeju", startMonth: 3, endMonth: 3, lat: 33.429, lng: 126.679 },
  { id: "chuncheon-mime", name: "춘천마임축제", cityId: "chuncheon", startMonth: 5, endMonth: 6, lat: 37.881, lng: 127.73 },
];

function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function monthOverlaps(startDate, endDate, startMonth, endMonth) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return false;
  for (let date = new Date(start); date <= end; date.setUTCMonth(date.getUTCMonth() + 1, 1)) {
    const month = date.getUTCMonth() + 1;
    if (month >= startMonth && month <= endMonth) return true;
  }
  return false;
}

function catalogFestivals({ startDate, endDate, lat, lng, cityId }) {
  const origin =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : isKnownCityId(cityId)
        ? resolveCity(cityId).center
        : null;
  return FESTIVAL_CATALOG.filter((festival) =>
    monthOverlaps(startDate, endDate, festival.startMonth, festival.endMonth),
  ).map((festival) => ({
    ...festival,
    startDate,
    endDate,
    cityName: resolveCity(festival.cityId).nameKo,
    distanceKm: origin ? Math.round(haversineKm(origin, festival)) : undefined,
  }));
}

export async function listFestivals(body, env) {
  const startDate = String(body?.startDate || "");
  const endDate = String(body?.endDate || "");
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const cityId = String(body?.cityId || "");
  const fallback = catalogFestivals({ startDate, endDate, lat, lng, cityId });
  if (!env.geminiApiKey) return { festivals: fallback, source: "catalog" };

  try {
    const { text } = await geminiComplete({
      apiKey: env.geminiApiKey,
      model: env.geminiModel,
      timeoutMs: Math.min(env.llmTimeoutMs, 30_000),
      systemHint: "Return valid JSON only. Never invent uncertain festival dates or locations.",
      prompt: `한국 국내 여행 축제를 기간 기준으로 추천합니다.
여행 기간: ${startDate}~${endDate}
유명하거나 매년 정기 개최되어 일정이 신뢰 가능한 축제만 반환하세요. 정확한 개최일·도시가 불확실하면 제외하세요.
반드시 JSON만 반환: {"festivals":[{"name":"축제명","cityId":"국내 도시 ID","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","lat":number,"lng":number}]}
사용 가능한 도시 ID 예시: ${[...new Set(fallback.map((f) => f.cityId))].join(", ")}.`,
    });
    const items = Array.isArray(parseJsonLoose(text)?.festivals)
      ? parseJsonLoose(text).festivals
      : [];
    const origin =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : isKnownCityId(cityId)
          ? resolveCity(cityId).center
          : null;
    const festivals = items
      .filter(
        (festival) =>
          festival &&
          isKnownCityId(festival.cityId) &&
          resolveCity(festival.cityId).countryId === "kr" &&
          /^\d{4}-\d{2}-\d{2}$/.test(String(festival.startDate)) &&
          /^\d{4}-\d{2}-\d{2}$/.test(String(festival.endDate)),
      )
      .map((festival, index) => ({
        id: `gemini-${festival.cityId}-${index}`,
        name: String(festival.name).slice(0, 80),
        cityId: festival.cityId,
        cityName: resolveCity(festival.cityId).nameKo,
        startDate: festival.startDate,
        endDate: festival.endDate,
        lat: Number(festival.lat) || resolveCity(festival.cityId).center.lat,
        lng: Number(festival.lng) || resolveCity(festival.cityId).center.lng,
        distanceKm: origin
          ? Math.round(
              haversineKm(origin, {
                lat: Number(festival.lat) || resolveCity(festival.cityId).center.lat,
                lng: Number(festival.lng) || resolveCity(festival.cityId).center.lng,
              }),
            )
          : undefined,
      }));
    return { festivals: festivals.length ? festivals : fallback, source: festivals.length ? "gemini" : "catalog" };
  } catch {
    return { festivals: fallback, source: "catalog" };
  }
}
