/** 하버사인 거리(km) */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 도쿄 기준 간이 교통 추정 (지하철/도보 혼합) — 키 없을 때 폴백
 */
export function estimateLegHaversine(from, to) {
  if (!from || !to) {
    return {
      travelFromPrevMinutes: 0,
      travelFromPrevCost: 0,
      transportEngine: "none",
    };
  }
  const km = haversineKm(
    { lat: Number(from.lat), lng: Number(from.lng) },
    { lat: Number(to.lat), lng: Number(to.lng) },
  );
  if (!Number.isFinite(km) || km < 0.05) {
    return {
      travelFromPrevMinutes: 3,
      travelFromPrevCost: 0,
      transportEngine: "haversine",
    };
  }
  const minutes =
    km < 1.2 ? Math.round(5 + km * 12) : Math.round(10 + km * 3.5 + 6);
  const cost = km < 0.9 ? 0 : Math.round(170 + Math.min(km, 25) * 18);
  return {
    travelFromPrevMinutes: Math.max(3, minutes),
    travelFromPrevCost: Math.max(0, cost),
    transportEngine: "haversine",
  };
}

/** @deprecated use estimateLegHaversine */
export function estimateLeg(from, to) {
  return estimateLegHaversine(from, to);
}

/**
 * Google Directions API (transit 우선, 실패 시 walking → haversine)
 * https://developers.google.com/maps/documentation/directions
 */
export async function estimateLegDirections(from, to, apiKey) {
  if (!apiKey || !from || !to) return estimateLegHaversine(from, to);

  const origin = `${Number(from.lat)},${Number(from.lng)}`;
  const destination = `${Number(to.lat)},${Number(to.lng)}`;

  for (const mode of ["transit", "walking"]) {
    try {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/directions/json",
      );
      url.searchParams.set("origin", origin);
      url.searchParams.set("destination", destination);
      url.searchParams.set("mode", mode);
      url.searchParams.set("language", "ko");
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== "OK" || !data.routes?.[0]?.legs?.[0]) continue;

      const leg = data.routes[0].legs[0];
      const seconds = Number(leg.duration?.value) || 0;
      const meters = Number(leg.distance?.value) || 0;
      const minutes = Math.max(3, Math.round(seconds / 60));

      // fare는 transit에서만 가끔 제공 — 없으면 거리 기반 추정
      let cost = 0;
      if (leg.fare?.value != null && Number.isFinite(Number(leg.fare.value))) {
        cost = Math.round(Number(leg.fare.value));
      } else if (mode === "transit" && meters > 900) {
        cost = Math.round(170 + Math.min(meters / 1000, 25) * 18);
      }

      return {
        travelFromPrevMinutes: minutes,
        travelFromPrevCost: Math.max(0, cost),
        transportEngine: `directions:${mode}`,
      };
    } catch {
      // try next mode
    }
  }

  return estimateLegHaversine(from, to);
}

export async function estimateLegSmart(from, to, apiKey) {
  if (apiKey) return estimateLegDirections(from, to, apiKey);
  return estimateLegHaversine(from, to);
}

/** 숙소 점수 분해 (centrality / price / rating proxy) */
export function lodgingScoreBreakdown(place, { nights = 2 } = {}) {
  const hubs = [
    { name: "shinjuku", lat: 35.6938, lng: 139.7034, w: 1 },
    { name: "tokyo", lat: 35.6812, lng: 139.7671, w: 0.95 },
    { name: "shibuya", lat: 35.6595, lng: 139.7005, w: 0.92 },
    { name: "ueno", lat: 35.7138, lng: 139.777, w: 0.85 },
  ];

  let centrality = 40;
  for (const h of hubs) {
    const km = haversineKm(
      { lat: Number(place.lat), lng: Number(place.lng) },
      h,
    );
    const score = Math.round(
      Math.max(35, Math.min(98, (1 - Math.min(km, 8) / 8) * 100 * h.w)),
    );
    if (score > centrality) centrality = score;
  }

  const perNight =
    nights > 0
      ? Math.max(1, Number(place.estimatedCost) || 18000) / nights
      : Number(place.estimatedCost) || 18000;
  // 저렴할수록 높은 점수 (¥8k~¥35k/night 기준)
  const priceEstimate = Math.round(
    Math.max(
      20,
      Math.min(95, 95 - ((Math.min(Math.max(perNight, 8000), 35000) - 8000) / 27000) * 75),
    ),
  );

  // 허브 근접 + 노트 키워드로 간이 평점 프록시
  const notes = String(place.notes || place.name || "").toLowerCase();
  let ratingProxy = 70 + Math.round((centrality - 50) * 0.25);
  if (/추천|허브|역앞|편리/.test(notes)) ratingProxy += 8;
  if (/조용|저렴/.test(notes)) ratingProxy += 3;
  ratingProxy = Math.max(40, Math.min(98, ratingProxy));

  const lodgingScore = Math.round(
    centrality * 0.5 + priceEstimate * 0.25 + ratingProxy * 0.25,
  );

  return {
    lodgingScore: Math.max(1, Math.min(100, lodgingScore)),
    scoreBreakdown: {
      centrality,
      priceEstimate,
      ratingProxy,
    },
  };
}

/** 숙소 추천 점수 (도쿄 교통 허브 근접도 중심, 1–100) */
export function lodgingRecommendScore(place) {
  return lodgingScoreBreakdown(place).lodgingScore;
}

/** 도쿄 숙소 후보 Top N */
export function buildLodgingCandidates({ nights = 2, partySize = 2, topN = 5 } = {}) {
  const catalog = [
    {
      name: "신주쿠 호텔 (추천 구역)",
      lat: 35.6938,
      lng: 139.7034,
      basePerNight: 18000,
      notes: "교통 허브 · 추천",
    },
    {
      name: "시부야 스트림 인근 호텔",
      lat: 35.6581,
      lng: 139.7017,
      basePerNight: 22000,
      notes: "쇼핑·야경 편리",
    },
    {
      name: "도쿄역 야에스 호텔",
      lat: 35.6812,
      lng: 139.7671,
      basePerNight: 24000,
      notes: "JR·신칸센 접근",
    },
    {
      name: "우에노 스테이 인",
      lat: 35.7126,
      lng: 139.7765,
      basePerNight: 14000,
      notes: "저렴 · 공원 인근",
    },
    {
      name: "아사쿠사 료칸풍 호텔",
      lat: 35.7145,
      lng: 139.7945,
      basePerNight: 16000,
      notes: "전통 분위기",
    },
    {
      name: "이케부쿠로 비즈니스 호텔",
      lat: 35.7295,
      lng: 139.7109,
      basePerNight: 12000,
      notes: "저렴 · 조용",
    },
  ];

  const partyFactor = 1 + Math.max(0, partySize - 2) * 0.15;
  const scored = catalog.map((c, i) => {
    const estimatedCost = Math.round(c.basePerNight * nights * partyFactor);
    const place = {
      id: `lodging-cand-${i + 1}`,
      name: c.name,
      category: "hotel",
      lat: c.lat,
      lng: c.lng,
      estimatedCost,
      notes: `${nights}박 · ${c.notes}`,
      dayIndex: 0,
      order: 0,
    };
    const { lodgingScore, scoreBreakdown } = lodgingScoreBreakdown(place, {
      nights,
    });
    return { ...place, lodgingScore, scoreBreakdown };
  });

  scored.sort((a, b) => b.lodgingScore - a.lodgingScore);
  return scored.slice(0, topN);
}

/**
 * day별 순서대로 travelFromPrev* / plannedTime / lodgingScore 보강
 * forceRecalc=true 이면 기존 travelFromPrev* 덮어씀 (DnD 후 재계산)
 */
export async function enrichPlacesWithTransport(
  places,
  { startHour = 9, forceRecalc = false, mapsApiKey = "" } = {},
) {
  if (!Array.isArray(places) || places.length === 0) return [];

  const byDay = new Map();
  for (const p of places) {
    const d = Number(p.dayIndex) || 0;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(p);
  }

  const out = [];
  for (const [, dayList] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    dayList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let minutesFromStart = startHour * 60;
    let prev = null;
    for (let i = 0; i < dayList.length; i++) {
      const p = { ...dayList[i] };
      if (prev) {
        const needRecalc =
          forceRecalc ||
          !(Number(p.travelFromPrevMinutes) > 0) ||
          !Number.isFinite(Number(p.travelFromPrevCost));
        if (needRecalc) {
          const leg = await estimateLegSmart(prev, p, mapsApiKey);
          p.travelFromPrevMinutes = leg.travelFromPrevMinutes;
          p.travelFromPrevCost = leg.travelFromPrevCost;
          p.transportEngine = leg.transportEngine;
        }
        minutesFromStart += Number(p.travelFromPrevMinutes) || 0;
      } else {
        p.travelFromPrevMinutes = 0;
        p.travelFromPrevCost = 0;
        p.transportEngine = "none";
      }

      if (
        forceRecalc ||
        !p.plannedTime ||
        !/^\d{1,2}:\d{2}$/.test(String(p.plannedTime))
      ) {
        const hh = Math.floor(minutesFromStart / 60) % 24;
        const mm = minutesFromStart % 60;
        p.plannedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      } else {
        const [h, m] = String(p.plannedTime).split(":").map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
          minutesFromStart = h * 60 + m;
        }
      }

      minutesFromStart +=
        p.category === "food" ? 60 : p.category === "hotel" ? 15 : 75;

      if (p.category === "hotel") {
        const bd = lodgingScoreBreakdown(p);
        if (forceRecalc || !(Number(p.lodgingScore) > 0)) {
          p.lodgingScore = bd.lodgingScore;
        }
        if (!p.scoreBreakdown) p.scoreBreakdown = bd.scoreBreakdown;
      }

      out.push(p);
      prev = p;
    }
  }

  out.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  out.forEach((p, i) => {
    p.order = i;
  });
  return out;
}
