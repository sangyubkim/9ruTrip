import { resolveCity } from "./cities.mjs";

const PREF_LABELS = [
  { key: "food", label: "맛집" },
  { key: "attraction", label: "명소" },
  { key: "activity", label: "액티비티" },
  { key: "cost", label: "비용" },
  { key: "minTravel", label: "최소 이동" },
];

/** 일정 생성 시 실제로 적용되는 규칙 한줄 */
export const DEFAULT_SCHEDULE_RULE =
  "식사 11–14시·18–20시 · 명소·식당 체류 약 1시간 · 이동은 차량 기준 반영";

/**
 * generateItinerary 입력·결과로 브리핑용 구조화 메타를 만든다.
 * AI 서술(briefing)과 별도로, 요청·축제·관광공사 코스 반영 여부를 명확히 보여준다.
 */
export function buildRouteBriefing(input = {}) {
  const {
    originLabel,
    endLabel,
    cityIds = [],
    cities,
    nights,
    days,
    routeOutline: outlineIn,
    mainRequest,
    extraRequest,
    userRequest,
    preferences,
    preferredFestivals = [],
    seedCourse,
    outboundTransportMode,
    scheduleRule,
  } = input;

  const cityNames = (Array.isArray(cityIds) ? cityIds : [])
    .map((id) => {
      try {
        return resolveCity(id)?.nameKo || String(id);
      } catch {
        return String(id);
      }
    })
    .filter(Boolean);

  const routeParts = [
    originLabel || null,
    ...cityNames,
    endLabel && endLabel !== originLabel ? endLabel : null,
  ].filter(Boolean);
  const routeSummary =
    String(outlineIn || "").trim() ||
    (routeParts.length ? routeParts.join(" → ") : cityNames.join(" · ") || "");

  const dayAssignments = formatDayAssignments(cities, cityNames, days);

  const main =
    String(mainRequest || userRequest || "").trim() || undefined;
  const extra = String(extraRequest || "").trim() || undefined;
  const preferenceChips = formatPreferenceChips(preferences);

  const festivals = (Array.isArray(preferredFestivals) ? preferredFestivals : [])
    .filter((f) => f && String(f.name || "").trim())
    .slice(0, 8)
    .map((f) => {
      const cityId = f.cityId ? String(f.cityId) : undefined;
      let cityName = f.cityName ? String(f.cityName) : undefined;
      if (!cityName && cityId) {
        try {
          cityName = resolveCity(cityId)?.nameKo;
        } catch {
          /* ignore */
        }
      }
      return {
        name: String(f.name).trim().slice(0, 80),
        ...(cityId ? { cityId } : {}),
        ...(cityName ? { cityName } : {}),
        ...(f.startDate ? { startDate: String(f.startDate) } : {}),
        ...(f.endDate ? { endDate: String(f.endDate) } : {}),
      };
    });

  const course = seedCourse?.title
    ? {
        title: String(seedCourse.title).slice(0, 120),
        source: String(seedCourse.source || "한국관광공사"),
        stopCount: Number.isFinite(Number(seedCourse.stopCount))
          ? Number(seedCourse.stopCount)
          : Array.isArray(seedCourse.waypoints)
            ? seedCourse.waypoints.length
            : undefined,
        ...(seedCourse.routeSummary
          ? { routeSummary: String(seedCourse.routeSummary).slice(0, 200) }
          : {}),
        usedAsSeed: true,
      }
    : null;

  const nightsN = Number.isFinite(Number(nights)) ? Number(nights) : undefined;
  const daysN = Number.isFinite(Number(days)) ? Number(days) : undefined;
  const durationLabel =
    nightsN != null && daysN != null
      ? `${nightsN}박 ${daysN}일`
      : daysN != null
        ? `${daysN}일`
        : undefined;

  const modeLabel = outboundModeLabel(outboundTransportMode);
  const rule =
    String(scheduleRule || "").trim() ||
    DEFAULT_SCHEDULE_RULE +
      (modeLabel ? ` · 출발 이동 ${modeLabel}` : "");

  return {
    routeSummary,
    ...(dayAssignments ? { dayAssignments } : {}),
    ...(durationLabel ? { durationLabel } : {}),
    requests: {
      ...(main ? { mainRequest: main.slice(0, 800) } : {}),
      ...(extra ? { extraRequest: extra.slice(0, 800) } : {}),
      ...(preferenceChips.length ? { preferences: preferenceChips } : {}),
      reflected: Boolean(main || extra || preferenceChips.length),
    },
    festivals,
    festivalsReflected: festivals.length > 0,
    seedCourse: course,
    courseReflected: Boolean(course),
    scheduleRule: rule,
  };
}

function formatDayAssignments(cities, cityNames, days) {
  if (Array.isArray(cities) && cities.length > 0) {
    return cities
      .map((c) => {
        const name = c.cityName || c.cityId;
        const idxs = Array.isArray(c.dayIndexes) ? c.dayIndexes : [];
        if (!idxs.length) return String(name);
        const dayLabel = idxs.map((d) => `Day ${Number(d) + 1}`).join(",");
        return `${name} ${idxs.length}일 (${dayLabel})`;
      })
      .join(" · ");
  }
  if (cityNames.length && Number.isFinite(Number(days))) {
    return `${cityNames.join(" · ")} ${days}일`;
  }
  return undefined;
}

function formatPreferenceChips(preferences) {
  if (!preferences || typeof preferences !== "object") return [];
  return PREF_LABELS.map(({ key, label }) => {
    const raw = Number(preferences[key]);
    if (!Number.isFinite(raw)) return null;
    return { key, label, value: Math.min(5, Math.max(1, Math.round(raw))) };
  }).filter(Boolean);
}

function outboundModeLabel(mode) {
  const map = {
    car: "자차",
    train: "기차",
    bus: "버스",
    flight: "비행기",
  };
  const key = String(mode || "").trim();
  return map[key] || undefined;
}
