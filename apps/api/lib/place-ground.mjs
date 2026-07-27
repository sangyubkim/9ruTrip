import { haversineKm } from "./transport.mjs";
import { isKnownCityId, resolveCity } from "./cities.mjs";

const GOOGLE_TIMEOUT_MS = 8_000;
const MAX_CITY_DISTANCE_KM = 80;

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）[\]【】·・\-_/.,'"“”‘’]/g, "");
}

/** 0~1 이름 유사도 (포함·접두 중심) */
export function placeNameSimilarity(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return Math.max(0.55, shorter / longer);
  }
  let shared = 0;
  const window = Math.min(4, left.length, right.length);
  for (let i = 0; i <= left.length - window; i += 1) {
    if (right.includes(left.slice(i, i + window))) shared += 1;
  }
  return shared ? Math.min(0.7, shared / 8) : 0;
}

function isChainDepartureHotel(place) {
  if (!place || place.category !== "hotel") return false;
  const notes = String(place.notes || "");
  return /전날|연결\s*출발|출발$/.test(notes) && !(Number(place.estimatedCost) > 0);
}

function poolList(tourPool, category) {
  if (!tourPool) return [];
  if (category === "hotel") return tourPool.hotel || [];
  if (category === "food") return tourPool.food || [];
  if (category === "attraction") return tourPool.attraction || [];
  return [];
}

function findTourMatch(place, tourPool, usedIds) {
  const cityId = isKnownCityId(place.cityId) ? place.cityId : null;
  const candidates = poolList(tourPool, place.category).filter((item) => {
    if (usedIds.has(item.id)) return false;
    if (cityId && item.cityId && item.cityId !== cityId) return false;
    return true;
  });
  let best = null;
  let bestScore = 0;
  for (const item of candidates) {
    const score = placeNameSimilarity(place.name, item.name);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (best && bestScore >= 0.55) return { item: best, score: bestScore };
  return null;
}

function takeUnusedTourPlace(place, tourPool, usedIds) {
  const cityId = isKnownCityId(place.cityId) ? place.cityId : null;
  const candidates = poolList(tourPool, place.category).filter((item) => {
    if (usedIds.has(item.id)) return false;
    if (cityId && item.cityId && item.cityId !== cityId) return false;
    return true;
  });
  return candidates[0] || null;
}

async function googleVerifyPlace(place, mapsApiKey) {
  if (!mapsApiKey || !place?.name) return null;
  const city = isKnownCityId(place.cityId)
    ? resolveCity(place.cityId)
    : resolveCity("seoul");
  const type =
    place.category === "food"
      ? "restaurant"
      : place.category === "hotel"
        ? "lodging"
        : place.category === "attraction"
          ? "tourist_attraction"
          : undefined;
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", `${place.name} ${city.nameKo}`);
  url.searchParams.set("location", `${city.center.lat},${city.center.lng}`);
  url.searchParams.set("radius", "50000");
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", "kr");
  url.searchParams.set("key", mapsApiKey);
  if (type) url.searchParams.set("type", type);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== "OK") return null;
    const results = Array.isArray(data.results) ? data.results : [];
    let best = null;
    let bestScore = 0;
    for (const result of results.slice(0, 5)) {
      const lat = Number(result.geometry?.location?.lat);
      const lng = Number(result.geometry?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const distanceKm = haversineKm(city.center, { lat, lng });
      if (distanceKm > MAX_CITY_DISTANCE_KM) continue;
      const score = placeNameSimilarity(place.name, result.name);
      if (score > bestScore) {
        best = {
          name: String(result.name || place.name).slice(0, 80),
          lat,
          lng,
          placeId: result.place_id || undefined,
          address: String(
            result.formatted_address || result.vicinity || "",
          ).slice(0, 120),
          score,
          distanceKm,
        };
        bestScore = score;
      }
    }
    // 상호가 너무 다르면 실존으로 인정하지 않음 (환각 상호 차단)
    if (!best || best.score < 0.45) return null;
    return best;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function copyDetailFields(target, source) {
  const keys = [
    "address",
    "phone",
    "openingHours",
    "restDate",
    "officialMenu",
    "signatureFood",
    "admissionFee",
    "checkInTime",
    "checkOutTime",
    "reservationUrl",
    "reservationInfo",
    "contentId",
  ];
  for (const key of keys) {
    if (source?.[key] != null && source[key] !== "") {
      target[key] = source[key];
    }
  }
  return target;
}

function applyTourItem(place, item) {
  const next = {
    ...place,
    id: item.id || place.id,
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    cityId: item.cityId || place.cityId,
    notes: place.notes || item.notes || item.address,
    grounded: "tourapi",
  };
  copyDetailFields(next, item);
  if (!next.address && item.address) next.address = item.address;
  // TourAPI 숙소는 공식 요금 없음 — Gemini 등이 넣은 가짜 1박가 제거
  if (place.category === "hotel") {
    next.estimatedCost = 0;
    delete next.pricePerPerson;
  }
  return next;
}

function applyGoogleHit(place, hit) {
  const next = {
    ...place,
    name: hit.name,
    lat: hit.lat,
    lng: hit.lng,
    notes: place.notes || hit.address,
    googlePlaceId: hit.placeId,
    grounded: "places",
  };
  if (hit.address) next.address = place.address || hit.address;
  return next;
}

/**
 * 국내 일정 장소를 실존 POI로 고정.
 * TourAPI 목록 매칭 → Google Places 검증 → 미검증 시 TourAPI 대체.
 * 대체 후보도 없으면 해당 슬롯 제거.
 */
export async function groundDomesticPlaces(
  places,
  {
    tourPool = { attraction: [], food: [], hotel: [] },
    mapsApiKey = "",
    partySize = 2,
  } = {},
) {
  if (!Array.isArray(places) || places.length === 0) return [];
  const usedTourIds = new Set();
  const grounded = [];

  for (const place of places) {
    if (!place?.name) continue;
    if (isChainDepartureHotel(place)) {
      grounded.push(place);
      continue;
    }

    if (String(place.id || "").startsWith("tour-")) {
      const inPool = [
        ...(tourPool.attraction || []),
        ...(tourPool.food || []),
        ...(tourPool.hotel || []),
      ].find((item) => item.id === place.id);
      if (inPool) {
        usedTourIds.add(inPool.id);
        grounded.push(applyTourItem(place, inPool));
        continue;
      }
    }

    const tourHit = findTourMatch(place, tourPool, usedTourIds);
    if (tourHit) {
      usedTourIds.add(tourHit.item.id);
      grounded.push(applyTourItem(place, tourHit.item));
      continue;
    }

    const googleHit = await googleVerifyPlace(place, mapsApiKey);
    if (googleHit) {
      grounded.push(applyGoogleHit(place, googleHit));
      continue;
    }

    const replacement = takeUnusedTourPlace(place, tourPool, usedTourIds);
    if (replacement) {
      usedTourIds.add(replacement.id);
      const next = applyTourItem(place, replacement);
      next.notes = next.notes
        ? `${next.notes} · 실존 장소로 교체`
        : "실존 관광정보로 교체";
      if (place.category === "food" && !(Number(next.estimatedCost) > 0)) {
        next.estimatedCost = partySize > 0 ? 15000 : 15000;
      }
      grounded.push(next);
      continue;
    }

    console.warn(
      `[place-ground] dropped unverified place: ${place.name} (${place.category})`,
    );
  }

  return grounded.map((place, index) => ({ ...place, order: index }));
}
