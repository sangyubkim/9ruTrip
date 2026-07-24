import { resolveCity, isKnownCityId } from "./cities.mjs";

/**
 * 세부 지명·주소 검색 (Google Places Text Search).
 * 키 없으면 destinations 도시명 로컬 매칭 폴백.
 */
export async function searchPlaces(body, env) {
  const query = String(body?.query || "").trim();
  if (query.length < 2) {
    return { results: [], source: "empty" };
  }

  const biasCityId = isKnownCityId(body?.cityId) ? body.cityId : null;
  const bias = biasCityId ? resolveCity(biasCityId) : null;
  const apiKey = env.googleMapsApiKey || "";

  if (apiKey) {
    try {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
      );
      url.searchParams.set("query", query);
      url.searchParams.set("language", "ko");
      if (bias) {
        url.searchParams.set(
          "location",
          `${bias.center.lat},${bias.center.lng}`,
        );
        url.searchParams.set("radius", "50000");
      }
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" || data.status === "ZERO_RESULTS") {
          const results = (data.results || []).slice(0, 8).map((r) => ({
            placeId: r.place_id || undefined,
            name: r.name || query,
            address: r.formatted_address || r.vicinity || "",
            lat: r.geometry?.location?.lat,
            lng: r.geometry?.location?.lng,
          }));
          return { results, source: "places" };
        }
      }
    } catch {
      /* local fallback */
    }
  }

  // 로컬 폴백: 카탈로그 도시명 매칭 + 자유 텍스트 1건
  const { CITIES } = await import("./cities.mjs");
  const q = query.toLowerCase();
  const matched = Object.values(CITIES)
    .filter(
      (c) =>
        c.nameKo.includes(query) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.id.includes(q),
    )
    .slice(0, 6)
    .map((c) => ({
      placeId: undefined,
      name: c.nameKo,
      address: `${c.nameEn} · 도시 중심`,
      lat: c.center.lat,
      lng: c.center.lng,
      cityId: c.id,
    }));

  if (matched.length === 0) {
    matched.push({
      placeId: undefined,
      name: query,
      address: "직접 입력 (좌표 미확정 — AI가 해석)",
      lat: bias?.center.lat,
      lng: bias?.center.lng,
    });
  }

  return { results: matched, source: apiKey ? "fallback" : "local" };
}
