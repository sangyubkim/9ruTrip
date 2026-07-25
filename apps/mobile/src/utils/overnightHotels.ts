import type { ItineraryPlace, LodgingCandidate } from "../types";

/** 숙박 Day 인덱스 — 마지막 날·당일치기 제외 */
export function overnightDayIndexes(days: number, nights: number): number[] {
  const d = Math.max(1, Math.floor(Number(days) || 1));
  const n = Math.max(0, Math.floor(Number(nights) || 0));
  if (d <= 1 || n <= 0) return [];
  const count = Math.min(n, d - 1);
  return Array.from({ length: count }, (_, i) => i);
}

function isChainDeparturePlace(p: ItineraryPlace): boolean {
  if (p.category !== "hotel") return false;
  const notes = String(p.notes || "");
  return /전날|연결\s*출발|출발$/.test(notes) && !(Number(p.estimatedCost) > 0);
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 구 API/AI가 숙소를 빠뜨린 응답을 클라이언트에서 보정.
 * lodgingCandidates가 있을 때 마지막 날 제외 각 Day에 hotel을 넣는다.
 */
export function ensureOvernightHotelsInPlaces(
  places: ItineraryPlace[],
  opts: {
    days: number;
    nights: number;
    lodgingCandidates?: LodgingCandidate[];
    preferredLodgingId?: string | null;
    cityId?: string;
    /** 숙소 복귀 시각 HH:mm (기본 21:00) */
    lodgingReturnTime?: string;
  },
): ItineraryPlace[] {
  const overnight = overnightDayIndexes(opts.days, opts.nights);
  const list = Array.isArray(places) ? [...places] : [];
  const clearChainMorning = (p: ItineraryPlace): ItineraryPlace =>
    isChainDeparturePlace(p)
      ? {
          ...p,
          plannedTime: undefined,
          travelFromPrevMinutes: 0,
          travelFromPrevCost: 0,
          transportOptions: undefined,
          preferredTransportMode: undefined,
        }
      : p;

  if (!overnight.length) {
    // 체인 아침 출발에 전날 저녁 plannedTime이 남아 있으면 제거
    return list.map(clearChainMorning);
  }

  const pool = Array.isArray(opts.lodgingCandidates)
    ? opts.lodgingCandidates
    : [];
  const preferred =
    pool.find((c) => c.id === opts.preferredLodgingId) || pool[0];
  if (!preferred) return list.map(clearChainMorning);

  const nights = Math.max(0, Math.floor(Number(opts.nights) || 0));
  const perNight =
    nights > 0
      ? Math.round(Math.max(0, Number(preferred.estimatedCost) || 0) / nights)
      : Math.max(0, Number(preferred.estimatedCost) || 0);
  const returnHhmm =
    opts.lodgingReturnTime && /^\d{1,2}:\d{2}$/.test(opts.lodgingReturnTime)
      ? opts.lodgingReturnTime
      : "21:00";

  for (const d of overnight) {
    const hasStay = list.some(
      (p) =>
        Number(p.dayIndex) === d &&
        p.category === "hotel" &&
        !isChainDeparturePlace(p),
    );
    if (hasStay) continue;

    const dayOrders = list
      .filter((p) => Number(p.dayIndex) === d)
      .map((p) => Number(p.order) || 0);
    const nextOrder = dayOrders.length ? Math.max(...dayOrders) + 1 : 0;
    list.push({
      id: uid("hotel"),
      name: preferred.name,
      category: "hotel",
      lat: preferred.lat,
      lng: preferred.lng,
      estimatedCost: perNight,
      notes: preferred.notes || "숙소 복귀",
      dayIndex: d,
      order: nextOrder,
      cityId: opts.cityId,
      lodgingScore: preferred.lodgingScore,
      scoreBreakdown: preferred.scoreBreakdown,
      plannedTime: returnHhmm,
      breakfastIncluded:
        typeof preferred.breakfastIncluded === "boolean"
          ? preferred.breakfastIncluded
          : undefined,
      breakfastPricePerPerson:
        Number(preferred.breakfastPricePerPerson) > 0
          ? Number(preferred.breakfastPricePerPerson)
          : undefined,
      pricePerPerson:
        Number(preferred.pricePerPerson) > 0
          ? Math.round(Number(preferred.pricePerPerson))
          : undefined,
    });
  }

  // 숙박 Day의 hotel을 그날 끝으로
  const overnightSet = new Set(overnight);
  const byDay = new Map<number, ItineraryPlace[]>();
  for (const p of list) {
    const d = Number(p.dayIndex) || 0;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push({ ...p });
  }
  const out: ItineraryPlace[] = [];
  for (const d of [...byDay.keys()].sort((a, b) => a - b)) {
    const arr = byDay.get(d)!;
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (overnightSet.has(d)) {
      const hotels = arr.filter((p) => p.category === "hotel");
      const rest = arr.filter((p) => p.category !== "hotel");
      const stay = hotels.filter((p) => !isChainDeparturePlace(p));
      const chainMorning = hotels.filter((p) => isChainDeparturePlace(p));
      // 체인 아침 출발은 앞에 두고 plannedTime 비움; 저녁 숙소는 끝 + 복귀 시각
      const last = stay[stay.length - 1];
      const dayList = last
        ? [
            ...chainMorning.map(clearChainMorning),
            ...rest,
            { ...last, plannedTime: returnHhmm },
          ]
        : [...chainMorning.map(clearChainMorning), ...rest];
      dayList.forEach((p, i) => {
        p.order = i;
        p.dayIndex = d;
        out.push(p);
      });
    } else {
      arr.forEach((p, i) => {
        const next = isChainDeparturePlace(p)
          ? {
              ...p,
              plannedTime: undefined,
              travelFromPrevMinutes: 0,
              travelFromPrevCost: 0,
              transportOptions: undefined,
              preferredTransportMode: undefined,
            }
          : p;
        next.order = i;
        next.dayIndex = d;
        out.push(next);
      });
    }
  }
  out.forEach((p, i) => {
    p.order = i;
  });
  return out;
}
