import { isKnownCityId, resolveCity } from "./cities.mjs";

/** 점심 11:00–14:00 (목표 12:00), 저녁 18:00–20:00 (목표 18:30) */
export const MEAL_WINDOWS = {
  lunch: { startMin: 11 * 60, endMin: 14 * 60, preferMin: 12 * 60, label: "점심" },
  dinner: {
    startMin: 18 * 60,
    endMin: 20 * 60,
    preferMin: 18 * 60 + 30,
    label: "저녁",
  },
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hhmmToMinutes(value) {
  const m = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function minutesToHhmm(totalMinutes) {
  const normalized = ((Math.floor(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function isChainDepartureHotel(place) {
  if (!place || place.category !== "hotel") return false;
  const notes = String(place.notes || "");
  return /전날|연결\s*출발|출발$/.test(notes) && !(Number(place.estimatedCost) > 0);
}

function foodInWindow(dayPlaces, window) {
  return dayPlaces.some((place) => {
    if (place.category !== "food") return false;
    const mins = hhmmToMinutes(place.plannedTime);
    if (mins == null) return false;
    return mins >= window.startMin && mins <= window.endMin;
  });
}

function pickFoodCandidate({
  cityId,
  tourPool,
  usedNames,
  mealLabel,
}) {
  const city = resolveCity(isKnownCityId(cityId) ? cityId : "seoul");
  const pool = (tourPool?.food || []).filter((item) => {
    if (!item?.name) return false;
    if (usedNames.has(String(item.name).trim())) return false;
    if (item.cityId && cityId && item.cityId !== cityId) return false;
    return true;
  });
  const hit = pool[0];
  // food estimatedCost는 1인 가격 (itinerary partyCost에서 인원 곱)
  const mealCost = city.countryId === "jp" ? 3000 : 15000;
  if (hit) {
    return {
      id: hit.id || uid("meal"),
      name: hit.name,
      category: "food",
      lat: hit.lat,
      lng: hit.lng,
      cityId: hit.cityId || cityId,
      estimatedCost:
        Number(hit.estimatedCost) > 0 ? Number(hit.estimatedCost) : mealCost,
      notes: `${mealLabel} 식사`,
      dayIndex: 0,
      order: 0,
    };
  }
  return {
    id: uid("meal"),
    name: `${city.nameKo} ${mealLabel} 맛집`,
    category: "food",
    lat: city.center.lat,
    lng: city.center.lng,
    cityId,
    estimatedCost: mealCost,
    notes: `${mealLabel} 식사 · 일정 보강`,
    dayIndex: 0,
    order: 0,
  };
}

/**
 * insertIndex: 이 위치 앞에 삽입 (호텔 전 / 해당 시간대 위치)
 */
function findInsertIndex(dayPlaces, window) {
  const hotelIdx = dayPlaces.findIndex(
    (p) => p.category === "hotel" && !isChainDepartureHotel(p),
  );
  for (let i = 0; i < dayPlaces.length; i += 1) {
    const mins = hhmmToMinutes(dayPlaces[i].plannedTime);
    if (mins != null && mins > window.preferMin) return i;
  }
  if (hotelIdx >= 0) return hotelIdx;
  return dayPlaces.length;
}

/**
 * 각 Day에 점심(11–14)·저녁(18–20) 맛집이 있도록 보강.
 * startHour가 창을 지나면 해당 끼니는 생략.
 * 변경이 없으면 원본 places 참조를 그대로 반환한다.
 */
export function ensureDailyMealSlots(
  places,
  {
    days,
    startHour = 9,
    tourPool = { food: [] },
    partySize = 2,
    cities,
    cityId = "seoul",
  } = {},
) {
  if (!Array.isArray(places) || !places.length || !(Number(days) > 0)) {
    return Array.isArray(places) ? places : [];
  }

  // partySize는 호출부 API 호환용 (estimatedCost는 1인 단가)
  void partySize;

  const startMin = Math.max(0, Math.min(23, Number(startHour) || 9)) * 60;
  const usedNames = new Set(
    places.map((p) => String(p?.name || "").trim()).filter(Boolean),
  );
  let changed = false;
  const out = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const dayPlaces = places
      .filter((p) => (Number(p.dayIndex) || 0) === dayIndex)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!dayPlaces.length) continue;

    const dayCityId =
      (Array.isArray(cities) &&
        cities.find(
          (c) =>
            Array.isArray(c?.dayIndexes) && c.dayIndexes.includes(dayIndex),
        )?.cityId) ||
      dayPlaces.find((p) => isKnownCityId(p.cityId))?.cityId ||
      cityId;

    // 원본 불변 — 변경 시에만 out에 복사본을 쌓는다
    const working = dayPlaces.map((p) => ({ ...p }));
    const claimedLoose = new Set();
    const meals = [];
    if (startMin < MEAL_WINDOWS.lunch.endMin) {
      meals.push({ key: "lunch", window: MEAL_WINDOWS.lunch });
    }
    if (startMin < MEAL_WINDOWS.dinner.endMin) {
      meals.push({ key: "dinner", window: MEAL_WINDOWS.dinner });
    }

    for (const { key, window } of meals) {
      if (foodInWindow(working, window)) continue;

      // 시각 없는 food를 창에 맞춰 1회만 배정 (다른 끼니 라벨은 제외)
      const otherLabel = key === "lunch" ? "저녁" : "점심";
      const looseFood = working.find(
        (p) =>
          p.category === "food" &&
          !claimedLoose.has(p) &&
          hhmmToMinutes(p.plannedTime) == null &&
          !String(p.notes || "").includes(otherLabel),
      );
      if (looseFood) {
        claimedLoose.add(looseFood);
        looseFood.plannedTime = minutesToHhmm(window.preferMin);
        looseFood.notes = looseFood.notes
          ? `${looseFood.notes} · ${window.label} 식사`
          : `${window.label} 식사`;
        changed = true;
        continue;
      }

      const candidate = pickFoodCandidate({
        cityId: dayCityId,
        tourPool,
        usedNames,
        mealLabel: window.label,
      });
      usedNames.add(String(candidate.name).trim());
      candidate.dayIndex = dayIndex;
      candidate.plannedTime = minutesToHhmm(window.preferMin);
      const idx = findInsertIndex(working, window);
      working.splice(idx, 0, candidate);
      changed = true;
    }

    working.forEach((p, i) => {
      out.push({ ...p, dayIndex, order: i });
    });
  }

  // 변경 없음 → 원본 참조 유지 (불필요한 day rebuild / order 재부여 방지)
  if (!changed) return places;

  // days 범위 밖 장소는 유지
  for (const p of places) {
    const d = Number(p.dayIndex) || 0;
    if (d < 0 || d >= days) out.push({ ...p });
  }

  out.sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  out.forEach((p, i) => {
    p.order = i;
  });
  return out;
}
