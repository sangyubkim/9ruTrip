import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import { haversineKm } from "./transport.mjs";

/**
 * Nearest-neighbor 휴리스틱: start에서 가장 가까운 미방문 장소를 반복 선택.
 * startIndex 기본 0 (첫 장소 고정 후 나머지 최적화).
 */
export function nearestNeighborOrder(places, startIndex = 0) {
  if (!Array.isArray(places) || places.length <= 1) {
    return Array.isArray(places) ? [...places] : [];
  }
  const n = places.length;
  const start = Math.min(Math.max(0, startIndex), n - 1);
  const remaining = places.map((p, i) => ({ p, i })).filter((x) => x.i !== start);
  const ordered = [places[start]];
  let cur = places[start];

  while (remaining.length) {
    let best = 0;
    let bestKm = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const km = haversineKm(
        { lat: Number(cur.lat), lng: Number(cur.lng) },
        { lat: Number(remaining[i].p.lat), lng: Number(remaining[i].p.lng) },
      );
      if (km < bestKm) {
        bestKm = km;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0].p;
    ordered.push(next);
    cur = next;
  }
  return ordered;
}

export function pathLengthKm(places) {
  let sum = 0;
  for (let i = 1; i < places.length; i++) {
    sum += haversineKm(
      { lat: Number(places[i - 1].lat), lng: Number(places[i - 1].lng) },
      { lat: Number(places[i].lat), lng: Number(places[i].lng) },
    );
  }
  return sum;
}

function cityLabel(cityId) {
  return cityId === "osaka" ? "오사카" : "도쿄";
}

/**
 * POST /trip/optimize-day
 * { places, dayIndex, cityId } → 해당 day 순서 재배치 (Gemini 또는 NN 폴백)
 */
export async function optimizeDayRoute(body, env) {
  const allPlaces = Array.isArray(body?.places) ? body.places : [];
  if (allPlaces.length === 0) {
    throw new Error("places is required");
  }

  const cityId = body?.cityId === "osaka" ? "osaka" : "tokyo";
  const dayIndexes = [
    ...new Set(allPlaces.map((p) => Number(p.dayIndex) || 0)),
  ];
  const maxDay = Math.max(0, ...dayIndexes);
  const dayIndex = Math.min(
    Math.max(0, Number(body?.dayIndex ?? 0)),
    maxDay,
  );

  const dayPlaces = allPlaces
    .filter((p) => Number(p.dayIndex) === dayIndex)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  if (dayPlaces.length <= 1) {
    return {
      places: allPlaces,
      dayIndex,
      before: dayPlaces.map((p) => p.name),
      after: dayPlaces.map((p) => p.name),
      engine: "noop",
      summary: `Day ${dayIndex + 1} 장소가 ${dayPlaces.length}곳이라 최적화할 필요가 없습니다.`,
      pathKmBefore: pathLengthKm(dayPlaces),
      pathKmAfter: pathLengthKm(dayPlaces),
    };
  }

  const beforeNames = dayPlaces.map((p) => p.name);
  const beforeKm = pathLengthKm(dayPlaces);

  // hotel이 있으면 첫 슬롯 고정(숙소 기준 출발)
  const hotelIdx = dayPlaces.findIndex((p) => p.category === "hotel");
  const startIdx = hotelIdx >= 0 ? hotelIdx : 0;

  let ordered = nearestNeighborOrder(dayPlaces, startIdx);
  let engine = "nearest-neighbor";
  let summary = `${cityLabel(cityId)} Day ${dayIndex + 1} 동선을 최근접 휴리스틱으로 재배치했습니다.`;

  if (env?.geminiApiKey) {
    try {
      const prompt = `당신은 ${cityLabel(cityId)} 당일 동선 최적화 플래너입니다.
아래 장소들을 이동 거리·피로도를 고려해 방문 순서를 재배치하세요.
- 첫 장소는 가능하면 숙소(hotel) 또는 기존 첫 장소를 유지
- 점심/저녁 식사(food)는 무리한 왕복 없이 자연스럽게
- 동일 id만 사용, 장소 추가/삭제 금지

입력 (순서=현재):
${JSON.stringify(
  dayPlaces.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
  })),
)}

반드시 JSON만:
{
  "summary": "한국어 한 줄",
  "orderedIds": ["id1", "id2", ...]
}`;

      const { text } = await geminiComplete({
        apiKey: env.geminiApiKey,
        model: env.geminiModel || "gemini-flash-lite-latest",
        prompt,
        systemHint: "Respond with valid JSON only. Korean summary.",
        timeoutMs: env.llmTimeoutMs || 90_000,
      });
      const parsed = parseJsonLoose(text);
      const ids = Array.isArray(parsed?.orderedIds)
        ? parsed.orderedIds.map(String)
        : [];
      const byId = new Map(dayPlaces.map((p) => [String(p.id), p]));
      const rebuilt = [];
      for (const id of ids) {
        const p = byId.get(id);
        if (p && !rebuilt.includes(p)) {
          rebuilt.push(p);
          byId.delete(id);
        }
      }
      for (const p of byId.values()) rebuilt.push(p);
      if (rebuilt.length === dayPlaces.length) {
        ordered = rebuilt;
        engine = "gemini";
        summary =
          typeof parsed?.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : `AI가 Day ${dayIndex + 1} 동선을 재배치했습니다.`;
      }
    } catch {
      // keep nearest-neighbor
    }
  }

  const afterNames = ordered.map((p) => p.name);
  const afterKm = pathLengthKm(ordered);

  const others = allPlaces.filter((p) => Number(p.dayIndex) !== dayIndex);
  const renumberedDay = ordered.map((p, i) => ({
    ...p,
    dayIndex,
    order: i,
  }));
  const merged = [...others, ...renumberedDay].sort(
    (a, b) =>
      (Number(a.dayIndex) || 0) - (Number(b.dayIndex) || 0) ||
      (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  merged.forEach((p, i) => {
    p.order = i;
  });

  return {
    places: merged,
    dayIndex,
    before: beforeNames,
    after: afterNames,
    engine,
    summary,
    pathKmBefore: Math.round(beforeKm * 100) / 100,
    pathKmAfter: Math.round(afterKm * 100) / 100,
  };
}
