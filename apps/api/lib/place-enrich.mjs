import { geminiComplete, parseJsonLoose } from "./gemini.mjs";
import { isKnownCityId, resolveCity } from "./cities.mjs";

const CATEGORIES = new Set(["attraction", "food", "transport", "other"]);

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function fallback(body) {
  const city = resolveCity(isKnownCityId(body?.cityId) ? body.cityId : "seoul");
  const lat = finiteNumber(body?.lat);
  const lng = finiteNumber(body?.lng);
  return {
    name: cleanText(body?.name, 120),
    ...(cleanText(body?.address, 240) ? { address: cleanText(body.address, 240) } : {}),
    ...(lat != null ? { lat } : {}),
    ...(lng != null ? { lng } : {}),
    category: "other",
    estimatedCost: 0,
    notes: `${city.nameKo} 일정에 직접 추가한 장소`,
    engine: "fallback",
  };
}

export async function enrichPlace(body, env) {
  const base = fallback(body);
  if (!base.name) throw new Error("장소 이름이 필요합니다.");
  if (!env.geminiApiKey) return base;

  const city = resolveCity(isKnownCityId(body?.cityId) ? body.cityId : "seoul");
  try {
    const { text, engine } = await geminiComplete({
      apiKey: env.geminiApiKey,
      model: env.geminiModel,
      timeoutMs: env.llmTimeoutMs,
      systemHint:
        "Return valid JSON only. Do not invent coordinates or factual claims. " +
        'Use category one of "attraction", "food", "transport", "other".',
      prompt: `여행 일정에 직접 추가할 장소 정보를 한국어로 보강하세요.
도시: ${city.nameKo}
이름: ${base.name}
주소: ${base.address ?? "알 수 없음"}
반환 JSON: {"category":"attraction|food|transport|other","notes":"20~80자 방문 팁 또는 설명","estimatedCost":0 이상의 숫자}.
확실하지 않으면 category는 other, 비용은 0으로 하세요.`,
    });
    const data = parseJsonLoose(text);
    const category = CATEGORIES.has(data?.category) ? data.category : base.category;
    const estimatedCost = Math.max(0, finiteNumber(data?.estimatedCost) ?? 0);
    const notes = cleanText(data?.notes, 160) || base.notes;
    return { ...base, category, estimatedCost, notes, engine };
  } catch {
    return base;
  }
}
