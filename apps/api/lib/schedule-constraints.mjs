/**
 * 대규모 일정 변경(동선 최적화·재루트·Day 재생성) 공통 제약.
 *
 * 1. completedPlaceIds · Day0 여행 출발 카드 → 순서/시간 고정
 * 2. Day0: 출발 카드 유지 + 숙박 hotel 맨 끝
 *    Day1+(dayIndex>=1): 체인 아침 hotel 시작 + 숙박 hotel 끝
 * 3. food 1곳 → 점심 11–14만 / food 2곳+ → 점심+저녁(18–20) 각 1
 */

import { isOriginDeparturePlace } from "./transport.mjs";
import { MEAL_WINDOWS } from "./meal-slots.mjs";

/** 체인 아침 출발 hotel — 저녁 숙박으로 치지 않음 (itinerary.isChainDeparturePlace 와 동일) */
export function isChainDepartureHotel(place) {
  if (!place || place.category !== "hotel") return false;
  const notes = String(place.notes || "");
  return (
    /전날|연결\s*출발|출발$/.test(notes) && !(Number(place.estimatedCost) > 0)
  );
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
  const normalized =
    ((Math.floor(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function assignFoodWindow(place, window) {
  place.plannedTime = minutesToHhmm(window.preferMin);
  const notes = String(place.notes || "");
  // 반대 끼니 라벨 제거 후 현재 라벨 부여
  let cleaned = notes
    .replace(/\s*·\s*점심\s*식사/g, "")
    .replace(/\s*·\s*저녁\s*식사/g, "")
    .replace(/점심\s*식사/g, "")
    .replace(/저녁\s*식사/g, "")
    .trim();
  place.notes = cleaned
    ? `${cleaned} · ${window.label} 식사`
    : `${window.label} 식사`;
}

export function completedIdSet(ids) {
  return new Set((Array.isArray(ids) ? ids : []).map(String));
}

/** 완료 장소 + 여행 출발 카드는 재배치·삭제 대상에서 제외 */
export function isScheduleLockedPlace(place, completedIds) {
  if (!place) return false;
  const set =
    completedIds instanceof Set ? completedIds : completedIdSet(completedIds);
  if (set.has(String(place.id))) return true;
  if (isOriginDeparturePlace(place)) return true;
  return false;
}

/**
 * 당일 장소를 locked / morningHotels / movable / stayHotels 로 분리.
 */
export function splitDayPlacesForReorder(dayPlaces, completedPlaceIds = []) {
  const completedIds = completedIdSet(completedPlaceIds);
  const sorted = [...(Array.isArray(dayPlaces) ? dayPlaces : [])].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  const locked = [];
  const morningHotels = [];
  const movable = [];
  const stayHotels = [];
  for (const p of sorted) {
    if (isScheduleLockedPlace(p, completedIds)) {
      locked.push(p);
    } else if (isChainDepartureHotel(p)) {
      morningHotels.push(p);
    } else if (p.category === "hotel") {
      stayHotels.push(p);
    } else {
      movable.push(p);
    }
  }
  return { locked, morningHotels, movable, stayHotels, completedIds };
}

/**
 * locked → (Day1+ 이면 morningHotels) → movable → stayHotels
 */
export function mergeConstrainedDayOrder(
  locked,
  movableOrdered,
  stayHotels,
  { morningHotels = [], dayIndex = 0 } = {},
) {
  const morning =
    Number(dayIndex) >= 1 && Array.isArray(morningHotels) ? morningHotels : [];
  // Day0 체인 hotel 은 드묾 — stay가 아니면 mid에 두기 위해 movable 앞에 붙이지 않음
  const day0Morning =
    Number(dayIndex) < 1 && Array.isArray(morningHotels) ? morningHotels : [];
  return [
    ...(Array.isArray(locked) ? locked : []),
    ...morning,
    ...(Array.isArray(movableOrdered) ? movableOrdered : []),
    ...day0Morning,
    ...(Array.isArray(stayHotels) ? stayHotels : []),
  ];
}

/**
 * Day0: locked·일반 유지 + stay hotel 맨 끝 (출발 카드는 locked).
 * Day1+: locked → 체인 아침 hotel → 중간 → stay hotel.
 */
export function ensureHotelBookends(
  dayPlaces,
  { dayIndex = 0, completedPlaceIds = [] } = {},
) {
  const completedIds = completedIdSet(completedPlaceIds);
  const sorted = [...(Array.isArray(dayPlaces) ? dayPlaces : [])].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  const locked = [];
  const morning = [];
  const stay = [];
  const mid = [];
  for (const p of sorted) {
    if (isScheduleLockedPlace(p, completedIds)) locked.push(p);
    else if (isChainDepartureHotel(p)) morning.push(p);
    else if (p.category === "hotel") stay.push(p);
    else mid.push(p);
  }
  if (Number(dayIndex) >= 1) {
    return [...locked, ...morning, ...mid, ...stay];
  }
  return [...locked, ...mid, ...morning, ...stay];
}

/** @deprecated use ensureHotelBookends — stay hotel 맨 끝 */
export function moveStayHotelsToDayEnd(dayPlaces) {
  return ensureHotelBookends(dayPlaces, { dayIndex: 0 });
}

function foodInWindow(place, window) {
  if (!place || place.category !== "food") return false;
  const mins = hhmmToMinutes(place.plannedTime);
  if (mins == null) return false;
  return mins >= window.startMin && mins <= window.endMin;
}

/**
 * 잠금되지 않은 food plannedTime 배정.
 * - 1곳: 점심(11–14)만
 * - 2곳 이상: 1곳 점심, 1곳 저녁(18–20)
 * 새 food 를 삽입하지 않는다.
 */
export function snapUnlockedFoodToMealWindows(
  dayPlaces,
  { completedPlaceIds = [], startHour = 9 } = {},
) {
  const completedIds = completedIdSet(completedPlaceIds);
  const startMin = Math.max(0, Math.min(23, Number(startHour) || 9)) * 60;
  const working = (Array.isArray(dayPlaces) ? dayPlaces : []).map((p) => ({
    ...p,
  }));

  const lunchOk = startMin < MEAL_WINDOWS.lunch.endMin;
  const dinnerOk = startMin < MEAL_WINDOWS.dinner.endMin;

  const foods = working.filter(
    (p) => p.category === "food" && !isScheduleLockedPlace(p, completedIds),
  );
  if (!foods.length || !lunchOk) return working;

  if (foods.length === 1) {
    assignFoodWindow(foods[0], MEAL_WINDOWS.lunch);
    return working;
  }

  // 2곳 이상: 점심 1 + 저녁 1
  const claimed = new Set();
  let lunchFood =
    foods.find((p) => foodInWindow(p, MEAL_WINDOWS.lunch)) || null;
  if (lunchFood) claimed.add(lunchFood);
  else {
    lunchFood =
      foods.find((p) => hhmmToMinutes(p.plannedTime) == null) || foods[0];
    assignFoodWindow(lunchFood, MEAL_WINDOWS.lunch);
    claimed.add(lunchFood);
  }

  if (dinnerOk) {
    let dinnerFood =
      foods.find(
        (p) => !claimed.has(p) && foodInWindow(p, MEAL_WINDOWS.dinner),
      ) || null;
    if (!dinnerFood) {
      dinnerFood =
        foods.find(
          (p) => !claimed.has(p) && hhmmToMinutes(p.plannedTime) == null,
        ) || foods.find((p) => !claimed.has(p));
      if (dinnerFood) {
        assignFoodWindow(dinnerFood, MEAL_WINDOWS.dinner);
      }
    }
  }

  return working;
}

/**
 * 해당 day: hotel 북엔드 + food 창 스냅 (기존 food만, 삽입 없음).
 */
export function applyMajorSchedulePostConstraints(
  places,
  {
    dayIndex = 0,
    days,
    startHour = 9,
    completedPlaceIds = [],
  } = {},
) {
  if (!Array.isArray(places) || !places.length) {
    return Array.isArray(places) ? places : [];
  }

  const day = Math.max(0, Number(dayIndex) || 0);
  void days;

  const others = places.filter((p) => Number(p.dayIndex) !== day);
  const dayPlaces = places
    .filter((p) => Number(p.dayIndex) === day)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  const withHotels = ensureHotelBookends(dayPlaces, {
    dayIndex: day,
    completedPlaceIds,
  });
  const withFoodTimes = snapUnlockedFoodToMealWindows(withHotels, {
    completedPlaceIds,
    startHour,
  });

  const renumbered = withFoodTimes.map((p, i) => ({
    ...p,
    dayIndex: day,
    order: i,
  }));
  const merged = [...others, ...renumbered].sort(
    (a, b) =>
      (Number(a.dayIndex) || 0) - (Number(b.dayIndex) || 0) ||
      (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  merged.forEach((p, i) => {
    p.order = i;
  });
  return merged;
}
