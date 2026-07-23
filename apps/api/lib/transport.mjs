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
 * 도쿄 기준 간이 교통 추정 (지하철/도보 혼합)
 * — 실제 경로 API 대신 MVP용 glance 수치
 */
export function estimateLeg(from, to) {
  if (!from || !to) {
    return { travelFromPrevMinutes: 0, travelFromPrevCost: 0 };
  }
  const km = haversineKm(
    { lat: Number(from.lat), lng: Number(from.lng) },
    { lat: Number(to.lat), lng: Number(to.lng) },
  );
  if (!Number.isFinite(km) || km < 0.05) {
    return { travelFromPrevMinutes: 3, travelFromPrevCost: 0 };
  }
  // 도보 위주 단거리 / 그 외 전철+환승 가정
  const minutes =
    km < 1.2
      ? Math.round(5 + km * 12)
      : Math.round(10 + km * 3.5 + 6);
  const cost =
    km < 0.9 ? 0 : Math.round(170 + Math.min(km, 25) * 18);
  return {
    travelFromPrevMinutes: Math.max(3, minutes),
    travelFromPrevCost: Math.max(0, cost),
  };
}

/** 숙소 추천 점수 (도쿄 교통 허브 근접도 중심, 1–100) */
export function lodgingRecommendScore(place) {
  const hubs = [
    { name: "shinjuku", lat: 35.6938, lng: 139.7034, w: 1 },
    { name: "tokyo", lat: 35.6812, lng: 139.7671, w: 0.95 },
    { name: "shibuya", lat: 35.6595, lng: 139.7005, w: 0.92 },
    { name: "ueno", lat: 35.7138, lng: 139.777, w: 0.85 },
  ];
  let best = 40;
  for (const h of hubs) {
    const km = haversineKm(
      { lat: Number(place.lat), lng: Number(place.lng) },
      h,
    );
    const score = Math.round(
      Math.max(35, Math.min(98, (1 - Math.min(km, 8) / 8) * 100 * h.w)),
    );
    if (score > best) best = score;
  }
  return best;
}

/**
 * day별 순서대로 travelFromPrev* / plannedTime / lodgingScore 보강
 */
export function enrichPlacesWithTransport(places, { startHour = 9 } = {}) {
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
        const leg = estimateLeg(prev, p);
        p.travelFromPrevMinutes =
          Number(p.travelFromPrevMinutes) > 0
            ? Number(p.travelFromPrevMinutes)
            : leg.travelFromPrevMinutes;
        p.travelFromPrevCost =
          Number.isFinite(Number(p.travelFromPrevCost)) &&
          Number(p.travelFromPrevCost) >= 0
            ? Number(p.travelFromPrevCost)
            : leg.travelFromPrevCost;
        minutesFromStart += p.travelFromPrevMinutes;
      } else {
        p.travelFromPrevMinutes = 0;
        p.travelFromPrevCost = 0;
      }

      if (!p.plannedTime || !/^\d{1,2}:\d{2}$/.test(String(p.plannedTime))) {
        const hh = Math.floor(minutesFromStart / 60) % 24;
        const mm = minutesFromStart % 60;
        p.plannedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      } else {
        const [h, m] = String(p.plannedTime).split(":").map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
          minutesFromStart = h * 60 + m;
        }
      }

      // 장소 체류 가정
      minutesFromStart +=
        p.category === "food" ? 60 : p.category === "hotel" ? 15 : 75;

      if (p.category === "hotel") {
        p.lodgingScore =
          Number(p.lodgingScore) > 0
            ? Number(p.lodgingScore)
            : lodgingRecommendScore(p);
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
